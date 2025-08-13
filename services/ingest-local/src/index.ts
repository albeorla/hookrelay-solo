import express, { type Request, type Response } from "express";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const app = express();

// Use the verify option to capture raw body during JSON parsing
app.use(
  express.json({
    limit: "2mb",
    verify: (req, res, buf) => {
      (req as any).rawBody = buf.toString("utf8");
    },
  }),
);

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
