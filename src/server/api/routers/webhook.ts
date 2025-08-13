/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { z } from "zod";
import {
  DynamoDBClient,
  ScanCommand,
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";
import { SQSClient, GetQueueAttributesCommand } from "@aws-sdk/client-sqs";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

// Initialize AWS clients for LocalStack
const dynamoDb = new DynamoDBClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  endpoint: process.env.AWS_DDB_ENDPOINT ?? "http://localhost:4566",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test",
  },
});

const sqs = new SQSClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  endpoint: process.env.AWS_SQS_ENDPOINT ?? "http://localhost:4566",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test",
  },
});

const ENDPOINTS_TABLE = "hookrelay-endpoints";
const DELIVERIES_TABLE = "hookrelay-deliveries";
const QUEUE_URL =
  "http://localhost:4566/000000000000/hookrelay-delivery-attempts";

export const webhookRouter = createTRPCRouter({
  // Get all webhook endpoints
  getEndpoints: protectedProcedure.query(async () => {
    try {
      const result = await dynamoDb.send(
        new ScanCommand({
          TableName: ENDPOINTS_TABLE,
        }),
      );

      const endpoints =
        result.Items?.map((item: any) => ({
          id: item.endpoint_id?.S ?? "",
          name: item.endpoint_id?.S ?? "",
          url: item.dest_url?.S ?? "",
          isActive: true,
          deliveryCount: 0,
          method: "POST" as const,
          timeout: 30,
          maxRetries: 3,
          // Keep original fields in case other parts rely on them
          endpointId: item.endpoint_id?.S ?? "",
          destUrl: item.dest_url?.S ?? "",
          hmacMode: item.hmac_mode?.S ?? null,
          hasSecret: Boolean(item.secret?.S),
        })) ?? [];

      return endpoints;
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch webhook endpoints",
      });
    }
  }),

  // Get endpoint details
  getEndpoint: protectedProcedure
    .input(z.object({ endpointId: z.string() }))
    .query(async ({ input }) => {
      try {
        const result = await dynamoDb.send(
          new GetItemCommand({
            TableName: ENDPOINTS_TABLE,
            Key: { endpoint_id: { S: input.endpointId } },
          }),
        );

        if (!result.Item) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Webhook endpoint not found",
          });
        }

        return {
          id: result.Item.endpoint_id?.S ?? "",
          name: result.Item.endpoint_id?.S ?? "",
          url: result.Item.dest_url?.S ?? "",
          isActive: true,
          deliveryCount: 0,
          method: "POST" as const,
          timeout: 30,
          maxRetries: 3,
          endpointId: result.Item.endpoint_id?.S ?? "",
          destUrl: result.Item.dest_url?.S ?? "",
          hmacMode: result.Item.hmac_mode?.S ?? null,
          hasSecret: Boolean(result.Item.secret?.S),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch webhook endpoint",
        });
      }
    }),

  // Create new webhook endpoint
  createEndpoint: protectedProcedure
    .input(
      z.object({
        endpointId: z.string().min(1),
        destUrl: z.string().url(),
        hmacMode: z.enum(["stripe", "github", "generic"]).optional(),
        secret: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const item: Record<string, any> = {
          endpoint_id: { S: input.endpointId },
          dest_url: { S: input.destUrl },
        };

        if (input.hmacMode) {
          item.hmac_mode = { S: input.hmacMode };
        }
        if (input.secret) {
          item.secret = { S: input.secret };
        }

        await dynamoDb.send(
          new PutItemCommand({
            TableName: ENDPOINTS_TABLE,
            Item: item,
            ConditionExpression: "attribute_not_exists(endpoint_id)",
          }),
        );

        return { success: true };
      } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Webhook endpoint already exists",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create webhook endpoint",
        });
      }
    }),

  // Delete webhook endpoint
  deleteEndpoint: protectedProcedure
    .input(z.object({ endpointId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        await dynamoDb.send(
          new DeleteItemCommand({
            TableName: ENDPOINTS_TABLE,
            Key: { endpoint_id: { S: input.endpointId } },
          }),
        );

        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete webhook endpoint",
        });
      }
    }),

  // Get webhook delivery stats
  getStats: protectedProcedure.query(async () => {
    try {
      // Get queue stats
      const queueStats = await sqs.send(
        new GetQueueAttributesCommand({
          QueueUrl: QUEUE_URL,
          AttributeNames: ["All"],
        }),
      );

      // Get total endpoints
      const endpointsResult = await dynamoDb.send(
        new ScanCommand({
          TableName: ENDPOINTS_TABLE,
          Select: "COUNT",
        }),
      );

      // Get recent deliveries
      const deliveriesResult = await dynamoDb.send(
        new ScanCommand({
          TableName: DELIVERIES_TABLE,
          Limit: 100,
        }),
      );

      const deliveries =
        deliveriesResult.Items?.map((item: any) => ({
          endpointId: item.endpoint_id?.S ?? "",
          id: item.delivery_id?.S ?? "",
          status: item.status?.S ?? "unknown",
          timestamp: item.timestamp?.N ? parseInt(item.timestamp.N) : 0,
        })) ?? [];

      const totalDeliveries = deliveriesResult.Count ?? 0;
      const successCount = deliveries.filter(
        (d) => d.status === "success",
      ).length;
      const successRate =
        totalDeliveries > 0
          ? Math.round((successCount / totalDeliveries) * 100)
          : 0;

      return {
        totalDeliveries,
        successRate,
        endpoints: {
          total: endpointsResult.Count ?? 0,
        },
        queue: {
          approximate: parseInt(
            queueStats.Attributes?.ApproximateNumberOfMessages ?? "0",
          ),
          delayed: parseInt(
            queueStats.Attributes?.ApproximateNumberOfMessagesDelayed ?? "0",
          ),
          notVisible: parseInt(
            queueStats.Attributes?.ApproximateNumberOfMessagesNotVisible ?? "0",
          ),
        },
        deliveries: {
          recent: deliveries.slice(0, 10),
          total: totalDeliveries,
        },
      };
    } catch {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch webhook stats",
      });
    }
  }),

  // Get recent delivery logs (for real-time feed)
  getRecentDeliveries: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ input }) => {
      try {
        const result = await dynamoDb.send(
          new ScanCommand({
            TableName: DELIVERIES_TABLE,
            Limit: input.limit,
          }),
        );

        const deliveries =
          result.Items?.map((item: any) => ({
            endpointId: item.endpoint_id?.S ?? "",
            id: item.delivery_id?.S ?? "",
            status: item.status?.S ?? "pending",
            timestamp: item.timestamp?.N
              ? parseInt(item.timestamp.N)
              : Date.now(),
            destUrl: item.dest_url?.S ?? "",
            attempt: item.attempt?.N ? parseInt(item.attempt.N) : 1,
            error: item.error?.S ?? null,
          })) ?? [];

        // Sort by timestamp descending (newest first)
        deliveries.sort((a: any, b: any) => b.timestamp - a.timestamp);

        return deliveries;
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch recent deliveries",
        });
      }
    }),
});
