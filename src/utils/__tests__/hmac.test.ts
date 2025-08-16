import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import {
  verifyHmacSignature,
  generateHmacSignature,
  type HmacMode,
} from "../hmac";

describe("HMAC Utilities", () => {
  const testPayload = JSON.stringify({ test: true, timestamp: 1640995200 });
  const testSecret = "test-secret-key-12345";

  describe("Stripe HMAC", () => {
    it("should generate valid Stripe signature", () => {
      const signature = generateHmacSignature(
        testPayload,
        testSecret,
        "stripe",
      );

      expect(signature).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);
    });

    it("should verify valid Stripe signature", () => {
      const signature = generateHmacSignature(
        testPayload,
        testSecret,
        "stripe",
      );
      const result = verifyHmacSignature(
        testPayload,
        signature,
        testSecret,
        "stripe",
      );

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject invalid Stripe signature", () => {
      const invalidSignature = "t=1640995200,v1=invalid";
      const result = verifyHmacSignature(
        testPayload,
        invalidSignature,
        testSecret,
        "stripe",
      );

      expect(result.isValid).toBe(false);
    });

    it("should reject malformed Stripe signature", () => {
      const malformedSignature = "malformed-signature";
      const result = verifyHmacSignature(
        testPayload,
        malformedSignature,
        testSecret,
        "stripe",
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Invalid Stripe signature format");
    });

    it("should reject signatures with old timestamps", () => {
      // Create signature with timestamp from 10 minutes ago (600 seconds)
      const oldTimestamp = Math.floor(Date.now() / 1000) - 600;
      const payloadForSigning = `${oldTimestamp}.${testPayload}`;
      const signature = crypto
        .createHmac("sha256", testSecret)
        .update(payloadForSigning, "utf8")
        .digest("hex");
      const fullSignature = `t=${oldTimestamp},v1=${signature}`;

      const result = verifyHmacSignature(
        testPayload,
        fullSignature,
        testSecret,
        "stripe",
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Signature timestamp too old");
    });

    it("should accept signatures within time tolerance", () => {
      // Create signature with timestamp from 2 minutes ago (120 seconds)
      const recentTimestamp = Math.floor(Date.now() / 1000) - 120;
      const payloadForSigning = `${recentTimestamp}.${testPayload}`;
      const signature = crypto
        .createHmac("sha256", testSecret)
        .update(payloadForSigning, "utf8")
        .digest("hex");
      const fullSignature = `t=${recentTimestamp},v1=${signature}`;

      const result = verifyHmacSignature(
        testPayload,
        fullSignature,
        testSecret,
        "stripe",
      );

      expect(result.isValid).toBe(true);
    });
  });

  describe("GitHub HMAC", () => {
    it("should generate valid GitHub signature", () => {
      const signature = generateHmacSignature(
        testPayload,
        testSecret,
        "github",
      );

      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    it("should verify valid GitHub signature", () => {
      const signature = generateHmacSignature(
        testPayload,
        testSecret,
        "github",
      );
      const result = verifyHmacSignature(
        testPayload,
        signature,
        testSecret,
        "github",
      );

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject invalid GitHub signature", () => {
      const invalidSignature = "sha256=invalid";
      const result = verifyHmacSignature(
        testPayload,
        invalidSignature,
        testSecret,
        "github",
      );

      expect(result.isValid).toBe(false);
    });

    it("should reject malformed GitHub signature", () => {
      const malformedSignature = "malformed-signature";
      const result = verifyHmacSignature(
        testPayload,
        malformedSignature,
        testSecret,
        "github",
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Invalid GitHub signature format");
    });

    it("should generate consistent signatures", () => {
      const signature1 = generateHmacSignature(
        testPayload,
        testSecret,
        "github",
      );
      const signature2 = generateHmacSignature(
        testPayload,
        testSecret,
        "github",
      );

      expect(signature1).toBe(signature2);
    });
  });

  describe("Generic HMAC", () => {
    it("should generate valid generic signature", () => {
      const signature = generateHmacSignature(
        testPayload,
        testSecret,
        "generic",
      );

      expect(signature).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should verify valid generic signature", () => {
      const signature = generateHmacSignature(
        testPayload,
        testSecret,
        "generic",
      );
      const result = verifyHmacSignature(
        testPayload,
        signature,
        testSecret,
        "generic",
      );

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject invalid generic signature", () => {
      const invalidSignature = "invalid";
      const result = verifyHmacSignature(
        testPayload,
        invalidSignature,
        testSecret,
        "generic",
      );

      expect(result.isValid).toBe(false);
    });

    it("should be consistent across calls", () => {
      const signature1 = generateHmacSignature(
        testPayload,
        testSecret,
        "generic",
      );
      const signature2 = generateHmacSignature(
        testPayload,
        testSecret,
        "generic",
      );

      expect(signature1).toBe(signature2);
    });
  });

  describe("Edge Cases and Security", () => {
    it("should handle empty payload", () => {
      const emptyPayload = "";
      const signature = generateHmacSignature(
        emptyPayload,
        testSecret,
        "github",
      );
      const result = verifyHmacSignature(
        emptyPayload,
        signature,
        testSecret,
        "github",
      );

      expect(result.isValid).toBe(true);
    });

    it("should handle empty secret", () => {
      const emptySecret = "";
      const signature = generateHmacSignature(
        testPayload,
        emptySecret,
        "generic",
      );
      const result = verifyHmacSignature(
        testPayload,
        signature,
        emptySecret,
        "generic",
      );

      expect(result.isValid).toBe(true);
    });

    it("should be sensitive to payload changes", () => {
      const signature = generateHmacSignature(
        testPayload,
        testSecret,
        "generic",
      );
      const modifiedPayload = testPayload + " ";
      const result = verifyHmacSignature(
        modifiedPayload,
        signature,
        testSecret,
        "generic",
      );

      expect(result.isValid).toBe(false);
    });

    it("should be sensitive to secret changes", () => {
      const signature = generateHmacSignature(
        testPayload,
        testSecret,
        "generic",
      );
      const wrongSecret = testSecret + " ";
      const result = verifyHmacSignature(
        testPayload,
        signature,
        wrongSecret,
        "generic",
      );

      expect(result.isValid).toBe(false);
    });

    it("should handle large payloads", () => {
      const largePayload = JSON.stringify({
        data: "x".repeat(10000),
        timestamp: Date.now(),
      });
      const signature = generateHmacSignature(
        largePayload,
        testSecret,
        "stripe",
      );
      const result = verifyHmacSignature(
        largePayload,
        signature,
        testSecret,
        "stripe",
      );

      expect(result.isValid).toBe(true);
    });

    it("should handle special characters in payload", () => {
      const specialPayload = JSON.stringify({
        text: "Hello 世界! 🚀 emoji test with \"quotes\" and 'apostrophes'",
        unicode: "\u2764\ufe0f\u200d\ud83d\udd25",
        symbols: "!@#$%^&*()_+-={}|[]\\:\";'<>?,./",
      });
      const signature = generateHmacSignature(
        specialPayload,
        testSecret,
        "github",
      );
      const result = verifyHmacSignature(
        specialPayload,
        signature,
        testSecret,
        "github",
      );

      expect(result.isValid).toBe(true);
    });

    it("should prevent timing attacks", () => {
      const validSignature = generateHmacSignature(
        testPayload,
        testSecret,
        "generic",
      );
      const invalidSignature = "a".repeat(64);

      // Both should fail, but timing should be similar
      const start1 = process.hrtime.bigint();
      const result1 = verifyHmacSignature(
        testPayload,
        validSignature.slice(0, -1) + "x",
        testSecret,
        "generic",
      );
      const time1 = process.hrtime.bigint() - start1;

      const start2 = process.hrtime.bigint();
      const result2 = verifyHmacSignature(
        testPayload,
        invalidSignature,
        testSecret,
        "generic",
      );
      const time2 = process.hrtime.bigint() - start2;

      expect(result1.isValid).toBe(false);
      expect(result2.isValid).toBe(false);

      // Times should be similar (within 10x factor)
      const ratio = Number(time1) / Number(time2);
      expect(ratio).toBeGreaterThan(0.1);
      expect(ratio).toBeLessThan(10);
    });
  });

  describe("Cross-Mode Compatibility", () => {
    it("should generate different signatures for different modes", () => {
      const stripeSignature = generateHmacSignature(
        testPayload,
        testSecret,
        "stripe",
      );
      const githubSignature = generateHmacSignature(
        testPayload,
        testSecret,
        "github",
      );
      const genericSignature = generateHmacSignature(
        testPayload,
        testSecret,
        "generic",
      );

      expect(stripeSignature).not.toBe(githubSignature);
      expect(githubSignature).not.toBe(genericSignature);
      expect(stripeSignature).not.toBe(genericSignature);
    });

    it("should not verify signatures across modes", () => {
      const githubSignature = generateHmacSignature(
        testPayload,
        testSecret,
        "github",
      );
      const stripeResult = verifyHmacSignature(
        testPayload,
        githubSignature,
        testSecret,
        "stripe",
      );
      const genericResult = verifyHmacSignature(
        testPayload,
        githubSignature,
        testSecret,
        "generic",
      );

      expect(stripeResult.isValid).toBe(false);
      expect(genericResult.isValid).toBe(false);
    });

    it("should handle unknown modes gracefully", () => {
      expect(() => {
        generateHmacSignature(testPayload, testSecret, "unknown" as HmacMode);
      }).toThrow("Unknown HMAC mode");

      const result = verifyHmacSignature(
        testPayload,
        "signature",
        testSecret,
        "unknown" as HmacMode,
      );
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Unknown HMAC mode");
    });
  });

  describe("Real-World Examples", () => {
    it("should handle actual Stripe webhook signature format", () => {
      const actualPayload = '{"id":"evt_test_webhook","object":"event"}';
      const actualSecret = "whsec_test_secret";

      const signature = generateHmacSignature(
        actualPayload,
        actualSecret,
        "stripe",
      );
      const result = verifyHmacSignature(
        actualPayload,
        signature,
        actualSecret,
        "stripe",
      );

      expect(result.isValid).toBe(true);
    });

    it("should handle actual GitHub webhook signature format", () => {
      const actualPayload =
        '{"zen":"Responsive is better than fast.","hook_id":12345678}';
      const actualSecret = "your-github-webhook-secret";

      const signature = generateHmacSignature(
        actualPayload,
        actualSecret,
        "github",
      );
      const result = verifyHmacSignature(
        actualPayload,
        signature,
        actualSecret,
        "github",
      );

      expect(result.isValid).toBe(true);
      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
    });
  });
});
