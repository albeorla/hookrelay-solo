import express from "express";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const app = express();
app.use(express.json({ limit: "2mb" }));

const port = Number(process.env.PORT || 3000);
const sqsUrl = process.env.SQS_URL;
const sqs = new SQSClient({});

app.get("/healthz", (_req, res) => res.status(200).send("ok"));

app.post("/ingest/:endpointId", async (req, res) => {
  if (!sqsUrl) return res.status(500).json({ error: "SQS_URL not configured" });
  const payload = {
    endpoint_id: req.params.endpointId,
    body: req.body,
    headers: req.headers,
    received_at: Date.now(),
  };
  await sqs.send(new SendMessageCommand({ QueueUrl: sqsUrl, MessageBody: JSON.stringify(payload) }));
  res.status(202).json({ delivery_id: `${Date.now()}-${Math.random().toString(16).slice(2, 10)}` });
});

app.listen(port, () => console.log(`ingest listening on :${port}`));

