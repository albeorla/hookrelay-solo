# HookRelay — Comprehensive Development Plan (MVP → GA)

## 1) Goals & Scope

- Primary objective: Ship a reliable webhook front door with verification, idempotency, retries, DLQ, replay, analytics, and alerts.
- Success metrics: p95 passthrough ≤ 250 ms; ≥ 99.5% delivery success; 99.95% uptime; day-7 activation ≥ 40%.
- Out-of-scope (MVP): on‑prem, deep PII redaction pipeline, complex transforms, custom BI.

## 2) Architecture Overview

```mermaid
flowchart LR
  A[Sender] --> B[Edge Ingest (API GW)]
  subgraph Verify+Dedup
    C[HMAC Verify]
    D[(Idempotency KV - DynamoDB)]
  end
  B --> C --> D --> E[Dispatcher]
  E --> F[(Retry Queue)]
  F -->|attempt| G[Delivery Worker]
  G --> H[Receiver]
  G --> I[Metrics + Logs]
  F -->|exhausted| J[(S3 DLQ)]
  I --> K[Console + API]
  K --> L[Alerts: Slack/Email/PagerDuty]
```

- Ingest/API: Amazon API Gateway + Lambda (Node/TypeScript). Optional CloudFront in front later.
- Verification: HMAC compat modes (Stripe/GitHub) selectable per Endpoint.
- Idempotency: DynamoDB table with 7‑day TTL; dedupe on `Idempotency-Key` or deterministic content hash.
- Retry engine: SQS + EventBridge Scheduler for delays > 15 minutes; exponential backoff with jitter.
- DLQ: S3 bucket (SSE‑KMS) storing payload+headers+attempt metadata; signed URL for access.
- Replay: API triggers fetch from S3 (by delivery IDs or DLQ range) and re-enqueues.
- Analytics: DynamoDB streams → Kinesis Firehose → S3 (optional) + CloudWatch Metrics. MVP: compute in app + CloudWatch.
- Alerts: Slack app (incoming webhook or bot), SES for email, PagerDuty Events v2.
- Console: Minimal React app for endpoints, deliveries, replay, metrics, and alert settings.
- Billing: Stripe metered billing via Usage Records (e.g., bill per successful delivery + overage tiers).

## 3) Components & Services

- API Gateway REST API: `/v1/*` management + `/ingest/*` public ingest.
- Lambda functions (Node 20):
  - `ingest-handler`: verify HMAC/idempotency; log; dispatch initial delivery attempt.
  - `attempt-dispatcher`: compute backoff schedule; enqueue attempts via SQS/EventBridge.
  - `delivery-worker`: fetch attempt; POST to receiver with timeout; emit metrics; ack/retry/exhaust.
  - `replay-worker`: hydrate from S3 DLQ or prior deliveries; re-enqueue.
  - `alert-notifier`: emit Slack/Email/PagerDuty on exhaustion, high failure rate, or SLA burn.
  - `metrics-rollup` (optional MVP+1): hourly aggregates for p50/p95 and success rate.
- Data stores (DynamoDB, all with on-demand capacity to start):
  - `Tenants` (PK `tenant_id`).
  - `Endpoints` (PK `endpoint_id`, GSI1 `tenant_id`).
  - `Deliveries` (PK `endpoint_id`, SK `delivery_id` [ULID ts]); GSI by `tenant_id#status` for queries; TTL 30 days.
  - `Idempotency` (PK `idempotency_key`), attributes: `endpoint_id`, `delivery_id`, `created_at`, TTL 7 days.
  - `ReplayJobs` (PK `job_id`, GSI `tenant_id#status`).
  - `ApiKeys` (PK `key_id` hash, `tenant_id`, `role`, `created_at`).
  - `Audit` (PK `tenant_id`, SK `ts#entry_id`).
- Queues & schedulers:
  - `delivery-attempts` SQS (default Visibility 30s; DLQ for poison messages to `sqs-poison-dlq`).
  - EventBridge Scheduler used to schedule attempts > 15 minutes (target to SQS).
- Buckets:
  - `dlq-payloads` (SSE‑KMS, bucket key disabled; prefix `tenant_id/endpoint_id/yyyy/mm/dd/ulid.json`).
- Networking & security:
  - AWS WAF IP allow-lists on API Gateway for optional enterprise customers.
  - VPC for outbound NAT if needed; otherwise Lambda public egress with egress control.
  - AWS KMS CMK for DynamoDB/S3/Lambda env var encryption.

## 4) Data Model (DynamoDB)

- Tenants: `{ tenant_id (PK), name, plan, stripe_customer_id, created_at }`
- Endpoints: `{ endpoint_id (PK), tenant_id, name, dest_url, hmac_mode, secret_ref, policy { timeouts, retries }, created_at }`
- Deliveries (30‑day TTL):
  - PK: `endpoint_id`, SK: `delivery_id` (ULID).
  - Attrs: `tenant_id`, `status` (queued|success|failed|exhausted), `attempts`, `last_error`, `latency_ms_p50`, `latency_ms_p95`, `created_at`.
  - GSI1: `tenant_id#status` → SK `created_at` for filtering.
