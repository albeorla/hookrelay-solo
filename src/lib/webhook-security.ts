import crypto from "crypto";

/**
 * Parse Stripe webhook signature header
 * Format: t=1234567890,v1=abc123def456
 */
export function parseStripeSig(
  signature: string | undefined,
): { t: string; v1: string } | null {
  if (!signature) return null;

  const parts = signature.split(",").reduce(
    (acc, part) => {
      const [key, value] = part.split("=");
      if (key && value) {
        acc[key] = value;
      }
      return acc;
    },
    {} as Record<string, string>,
  );

  if (!parts.t || !parts.v1) return null;
  return { t: parts.t, v1: parts.v1 };
}

/**
 * Create HMAC SHA256 hex signature
 */
export function hmacSha256Hex(secret: string, data: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

/**
 * Verify webhook signature based on mode
 * @param mode - Verification mode: stripe, github, or generic
 * @param secret - HMAC secret key
 * @param body - Raw request body
 * @param headers - Request headers
 * @returns Promise<boolean> - true if signature is valid
 */
export async function verifySignature(
  mode: string | undefined,
  secret: string | undefined,
  body: string,
  headers: Record<string, string | undefined> = {},
): Promise<boolean> {
  // Security: Only allow bypassing HMAC verification in development mode with explicit env var
  if (!mode || !secret) {
    if (
      process.env.NODE_ENV === "development" &&
      process.env.DISABLE_HMAC_VERIFICATION === "true"
    ) {
      console.warn("⚠️  HMAC verification disabled in development mode");
      return true;
    }
    console.error("🚨 Missing HMAC configuration", {
      mode: !!mode,
      secret: !!secret,
    });
    return false;
  }

  switch (mode) {
    case "stripe": {
      const sig = parseStripeSig(headers.stripe_signature);
      if (!sig) return false;
      const payload = `t=${sig.t}.${body}`;
      const expected = hmacSha256Hex(secret, payload);

      // Ensure both signatures are the same length for timing-safe comparison
      if (expected.length !== sig.v1.length) return false;

      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig.v1));
    }
    case "github": {
      const sig = headers.x_hub_sig_256?.replace(/^sha256=/, "");
      if (!sig) return false;
      const expected = hmacSha256Hex(secret, body);

      // Ensure both signatures are the same length for timing-safe comparison
      if (expected.length !== sig.length) return false;

      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
    }
    case "generic": {
      const ts = headers.x_timestamp ?? "";
      const sig = headers.x_signature;
      if (!sig) return false;
      const payload = ts ? `${ts}.${body}` : body;
      const expected = hmacSha256Hex(secret, payload);

      // Ensure both signatures are the same length for timing-safe comparison
      if (expected.length !== sig.length) return false;

      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
    }
    default:
      return false;
  }
}

/**
 * Validate webhook payload size and format
 */
export function validateWebhookPayload(
  body: string,
  maxSizeMB = 1,
): {
  valid: boolean;
  error?: string;
} {
  // Check size limit (default 1MB)
  const sizeInMB = Buffer.byteLength(body, "utf8") / (1024 * 1024);
  if (sizeInMB > maxSizeMB) {
    return {
      valid: false,
      error: `Payload size ${sizeInMB.toFixed(2)}MB exceeds limit of ${maxSizeMB}MB`,
    };
  }

  // Attempt to parse as JSON
  try {
    JSON.parse(body);
    return { valid: true };
  } catch {
    return {
      valid: false,
      error: "Invalid JSON payload",
    };
  }
}
