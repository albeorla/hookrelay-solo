/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "~/server/api/trpc";
import { ScanCommand } from "@aws-sdk/client-dynamodb";
import { GetQueueAttributesCommand } from "@aws-sdk/client-sqs";
import {
  dynamoDb,
  sqs,
  ENDPOINTS_TABLE,
  DELIVERIES_TABLE,
  QUEUE_URL,
} from "./common";

export const statsProcedures = {
  getStats: protectedProcedure.query(async () => {
    try {
      const queueStats = await sqs.send(
        new GetQueueAttributesCommand({
          QueueUrl: QUEUE_URL,
          AttributeNames: ["All"],
        }),
      );
      const endpointsResult = await dynamoDb.send(
        new ScanCommand({ TableName: ENDPOINTS_TABLE, Select: "COUNT" }),
      );
      const deliveriesResult = await dynamoDb.send(
        new ScanCommand({ TableName: DELIVERIES_TABLE, Limit: 100 }),
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
        endpoints: { total: endpointsResult.Count ?? 0 },
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
};
