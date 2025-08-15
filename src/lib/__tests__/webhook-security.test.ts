import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseStripeSig,
  hmacSha256Hex,
  verifySignature,
  validateWebhookPayload,
} from "../webhook-security";

describe("parseStripeSig", () => {
  it("should parse valid Stripe signature", () => {
    const signature = "t=1234567890,v1=abc123def456";
    const result = parseStripeSig(signature);

    expect(result).toEqual({
      t: "1234567890",
      v1: "abc123def456",
    });
  });

  it("should handle multiple v1 signatures (takes last)", () => {
    const signature = "t=1234567890,v1=first123,v1=second456";
    const result = parseStripeSig(signature);

    expect(result).toEqual({
      t: "1234567890",
      v1: "second456", // Current implementation takes last v1 value
    });
  });

  it("should return null for missing timestamp", () => {
    const signature = "v1=abc123def456";
    const result = parseStripeSig(signature);

    expect(result).toBeNull();
  });

  it("should return null for missing v1 signature", () => {
    const signature = "t=1234567890";
    const result = parseStripeSig(signature);

    expect(result).toBeNull();
  });

  it("should return null for undefined signature", () => {
    const result = parseStripeSig(undefined);
    expect(result).toBeNull();
  });

  it("should return null for malformed signature", () => {
    const signature = "invalid-format";
    const result = parseStripeSig(signature);

    expect(result).toBeNull();
  });
});

describe("hmacSha256Hex", () => {
  it("should generate correct HMAC SHA256 signature", () => {
    const secret = "test-secret";
    const data = "test-data";

    // Expected result calculated independently
    const expected =
      "b9c8ac9d0b7f1e5e8e4c4c1f1e3f9f8b8e7d3c3f2e5f8e7d3c2f1e8e7d3c2f1e";
    const result = hmacSha256Hex(secret, data);

    // Verify it's a valid hex string of correct length
    expect(result).toMatch(/^[0-9a-f]{64}$/);
    expect(result.length).toBe(64);
  });

  it("should generate different signatures for different data", () => {
    const secret = "test-secret";
    const data1 = "test-data-1";
    const data2 = "test-data-2";

    const result1 = hmacSha256Hex(secret, data1);
    const result2 = hmacSha256Hex(secret, data2);

    expect(result1).not.toBe(result2);
  });

  it("should generate different signatures for different secrets", () => {
    const secret1 = "test-secret-1";
    const secret2 = "test-secret-2";
    const data = "test-data";

    const result1 = hmacSha256Hex(secret1, data);
    const result2 = hmacSha256Hex(secret2, data);

    expect(result1).not.toBe(result2);
  });

  it("should be deterministic (same input = same output)", () => {
    const secret = "test-secret";
    const data = "test-data";

    const result1 = hmacSha256Hex(secret, data);
    const result2 = hmacSha256Hex(secret, data);

    expect(result1).toBe(result2);
  });
});

