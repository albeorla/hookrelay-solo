/* eslint-disable @typescript-eslint/no-unused-vars */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "~/server/api/trpc";
import {
  ScanCommand,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { GetQueueAttributesCommand } from "@aws-sdk/client-sqs";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import {
  dynamoDb,
  s3,
  sqs,
  ENDPOINTS_TABLE,
  QUEUE_URL,
  DLQ_BUCKET,
} from "./common";

export const systemProcedures = {
  getSystemSettings: protectedProcedure.query(async ({ ctx }) => {
    try {
      const result = await dynamoDb.send(
        new GetItemCommand({
          TableName: ENDPOINTS_TABLE,
          Key: { endpoint_id: { S: "__system_settings__" } },
        }),
      );
      if (!result.Item) return null;
      return JSON.parse(result.Item.settings?.S ?? "{}") as unknown;
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get system settings",
      });
    }
  }),

  updateSystemSettings: protectedProcedure
    .input(
      z.object({
        defaultTimeout: z.number().min(5).max(120),
        defaultMaxRetries: z.number().min(0).max(10),
        defaultRetryBackoff: z.enum(["linear", "exponential", "constant"]),
        requireHmacVerification: z.boolean(),
        allowedIpRanges: z.array(z.string()),
        rateLimitEnabled: z.boolean(),
        rateLimitRps: z.number().min(1).max(1000),
        monitoringEnabled: z.boolean(),
        alertOnFailureRate: z.boolean(),
        failureRateThreshold: z.number().min(1).max(50),
        alertOnQueueDepth: z.boolean(),
        queueDepthThreshold: z.number().min(100).max(10000),
        notificationChannels: z.array(z.string()),
        concurrentDeliveries: z.number().min(1).max(100),
        batchSize: z.number().min(10).max(500),
        dlqRetentionDays: z.number().min(1).max(365),
        logRetentionDays: z.number().min(7).max(365),
        enableWebhookSignatures: z.boolean(),
        customHeaders: z.record(z.string(), z.string()),
        debugMode: z.boolean(),
        enableMetrics: z.boolean(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        await dynamoDb.send(
          new PutItemCommand({
            TableName: ENDPOINTS_TABLE,
            Item: {
              endpoint_id: { S: "__system_settings__" },
              settings: { S: JSON.stringify(input) },
              created_at: { N: String(Date.now()) },
              updated_at: { N: String(Date.now()) },
              updated_by: { S: ctx.session.user.id },
            },
          }),
        );
        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update system settings",
        });
      }
    }),

  testSystemConnection: protectedProcedure.mutation(async () => {
    try {
      const tests: Array<{ service: string; status: string; error?: string }> =
        [];
      try {
        await dynamoDb.send(
          new ScanCommand({ TableName: ENDPOINTS_TABLE, Limit: 1 }),
        );
        tests.push({ service: "DynamoDB", status: "success" });
      } catch (error) {
        tests.push({
          service: "DynamoDB",
          status: "failed",
          error: String(error),
        });
      }
      try {
        await sqs.send(
          new GetQueueAttributesCommand({
            QueueUrl: QUEUE_URL,
            AttributeNames: ["ApproximateNumberOfMessages"],
          }),
        );
        tests.push({ service: "SQS", status: "success" });
      } catch (error) {
        tests.push({ service: "SQS", status: "failed", error: String(error) });
      }
      try {
        await s3.send(
          new ListObjectsV2Command({ Bucket: DLQ_BUCKET, MaxKeys: 1 }),
        );
        tests.push({ service: "S3", status: "success" });
      } catch (error) {
        tests.push({ service: "S3", status: "failed", error: String(error) });
      }
      const allSuccessful = tests.every((t) => t.status === "success");
      const failedTests = tests.filter((t) => t.status === "failed");
      return {
        success: allSuccessful,
        tests,
        error:
          failedTests.length > 0
            ? `Failed services: ${failedTests.map((t) => t.service).join(", ")}`
            : undefined,
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to test system connection",
      });
    }
  }),
};
