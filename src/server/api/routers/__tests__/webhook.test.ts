import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TRPCError } from "@trpc/server";
import type { inferProcedureInput } from "@trpc/server";

// Create mock instances that we can control - use vi.hoisted to ensure they're available
const { mockDynamoSend, mockSQSSend, mockS3Send } = vi.hoisted(() => {
  return {
    mockDynamoSend: vi.fn(),
    mockSQSSend: vi.fn(),
    mockS3Send: vi.fn(),
  };
});

// Mock environment variables and Next.js dependencies
vi.mock("~/env.js", () => ({
  env: {
    NODE_ENV: "test",
    DATABASE_URL: "postgres://test:test@localhost/test",
    AWS_REGION: "us-east-1",
    AWS_DDB_ENDPOINT: "http://localhost:4566",
    AWS_SQS_ENDPOINT: "http://localhost:4566",
    AWS_S3_ENDPOINT: "http://localhost:4566",
    NEXTAUTH_SECRET: "test-secret",
    NEXTAUTH_URL: "http://localhost:3000",
    DISCORD_CLIENT_ID: "test-discord-id",
    DISCORD_CLIENT_SECRET: "test-discord-secret",
  },
}));

// Mock Next.js server
vi.mock("next/server", () => ({}));

// Mock NextAuth
vi.mock("next-auth", () => ({
  default: vi.fn(),
}));

vi.mock("next-auth/providers/discord", () => ({
  default: vi.fn(() => ({
    id: "discord",
    name: "Discord",
  })),
}));

// Mock Prisma
vi.mock("~/server/db", () => ({
  db: {},
}));

import { webhookRouter } from "../webhook";
import { createTRPCRouter } from "~/server/api/trpc";

// Mock AWS SDK
vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: vi.fn(() => ({
    send: mockDynamoSend,
  })),
  ScanCommand: vi.fn((params) => params),
  GetItemCommand: vi.fn((params) => params),
  PutItemCommand: vi.fn((params) => params),
  DeleteItemCommand: vi.fn((params) => params),
  UpdateItemCommand: vi.fn((params) => params),
  QueryCommand: vi.fn((params) => params),
}));

vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: vi.fn(() => ({
    send: mockSQSSend,
  })),
  GetQueueAttributesCommand: vi.fn((params) => params),
  SendMessageCommand: vi.fn((params) => params),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(() => ({
    send: mockS3Send,
  })),
  ListObjectsV2Command: vi.fn((params) => params),
  GetObjectCommand: vi.fn((params) => params),
  DeleteObjectCommand: vi.fn((params) => params),
}));

// Mock crypto
vi.mock("crypto", () => ({
  default: {
    randomBytes: vi.fn(() => ({
      toString: vi.fn(() => "mock-secret-key-12345"),
    })),
  },
}));

// Create caller for testing
const createCaller = (ctx: any) => {
  const testRouter = createTRPCRouter({
    webhook: webhookRouter,
  });
  return testRouter.createCaller(ctx);
};

// Mock context
const mockContext = {
  session: {
    user: {
      id: "test-user-id",
      roles: ["ADMIN"],
    },
  },
  db: {} as any, // Not used in webhook router
};

