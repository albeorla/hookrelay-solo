import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import fetch from "node-fetch";

const sqsUrl = process.env.SQS_URL;
const sqs = new SQSClient({});

if (!sqsUrl) {
  console.error("SQS_URL not set; exiting.");
  process.exit(1);
}

async function run() {
  console.log("worker listening on SQS", sqsUrl);
  for (;;) {
    const res = await sqs.send(new ReceiveMessageCommand({
      QueueUrl: sqsUrl,
      MaxNumberOfMessages: 5,
      WaitTimeSeconds: 20,
      VisibilityTimeout: 30,
    }));
    const msgs = res.Messages || [];
    for (const m of msgs) {
      try {
        const body = m.Body ? JSON.parse(m.Body) : {};
        const url: string | undefined = body.dest_url;
        if (url) {
          const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
        } else {
          console.log("no dest_url, ack only");
        }
        if (m.ReceiptHandle) await sqs.send(new DeleteMessageCommand({ QueueUrl: sqsUrl, ReceiptHandle: m.ReceiptHandle }));
      } catch (err) {
        console.error("process error", err);
      }
    }
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

