/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";
import { protectedProcedure } from "~/server/api/trpc";
import {
  ScanCommand,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";
import { dynamoDb, ENDPOINTS_TABLE } from "./common";

export const endpointsProcedures = {
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
          isActive: item.is_active?.BOOL ?? true,
          deliveryCount: 0,
          method: "POST" as const,
          timeout: item.timeout_seconds?.N
            ? Number(item.timeout_seconds.N)
            : 30,
          maxRetries: item.max_retries?.N ? Number(item.max_retries.N) : 3,
          // Keep original fields in case other parts rely on them
          endpointId: item.endpoint_id?.S ?? "",
          destUrl: item.dest_url?.S ?? "",
          hmacMode: item.hmac_mode?.S ?? null,
          hasSecret: Boolean(item.secret?.S),
          description: item.description?.S ?? null,
        })) ?? [];

      return endpoints;
    } catch {
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
          isActive: result.Item.is_active?.BOOL ?? true,
          deliveryCount: 0,
          method: "POST" as const,
          timeout: result.Item.timeout_seconds?.N
            ? Number(result.Item.timeout_seconds.N)
            : 30,
          maxRetries: result.Item.max_retries?.N
            ? Number(result.Item.max_retries.N)
            : 3,
          endpointId: result.Item.endpoint_id?.S ?? "",
          destUrl: result.Item.dest_url?.S ?? "",
          hmacMode: result.Item.hmac_mode?.S ?? null,
          hasSecret: Boolean(result.Item.secret?.S),
          description: result.Item.description?.S ?? null,
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
        description: z.string().max(500).optional(),
        isActive: z.boolean().optional(),
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
        if (input.description) {
          item.description = { S: input.description };
        }
        if (typeof input.isActive === "boolean") {
          item.is_active = { BOOL: input.isActive };
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
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete webhook endpoint",
        });
      }
    }),

  // Update endpoint
  updateEndpoint: protectedProcedure
    .input(
      z.object({
        endpointId: z.string(),
        destUrl: z.string().url().optional(),
        hmacMode: z.enum(["stripe", "github", "generic"]).optional(),
        secret: z.string().optional(),
        isActive: z.boolean().optional(),
        timeout: z.number().min(1).max(300).optional(),
        maxRetries: z.number().min(0).max(10).optional(),
        description: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const updateExpression = [] as string[];
        const expressionAttributeValues: Record<string, any> = {};

        if (input.destUrl) {
          updateExpression.push("dest_url = :destUrl");
          expressionAttributeValues[":destUrl"] = { S: input.destUrl };
        }

        if (input.hmacMode) {
          updateExpression.push("hmac_mode = :hmacMode");
          expressionAttributeValues[":hmacMode"] = { S: input.hmacMode };
        }

        if (input.secret) {
          updateExpression.push("secret = :secret");
          expressionAttributeValues[":secret"] = { S: input.secret };
        }

        if (input.isActive !== undefined) {
          updateExpression.push("is_active = :isActive");
          expressionAttributeValues[":isActive"] = { BOOL: input.isActive };
        }

        if (input.timeout) {
          updateExpression.push("timeout_seconds = :timeout");
          expressionAttributeValues[":timeout"] = { N: String(input.timeout) };
        }

        if (input.maxRetries !== undefined) {
          updateExpression.push("max_retries = :maxRetries");
          expressionAttributeValues[":maxRetries"] = {
            N: String(input.maxRetries),
          };
        }

        if (input.description !== undefined) {
          updateExpression.push("description = :description");
          expressionAttributeValues[":description"] = { S: input.description };
        }

        if (updateExpression.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No fields to update",
          });
        }

        await dynamoDb.send(
          new UpdateItemCommand({
            TableName: ENDPOINTS_TABLE,
            Key: { endpoint_id: { S: input.endpointId } },
            UpdateExpression: "SET " + updateExpression.join(", "),
            ExpressionAttributeValues: expressionAttributeValues,
            ConditionExpression: "attribute_exists(endpoint_id)",
          }),
        );

        return { success: true };
      } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Webhook endpoint not found",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update webhook endpoint",
        });
      }
    }),

  // Generate HMAC secret
  generateHmacSecret: protectedProcedure
    .input(z.object({ endpointId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const secret = crypto.randomBytes(32).toString("hex");

        await dynamoDb.send(
          new UpdateItemCommand({
            TableName: ENDPOINTS_TABLE,
            Key: { endpoint_id: { S: input.endpointId } },
            UpdateExpression: "SET secret = :secret, updated_at = :updatedAt",
            ExpressionAttributeValues: {
              ":secret": { S: secret },
              ":updatedAt": { N: String(Date.now()) },
            },
            ConditionExpression: "attribute_exists(endpoint_id)",
          }),
        );

        return { secret };
      } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Webhook endpoint not found",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate HMAC secret",
        });
      }
    }),

  // Test webhook endpoint
  testEndpoint: protectedProcedure
    .input(
      z.object({
        endpointId: z.string(),
        payload: z.string().optional(),
        headers: z.record(z.string(), z.string()).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        // Get endpoint configuration
        const endpointResult = await dynamoDb.send(
          new GetItemCommand({
            TableName: ENDPOINTS_TABLE,
            Key: { endpoint_id: { S: input.endpointId } },
          }),
        );

        if (!endpointResult.Item) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Webhook endpoint not found",
          });
        }

        const endpoint = endpointResult.Item;
        const destUrl = endpoint.dest_url?.S;

        if (!destUrl) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Endpoint has no destination URL",
          });
        }

        // Use provided payload or default test payload
        const testPayload =
          input.payload ??
          JSON.stringify({
            test: true,
            timestamp: Date.now(),
            endpoint_id: input.endpointId,
            message: "This is a test webhook from HookRelay",
          });

        // Send test webhook
        const startTime = Date.now();
        try {
          const response = await fetch(destUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "HookRelay-Test/1.0",
              ...input.headers,
            },
            body: testPayload,
          });

          const endTime = Date.now();
          const responseBody = await response.text();

          return {
            success: response.ok,
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: responseBody,
            duration: endTime - startTime,
            url: destUrl,
          };
        } catch (error) {
          const endTime = Date.now();
          return {
            success: false,
            status: 0,
            statusText: "Network Error",
            headers: {},
            body: String(error),
            duration: endTime - startTime,
            url: destUrl,
            error: String(error),
          };
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to test webhook endpoint",
        });
      }
    }),
};
