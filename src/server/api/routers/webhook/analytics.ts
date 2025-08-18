/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "~/server/api/trpc";
import { ScanCommand } from "@aws-sdk/client-dynamodb";
import { dynamoDb, DELIVERIES_TABLE } from "./common";

export const analyticsProcedures = {
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
        let interval: number;
        switch (input.timeRange) {
          case "1h":
            startTime = now - 60 * 60 * 1000;
            interval = 5 * 60 * 1000;
            break;
          case "24h":
            startTime = now - 24 * 60 * 60 * 1000;
            interval = 60 * 60 * 1000;
            break;
          case "7d":
            startTime = now - 7 * 24 * 60 * 60 * 1000;
            interval = 4 * 60 * 60 * 1000;
            break;
          case "30d":
            startTime = now - 30 * 24 * 60 * 60 * 1000;
            interval = 24 * 60 * 60 * 1000;
            break;
          default:
            startTime = now - 24 * 60 * 60 * 1000;
            interval = 60 * 60 * 1000;
        }

        const scanParams: any = {
          TableName: DELIVERIES_TABLE,
          FilterExpression: "#timestamp BETWEEN :startTime AND :endTime",
          ExpressionAttributeNames: { "#timestamp": "timestamp" },
          ExpressionAttributeValues: {
            ":startTime": { N: startTime.toString() },
            ":endTime": { N: now.toString() },
          },
        };
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

        const intervals = Math.ceil((now - startTime) / interval);
        const timeSeriesData: Array<{
          timestamp: number;
          time: string;
          successful: number;
          failed: number;
          pending: number;
          retrying: number;
          total: number;
          successRate: number;
        }> = [];
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

        deliveries.forEach((delivery) => {
          totalDeliveries++;
          if (delivery.status === "success") successfulDeliveries++;
          endpointStats[delivery.endpointId] ??= {
            success: 0,
            failed: 0,
            total: 0,
          };
          endpointStats[delivery.endpointId]!.total++;
          if (delivery.status === "success")
            endpointStats[delivery.endpointId]!.success++;
          else if (delivery.status === "failed")
            endpointStats[delivery.endpointId]!.failed++;
          if (delivery.responseStatus)
            statusCodeStats[delivery.responseStatus] =
              (statusCodeStats[delivery.responseStatus] ?? 0) + 1;
          if (delivery.durationMs) {
            totalResponseTime += delivery.durationMs;
            responseTimeCount++;
          }
        });
        if (responseTimeCount > 0)
          averageResponseTime = Math.round(
            totalResponseTime / responseTimeCount,
          );
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
};
