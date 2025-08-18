/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "~/server/api/trpc";
import { sqs, s3, DLQ_BUCKET, QUEUE_URL } from "./common";
import {
  ListObjectsV2Command,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { SendMessageCommand } from "@aws-sdk/client-sqs";

export const dlqProcedures = {
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

        const retryPayload = {
          endpoint_id: dlqData.endpoint_id,
          raw_body: dlqData.original_payload ?? "",
          headers: dlqData.original_headers ?? {},
          received_at: Date.now(),
          attempt: 0,
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
        const results = [] as Array<{
          key: string;
          success: boolean;
          error?: string;
        }>;

        for (const key of input.dlqKeys) {
          try {
            await s3.send(
              new DeleteObjectCommand({
                Bucket: DLQ_BUCKET,
                Key: key,
              }),
            );

            results.push({ key, success: true });
          } catch (error) {
            results.push({ key, success: false, error: String(error) });
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
};
