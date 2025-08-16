import crypto from "crypto";

export type HmacMode = "stripe" | "github" | "generic";

export interface HmacVerificationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Verify HMAC signature for webhook payloads
 */
export function verifyHmacSignature(
  payload: string,
  signature: string,
  secret: string,
  mode: HmacMode,
): HmacVerificationResult {
  try {
    switch (mode) {
      case "stripe":
        return verifyStripeSignature(payload, signature, secret);
      case "github":
        return verifyGithubSignature(payload, signature, secret);
      case "generic":
        return verifyGenericSignature(payload, signature, secret);
      default:
        return { isValid: false, error: "Unknown HMAC mode" };
    }
  } catch (error) {
    return { isValid: false, error: String(error) };
  }
}

/**
 * Generate HMAC signature for outgoing webhooks
 */
export function generateHmacSignature(
  payload: string,
  secret: string,
  mode: HmacMode,
): string {
  switch (mode) {
    case "stripe":
      return generateStripeSignature(payload, secret);
    case "github":
      return generateGithubSignature(payload, secret);
    case "generic":
      return generateGenericSignature(payload, secret);
    default:
      throw new Error("Unknown HMAC mode");
  }
}

/**
 * Stripe-style signature verification
 * Format: t=timestamp,v1=signature
 */
function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string,
): HmacVerificationResult {
  const elements = signature.split(",");
  let timestamp: string | undefined;
  let v1Signature: string | undefined;

  for (const element of elements) {
    const [key, value] = element.split("=");
    if (key === "t") {
      timestamp = value;
    } else if (key === "v1") {
      v1Signature = value;
    }
  }

  if (!timestamp || !v1Signature) {
    return { isValid: false, error: "Invalid Stripe signature format" };
  }

  // Check timestamp (prevent replay attacks)
  const currentTime = Math.floor(Date.now() / 1000);
  const signatureTime = parseInt(timestamp, 10);
  const timeDiff = Math.abs(currentTime - signatureTime);

  // Allow 5 minutes tolerance
  if (timeDiff > 300) {
    return { isValid: false, error: "Signature timestamp too old" };
  }

  // Generate expected signature
  const payloadForSigning = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payloadForSigning, "utf8")
    .digest("hex");

  const isValid = crypto.timingSafeEqual(
    Buffer.from(v1Signature, "hex"),
    Buffer.from(expectedSignature, "hex"),
  );

  return { isValid };
}

/**
 * GitHub-style signature verification
 * Format: sha256=signature
 */
function verifyGithubSignature(
  payload: string,
  signature: string,
  secret: string,
): HmacVerificationResult {
  if (!signature.startsWith("sha256=")) {
    return { isValid: false, error: "Invalid GitHub signature format" };
  }

  const providedSignature = signature.slice(7); // Remove 'sha256='
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("hex");

  const isValid = crypto.timingSafeEqual(
    Buffer.from(providedSignature, "hex"),
    Buffer.from(expectedSignature, "hex"),
  );

  return { isValid };
}

/**
 * Generic HMAC-SHA256 signature verification
 * Format: signature (raw hex)
 */
function verifyGenericSignature(
  payload: string,
  signature: string,
  secret: string,
): HmacVerificationResult {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("hex");

  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expectedSignature, "hex"),
  );

  return { isValid };
}

/**
 * Generate Stripe-style signature
 */
function generateStripeSignature(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadForSigning = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payloadForSigning, "utf8")
    .digest("hex");

  return `t=${timestamp},v1=${signature}`;
}

/**
 * Generate GitHub-style signature
 */
function generateGithubSignature(payload: string, secret: string): string {
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("hex");

  return `sha256=${signature}`;
}

/**
 * Generate generic HMAC signature
 */
function generateGenericSignature(payload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("hex");
}
