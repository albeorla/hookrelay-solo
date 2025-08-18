/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "~/server/api/trpc";
import { ScanCommand } from "@aws-sdk/client-dynamodb";
import { GetQueueAttributesCommand } from "@aws-sdk/client-sqs";
import { dynamoDb, sqs, DELIVERIES_TABLE, QUEUE_URL } from "./common";

export const healthProcedures = {
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
        const queueStats = await sqs.send(
          new GetQueueAttributesCommand({
            QueueUrl: QUEUE_URL,
            AttributeNames: ["All"],
          }),
        );
        const deliveriesResult = await dynamoDb.send(
          new ScanCommand({ TableName: DELIVERIES_TABLE, Limit: 100 }),
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
        const alerts: any[] = [];
        const now = new Date();
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
            metadata: { totalDeliveries, failedDeliveries, timeWindow: 10 },
          });
        }
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
            metadata: { queueDepth, timeWindow: 5 },
          });
        }
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

  acknowledgeHealthAlert: protectedProcedure
    .input(z.object({ alertId: z.string(), note: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      try {
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

  getHealthConfig: protectedProcedure.query(async () => {
    try {
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
          notifications: { email: true, slack: true, sms: true },
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
          notifications: { email: true, slack: true, sms: false },
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
          notifications: { email: true, slack: true, sms: true },
        },
      ];
      return {
        thresholds: defaultThresholds,
        notificationChannels: {
          email: { enabled: true, address: "alerts@example.com" },
          slack: {
            enabled: true,
            webhook: "https://hooks.slack.com/services/...",
          },
          sms: { enabled: false, number: "+1234567890" },
        },
        monitoringEnabled: true,
        checkInterval: 60,
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get health configuration",
      });
    }
  }),

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
              .object({ enabled: z.boolean(), address: z.string() })
              .optional(),
            slack: z
              .object({ enabled: z.boolean(), webhook: z.string() })
              .optional(),
            sms: z
              .object({ enabled: z.boolean(), number: z.string() })
              .optional(),
          })
          .optional(),
        monitoringEnabled: z.boolean().optional(),
        checkInterval: z.number().min(10).max(3600).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
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
};
