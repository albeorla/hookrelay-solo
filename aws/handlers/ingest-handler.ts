import crypto from "crypto";

type APIGatewayProxyEventV2 = {
  body: string | null;
  isBase64Encoded?: boolean;
  headers?: Record<string, string | undefined>;
};

type APIGatewayProxyStructuredResultV2 = {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
};

function hmacSha256Hex(secret: string, data: string) {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

function verifyGeneric(
  body: string,
  headers: Record<string, string | undefined>,
) {
  const ts = headers["x-timestamp"] || headers["X-Timestamp"] || "";
  const sig = headers["x-signature"] || headers["X-Signature"];
  if (!sig) return false;
  const secret = process.env.INGEST_SHARED_SECRET || "";
  if (!secret) return false;
  const payload = ts ? `${ts}.${body}` : body;
  const expected = hmacSha256Hex(secret, payload);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

function ulid() {
  const now = Date.now();
  const time = now.toString(16).padStart(12, "0");
  const rand = crypto.randomBytes(10).toString("hex");
  return (time + rand).slice(0, 26);
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> {
  const raw = event.body
    ? event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body
    : "";
  const ok = verifyGeneric(raw, event.headers || {});
  if (!ok) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "invalid signature" }),
    };
  }
  const deliveryId = ulid();
  return {
    statusCode: 202,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ delivery_id: deliveryId }),
  };
}
