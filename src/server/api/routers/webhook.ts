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
  UpdateItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import {
  SQSClient,
  GetQueueAttributesCommand,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";
import {
  getDynamoDBConfig,
  getSQSConfig,
  getS3Config,
  AWS_RESOURCES,
  validateAWSConfig,
  logAWSConfig,
} from "~/config/aws";

// Validate AWS configuration on startup
const configValidation = validateAWSConfig();
if (!configValidation.isValid) {
  console.error("AWS Configuration Errors:", configValidation.errors);
  throw new Error("Invalid AWS configuration. Check environment variables.");
}

// Log current configuration (without sensitive data)
logAWSConfig();

// Helper function to format data as CSV
function formatAsCSV(data: any[], columns: string[]): string {
  if (data.length === 0) return "";

  // Create header row
  const header = columns.join(",");

  // Create data rows
  const rows = data.map((row) => {
    return columns
      .map((col) => {
        const value = row[col];
        if (value === null || value === undefined) return "";

        // Handle JSON objects and arrays
        if (typeof value === "object") {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }

        // Escape quotes and wrap in quotes if contains comma, newline, or quote
        const stringValue = String(value);
        if (
          stringValue.includes(",") ||
          stringValue.includes("\n") ||
          stringValue.includes('"')
        ) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }

        return stringValue;
      })
      .join(",");
  });

  return [header, ...rows].join("\n");
}

// Initialize AWS clients with environment-specific configuration
const dynamoDb = new DynamoDBClient(getDynamoDBConfig());
const sqs = new SQSClient(getSQSConfig());
const s3 = new S3Client(getS3Config());

// Use configured resource names
const ENDPOINTS_TABLE = AWS_RESOURCES.ENDPOINTS_TABLE;
const DELIVERIES_TABLE = AWS_RESOURCES.DELIVERIES_TABLE;
const QUEUE_URL = AWS_RESOURCES.QUEUE_URL;
const DLQ_BUCKET = AWS_RESOURCES.DLQ_BUCKET;

// Delivery status types
type DeliveryStatus = "pending" | "success" | "failed" | "retrying";

