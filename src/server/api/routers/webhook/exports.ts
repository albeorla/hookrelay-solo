/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "~/server/api/trpc";
import { ScanCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { dynamoDb, DELIVERIES_TABLE, formatAsCSV } from "./common";

export const exportsProcedures = {
  exportDeliveries: protectedProcedure
    .input(
      z.object({
        format: z.enum(["csv", "json", "xlsx"]),
        dateRange: z.object({ start: z.string(), end: z.string() }),
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
    .mutation(async ({ input }) => {
      try {
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
          const scanParams: any = {
            TableName: DELIVERIES_TABLE,
            Limit: input.maxRecords,
            FilterExpression: "#ts BETWEEN :start_time AND :end_time",
            ExpressionAttributeNames: { "#ts": "timestamp" },
            ExpressionAttributeValues: {
              ":start_time": { N: String(startTime) },
              ":end_time": { N: String(endTime) },
            },
          };
          if (input.filters.status) {
            scanParams.FilterExpression += " AND #status = :status";
            scanParams.ExpressionAttributeNames["#status"] = "status";
            scanParams.ExpressionAttributeValues[":status"] = {
              S: input.filters.status,
            };
          }
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
          deliveries.sort((a, b) => b.timestamp - a.timestamp);
        }

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
                if (input.includeHeaders)
                  filtered.requestHeaders = delivery.requestHeaders;
                break;
              case "responseHeaders":
                if (input.includeHeaders)
                  filtered.responseHeaders = delivery.responseHeaders;
                break;
              case "requestBody":
                if (input.includePayloads)
                  filtered.requestBody = delivery.requestBody;
                break;
              case "responseBody":
                if (input.includePayloads)
                  filtered.responseBody = delivery.responseBody;
                break;
              case "error":
                filtered.error = delivery.error;
                break;
            }
          }
          return filtered;
        });

        const timestamp = new Date().toISOString().split("T")[0];
        const filename = `webhook-deliveries-${timestamp}.${input.format}`;
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
};