- Idempotency (7‑day TTL): `{ idempotency_key (PK), endpoint_id, delivery_id, status, created_at }`
- ReplayJobs: `{ job_id (PK), tenant_id, criteria, submitted_by, status, counts { queued, succeeded, failed }, created_at }`
- ApiKeys: `{ key_id (PK, hash), tenant_id, role (admin|viewer), name, created_at, last_used_at }`
- Audit: `{ tenant_id (PK), sk: ts#entry_id, actor, action, target, ip, user_agent }`

## 5) API Surface (MVP)

- Public ingest: `POST /ingest/{endpoint_id}`
  - Headers: `X-Signature` or provider-specific (`Stripe-Signature`, `X-Hub-Signature-256`), optional `Idempotency-Key`.
  - Behavior: HMAC verify → dedupe → enqueue → 2xx fast ACK with `delivery_id`.
- Management API (`/v1` with API key):
  - `POST /v1/endpoints` → create endpoint, return `endpoint_id` & secret.
  - `POST /v1/endpoints/{id}/rotate-secret` → rotate secret (dual-valid window 24h).
  - `GET /v1/deliveries?endpoint_id=…&status=…&since=…` → filter.
  - `POST /v1/replays` body: `{ delivery_ids?: string[], dlq_range?: { from, to, tenant_id?, endpoint_id? } }`.
  - `GET /v1/metrics?endpoint_id=…` → p50, p95, success rate, top failures.

## 6) Verification & Idempotency

- HMAC modes:
  - Stripe: compute event signature per `t=…` and secret; tolerate clock skew ±5 min.
  - GitHub: `sha256=…` over raw body.
  - Generic: `X-Signature` HMAC SHA256 over body+timestamp header.
- Idempotency:
  - Use `Idempotency-Key` if present; else derive `hash(tenant_id|endpoint_id|body|timestamp_bucket)`; reject if collision within 7 days.
  - Store result with `delivery_id`; return previous status for repeats.

## 7) Retry Engine & Backoff

- Policy per endpoint: base delay, factor, jitter, max attempts.
- Schedule:
  - For delay ≤ 15 min: SQS `DelaySeconds`.
  - For delay > 15 min: EventBridge Scheduler one-shot to push to SQS at due time.
- Attempt outcome:
  - 2xx → success; record latency and finalize.
  - 4xx (non-retryable: 400/401/403/404/422) → fail fast; one optional retry if configured.
  - 5xx/timeout → retry until exhausted; then DLQ.

## 8) DLQ & Replay

- DLQ object format: `{ headers, body_base64, endpoint_id, tenant_id, attempt_history[], first_seen_at, exhausted_at }`.
- Replay:
  - Single or bulk via `delivery_ids` or DLQ time range.
  - Maintain `ReplayJobs` to track progress; annotate new deliveries with `replay_of`.
  - Protect against replay storms with per-tenant rate limit.

## 9) Metrics, Analytics, and SLOs

- Per endpoint: `deliveries_total`, `success_total`, `fail_total`, `exhausted_total`, `attempts_total`, `latency_ms` (histogram), `inflight`.
- SLOs: availability 99.95% (ingest ACK), delivery success ≥ 99.5%, p95 latency ≤ 250 ms.
- Burn alerts: alert when error budget burn rate > 2x over 1h / 6h windows.
- Dashboards: CloudWatch dashboards for ops; simple UI charts for tenants.

## 10) Alerts

- Slack: channel per tenant or shared; cards include endpoint, error, last N attempts, replay link.
- Email: SES verified domain; rate limit; basic templates.
- PagerDuty: service per environment; incidents for saturation (high queue age), high error rate, function throttles.

## 11) Security & Compliance

- API keys: prefix+hash (store hash only) + HMAC signing on management API.
- Secrets: AWS Secrets Manager for endpoint secrets; rotate via `rotate-secret` with dual-valid window.
- Encryption: DynamoDB/S3/Lambda env with KMS CMK; TLS 1.2+.
- Access controls: RBAC roles `admin`, `viewer`; audit all changes.
- Data retention: deliveries 30 days (configurable); DLQ 30/90 days depending on plan.
- GDPR: per-tenant purge job removes deliveries, DLQ objects, keys.

## 12) Rate Limiting & IP Controls

- Global: API Gateway throttling.
- Per-tenant: token bucket in Redis-compatible store (ElastiCache) or lightweight DynamoDB rate limiter; MVP: APIGW usage plans keyed by API key.
- IP allowlists: AWS WAF IPSet per tenant (enterprise add-on) or per-stage list.

## 13) Multi-Region Strategy

