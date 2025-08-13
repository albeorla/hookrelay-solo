#!/usr/bin/env node

import crypto from "crypto";

const secret = "dev-secret";
const body = '{"test": "webhook", "timestamp": 1639430400}';
const timestamp = Math.floor(Date.now() / 1000).toString();

// For generic mode, create payload as timestamp.body
const payload = `${timestamp}.${body}`;
const signature = crypto
  .createHmac("sha256", secret)
  .update(payload)
  .digest("hex");

console.log("Timestamp:", timestamp);
console.log("Signature:", signature);
console.log("Body:", body);
console.log("Payload for HMAC:", payload);

const curlCommand = `curl -X POST http://localhost:3002/ingest/ep_demo \\
  -H "Content-Type: application/json" \\
  -H "x-timestamp: ${timestamp}" \\
  -H "x-signature: ${signature}" \\
  -d '${body}' \\
  -v`;

console.log("\nCurl command:");
console.log(curlCommand);
