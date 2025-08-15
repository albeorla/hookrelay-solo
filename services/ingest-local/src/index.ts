import express, { type Request, type Response } from "express";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const app = express();

// Input validation and payload processing
function validateWebhookPayload(
  body: string,
  maxSizeMB = 2,
): {
  valid: boolean;
  error?: string;
} {
  // Check size limit
  const sizeInMB = Buffer.byteLength(body, "utf8") / (1024 * 1024);
  if (sizeInMB > maxSizeMB) {
    return {
      valid: false,
      error: `Payload size ${sizeInMB.toFixed(2)}MB exceeds limit of ${maxSizeMB}MB`,
    };
  }

  // For webhooks, body can be JSON or raw string, so we'll be more permissive
  // Only reject obviously invalid payloads
  if (body.length === 0) {
    return {
      valid: false,
      error: "Empty payload not allowed",
    };
  }

  return { valid: true };
}

// Use the verify option to capture raw body during JSON parsing
app.use(
  express.json({
    limit: "2mb",
    verify: (req, res, buf) => {
      (req as any).rawBody = buf.toString("utf8");
    },
  }),
);

// Handle JSON parsing errors
app.use((error: any, req: any, res: any, next: any) => {
  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({
      error: "Invalid JSON payload",
      message: "Request body contains malformed JSON",
    });
  }
  next(error);
});

const port = Number(process.env.PORT || 3000);
const sqsUrl = process.env.SQS_URL!;
const region = process.env.AWS_REGION || "us-east-1";
const sqsEndpoint = process.env.AWS_SQS_ENDPOINT;

const sqs = new SQSClient({
  region,
  endpoint: sqsEndpoint,
  credentials: sqsEndpoint
    ? { accessKeyId: "test", secretAccessKey: "test" }
    : undefined,
});

app.get("/healthz", (_req: Request, res: Response) =>
  res.status(200).send("ok"),
);

app.post("/ingest/:endpointId", async (req: Request, res: Response) => {
  try {
    const rawBody = (req as any).rawBody || JSON.stringify(req.body ?? {});

    // Validate webhook payload
    const validation = validateWebhookPayload(rawBody);
    if (!validation.valid) {
      return res.status(400).json({
        error: "Invalid payload",
        message: validation.error,
      });
    }

    // Validate endpoint ID
    if (!req.params.endpointId || req.params.endpointId.length === 0) {
      return res.status(400).json({
        error: "Invalid endpoint ID",
        message: "Endpoint ID is required",
      });
    }

    const payload = {
      endpoint_id: req.params.endpointId,
      raw_body: rawBody,
      headers: {
        stripe_signature: req.header("Stripe-Signature"),
        x_hub_sig_256: req.header("X-Hub-Signature-256"),
        x_signature: req.header("X-Signature") || req.header("x-signature"),
        x_timestamp: req.header("X-Timestamp") || req.header("x-timestamp"),
        idempotency_key: req.header("Idempotency-Key"),
      },
      received_at: Date.now(),
    };
    await sqs.send(
      new SendMessageCommand({
        QueueUrl: sqsUrl,
        MessageBody: JSON.stringify(payload),
      }),
    );
    res.status(202).json({
      delivery_id: `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
    });
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.listen(port, () => console.log(`ingest-local listening on :${port}`));