- MVP: single region, multi‑AZ; stateless lambdas; S3/KMS regional.
- GA+: dual-region active/active for ingest via Route53 latency routing; DynamoDB global tables for Idempotency and Deliveries; per-region SQS; write-through metrics.

## 14) Console (MVP)

- Pages: Endpoints (create/rotate), Deliveries (table with filter), Delivery detail, Replay (bulk), Metrics, Alerts settings, API keys, Audit.
- Tech: React + minimal server (can be in same Lambda/API). Auth via API keys for now; tenant switcher.

## 15) Billing (Stripe)

- Product: HookRelay; price by successful deliveries with tiered pricing; free quota; 7‑day grace.
- Implementation:
  - Track `success_total` per tenant per day; nightly job posts usage records.
  - Webhooks from Stripe to update plan/limits; revoke access on failed payments after grace.

## 16) Observability

- Logs: structured JSON; correlation `delivery_id`, `attempt_id`.
- Tracing: X-Ray traces; propagate `delivery_id` as trace attribute.
- Metrics: custom CW metrics; alarms on queue age, error rates, throttles, cold start spike.

## 17) Infrastructure as Code (Terraform)

- Modules: `apigw`, `lambda`, `dynamodb`, `sqs`, `s3`, `kms`, `waf`, `secrets`, `iam`, `eventbridge`.
- Environments: `dev`, `staging`, `prod`; per‑env workspaces and state locking.
- Outputs: endpoints, ARNs, keys; rotate via TF where possible.

## 18) Environments & CI/CD

- Branching: trunk with PRs; protected main.
- CI: lint, typecheck, unit tests, contract tests; SAM/Terraform plan.
- CD: blue/green Lambda alias; canary 10% → 100% over 30 minutes; auto rollback on alarms.

## 19) Testing Strategy

- Unit: HMAC verifiers, idempotency store, backoff scheduler, retry classification.
- Contract: receiver mock service for 2xx/4xx/5xx/timeouts.
- Load: k6 or artillery 1k rps for 10 min; assert p95 ≤ 250 ms ingest ACK.
- Fault injection: random timeouts, 5xx bursts; SQS visibility timeouts; KMS throttling.
- E2E: create endpoint → send events → observe deliveries, retries, DLQ, replay, alerts.

## 20) Runbooks

- High failures: check receiver availability; verify backoff; enable alert suppression; pause endpoints if necessary.
- Queue growth: scale concurrency; inspect oldest message age; throttle ingest; notify tenants.
- DLQ surge: triage top errors; share replay guidance; open incident if widespread.
- Key rotation: dual-valid window steps; cache invalidation.

## 21) Timeline & Milestones (MVP ~2 weeks)

- Week 1
  - Day 1–2: Terraform scaffold; DynamoDB tables; SQS; S3; KMS; base IAM; API Gateway routes.
  - Day 3: `ingest-handler` with HMAC (Stripe/GitHub/generic) + idempotency; 2xx ACK.
  - Day 4: `delivery-worker` with timeout/retry classification; basic metrics.
  - Day 5: Backoff + `attempt-dispatcher` + SQS/EventBridge; DLQ write to S3.
- Week 2
  - Day 6: Replay API + `replay-worker`; permissions for S3 reads/writes.
  - Day 7: Alerts: Slack + SES; thresholding; basic burn-rate.
  - Day 8: Console MVP: endpoints, deliveries list/detail, replay.
  - Day 9: Stripe metering job; usage records pipeline; plan gates.
  - Day 10: Load + fault tests; runbooks; launch checklist.

## 22) Acceptance Criteria (MVP)

- Ingest ACK p95 ≤ 250 ms at 1k rps with verification enabled.
- ≥ 99.5% delivery success to a flaky test receiver under retries.
- DLQ populated for exhausted attempts; replay succeeds end-to-end.
- Slack + email alerts fire on exhaustion and SLO burn; include replay link.
- Metrics endpoint returns p50, p95, success rate, top failures.
- Stripe usage reflects successful deliveries for at least two tenants.

## 23) Risks & Mitigations

- Long delays beyond SQS limit → EventBridge Scheduler; test scale.
- Receiver-side rate limits → per-endpoint concurrency cap + jitter + 429 handling.
- Secret sprawl → centralize in Secrets Manager; strict IAM; audit.
- Cost creep (DDB/Scheduler) → on-demand to provisioned with autoscaling after baseline.
- Commoditization → focus on UX, replay ergonomics, analytics depth.

## 24) Backlog (Post-MVP)

- Message transforms at ingress (header/body mutators; templating).
- VPC peering/private links for regulated buyers.
- Multi-region active/active and regional analytics caches.
- Advanced analytics: per-destination health scoring; anomaly detection.
- Expanded alert channels (Opsgenie, Teams) and on-call schedules.

---

Implementation note: prefer TypeScript across Lambdas for shared types; use ULIDs for monotonic ordering; emit structured logs with `delivery_id` for easy traceability.

