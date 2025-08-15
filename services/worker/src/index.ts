import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  SendMessageCommand,
  GetQueueUrlCommand,
} from "@aws-sdk/client-sqs";
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fetch from "node-fetch";
import crypto from "crypto";

let sqsUrl = process.env.SQS_URL;
const queueName = process.env.QUEUE_NAME || "hookrelay-delivery-attempts";
const region = process.env.AWS_REGION || "us-east-1";
const sqsEndpoint = process.env.AWS_SQS_ENDPOINT;
const ddbEndpoint = process.env.AWS_DDB_ENDPOINT;
const s3Endpoint = process.env.AWS_S3_ENDPOINT;

const sharedCreds =
  sqsEndpoint || ddbEndpoint || s3Endpoint
    ? { accessKeyId: "test", secretAccessKey: "test" }
    : undefined;

const sqs = new SQSClient({
  region,
  endpoint: sqsEndpoint,
  credentials: sharedCreds,
});
const ddb = new DynamoDBClient({
  region,
  endpoint: ddbEndpoint,
  credentials: sharedCreds,
});
const s3 = new S3Client({
  region,
  endpoint: s3Endpoint,
  credentials: sharedCreds,
  forcePathStyle: !!s3Endpoint,
});

const endpointsTable = process.env.ENDPOINTS_TABLE!;
const idempotencyTable = process.env.IDEMPOTENCY_TABLE!;
// const deliveriesTable = process.env.DELIVERIES_TABLE!;
const dlqBucket = process.env.DLQ_BUCKET!;
const baseDelay = Number(process.env.RETRY_BASE_SECONDS || 2);
const maxAttempts = Number(process.env.RETRY_MAX_ATTEMPTS || 6);

type InboundMsg = {
  endpoint_id: string;
  raw_body: string;
  headers?: Record<string, string | undefined> | null;
  received_at?: number;
  attempt?: number;
};

function parseStripeSig(sig: string | undefined) {
  if (!sig) return undefined;
  const parts = Object.fromEntries(
    sig.split(",").map((p) => p.split("=", 2) as [string, string]),
  );
  if (!parts.t || !parts.v1) return undefined;
  return { t: parts.t, v1: parts.v1 };
}

