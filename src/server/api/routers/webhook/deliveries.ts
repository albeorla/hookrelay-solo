/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "~/server/api/trpc";
import {
  ScanCommand,
  GetItemCommand,
  UpdateItemCommand,
  QueryCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";
import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { dynamoDb, sqs, DELIVERIES_TABLE, QUEUE_URL } from "./common";

export const deliveriesProcedures = {
  // Get recent delivery logs (for real-time feed)
  getRecentDeliveries: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ input }) => {
      try {
        const result = await dynamoDb.send(
          new ScanCommand({ TableName: DELIVERIES_TABLE, Limit: input.limit }),
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
        deliveries.sort((a: any, b: any) => b.timestamp - a.timestamp);
        return deliveries;
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch recent deliveries",
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
          const queryParams: any = {
            TableName: DELIVERIES_TABLE,
            KeyConditionExpression: "endpoint_id = :endpointId",
            ExpressionAttributeValues: {
              ":endpointId": { S: input.endpointId },
            },
            Limit: input.limit,
            ScanIndexForward: false,
          };
          if (input.startKey) {
            queryParams.ExclusiveStartKey = {
              endpoint_id: { S: input.startKey.endpoint_id },
              delivery_id: { S: input.startKey.delivery_id },
            };
          }
          const filterExpressions = [] as string[];
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
          if (input.advancedFilters) {
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
            if (input.advancedFilters.httpStatusCodes?.enabled) {
              const httpFilters: string[] = [];
              if (input.advancedFilters.httpStatusCodes.ranges.length > 0) {
                const rangeFilters =
                  input.advancedFilters.httpStatusCodes.ranges
                    .map((range) => {
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
                    .filter(Boolean) as string[];
                if (rangeFilters.length > 0) {
                  httpFilters.push(`(${rangeFilters.join(" OR ")})`);
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
          const filterExpressions = [] as string[];
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
          if (input.advancedFilters) {
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
            if (input.advancedFilters.httpStatusCodes?.enabled) {
              const httpFilters: string[] = [];
              if (input.advancedFilters.httpStatusCodes.ranges.length > 0) {
                const rangeFilters =
                  input.advancedFilters.httpStatusCodes.ranges
                    .map((range) => {
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
                    .filter(Boolean) as string[];
                if (rangeFilters.length > 0) {
                  httpFilters.push(`(${rangeFilters.join(" OR ")})`);
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
    .input(z.object({ endpointId: z.string(), deliveryId: z.string() }))
    .mutation(async ({ input }) => {
      try {
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
        if (delivery.status?.S !== "failed") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Can only retry failed deliveries",
          });
        }
        const retryPayload = {
          endpoint_id: input.endpointId,
          raw_body: delivery.request_body?.S ?? "",
          headers: delivery.request_headers?.S
            ? JSON.parse(delivery.request_headers.S)
            : {},
          received_at: Date.now(),
          attempt: 0,
          manual_retry: true,
          original_delivery_id: input.deliveryId,
        };
        await sqs.send(
          new SendMessageCommand({
            QueueUrl: QUEUE_URL,
            MessageBody: JSON.stringify(retryPayload),
          }),
        );
        await dynamoDb.send(
          new UpdateItemCommand({
            TableName: DELIVERIES_TABLE,
            Key: {
              endpoint_id: { S: input.endpointId },
              delivery_id: { S: input.deliveryId },
            },
            UpdateExpression: "SET #status = :status, retry_at = :retryAt",
            ExpressionAttributeNames: { "#status": "status" },
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
          .array(z.object({ endpointId: z.string(), deliveryId: z.string() }))
          .min(1)
          .max(50),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const results: Array<{
          deliveryId: string;
          success: boolean;
          error?: string;
        }> = [];
        for (const delivery of input.deliveries) {
          try {
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
            if (deliveryItem.status?.S !== "failed") {
              results.push({
                deliveryId: delivery.deliveryId,
                success: false,
                error: "Can only retry failed deliveries",
              });
              continue;
            }
            const retryPayload = {
              endpoint_id: delivery.endpointId,
              raw_body: deliveryItem.request_body?.S ?? "",
              headers: deliveryItem.request_headers?.S
                ? JSON.parse(deliveryItem.request_headers.S)
                : {},
              received_at: Date.now(),
              attempt: 0,
              manual_retry: true,
              original_delivery_id: delivery.deliveryId,
            };
            await sqs.send(
              new SendMessageCommand({
                QueueUrl: QUEUE_URL,
                MessageBody: JSON.stringify(retryPayload),
              }),
            );
            await dynamoDb.send(
              new UpdateItemCommand({
                TableName: DELIVERIES_TABLE,
                Key: {
                  endpoint_id: { S: delivery.endpointId },
                  delivery_id: { S: delivery.deliveryId },
                },
                UpdateExpression: "SET #status = :status, retry_at = :retryAt",
                ExpressionAttributeNames: { "#status": "status" },
                ExpressionAttributeValues: {
                  ":status": { S: "retrying" },
                  ":retryAt": { N: String(Date.now()) },
                },
              }),
            );
            results.push({ deliveryId: delivery.deliveryId, success: true });
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

  // Bulk delete deliveries
  bulkDeleteDeliveries: protectedProcedure
    .input(
      z.object({
        deliveries: z.array(
          z.object({ endpointId: z.string(), deliveryId: z.string() }),
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

  // Bulk archive deliveries
  bulkArchiveDeliveries: protectedProcedure
    .input(
      z.object({
        deliveries: z.array(
          z.object({ endpointId: z.string(), deliveryId: z.string() }),
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

  // Bulk update status
  bulkUpdateDeliveryStatus: protectedProcedure
    .input(
      z.object({
        deliveries: z.array(
          z.object({ endpointId: z.string(), deliveryId: z.string() }),
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
              const expressionAttributeNames: any = { "#status": "status" };
              if (input.reason)
                expressionAttributeValues[":reason"] = { S: input.reason };
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
};