describe("Webhook Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("getEndpoints", () => {
    it("should return formatted endpoints successfully", async () => {
      const mockEndpoints = {
        Items: [
          {
            endpoint_id: { S: "ep_test_1" },
            dest_url: { S: "https://example.com/webhook" },
            hmac_mode: { S: "stripe" },
            secret: { S: "secret-key" },
          },
          {
            endpoint_id: { S: "ep_test_2" },
            dest_url: { S: "https://api.test.com/hooks" },
          },
        ],
      };

      mockDynamoSend.mockResolvedValue(mockEndpoints);

      const caller = createCaller(mockContext);
      const result = await caller.webhook.getEndpoints();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: "ep_test_1",
        url: "https://example.com/webhook",
        hmacMode: "stripe",
        hasSecret: true,
        isActive: true,
      });
      expect(result[1]).toMatchObject({
        id: "ep_test_2",
        url: "https://api.test.com/hooks",
        hasSecret: false,
      });
    });

    it("should handle DynamoDB errors", async () => {
      mockDynamoSend.mockRejectedValue(new Error("DynamoDB error"));

      const caller = createCaller(mockContext);

      await expect(caller.webhook.getEndpoints()).rejects.toThrow(TRPCError);
    });

    it("should return empty array when no endpoints exist", async () => {
      mockDynamoSend.mockResolvedValue({ Items: [] });

      const caller = createCaller(mockContext);
      const result = await caller.webhook.getEndpoints();

      expect(result).toEqual([]);
    });
  });

  describe("getEndpoint", () => {
    it("should return specific endpoint successfully", async () => {
      const mockEndpoint = {
        Item: {
          endpoint_id: { S: "ep_test_1" },
          dest_url: { S: "https://example.com/webhook" },
          hmac_mode: { S: "github" },
          secret: { S: "secret-key" },
        },
      };

      mockDynamoSend.mockResolvedValue(mockEndpoint);

      const caller = createCaller(mockContext);
      const result = await caller.webhook.getEndpoint({
        endpointId: "ep_test_1",
      });

      expect(result).toMatchObject({
        id: "ep_test_1",
        url: "https://example.com/webhook",
        hmacMode: "github",
        hasSecret: true,
      });
    });

    it("should throw NOT_FOUND when endpoint does not exist", async () => {
      mockDynamoSend.mockResolvedValue({ Item: null });

      const caller = createCaller(mockContext);

      await expect(
        caller.webhook.getEndpoint({ endpointId: "nonexistent" }),
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("createEndpoint", () => {
    it("should create endpoint successfully", async () => {
      mockDynamoSend.mockResolvedValue({});

      const caller = createCaller(mockContext);
      const input = {
        endpointId: "ep_new_test",
        destUrl: "https://test.com/webhook",
        hmacMode: "stripe" as const,
        secret: "test-secret",
      };

      const result = await caller.webhook.createEndpoint(input);

      expect(result).toEqual({ success: true });
      expect(mockDynamoSend).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: "hookrelay-endpoints",
          ConditionExpression: "attribute_not_exists(endpoint_id)",
        }),
      );
    });

    it("should handle endpoint already exists conflict", async () => {
      const conflictError = new Error("ConditionalCheckFailedException");
      conflictError.name = "ConditionalCheckFailedException";
      mockDynamoSend.mockRejectedValue(conflictError);

      const caller = createCaller(mockContext);
      const input = {
        endpointId: "ep_existing",
        destUrl: "https://test.com/webhook",
      };

      await expect(caller.webhook.createEndpoint(input)).rejects.toThrow(
        TRPCError,
      );
    });

    it("should create endpoint without optional fields", async () => {
      mockDynamoSend.mockResolvedValue({});

      const caller = createCaller(mockContext);
      const input = {
        endpointId: "ep_minimal",
        destUrl: "https://test.com/webhook",
      };

      const result = await caller.webhook.createEndpoint(input);

      expect(result).toEqual({ success: true });
    });
  });

  describe("deleteEndpoint", () => {
    it("should delete endpoint successfully", async () => {
      mockDynamoSend.mockResolvedValue({});

      const caller = createCaller(mockContext);
      const result = await caller.webhook.deleteEndpoint({
        endpointId: "ep_to_delete",
      });

      expect(result).toEqual({ success: true });
      expect(mockDynamoSend).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: "hookrelay-endpoints",
          Key: { endpoint_id: { S: "ep_to_delete" } },
        }),
      );
    });

    it("should handle delete errors", async () => {
      mockDynamoSend.mockRejectedValue(new Error("Delete failed"));

      const caller = createCaller(mockContext);

      await expect(
        caller.webhook.deleteEndpoint({ endpointId: "ep_error" }),
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("generateHmacSecret", () => {
    it("should generate and store new secret", async () => {
      mockDynamoSend.mockResolvedValue({});

      const caller = createCaller(mockContext);
      const result = await caller.webhook.generateHmacSecret({
        endpointId: "ep_test",
      });

      expect(result).toEqual({ secret: "mock-secret-key-12345" });
      expect(mockDynamoSend).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: "hookrelay-endpoints",
          UpdateExpression: "SET secret = :secret, updated_at = :updatedAt",
        }),
      );
    });

    it("should handle endpoint not found", async () => {
      const notFoundError = new Error("ConditionalCheckFailedException");
      notFoundError.name = "ConditionalCheckFailedException";
      mockDynamoSend.mockRejectedValue(notFoundError);

      const caller = createCaller(mockContext);

      await expect(
        caller.webhook.generateHmacSecret({ endpointId: "nonexistent" }),
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("testEndpoint", () => {
    it("should test endpoint successfully with 200 response", async () => {
      // Mock the endpoint lookup
      mockDynamoSend.mockResolvedValue({
        Item: {
          endpoint_id: { S: "ep_test" },
          dest_url: { S: "https://example.com/webhook" },
        },
      });

      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Map([["content-type", "application/json"]]),
        text: () => Promise.resolve('{"received": true}'),
      });

      const caller = createCaller(mockContext);
      const result = await caller.webhook.testEndpoint({
        endpointId: "ep_test",
        payload: '{"test": true}',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(result.body).toBe('{"received": true}');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it("should handle network errors during test", async () => {
      mockDynamoSend.mockResolvedValue({
        Item: {
          endpoint_id: { S: "ep_test" },
          dest_url: { S: "https://unreachable.com/webhook" },
        },
      });

      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const caller = createCaller(mockContext);
      const result = await caller.webhook.testEndpoint({
        endpointId: "ep_test",
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(0);
      expect(result.error).toContain("Network error");
    });

    it("should handle endpoint not found during test", async () => {
      mockDynamoSend.mockResolvedValue({ Item: null });

      const caller = createCaller(mockContext);

      await expect(
        caller.webhook.testEndpoint({ endpointId: "nonexistent" }),
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("getStats", () => {
    it("should return comprehensive stats", async () => {
      // Mock SQS queue attributes
      mockSQSSend.mockResolvedValueOnce({
        Attributes: {
          ApproximateNumberOfMessages: "5",
          ApproximateNumberOfMessagesDelayed: "2",
          ApproximateNumberOfMessagesNotVisible: "1",
        },
      });

      // Mock endpoints count
      mockDynamoSend.mockResolvedValueOnce({
        Count: 3,
      });

      // Mock deliveries
      mockDynamoSend.mockResolvedValueOnce({
        Items: [
          {
            endpoint_id: { S: "ep_1" },
            delivery_id: { S: "del_1" },
            status: { S: "success" },
            timestamp: { N: String(Date.now()) },
          },
          {
            endpoint_id: { S: "ep_1" },
            delivery_id: { S: "del_2" },
            status: { S: "failed" },
            timestamp: { N: String(Date.now()) },
          },
        ],
        Count: 2,
      });

      const caller = createCaller(mockContext);
      const result = await caller.webhook.getStats();

      expect(result).toMatchObject({
        totalDeliveries: 2,
        successRate: 50,
        endpoints: { total: 3 },
        queue: {
          approximate: 5,
          delayed: 2,
          notVisible: 1,
        },
        deliveries: {
          total: 2,
          failed: 1,
          pending: 0,
          retrying: 0,
        },
      });
    });

    it("should handle AWS service errors", async () => {
      mockSQSSend.mockRejectedValue(new Error("SQS error"));

      const caller = createCaller(mockContext);

      await expect(caller.webhook.getStats()).rejects.toThrow(TRPCError);
    });
  });

  describe("getDeliveryLogs", () => {
    it("should return filtered delivery logs", async () => {
      const mockDeliveries = {
        Items: [
          {
            endpoint_id: { S: "ep_1" },
            delivery_id: { S: "del_1" },
            status: { S: "success" },
            timestamp: { N: String(Date.now()) },
            dest_url: { S: "https://example.com" },
            attempt: { N: "1" },
            response_status: { N: "200" },
            duration_ms: { N: "150" },
          },
        ],
      };

      mockDynamoSend.mockResolvedValue(mockDeliveries);

      const caller = createCaller(mockContext);
      const result = await caller.webhook.getDeliveryLogs({
        status: "success",
        limit: 10,
      });

      expect(result.deliveries).toHaveLength(1);
      expect(result.deliveries[0]).toMatchObject({
        endpointId: "ep_1",
        deliveryId: "del_1",
        status: "success",
        responseStatus: 200,
        durationMs: 150,
      });
    });

    it("should handle search filtering", async () => {
      const mockDeliveries = {
        Items: [
          {
            endpoint_id: { S: "ep_search_test" },
            delivery_id: { S: "del_search_123" },
            status: { S: "failed" },
            timestamp: { N: String(Date.now()) },
            dest_url: { S: "https://example.com" },
            attempt: { N: "3" },
          },
        ],
      };

      mockDynamoSend.mockResolvedValue(mockDeliveries);

      const caller = createCaller(mockContext);
      const result = await caller.webhook.getDeliveryLogs({
        search: "search",
        limit: 10,
      });

      expect(mockDynamoSend).toHaveBeenCalledWith(
        expect.objectContaining({
          FilterExpression: expect.stringContaining("contains"),
        }),
      );
    });
  });

  describe("retryDelivery", () => {
    it("should retry failed delivery successfully", async () => {
      // Mock getting the delivery record
      mockDynamoSend.mockResolvedValueOnce({
        Item: {
          endpoint_id: { S: "ep_1" },
          delivery_id: { S: "del_failed" },
          status: { S: "failed" },
          request_body: { S: '{"test": true}' },
          request_headers: { S: '{"content-type": "application/json"}' },
        },
      });

      // Mock SQS send
      mockSQSSend.mockResolvedValue({});

      // Mock status update
      mockDynamoSend.mockResolvedValueOnce({});

      const caller = createCaller(mockContext);
      const result = await caller.webhook.retryDelivery({
        endpointId: "ep_1",
        deliveryId: "del_failed",
      });

      expect(result).toEqual({ success: true });
      expect(mockSQSSend).toHaveBeenCalledWith(
        expect.objectContaining({
          MessageBody: expect.stringContaining("ep_1"),
        }),
      );
    });

    it("should reject retry for non-failed deliveries", async () => {
      mockDynamoSend.mockResolvedValue({
        Item: {
          status: { S: "success" },
        },
      });

      const caller = createCaller(mockContext);

      await expect(
        caller.webhook.retryDelivery({
          endpointId: "ep_1",
          deliveryId: "del_success",
        }),
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("Auth and Permissions", () => {
    it("should reject requests from non-admin users", async () => {
      const nonAdminContext = {
        session: {
          user: {
            id: "test-user",
            roles: ["USER"],
          },
        },
        db: {} as any,
      };

      const caller = createCaller(nonAdminContext);

      // Should reject all protected procedures
      await expect(caller.webhook.getEndpoints()).rejects.toThrow();
    });

    it("should reject requests from unauthenticated users", async () => {
      const unauthenticatedContext = {
        session: null,
        db: {} as any,
      };

      const caller = createCaller(unauthenticatedContext);

      await expect(caller.webhook.getEndpoints()).rejects.toThrow();
    });
  });
});