// Import secure HMAC verification functions
async function verifySignature(
  mode: string | undefined,
  secret: string | undefined,
  body: string,
  headers: Record<string, string | undefined> = {},
) {
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
      const ts = headers.x_timestamp || "";
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

function hmacSha256Hex(secret: string, data: string) {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

async function isIdempotent(
  endpointId: string,
  key: string | undefined,
  body: string,
) {
  const idem =
    key ||
    crypto
      .createHash("sha256")
      .update(endpointId + ":" + body)
      .digest("hex");
  const nowSec = Math.floor(Date.now() / 1000);
  const ttl = nowSec + 7 * 24 * 3600;
  const get = await ddb.send(
    new GetItemCommand({
      TableName: idempotencyTable,
      Key: { idempotency_key: { S: idem } },
    }),
  );
  if (get.Item) return true;
  await ddb.send(
    new PutItemCommand({
      TableName: idempotencyTable,
      Item: {
        idempotency_key: { S: idem },
        endpoint_id: { S: endpointId },
        created_at: { N: String(nowSec) },
        expires_at: { N: String(ttl) },
      },
      ConditionExpression: "attribute_not_exists(idempotency_key)",
    }),
  );
  return false;
}

function backoff(attempt: number) {
  const cap = 300; // 5m
  const base = Math.min(cap, Math.pow(2, attempt) * baseDelay);
  const jitter = Math.random() * base * 0.2;
  return Math.floor(base + jitter);
}

// SQS_URL is optional in local dev; when absent, resolve via GetQueueUrl using QUEUE_NAME

async function run() {
  // Resolve queue URL once if needed
  if (!sqsUrl) {
    console.log(`Resolving queue URL for: ${queueName}`);
    const q = await sqs.send(new GetQueueUrlCommand({ QueueName: queueName }));
    sqsUrl = q.QueueUrl;
    console.log(`Resolved queue URL: ${sqsUrl}`);
  }
  console.log("worker listening on SQS", sqsUrl);
  for (;;) {
    const res = await sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: sqsUrl!,
        MaxNumberOfMessages: 5,
        WaitTimeSeconds: 20,
        VisibilityTimeout: 30,
      }),
    );
    const msgs = res.Messages || [];
    console.log("Received", msgs.length, "messages from SQS");
    for (const m of msgs) {
      try {
        console.log("Processing SQS message:", m.MessageId);
        const payload: InboundMsg = m.Body ? JSON.parse(m.Body) : ({} as any);
        const endpointId = payload.endpoint_id;
        if (!endpointId) throw new Error("missing endpoint_id");

        console.log("Processing message for endpoint:", endpointId);
        console.log("Raw body:", payload.raw_body);
        console.log("Headers:", JSON.stringify(payload.headers, null, 2));

        // Load endpoint config
        const ep = await ddb.send(
          new GetItemCommand({
            TableName: endpointsTable,
            Key: { endpoint_id: { S: endpointId } },
          }),
        );
        if (!ep.Item) throw new Error("endpoint not found");
        const destUrl = ep.Item.dest_url?.S;
        const hmacMode = ep.Item.hmac_mode?.S;
        const secret = ep.Item.secret?.S;
        const idk =
          payload.headers?.idempotency_key ||
          payload.headers?.["Idempotency-Key"]; // safety

        console.log(
          "Endpoint config - HMAC mode:",
          hmacMode,
          "Secret:",
          secret ? "***" : "none",
        );

        // Verify signature
        const ok = await verifySignature(
          hmacMode,
          secret,
          payload.raw_body,
          payload.headers || {},
        );
        console.log("Signature verification result:", ok);
        if (!ok) throw new Error("invalid signature");

        // Idempotency
        const duplicate = await isIdempotent(
          endpointId,
          typeof idk === "string" ? idk : undefined,
          payload.raw_body,
        );
        if (duplicate) {
          console.log("duplicate, ack", endpointId);
        } else {
          // Deliver
          if (!destUrl) throw new Error("missing dest_url");
          const r = await fetch(destUrl, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: payload.raw_body,
            signal: AbortSignal.timeout(8000),
          });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
        }

        if (m.ReceiptHandle)
          await sqs.send(
            new DeleteMessageCommand({
              QueueUrl: sqsUrl,
              ReceiptHandle: m.ReceiptHandle,
            }),
          );
      } catch (err) {
        console.error("process error", err);
        // Retry with backoff or DLQ to S3 after max attempts
        const payload: InboundMsg = m.Body ? JSON.parse(m.Body) : ({} as any);
        const attempt = (payload.attempt || 0) + 1;
        if (attempt >= maxAttempts) {
          const key = `${payload.endpoint_id || "unknown"}/${Date.now()}-${Math.random().toString(16).slice(2)}.json`;
          await s3.send(
            new PutObjectCommand({
              Bucket: dlqBucket,
              Key: key,
              Body: JSON.stringify({ payload, error: String(err) }),
            }),
          );
          if (m.ReceiptHandle)
            await sqs.send(
              new DeleteMessageCommand({
                QueueUrl: sqsUrl,
                ReceiptHandle: m.ReceiptHandle,
              }),
            );
        } else {
          const delay = backoff(attempt);
          payload.attempt = attempt;
          await sqs.send(
            new SendMessageCommand({
              QueueUrl: sqsUrl,
              MessageBody: JSON.stringify(payload),
              DelaySeconds: Math.min(delay, 900),
            }),
          );
          if (m.ReceiptHandle)
            await sqs.send(
              new DeleteMessageCommand({
                QueueUrl: sqsUrl,
                ReceiptHandle: m.ReceiptHandle,
              }),
            );
        }
      }
    }
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