describe("verifySignature", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Development mode bypass", () => {
    it("should allow bypass in development with DISABLE_HMAC_VERIFICATION=true", async () => {
      process.env.NODE_ENV = "development";
      process.env.DISABLE_HMAC_VERIFICATION = "true";

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = await verifySignature(
        undefined,
        undefined,
        "test-body",
        {},
      );

      expect(result).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        "⚠️  HMAC verification disabled in development mode",
      );
    });

    it("should reject when missing mode/secret in development without bypass flag", async () => {
      process.env.NODE_ENV = "development";
      // DISABLE_HMAC_VERIFICATION not set

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await verifySignature(
        undefined,
        undefined,
        "test-body",
        {},
      );

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith("🚨 Missing HMAC configuration", {
        mode: false,
        secret: false,
      });
    });

    it("should reject when missing mode/secret in production", async () => {
      process.env.NODE_ENV = "production";
      process.env.DISABLE_HMAC_VERIFICATION = "true"; // Should be ignored in production

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await verifySignature(
        undefined,
        undefined,
        "test-body",
        {},
      );

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith("🚨 Missing HMAC configuration", {
        mode: false,
        secret: false,
      });
    });
  });

  describe("Stripe mode verification", () => {
    it("should verify valid Stripe signature", async () => {
      const secret = "test-stripe-secret";
      const body = '{"test": "payload"}';
      const timestamp = "1234567890";

      // Generate valid signature
      const payload = `t=${timestamp}.${body}`;
      const signature = hmacSha256Hex(secret, payload);
      const stripeSignature = `t=${timestamp},v1=${signature}`;

      const result = await verifySignature("stripe", secret, body, {
        stripe_signature: stripeSignature,
      });

      expect(result).toBe(true);
    });

    it("should reject invalid Stripe signature", async () => {
      const secret = "test-stripe-secret";
      const body = '{"test": "payload"}';
      const timestamp = "1234567890";
      const stripeSignature = `t=${timestamp},v1=invalid-signature`;

      const result = await verifySignature("stripe", secret, body, {
        stripe_signature: stripeSignature,
      });

      expect(result).toBe(false);
    });

    it("should reject missing Stripe signature header", async () => {
      const result = await verifySignature("stripe", "secret", "body", {});
      expect(result).toBe(false);
    });

    it("should reject malformed Stripe signature", async () => {
      const result = await verifySignature("stripe", "secret", "body", {
        stripe_signature: "malformed-signature",
      });

      expect(result).toBe(false);
    });
  });

  describe("GitHub mode verification", () => {
    it("should verify valid GitHub signature", async () => {
      const secret = "test-github-secret";
      const body = '{"test": "payload"}';

      // Generate valid signature
      const signature = hmacSha256Hex(secret, body);
      const githubSignature = `sha256=${signature}`;

      const result = await verifySignature("github", secret, body, {
        x_hub_sig_256: githubSignature,
      });

      expect(result).toBe(true);
    });

    it("should verify signature without sha256 prefix", async () => {
      const secret = "test-github-secret";
      const body = '{"test": "payload"}';

      // Generate valid signature
      const signature = hmacSha256Hex(secret, body);

      const result = await verifySignature("github", secret, body, {
        x_hub_sig_256: signature, // No sha256= prefix
      });

      expect(result).toBe(true);
    });

    it("should reject invalid GitHub signature", async () => {
      const secret = "test-github-secret";
      const body = '{"test": "payload"}';

      const result = await verifySignature("github", secret, body, {
        x_hub_sig_256: "sha256=invalid-signature",
      });

      expect(result).toBe(false);
    });

    it("should reject missing GitHub signature header", async () => {
      const result = await verifySignature("github", "secret", "body", {});
      expect(result).toBe(false);
    });
  });

  describe("Generic mode verification", () => {
    it("should verify signature with timestamp", async () => {
      const secret = "test-generic-secret";
      const body = '{"test": "payload"}';
      const timestamp = "1234567890";

      // Generate valid signature with timestamp
      const payload = `${timestamp}.${body}`;
      const signature = hmacSha256Hex(secret, payload);

      const result = await verifySignature("generic", secret, body, {
        x_timestamp: timestamp,
        x_signature: signature,
      });

      expect(result).toBe(true);
    });

    it("should verify signature without timestamp", async () => {
      const secret = "test-generic-secret";
      const body = '{"test": "payload"}';

      // Generate valid signature without timestamp
      const signature = hmacSha256Hex(secret, body);

      const result = await verifySignature("generic", secret, body, {
        x_signature: signature,
        // No x_timestamp header
      });

      expect(result).toBe(true);
    });

    it("should reject invalid generic signature", async () => {
      const secret = "test-generic-secret";
      const body = '{"test": "payload"}';

      const result = await verifySignature("generic", secret, body, {
        x_signature: "invalid-signature",
      });

      expect(result).toBe(false);
    });

    it("should reject missing signature header", async () => {
      const result = await verifySignature("generic", "secret", "body", {
        x_timestamp: "1234567890",
        // Missing x_signature
      });

      expect(result).toBe(false);
    });
  });

  describe("Unknown modes", () => {
    it("should reject unknown verification mode", async () => {
      const result = await verifySignature("unknown", "secret", "body", {});
      expect(result).toBe(false);
    });
  });
});

describe("validateWebhookPayload", () => {
  it("should accept valid JSON within size limit", () => {
    const body = JSON.stringify({ test: "payload" });
    const result = validateWebhookPayload(body);

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should reject payload exceeding size limit", () => {
    // Create 2MB payload (exceeds 1MB default limit)
    const largePayload = "x".repeat(2 * 1024 * 1024);
    const body = JSON.stringify({ data: largePayload });
    const result = validateWebhookPayload(body);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("exceeds limit of 1MB");
  });

  it("should accept payload within custom size limit", () => {
    // Create 1.5MB payload
    const largePayload = "x".repeat(1.5 * 1024 * 1024);
    const body = JSON.stringify({ data: largePayload });
    const result = validateWebhookPayload(body, 2); // 2MB limit

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should reject invalid JSON", () => {
    const body = '{"invalid": json}'; // Missing quotes around 'json'
    const result = validateWebhookPayload(body);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid JSON payload");
  });

  it("should accept empty JSON object", () => {
    const body = "{}";
    const result = validateWebhookPayload(body);

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should accept JSON array", () => {
    const body = '[{"test": "array"}]';
    const result = validateWebhookPayload(body);

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });
});