// Enhanced delivery record structure
interface DeliveryRecord {
  endpoint_id: string;
  delivery_id: string;
  status: DeliveryStatus;
  timestamp: number;
  dest_url: string;
  attempt: number;
  request_headers?: Record<string, string>;
  request_body?: string;
  response_status?: number;
  response_headers?: Record<string, string>;
  response_body?: string;
  duration_ms?: number;
  error?: string;
  retry_at?: number;
}

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
          failed: deliveries.filter((d) => d.status === "failed").length,
          pending: deliveries.filter((d) => d.status === "pending").length,
          retrying: deliveries.filter((d) => d.status === "retrying").length,
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
            responseStatus: item.response_status?.N
              ? parseInt(item.response_status.N)
              : null,
            durationMs: item.duration_ms?.N
              ? parseInt(item.duration_ms.N)
              : null,
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
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const updateExpression = [];
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

  // Get delivery logs with filtering and pagination
  getDeliveryLogs: protectedProcedure
    .input(
      z.object({
        endpointId: z.string().optional(),
        status: z.enum(["pending", "success", "failed", "retrying"]).optional(),
        limit: z.number().min(1).max(100).default(20),
        startKey: z
          .object({
            endpoint_id: z.string(),
            delivery_id: z.string(),
          })
          .optional(),
        fromTimestamp: z.number().optional(),
        toTimestamp: z.number().optional(),
        search: z.string().optional(),
        // Advanced filters
        advancedFilters: z
          .object({
            // Date & Time Filters
            dateRange: z
              .object({
                start: z.string(),
                end: z.string(),
                enabled: z.boolean(),
              })
              .optional(),
            timeRange: z
              .object({
                startTime: z.string(),
                endTime: z.string(),
                enabled: z.boolean(),
              })
              .optional(),
            // Status & Response Filters
            httpStatusCodes: z
              .object({
                ranges: z.array(z.string()),
                specific: z.array(z.number()),
                exclude: z.array(z.number()),
                enabled: z.boolean(),
              })
              .optional(),
            deliveryStatus: z
              .object({
                include: z.array(z.string()),
                exclude: z.array(z.string()),
              })
              .optional(),
            // Performance Filters
            duration: z
              .object({
                min: z.number(),
                max: z.number(),
                enabled: z.boolean(),
              })
              .optional(),
            attemptCount: z
              .object({
                min: z.number(),
                max: z.number(),
                enabled: z.boolean(),
              })
              .optional(),
            // Content Filters
            payloadSize: z
              .object({
                min: z.number(),
                max: z.number(),
                enabled: z.boolean(),
              })
              .optional(),
            contentType: z
              .object({
                include: z.array(z.string()),
                exclude: z.array(z.string()),
                enabled: z.boolean(),
              })
              .optional(),
            // Error Filters
            hasErrors: z.boolean().nullable().optional(),
            errorPatterns: z
              .object({
                patterns: z.array(z.string()),
                caseSensitive: z.boolean(),
                enabled: z.boolean(),
              })
              .optional(),
          })
          .optional(),
      }),
    )
    .query(async ({ input }) => {
      try {
        let command: ScanCommand | QueryCommand;

        if (input.endpointId) {
          // Query specific endpoint
          const queryParams: any = {
            TableName: DELIVERIES_TABLE,
            KeyConditionExpression: "endpoint_id = :endpointId",
            ExpressionAttributeValues: {
              ":endpointId": { S: input.endpointId },
            },
            Limit: input.limit,
            ScanIndexForward: false, // Sort by delivery_id descending
          };

          if (input.startKey) {
            queryParams.ExclusiveStartKey = {
              endpoint_id: { S: input.startKey.endpoint_id },
              delivery_id: { S: input.startKey.delivery_id },
            };
          }

          // Add filters
          const filterExpressions = [];
          if (input.status) {
            filterExpressions.push("#status = :status");
            queryParams.ExpressionAttributeNames = { "#status": "status" };
            queryParams.ExpressionAttributeValues[":status"] = {
              S: input.status,
            };
          }
          if (input.fromTimestamp) {
            filterExpressions.push("#timestamp >= :fromTimestamp");
            queryParams.ExpressionAttributeNames = {
              ...queryParams.ExpressionAttributeNames,
              "#timestamp": "timestamp",
            };
            queryParams.ExpressionAttributeValues[":fromTimestamp"] = {
              N: String(input.fromTimestamp),
            };
          }
          if (input.toTimestamp) {
            filterExpressions.push("#timestamp <= :toTimestamp");
            queryParams.ExpressionAttributeNames = {
              ...queryParams.ExpressionAttributeNames,
              "#timestamp": "timestamp",
            };
            queryParams.ExpressionAttributeValues[":toTimestamp"] = {
              N: String(input.toTimestamp),
            };
          }
          if (input.search) {
            filterExpressions.push("contains(delivery_id, :search)");
            queryParams.ExpressionAttributeValues[":search"] = {
              S: input.search,
            };
          }

          // Advanced filters processing
          if (input.advancedFilters) {
            // Date range filter
            if (input.advancedFilters.dateRange?.enabled) {
              const startTimestamp = new Date(
                input.advancedFilters.dateRange.start,
              ).getTime();
              const endTimestamp = new Date(
                input.advancedFilters.dateRange.end + "T23:59:59.999Z",
              ).getTime();
              filterExpressions.push(
                "#timestamp BETWEEN :advDateStart AND :advDateEnd",
              );
              queryParams.ExpressionAttributeNames = {
                ...queryParams.ExpressionAttributeNames,
                "#timestamp": "timestamp",
              };
              queryParams.ExpressionAttributeValues[":advDateStart"] = {
                N: String(startTimestamp),
              };
              queryParams.ExpressionAttributeValues[":advDateEnd"] = {
                N: String(endTimestamp),
              };
            }

            // HTTP status codes filter
            if (input.advancedFilters.httpStatusCodes?.enabled) {
              const httpFilters = [];

              // Handle status ranges (2xx, 3xx, 4xx, 5xx)
              if (input.advancedFilters.httpStatusCodes.ranges.length > 0) {
                const rangeFilters =
                  input.advancedFilters.httpStatusCodes.ranges
                    .map((range, idx) => {
                      switch (range) {
                        case "2xx":
                          return `(response_status >= :range2xxStart AND response_status <= :range2xxEnd)`;
                        case "3xx":
                          return `(response_status >= :range3xxStart AND response_status <= :range3xxEnd)`;
                        case "4xx":
                          return `(response_status >= :range4xxStart AND response_status <= :range4xxEnd)`;
                        case "5xx":
                          return `(response_status >= :range5xxStart AND response_status <= :range5xxEnd)`;
                        default:
                          return null;
                      }
                    })
                    .filter(Boolean);

                if (rangeFilters.length > 0) {
                  httpFilters.push(`(${rangeFilters.join(" OR ")})`);

                  // Add range values
                  if (
                    input.advancedFilters.httpStatusCodes.ranges.includes("2xx")
                  ) {
                    queryParams.ExpressionAttributeValues[":range2xxStart"] = {
                      N: "200",
                    };
                    queryParams.ExpressionAttributeValues[":range2xxEnd"] = {
                      N: "299",
                    };
                  }
                  if (
                    input.advancedFilters.httpStatusCodes.ranges.includes("3xx")
                  ) {
                    queryParams.ExpressionAttributeValues[":range3xxStart"] = {
                      N: "300",
                    };
                    queryParams.ExpressionAttributeValues[":range3xxEnd"] = {
                      N: "399",
                    };
                  }
                  if (
                    input.advancedFilters.httpStatusCodes.ranges.includes("4xx")
                  ) {
                    queryParams.ExpressionAttributeValues[":range4xxStart"] = {
                      N: "400",
                    };
                    queryParams.ExpressionAttributeValues[":range4xxEnd"] = {
                      N: "499",
                    };
                  }
                  if (
                    input.advancedFilters.httpStatusCodes.ranges.includes("5xx")
                  ) {
                    queryParams.ExpressionAttributeValues[":range5xxStart"] = {
                      N: "500",
                    };
                    queryParams.ExpressionAttributeValues[":range5xxEnd"] = {
                      N: "599",
                    };
                  }
                }
              }

              // Handle specific status codes
              if (input.advancedFilters.httpStatusCodes.specific.length > 0) {
                const specificFilters =
                  input.advancedFilters.httpStatusCodes.specific.map(
                    (code, idx) => {
                      queryParams.ExpressionAttributeValues[
                        `:specificCode${idx}`
                      ] = { N: String(code) };
                      return `response_status = :specificCode${idx}`;
                    },
                  );
                httpFilters.push(`(${specificFilters.join(" OR ")})`);
              }

              // Handle excluded status codes
              if (input.advancedFilters.httpStatusCodes.exclude.length > 0) {
                const excludeFilters =
                  input.advancedFilters.httpStatusCodes.exclude.map(
                    (code, idx) => {
                      queryParams.ExpressionAttributeValues[
                        `:excludeCode${idx}`
                      ] = { N: String(code) };
                      return `response_status <> :excludeCode${idx}`;
                    },
                  );
                httpFilters.push(`(${excludeFilters.join(" AND ")})`);
              }

              if (httpFilters.length > 0) {
                filterExpressions.push(`(${httpFilters.join(" AND ")})`);
              }
            }

            // Duration filter
            if (input.advancedFilters.duration?.enabled) {
              filterExpressions.push(
                "duration_ms BETWEEN :durationMin AND :durationMax",
              );
              queryParams.ExpressionAttributeValues[":durationMin"] = {
                N: String(input.advancedFilters.duration.min),
              };
              queryParams.ExpressionAttributeValues[":durationMax"] = {
                N: String(input.advancedFilters.duration.max),
              };
            }

            // Attempt count filter
            if (input.advancedFilters.attemptCount?.enabled) {
              filterExpressions.push(
                "attempt BETWEEN :attemptMin AND :attemptMax",
              );
              queryParams.ExpressionAttributeValues[":attemptMin"] = {
                N: String(input.advancedFilters.attemptCount.min),
              };
              queryParams.ExpressionAttributeValues[":attemptMax"] = {
                N: String(input.advancedFilters.attemptCount.max),
              };
            }

            // Delivery status filters
            if (input.advancedFilters.deliveryStatus) {
              if (input.advancedFilters.deliveryStatus.include.length > 0) {
                const includeFilters =
                  input.advancedFilters.deliveryStatus.include.map(
                    (status, idx) => {
                      queryParams.ExpressionAttributeValues[
                        `:includeStatus${idx}`
                      ] = { S: status };
                      return `#status = :includeStatus${idx}`;
                    },
                  );
                filterExpressions.push(`(${includeFilters.join(" OR ")})`);
                queryParams.ExpressionAttributeNames = {
                  ...queryParams.ExpressionAttributeNames,
                  "#status": "status",
                };
              }

              if (input.advancedFilters.deliveryStatus.exclude.length > 0) {
                const excludeFilters =
                  input.advancedFilters.deliveryStatus.exclude.map(
                    (status, idx) => {
                      queryParams.ExpressionAttributeValues[
                        `:excludeStatus${idx}`
                      ] = { S: status };
                      return `#status <> :excludeStatus${idx}`;
                    },
                  );
                filterExpressions.push(`(${excludeFilters.join(" AND ")})`);
                queryParams.ExpressionAttributeNames = {
                  ...queryParams.ExpressionAttributeNames,
                  "#status": "status",
                };
              }
            }

            // Has errors filter
            if (input.advancedFilters.hasErrors === true) {
              filterExpressions.push("attribute_exists(#errorAttr)");
              queryParams.ExpressionAttributeNames = {
                ...queryParams.ExpressionAttributeNames,
                "#errorAttr": "error",
              };
            } else if (input.advancedFilters.hasErrors === false) {
              filterExpressions.push("attribute_not_exists(#errorAttr)");
              queryParams.ExpressionAttributeNames = {
                ...queryParams.ExpressionAttributeNames,
                "#errorAttr": "error",
              };
            }
          }

          if (filterExpressions.length > 0) {
            queryParams.FilterExpression = filterExpressions.join(" AND ");
          }

          command = new QueryCommand(queryParams);
        } else {
          // Scan all endpoints
          const scanParams: any = {
            TableName: DELIVERIES_TABLE,
            Limit: input.limit,
          };

          if (input.startKey) {
            scanParams.ExclusiveStartKey = {
              endpoint_id: { S: input.startKey.endpoint_id },
              delivery_id: { S: input.startKey.delivery_id },
            };
          }

          // Add filters
          const filterExpressions = [];
          const expressionAttributeValues: any = {};
          const expressionAttributeNames: any = {};

          if (input.status) {
            filterExpressions.push("#status = :status");
            expressionAttributeNames["#status"] = "status";
            expressionAttributeValues[":status"] = { S: input.status };
          }
          if (input.fromTimestamp) {
            filterExpressions.push("#timestamp >= :fromTimestamp");
            expressionAttributeNames["#timestamp"] = "timestamp";
            expressionAttributeValues[":fromTimestamp"] = {
              N: String(input.fromTimestamp),
            };
          }
          if (input.toTimestamp) {
            filterExpressions.push("#timestamp <= :toTimestamp");
            expressionAttributeNames["#timestamp"] = "timestamp";
            expressionAttributeValues[":toTimestamp"] = {
              N: String(input.toTimestamp),
            };
          }
          if (input.search) {
            filterExpressions.push(
              "(contains(delivery_id, :search) OR contains(endpoint_id, :search))",
            );
            expressionAttributeValues[":search"] = { S: input.search };
          }

          // Advanced filters processing for scan
          if (input.advancedFilters) {
            // Date range filter
            if (input.advancedFilters.dateRange?.enabled) {
              const startTimestamp = new Date(
                input.advancedFilters.dateRange.start,
              ).getTime();
              const endTimestamp = new Date(
                input.advancedFilters.dateRange.end + "T23:59:59.999Z",
              ).getTime();
              filterExpressions.push(
                "#timestamp BETWEEN :advDateStart AND :advDateEnd",
              );
              expressionAttributeNames["#timestamp"] = "timestamp";
              expressionAttributeValues[":advDateStart"] = {
                N: String(startTimestamp),
              };
              expressionAttributeValues[":advDateEnd"] = {
                N: String(endTimestamp),
              };
            }

            // HTTP status codes filter
            if (input.advancedFilters.httpStatusCodes?.enabled) {
              const httpFilters = [];

              // Handle status ranges (2xx, 3xx, 4xx, 5xx)
              if (input.advancedFilters.httpStatusCodes.ranges.length > 0) {
                const rangeFilters =
                  input.advancedFilters.httpStatusCodes.ranges
                    .map((range, idx) => {
                      switch (range) {
                        case "2xx":
                          return `(response_status >= :range2xxStart AND response_status <= :range2xxEnd)`;
                        case "3xx":
                          return `(response_status >= :range3xxStart AND response_status <= :range3xxEnd)`;
                        case "4xx":
                          return `(response_status >= :range4xxStart AND response_status <= :range4xxEnd)`;
                        case "5xx":
                          return `(response_status >= :range5xxStart AND response_status <= :range5xxEnd)`;
                        default:
                          return null;
                      }
                    })
                    .filter(Boolean);

                if (rangeFilters.length > 0) {
                  httpFilters.push(`(${rangeFilters.join(" OR ")})`);

                  // Add range values
                  if (
                    input.advancedFilters.httpStatusCodes.ranges.includes("2xx")
                  ) {
                    expressionAttributeValues[":range2xxStart"] = { N: "200" };
                    expressionAttributeValues[":range2xxEnd"] = { N: "299" };
                  }
                  if (
                    input.advancedFilters.httpStatusCodes.ranges.includes("3xx")
                  ) {
                    expressionAttributeValues[":range3xxStart"] = { N: "300" };
                    expressionAttributeValues[":range3xxEnd"] = { N: "399" };
                  }
                  if (
                    input.advancedFilters.httpStatusCodes.ranges.includes("4xx")
                  ) {
                    expressionAttributeValues[":range4xxStart"] = { N: "400" };
                    expressionAttributeValues[":range4xxEnd"] = { N: "499" };
                  }
                  if (
                    input.advancedFilters.httpStatusCodes.ranges.includes("5xx")
                  ) {
                    expressionAttributeValues[":range5xxStart"] = { N: "500" };
                    expressionAttributeValues[":range5xxEnd"] = { N: "599" };
                  }
                }
              }

              // Handle specific status codes
              if (input.advancedFilters.httpStatusCodes.specific.length > 0) {
                const specificFilters =
                  input.advancedFilters.httpStatusCodes.specific.map(
                    (code, idx) => {
                      expressionAttributeValues[`:specificCode${idx}`] = {
                        N: String(code),
                      };
                      return `response_status = :specificCode${idx}`;
                    },
                  );
                httpFilters.push(`(${specificFilters.join(" OR ")})`);
              }

              // Handle excluded status codes
              if (input.advancedFilters.httpStatusCodes.exclude.length > 0) {
                const excludeFilters =
                  input.advancedFilters.httpStatusCodes.exclude.map(
                    (code, idx) => {
                      expressionAttributeValues[`:excludeCode${idx}`] = {
                        N: String(code),
                      };
                      return `response_status <> :excludeCode${idx}`;
                    },
                  );
                httpFilters.push(`(${excludeFilters.join(" AND ")})`);
              }

              if (httpFilters.length > 0) {
                filterExpressions.push(`(${httpFilters.join(" AND ")})`);
              }
            }

            // Duration filter
            if (input.advancedFilters.duration?.enabled) {
              filterExpressions.push(
                "duration_ms BETWEEN :durationMin AND :durationMax",
              );
              expressionAttributeValues[":durationMin"] = {
                N: String(input.advancedFilters.duration.min),
              };
              expressionAttributeValues[":durationMax"] = {
                N: String(input.advancedFilters.duration.max),
              };
            }

            // Attempt count filter
            if (input.advancedFilters.attemptCount?.enabled) {
              filterExpressions.push(
                "attempt BETWEEN :attemptMin AND :attemptMax",
              );
              expressionAttributeValues[":attemptMin"] = {
                N: String(input.advancedFilters.attemptCount.min),
              };
              expressionAttributeValues[":attemptMax"] = {
                N: String(input.advancedFilters.attemptCount.max),
              };
            }

            // Delivery status filters
            if (input.advancedFilters.deliveryStatus) {
              if (input.advancedFilters.deliveryStatus.include.length > 0) {
                const includeFilters =
                  input.advancedFilters.deliveryStatus.include.map(
                    (status, idx) => {
                      expressionAttributeValues[`:includeStatus${idx}`] = {
                        S: status,
                      };
                      return `#status = :includeStatus${idx}`;
                    },
                  );
                filterExpressions.push(`(${includeFilters.join(" OR ")})`);
                expressionAttributeNames["#status"] = "status";
              }

              if (input.advancedFilters.deliveryStatus.exclude.length > 0) {
                const excludeFilters =
                  input.advancedFilters.deliveryStatus.exclude.map(
                    (status, idx) => {
                      expressionAttributeValues[`:excludeStatus${idx}`] = {
                        S: status,
                      };
                      return `#status <> :excludeStatus${idx}`;
                    },
                  );
                filterExpressions.push(`(${excludeFilters.join(" AND ")})`);
                expressionAttributeNames["#status"] = "status";
              }
            }

            // Has errors filter
            if (input.advancedFilters.hasErrors === true) {
              filterExpressions.push("attribute_exists(#errorAttr)");
              expressionAttributeNames["#errorAttr"] = "error";
            } else if (input.advancedFilters.hasErrors === false) {
              filterExpressions.push("attribute_not_exists(#errorAttr)");
              expressionAttributeNames["#errorAttr"] = "error";
            }
          }

          if (filterExpressions.length > 0) {
            scanParams.FilterExpression = filterExpressions.join(" AND ");
            scanParams.ExpressionAttributeValues = expressionAttributeValues;
            scanParams.ExpressionAttributeNames = expressionAttributeNames;
          }

          command = new ScanCommand(scanParams);
        }

        const result = await dynamoDb.send(command);

        const deliveries =
          result.Items?.map((item: any) => ({
            endpointId: item.endpoint_id?.S ?? "",
            deliveryId: item.delivery_id?.S ?? "",
            status: item.status?.S ?? "pending",
            timestamp: item.timestamp?.N ? parseInt(item.timestamp.N) : 0,
            destUrl: item.dest_url?.S ?? "",
            attempt: item.attempt?.N ? parseInt(item.attempt.N) : 1,
            responseStatus: item.response_status?.N
              ? parseInt(item.response_status.N)
              : null,
            durationMs: item.duration_ms?.N
              ? parseInt(item.duration_ms.N)
              : null,
            error: item.error?.S ?? null,
            requestHeaders: item.request_headers?.S ?? null,
            requestBody: item.request_body?.S ?? null,
            responseHeaders: item.response_headers?.S ?? null,
            responseBody: item.response_body?.S ?? null,
          })) ?? [];

        // If scanning, sort by timestamp descending
        if (!input.endpointId) {
          deliveries.sort((a: any, b: any) => b.timestamp - a.timestamp);
        }

        return {
          deliveries,
          lastEvaluatedKey: result.LastEvaluatedKey
            ? {
                endpoint_id: result.LastEvaluatedKey.endpoint_id?.S ?? "",
                delivery_id: result.LastEvaluatedKey.delivery_id?.S ?? "",
              }
            : null,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch delivery logs",
        });
      }
    }),

  // Retry failed delivery
  retryDelivery: protectedProcedure
    .input(
      z.object({
        endpointId: z.string(),
        deliveryId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        // Get the original delivery record
        const deliveryResult = await dynamoDb.send(
          new GetItemCommand({
            TableName: DELIVERIES_TABLE,
            Key: {
              endpoint_id: { S: input.endpointId },
              delivery_id: { S: input.deliveryId },
            },
          }),
        );

        if (!deliveryResult.Item) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Delivery not found",
          });
        }

        const delivery = deliveryResult.Item;

        // Only retry failed deliveries
        if (delivery.status?.S !== "failed") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Can only retry failed deliveries",
          });
        }

        // Create retry message for SQS
        const retryPayload = {
          endpoint_id: input.endpointId,
          raw_body: delivery.request_body?.S ?? "",
          headers: delivery.request_headers?.S
            ? JSON.parse(delivery.request_headers.S)
            : {},
          received_at: Date.now(),
          attempt: 0, // Reset attempt count for manual retry
          manual_retry: true,
          original_delivery_id: input.deliveryId,
        };

        await sqs.send(
          new SendMessageCommand({
            QueueUrl: QUEUE_URL,
            MessageBody: JSON.stringify(retryPayload),
          }),
        );

        // Update delivery status to retrying
        await dynamoDb.send(
          new UpdateItemCommand({
            TableName: DELIVERIES_TABLE,
            Key: {
              endpoint_id: { S: input.endpointId },
              delivery_id: { S: input.deliveryId },
            },
            UpdateExpression: "SET #status = :status, retry_at = :retryAt",
            ExpressionAttributeNames: {
              "#status": "status",
            },
            ExpressionAttributeValues: {
              ":status": { S: "retrying" },
              ":retryAt": { N: String(Date.now()) },
            },
          }),
        );

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retry delivery",
        });
      }
    }),

  // Bulk retry failed deliveries
  bulkRetryDeliveries: protectedProcedure
    .input(
      z.object({
        deliveries: z
          .array(
            z.object({
              endpointId: z.string(),
              deliveryId: z.string(),
            }),
          )
          .min(1)
          .max(50),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const results = [];

        for (const delivery of input.deliveries) {
          try {
            // Get the original delivery record
            const deliveryResult = await dynamoDb.send(
              new GetItemCommand({
                TableName: DELIVERIES_TABLE,
                Key: {
                  endpoint_id: { S: delivery.endpointId },
                  delivery_id: { S: delivery.deliveryId },
                },
              }),
            );

            if (!deliveryResult.Item) {
              results.push({
                deliveryId: delivery.deliveryId,
                success: false,
                error: "Delivery not found",
              });
              continue;
            }

            const deliveryItem = deliveryResult.Item;

            // Only retry failed deliveries
            if (deliveryItem.status?.S !== "failed") {
              results.push({
                deliveryId: delivery.deliveryId,
                success: false,
                error: "Can only retry failed deliveries",
              });
              continue;
            }

            // Create retry message for SQS
            const retryPayload = {
              endpoint_id: delivery.endpointId,
              raw_body: deliveryItem.request_body?.S ?? "",
              headers: deliveryItem.request_headers?.S
                ? JSON.parse(deliveryItem.request_headers.S)
                : {},
              received_at: Date.now(),
              attempt: 0, // Reset attempt count for manual retry
              manual_retry: true,
              original_delivery_id: delivery.deliveryId,
            };

            await sqs.send(
              new SendMessageCommand({
                QueueUrl: QUEUE_URL,
                MessageBody: JSON.stringify(retryPayload),
              }),
            );

            // Update delivery status to retrying
            await dynamoDb.send(
              new UpdateItemCommand({
                TableName: DELIVERIES_TABLE,
                Key: {
                  endpoint_id: { S: delivery.endpointId },
                  delivery_id: { S: delivery.deliveryId },
                },
                UpdateExpression: "SET #status = :status, retry_at = :retryAt",
                ExpressionAttributeNames: {
                  "#status": "status",
                },
                ExpressionAttributeValues: {
                  ":status": { S: "retrying" },
                  ":retryAt": { N: String(Date.now()) },
                },
              }),
            );

            results.push({
              deliveryId: delivery.deliveryId,
              success: true,
            });
          } catch (error) {
            results.push({
              deliveryId: delivery.deliveryId,
              success: false,
              error: String(error),
            });
          }
        }

        const successCount = results.filter((r) => r.success).length;
        const failCount = results.filter((r) => !r.success).length;

        return {
          results,
          summary: {
            total: input.deliveries.length,
            succeeded: successCount,
            failed: failCount,
          },
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to bulk retry deliveries",
        });
      }
    }),

  // Get Dead Letter Queue items
  getDlqItems: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        continuationToken: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      try {
        const listParams: any = {
          Bucket: DLQ_BUCKET,
          MaxKeys: input.limit,
        };

        if (input.continuationToken) {
          listParams.ContinuationToken = input.continuationToken;
        }

        const result = await s3.send(new ListObjectsV2Command(listParams));

        const dlqItems = await Promise.all(
          (result.Contents ?? []).map(async (obj) => {
            if (!obj.Key) return null;

            try {
              // Get the object content
              const objectResult = await s3.send(
                new GetObjectCommand({
                  Bucket: DLQ_BUCKET,
                  Key: obj.Key,
                }),
              );

              const content = await objectResult.Body?.transformToString();
              const data = content ? JSON.parse(content) : {};

              return {
                key: obj.Key,
                size: obj.Size ?? 0,
                lastModified: obj.LastModified?.getTime() ?? Date.now(),
                endpointId: data.endpoint_id ?? "unknown",
                deliveryId:
                  (data.delivery_id as string | undefined) ??
                  obj.Key.split("/").pop() ??
                  obj.Key,
                reason: data.reason ?? "Max retries exceeded",
                originalTimestamp:
                  (data.original_timestamp as number | undefined) ?? Date.now(),
                finalError: data.final_error ?? "Unknown error",
                attemptCount: (data.attempt_count as number | undefined) ?? 0,
                payload: (data.original_payload as string | undefined) ?? null,
              };
            } catch (parseError) {
              // If we can't parse the content, return basic info
              return {
                key: obj.Key,
                size: obj.Size ?? 0,
                lastModified: obj.LastModified?.getTime() ?? Date.now(),
                endpointId: "unknown",
                deliveryId: obj.Key.split("/").pop() ?? obj.Key,
                reason: "Parse error",
                originalTimestamp: obj.LastModified?.getTime() ?? Date.now(),
                finalError: "Could not parse DLQ item",
                attemptCount: 0,
                payload: null,
              };
            }
          }),
        );

        // Filter out null items and sort by timestamp descending
        const validItems = dlqItems
          .filter((item): item is NonNullable<typeof item> => item !== null)
          .sort((a, b) => b.lastModified - a.lastModified);

        return {
          items: validItems,
          nextContinuationToken: result.NextContinuationToken,
          isTruncated: result.IsTruncated ?? false,
          totalCount: result.KeyCount ?? 0,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch DLQ items",
        });
      }
    }),

  // Replay delivery from DLQ
  replayFromDlq: protectedProcedure
    .input(
      z.object({
        dlqKey: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        // Get the DLQ item
        const objectResult = await s3.send(
          new GetObjectCommand({
            Bucket: DLQ_BUCKET,
            Key: input.dlqKey,
          }),
        );

        const content = await objectResult.Body?.transformToString();
        if (!content) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "DLQ item not found",
          });
        }

        const dlqData = JSON.parse(content);

        // Create retry message for SQS
        const retryPayload = {
          endpoint_id: dlqData.endpoint_id,
          raw_body: dlqData.original_payload ?? "",
          headers: dlqData.original_headers ?? {},
          received_at: Date.now(),
          attempt: 0, // Reset attempt count for replay
          dlq_replay: true,
          original_dlq_key: input.dlqKey,
        };

        await sqs.send(
          new SendMessageCommand({
            QueueUrl: QUEUE_URL,
            MessageBody: JSON.stringify(retryPayload),
          }),
        );

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to replay from DLQ",
        });
      }
    }),

  // Delete DLQ item
  deleteDlqItem: protectedProcedure
    .input(
      z.object({
        dlqKey: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: DLQ_BUCKET,
            Key: input.dlqKey,
          }),
        );

        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete DLQ item",
        });
      }
    }),

  // Bulk delete DLQ items
  bulkDeleteDlqItems: protectedProcedure
    .input(
      z.object({
        dlqKeys: z.array(z.string()).min(1).max(50),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const results = [];

        for (const key of input.dlqKeys) {
          try {
            await s3.send(
              new DeleteObjectCommand({
                Bucket: DLQ_BUCKET,
                Key: key,
              }),
            );

            results.push({
              key,
              success: true,
            });
          } catch (error) {
            results.push({
              key,
              success: false,
              error: String(error),
            });
          }
        }

        const successCount = results.filter((r) => r.success).length;
        const failCount = results.filter((r) => !r.success).length;

        return {
          results,
          summary: {
            total: input.dlqKeys.length,
            succeeded: successCount,
            failed: failCount,
          },
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to bulk delete DLQ items",
        });
      }
    }),

  // Get system settings
  getSystemSettings: protectedProcedure.query(async ({ ctx }) => {
    try {
      // For now, we'll use DynamoDB to store system settings
      // In a real implementation, you might use a dedicated settings service
      const result = await dynamoDb.send(
        new GetItemCommand({
          TableName: ENDPOINTS_TABLE,
          Key: { endpoint_id: { S: "__system_settings__" } },
        }),
      );

      if (!result.Item) {
        // Return default settings if none exist
        return null;
      }

      return JSON.parse(result.Item.settings?.S ?? "{}") as unknown;
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get system settings",
      });
    }
  }),

  // Update system settings
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
        // Store settings in DynamoDB
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

  // Test system connection
  testSystemConnection: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      const tests = [];

      // Test DynamoDB connection
      try {
        await dynamoDb.send(
          new ScanCommand({
            TableName: ENDPOINTS_TABLE,
            Limit: 1,
          }),
        );
        tests.push({ service: "DynamoDB", status: "success" });
      } catch (error) {
        tests.push({
          service: "DynamoDB",
          status: "failed",
          error: String(error),
        });
      }

      // Test SQS connection
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

      // Test S3 connection
      try {
        await s3.send(
          new ListObjectsV2Command({
            Bucket: DLQ_BUCKET,
            MaxKeys: 1,
          }),
        );
        tests.push({ service: "S3", status: "success" });
      } catch (error) {
        tests.push({ service: "S3", status: "failed", error: String(error) });
      }

      const allSuccessful = tests.every((test) => test.status === "success");
      const failedTests = tests.filter((test) => test.status === "failed");

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

  // Export deliveries
  exportDeliveries: protectedProcedure
    .input(
      z.object({
        format: z.enum(["csv", "json", "xlsx"]),
        dateRange: z.object({
          start: z.string(),
          end: z.string(),
        }),
        filters: z.object({
          status: z.string().optional(),
          endpointId: z.string().optional(),
          search: z.string().optional(),
        }),
        columns: z.array(z.string()),
        includePayloads: z.boolean(),
        includeHeaders: z.boolean(),
        maxRecords: z.number().min(1).max(50000),
        selectedItems: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Convert date strings to timestamps
        const startTime = new Date(input.dateRange.start).getTime();
        const endTime = new Date(
          input.dateRange.end + "T23:59:59.999Z",
        ).getTime();

        type ExportDelivery = {
          deliveryId?: string;
          endpointId?: string;
          status: string;
          timestamp: number;
          responseStatus: number | null;
          durationMs: number | null;
          attempt: number;
          destUrl?: string;
          requestHeaders?: string | null;
          responseHeaders?: string | null;
          requestBody?: string | null;
          responseBody?: string | null;
          error?: string | null;
        };
        let deliveries: ExportDelivery[] = [];

        if (input.selectedItems && input.selectedItems.length > 0) {
          // Export only selected items
          for (const itemKey of input.selectedItems) {
            const [endpointId, deliveryId] = itemKey.split("::");
            if (!endpointId || !deliveryId) continue;

            try {
              const result = await dynamoDb.send(
                new GetItemCommand({
                  TableName: DELIVERIES_TABLE,
                  Key: {
                    endpoint_id: { S: endpointId },
                    delivery_id: { S: deliveryId },
                  },
                }),
              );

              if (result.Item) {
                const delivery: ExportDelivery = {
                  deliveryId: result.Item.delivery_id?.S,
                  endpointId: result.Item.endpoint_id?.S,
                  status: result.Item.status?.S ?? "unknown",
                  timestamp: parseInt(result.Item.timestamp?.N ?? "0"),
                  responseStatus: result.Item.response_status?.N
                    ? parseInt(result.Item.response_status.N)
                    : null,
                  durationMs: result.Item.duration_ms?.N
                    ? parseInt(result.Item.duration_ms.N)
                    : null,
                  attempt: result.Item.attempt?.N
                    ? parseInt(result.Item.attempt.N)
                    : 1,
                  destUrl: result.Item.dest_url?.S,
                  requestHeaders: result.Item.request_headers?.S,
                  responseHeaders: result.Item.response_headers?.S,
                  requestBody: result.Item.request_body?.S,
                  responseBody: result.Item.response_body?.S,
                  error: result.Item.error?.S,
                };

                deliveries.push(delivery);
              }
            } catch (error) {
              console.warn(
                `Failed to fetch delivery ${endpointId}:${deliveryId}:`,
                error,
              );
            }
          }
        } else {
          // Export based on filters and date range
          const scanParams: any = {
            TableName: DELIVERIES_TABLE,
            Limit: input.maxRecords,
            FilterExpression: "#ts BETWEEN :start_time AND :end_time",
            ExpressionAttributeNames: {
              "#ts": "timestamp",
            },
            ExpressionAttributeValues: {
              ":start_time": { N: String(startTime) },
              ":end_time": { N: String(endTime) },
            },
          };

          // Add status filter
          if (input.filters.status) {
            scanParams.FilterExpression += " AND #status = :status";
            scanParams.ExpressionAttributeNames["#status"] = "status";
            scanParams.ExpressionAttributeValues[":status"] = {
              S: input.filters.status,
            };
          }

          // Add endpoint filter
          if (input.filters.endpointId) {
            scanParams.FilterExpression += " AND endpoint_id = :endpoint_id";
            scanParams.ExpressionAttributeValues[":endpoint_id"] = {
              S: input.filters.endpointId,
            };
          }

          const result = await dynamoDb.send(new ScanCommand(scanParams));

          const items = Array.isArray(result.Items) ? result.Items : [];
          deliveries = items.map((item: any) => ({
            deliveryId: item.delivery_id?.S,
            endpointId: item.endpoint_id?.S,
            status: item.status?.S ?? "unknown",
            timestamp: parseInt(item.timestamp?.N ?? "0"),
            responseStatus: item.response_status?.N
              ? parseInt(item.response_status.N)
              : null,
            durationMs: item.duration_ms?.N
              ? parseInt(item.duration_ms.N)
              : null,
            attempt: item.attempt?.N ? parseInt(item.attempt.N) : 1,
            destUrl: item.dest_url?.S,
            requestHeaders: item.request_headers?.S,
            responseHeaders: item.response_headers?.S,
            requestBody: item.request_body?.S,
            responseBody: item.response_body?.S,
            error: item.error?.S,
          }));

          // Apply search filter if provided
          if (input.filters.search) {
            const searchTerm = input.filters.search.toLowerCase();
            deliveries = deliveries.filter(
              (delivery) =>
                (delivery.deliveryId ?? "")
                  .toLowerCase()
                  .includes(searchTerm) ||
                (delivery.endpointId ?? "")
                  .toLowerCase()
                  .includes(searchTerm) ||
                (delivery.destUrl ?? "").toLowerCase().includes(searchTerm),
            );
          }

          // Sort by timestamp descending
          deliveries.sort((a, b) => b.timestamp - a.timestamp);
        }

        // Filter columns based on selection
        const filteredDeliveries = deliveries.map((delivery) => {
          const filtered: Record<string, unknown> = {};

          for (const column of input.columns) {
            switch (column) {
              case "deliveryId":
                filtered.deliveryId = delivery.deliveryId;
                break;
              case "endpointId":
                filtered.endpointId = delivery.endpointId;
                break;
              case "status":
                filtered.status = delivery.status;
                break;
              case "timestamp":
                filtered.timestamp = new Date(delivery.timestamp).toISOString();
                break;
              case "responseStatus":
                filtered.responseStatus = delivery.responseStatus;
                break;
              case "durationMs":
                filtered.durationMs = delivery.durationMs;
                break;
              case "attempt":
                filtered.attempt = delivery.attempt;
                break;
              case "destUrl":
                filtered.destUrl = delivery.destUrl;
                break;
              case "requestHeaders":
                if (input.includeHeaders) {
                  filtered.requestHeaders = delivery.requestHeaders;
                }
                break;
              case "responseHeaders":
                if (input.includeHeaders) {
                  filtered.responseHeaders = delivery.responseHeaders;
                }
                break;
              case "requestBody":
                if (input.includePayloads) {
                  filtered.requestBody = delivery.requestBody;
                }
                break;
              case "responseBody":
                if (input.includePayloads) {
                  filtered.responseBody = delivery.responseBody;
                }
                break;
              case "error":
                filtered.error = delivery.error;
                break;
            }
          }

          return filtered;
        });

        // Generate filename
        const timestamp = new Date().toISOString().split("T")[0];
        const filename = `webhook-deliveries-${timestamp}.${input.format}`;

        // Format data based on export format
        let exportData: string;

        switch (input.format) {
          case "csv":
            exportData = formatAsCSV(filteredDeliveries, input.columns);
            break;
          case "json":
            exportData = JSON.stringify(
              {
                exportInfo: {
                  generatedAt: new Date().toISOString(),
                  recordCount: filteredDeliveries.length,
                  filters: input.filters,
                  dateRange: input.dateRange,
                  columns: input.columns,
                },
                deliveries: filteredDeliveries,
              },
              null,
              2,
            );
            break;
          case "xlsx":
            // For XLSX, we would need a library like 'xlsx' or 'exceljs'
            // For now, we'll return CSV data with a note
            exportData = formatAsCSV(filteredDeliveries, input.columns);
            break;
          default:
            exportData = JSON.stringify(filteredDeliveries, null, 2);
        }

        return {
          data: exportData,
          filename,
          recordCount: filteredDeliveries.length,
          format: input.format,
        };
      } catch (error) {
        console.error("Export error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to export deliveries",
        });
      }
    }),

  // Get health monitoring alerts
  getHealthAlerts: protectedProcedure
    .input(
      z.object({
        includeResolved: z.boolean().default(false),
        severity: z.enum(["low", "medium", "high", "critical"]).optional(),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ input }) => {
      try {
        // In production, this would query a dedicated alerts table
        // For now, we'll return mock data based on current system metrics

        // Get current stats to determine health
        const queueStats = await sqs.send(
          new GetQueueAttributesCommand({
            QueueUrl: QUEUE_URL,
            AttributeNames: ["All"],
          }),
        );

        const deliveriesResult = await dynamoDb.send(
          new ScanCommand({
            TableName: DELIVERIES_TABLE,
            Limit: 100,
          }),
        );

        const deliveries =
          deliveriesResult.Items?.map((item: any) => ({
            status: item.status?.S ?? "unknown",
            timestamp: item.timestamp?.N ? parseInt(item.timestamp.N) : 0,
            responseStatus: item.response_status?.N
              ? parseInt(item.response_status.N)
              : null,
            durationMs: item.duration_ms?.N
              ? parseInt(item.duration_ms.N)
              : null,
          })) ?? [];

        const totalDeliveries = deliveries.length;
        const failedDeliveries = deliveries.filter(
          (d) => d.status === "failed",
        ).length;
        const failureRate =
          totalDeliveries > 0 ? (failedDeliveries / totalDeliveries) * 100 : 0;
        const queueDepth = parseInt(
          queueStats.Attributes?.ApproximateNumberOfMessages ?? "0",
        );

        // Generate alerts based on thresholds
        const alerts = [];
        const now = new Date();

        // Failure rate alerts
        if (failureRate > 25) {
          alerts.push({
            id: `alert_failure_rate_${Date.now()}`,
            type: "failure_rate",
            severity: failureRate > 50 ? "critical" : "high",
            title: "High Failure Rate",
            message: `Webhook failure rate is ${failureRate.toFixed(1)}%, exceeding normal thresholds`,
            value: failureRate,
            threshold: failureRate > 50 ? 50 : 25,
            createdAt: now.toISOString(),
            resolved: false,
            acknowledged: false,
            metadata: {
              totalDeliveries,
              failedDeliveries,
              timeWindow: 10,
            },
          });
        }

        // Queue depth alerts
        if (queueDepth > 100) {
          alerts.push({
            id: `alert_queue_depth_${Date.now()}`,
            type: "queue_depth",
            severity: queueDepth > 500 ? "critical" : "high",
            title: "High Queue Depth",
            message: `Message queue has ${queueDepth} pending messages`,
            value: queueDepth,
            threshold: queueDepth > 500 ? 500 : 100,
            createdAt: now.toISOString(),
            resolved: false,
            acknowledged: false,
            metadata: {
              queueDepth,
              timeWindow: 5,
            },
          });
        }

        // Filter by severity if specified
        const filteredAlerts = input.severity
          ? alerts.filter((a) => a.severity === input.severity)
          : alerts;

        return {
          alerts: filteredAlerts.slice(0, input.limit),
          summary: {
            total: filteredAlerts.length,
            critical: filteredAlerts.filter((a) => a.severity === "critical")
              .length,
            high: filteredAlerts.filter((a) => a.severity === "high").length,
            medium: filteredAlerts.filter((a) => a.severity === "medium")
              .length,
            low: filteredAlerts.filter((a) => a.severity === "low").length,
          },
          healthStatus: {
            status: alerts.some((a) => a.severity === "critical")
              ? "critical"
              : alerts.length > 0
                ? "warning"
                : "healthy",
            lastCheck: now.toISOString(),
          },
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch health alerts",
        });
      }
    }),

  // Acknowledge health alert
  acknowledgeHealthAlert: protectedProcedure
    .input(
      z.object({
        alertId: z.string(),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // In production, this would update the alerts table
        // For now, we'll just return success

        return {
          success: true,
          acknowledgedBy: ctx.session.user.id,
          acknowledgedAt: new Date().toISOString(),
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to acknowledge alert",
        });
      }
    }),

  // Get health monitoring configuration
  getHealthConfig: protectedProcedure.query(async () => {
    try {
      // In production, this would be stored in the database
      // For now, return default configuration

      const defaultThresholds = [
        {
          id: "failure_rate_critical",
          name: "Critical Failure Rate",
          description: "Alert when failure rate exceeds 50% over 5 minutes",
          type: "failure_rate",
          threshold: 50,
          timeWindow: 5,
          severity: "critical",
          enabled: true,
          notifications: {
            email: true,
            slack: true,
            sms: true,
          },
        },
        {
          id: "failure_rate_high",
          name: "High Failure Rate",
          description: "Alert when failure rate exceeds 25% over 10 minutes",
          type: "failure_rate",
          threshold: 25,
          timeWindow: 10,
          severity: "high",
          enabled: true,
          notifications: {
            email: true,
            slack: true,
            sms: false,
          },
        },
        {
          id: "queue_depth_critical",
          name: "Critical Queue Depth",
          description: "Alert when queue depth exceeds 1000 messages",
          type: "queue_depth",
          threshold: 1000,
          timeWindow: 1,
          severity: "critical",
          enabled: true,
          notifications: {
            email: true,
            slack: true,
            sms: true,
          },
        },
      ];

      return {
        thresholds: defaultThresholds,
        notificationChannels: {
          email: {
            enabled: true,
            address: "alerts@example.com",
          },
          slack: {
            enabled: true,
            webhook: "https://hooks.slack.com/services/...",
          },
          sms: {
            enabled: false,
            number: "+1234567890",
          },
        },
        monitoringEnabled: true,
        checkInterval: 60, // seconds
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get health configuration",
      });
    }
  }),

  // Update health monitoring configuration
  updateHealthConfig: protectedProcedure
    .input(
      z.object({
        thresholds: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            description: z.string(),
            type: z.enum([
              "failure_rate",
              "queue_depth",
              "response_time",
              "endpoint_down",
            ]),
            threshold: z.number(),
            timeWindow: z.number(),
            severity: z.enum(["low", "medium", "high", "critical"]),
            enabled: z.boolean(),
            notifications: z.object({
              email: z.boolean(),
              slack: z.boolean(),
              sms: z.boolean(),
            }),
          }),
        ),
        notificationChannels: z
          .object({
            email: z
              .object({
                enabled: z.boolean(),
                address: z.string(),
              })
              .optional(),
            slack: z
              .object({
                enabled: z.boolean(),
                webhook: z.string(),
              })
              .optional(),
            sms: z
              .object({
                enabled: z.boolean(),
                number: z.string(),
              })
              .optional(),
          })
          .optional(),
        monitoringEnabled: z.boolean().optional(),
        checkInterval: z.number().min(10).max(3600).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // In production, this would save to database

        return {
          success: true,
          updatedBy: ctx.session.user.id,
          updatedAt: new Date().toISOString(),
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update health configuration",
        });
      }
    }),

  // Get webhook analytics for delivery trends
  getAnalytics: protectedProcedure
    .input(
      z.object({
        timeRange: z.enum(["1h", "24h", "7d", "30d"]).default("24h"),
        endpointId: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      try {
        const now = Date.now();
        let startTime: number;
        let interval: number; // in milliseconds

        // Calculate time range and interval for data points
        switch (input.timeRange) {
          case "1h":
            startTime = now - 60 * 60 * 1000; // 1 hour ago
            interval = 5 * 60 * 1000; // 5-minute intervals
            break;
          case "24h":
            startTime = now - 24 * 60 * 60 * 1000; // 24 hours ago
            interval = 60 * 60 * 1000; // 1-hour intervals
            break;
          case "7d":
            startTime = now - 7 * 24 * 60 * 60 * 1000; // 7 days ago
            interval = 4 * 60 * 60 * 1000; // 4-hour intervals
            break;
          case "30d":
            startTime = now - 30 * 24 * 60 * 60 * 1000; // 30 days ago
            interval = 24 * 60 * 60 * 1000; // 1-day intervals
            break;
          default:
            startTime = now - 24 * 60 * 60 * 1000;
            interval = 60 * 60 * 1000;
        }

        // Prepare query parameters
        const scanParams: any = {
          TableName: DELIVERIES_TABLE,
          FilterExpression: "#timestamp BETWEEN :startTime AND :endTime",
          ExpressionAttributeNames: {
            "#timestamp": "timestamp",
          },
          ExpressionAttributeValues: {
            ":startTime": { N: startTime.toString() },
            ":endTime": { N: now.toString() },
          },
        };

        // Add endpoint filter if specified
        if (input.endpointId) {
          scanParams.FilterExpression += " AND endpoint_id = :endpointId";
          scanParams.ExpressionAttributeValues[":endpointId"] = {
            S: input.endpointId,
          };
        }

        const result = await dynamoDb.send(new ScanCommand(scanParams));

        const deliveries =
          result.Items?.map((item: any) => ({
            timestamp: item.timestamp?.N ? parseInt(item.timestamp.N) : 0,
            status: item.status?.S ?? "pending",
            endpointId: item.endpoint_id?.S ?? "",
            responseStatus: item.response_status?.N
              ? parseInt(item.response_status.N)
              : null,
            durationMs: item.duration_ms?.N
              ? parseInt(item.duration_ms.N)
              : null,
            attempt: item.attempt?.N ? parseInt(item.attempt.N) : 1,
          })) ?? [];

        // Group deliveries by time intervals
        const intervals = Math.ceil((now - startTime) / interval);
        const timeSeriesData = [];
        const endpointStats: Record<
          string,
          { success: number; failed: number; total: number }
        > = {};
        const statusCodeStats: Record<number, number> = {};
        let totalDeliveries = 0;
        let successfulDeliveries = 0;
        let averageResponseTime = 0;
        let totalResponseTime = 0;
        let responseTimeCount = 0;

        // Initialize time series data points
        for (let i = 0; i < intervals; i++) {
          const intervalStart = startTime + i * interval;
          const intervalEnd = intervalStart + interval;

          const intervalDeliveries = deliveries.filter(
            (d) => d.timestamp >= intervalStart && d.timestamp < intervalEnd,
          );

          const successful = intervalDeliveries.filter(
            (d) => d.status === "success",
          ).length;
          const failed = intervalDeliveries.filter(
            (d) => d.status === "failed",
          ).length;
          const pending = intervalDeliveries.filter(
            (d) => d.status === "pending",
          ).length;
          const retrying = intervalDeliveries.filter(
            (d) => d.status === "retrying",
          ).length;
          const total = intervalDeliveries.length;

          timeSeriesData.push({
            timestamp: intervalStart,
            time: new Date(intervalStart).toISOString(),
            successful,
            failed,
            pending,
            retrying,
            total,
            successRate: total > 0 ? (successful / total) * 100 : 0,
          });
        }

        // Calculate overall stats
        deliveries.forEach((delivery) => {
          totalDeliveries++;
          if (delivery.status === "success") {
            successfulDeliveries++;
          }

          // Track endpoint stats
          endpointStats[delivery.endpointId] ??= {
            success: 0,
            failed: 0,
            total: 0,
          };
          endpointStats[delivery.endpointId]!.total++;
          if (delivery.status === "success") {
            endpointStats[delivery.endpointId]!.success++;
          } else if (delivery.status === "failed") {
            endpointStats[delivery.endpointId]!.failed++;
          }

          // Track status codes
          if (delivery.responseStatus) {
            statusCodeStats[delivery.responseStatus] =
              (statusCodeStats[delivery.responseStatus] ?? 0) + 1;
          }

          // Track response times
          if (delivery.durationMs) {
            totalResponseTime += delivery.durationMs;
            responseTimeCount++;
          }
        });

        if (responseTimeCount > 0) {
          averageResponseTime = Math.round(
            totalResponseTime / responseTimeCount,
          );
        }

        // Calculate endpoint performance data
        const endpointPerformance = Object.entries(endpointStats).map(
          ([endpointId, stats]) => ({
            endpointId,
            total: stats.total,
            successful: stats.success,
            failed: stats.failed,
            successRate:
              stats.total > 0 ? (stats.success / stats.total) * 100 : 0,
          }),
        );

        // Convert status code stats to array format
        const statusCodeDistribution = Object.entries(statusCodeStats).map(
          ([code, count]) => ({
            statusCode: parseInt(code),
            count,
            percentage:
              totalDeliveries > 0 ? (count / totalDeliveries) * 100 : 0,
          }),
        );

        return {
          timeRange: input.timeRange,
          summary: {
            totalDeliveries,
            successfulDeliveries,
            failedDeliveries: totalDeliveries - successfulDeliveries,
            successRate:
              totalDeliveries > 0
                ? (successfulDeliveries / totalDeliveries) * 100
                : 0,
            averageResponseTime,
          },
          timeSeries: timeSeriesData,
          endpointPerformance,
          statusCodeDistribution,
        };
      } catch (error) {
        console.error("Analytics query error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch analytics data",
        });
      }
    }),

  // Bulk delete deliveries
  bulkDeleteDeliveries: protectedProcedure
    .input(
      z.object({
        deliveries: z.array(
          z.object({
            endpointId: z.string(),
            deliveryId: z.string(),
          }),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const deletePromises = input.deliveries.map(
          async ({ endpointId, deliveryId }) => {
            try {
              await dynamoDb.send(
                new DeleteItemCommand({
                  TableName: DELIVERIES_TABLE,
                  Key: {
                    endpoint_id: { S: endpointId },
                    delivery_id: { S: deliveryId },
                  },
                }),
              );
              return { success: true, endpointId, deliveryId };
            } catch (error) {
              console.error(`Failed to delete delivery ${deliveryId}:`, error);
              return {
                success: false,
                endpointId,
                deliveryId,
                error: String(error),
              };
            }
          },
        );

        const results = await Promise.allSettled(deletePromises);
        const successful = results.filter(
          (r) => r.status === "fulfilled" && r.value.success,
        ).length;
        const failed = results.length - successful;

        return {
          total: input.deliveries.length,
          successful,
          failed,
          results: results.map((r) =>
            r.status === "fulfilled"
              ? r.value
              : { success: false, error: "Promise rejected" },
          ),
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete deliveries",
        });
      }
    }),

  // Bulk archive deliveries (mark as archived instead of deleting)
  bulkArchiveDeliveries: protectedProcedure
    .input(
      z.object({
        deliveries: z.array(
          z.object({
            endpointId: z.string(),
            deliveryId: z.string(),
          }),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const archivePromises = input.deliveries.map(
          async ({ endpointId, deliveryId }) => {
            try {
              await dynamoDb.send(
                new UpdateItemCommand({
                  TableName: DELIVERIES_TABLE,
                  Key: {
                    endpoint_id: { S: endpointId },
                    delivery_id: { S: deliveryId },
                  },
                  UpdateExpression:
                    "SET archived = :archived, archived_at = :archivedAt",
                  ExpressionAttributeValues: {
                    ":archived": { BOOL: true },
                    ":archivedAt": { N: Date.now().toString() },
                  },
                }),
              );
              return { success: true, endpointId, deliveryId };
            } catch (error) {
              console.error(`Failed to archive delivery ${deliveryId}:`, error);
              return {
                success: false,
                endpointId,
                deliveryId,
                error: String(error),
              };
            }
          },
        );

        const results = await Promise.allSettled(archivePromises);
        const successful = results.filter(
          (r) => r.status === "fulfilled" && r.value.success,
        ).length;
        const failed = results.length - successful;

        return {
          total: input.deliveries.length,
          successful,
          failed,
          results: results.map((r) =>
            r.status === "fulfilled"
              ? r.value
              : { success: false, error: "Promise rejected" },
          ),
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to archive deliveries",
        });
      }
    }),

  // Bulk update delivery status
  bulkUpdateDeliveryStatus: protectedProcedure
    .input(
      z.object({
        deliveries: z.array(
          z.object({
            endpointId: z.string(),
            deliveryId: z.string(),
          }),
        ),
        status: z.enum(["pending", "success", "failed", "retrying"]),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const updatePromises = input.deliveries.map(
          async ({ endpointId, deliveryId }) => {
            try {
              const updateExpression = input.reason
                ? "SET #status = :status, updated_at = :updatedAt, update_reason = :reason"
                : "SET #status = :status, updated_at = :updatedAt";

              const expressionAttributeValues: any = {
                ":status": { S: input.status },
                ":updatedAt": { N: Date.now().toString() },
              };

              const expressionAttributeNames: any = {
                "#status": "status",
              };

              if (input.reason) {
                expressionAttributeValues[":reason"] = { S: input.reason };
              }

              await dynamoDb.send(
                new UpdateItemCommand({
                  TableName: DELIVERIES_TABLE,
                  Key: {
                    endpoint_id: { S: endpointId },
                    delivery_id: { S: deliveryId },
                  },
                  UpdateExpression: updateExpression,
                  ExpressionAttributeValues: expressionAttributeValues,
                  ExpressionAttributeNames: expressionAttributeNames,
                }),
              );
              return { success: true, endpointId, deliveryId };
            } catch (error) {
              console.error(`Failed to update delivery ${deliveryId}:`, error);
              return {
                success: false,
                endpointId,
                deliveryId,
                error: String(error),
              };
            }
          },
        );

        const results = await Promise.allSettled(updatePromises);
        const successful = results.filter(
          (r) => r.status === "fulfilled" && r.value.success,
        ).length;
        const failed = results.length - successful;

        return {
          total: input.deliveries.length,
          successful,
          failed,
          status: input.status,
          results: results.map((r) =>
            r.status === "fulfilled"
              ? r.value
              : { success: false, error: "Promise rejected" },
          ),
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update delivery status",
        });
      }
    }),
});
