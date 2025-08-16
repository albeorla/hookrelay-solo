## Core HookRelay Implementation Files

### 1. Microservices (The Heart of HookRelay)

```text
services/
├── ingest-local/                    # Webhook Reception Service
│   └── src/
│       └── index.ts                 # Express server that receives webhooks, validates, queues to SQS
└── worker/                          # Webhook Delivery Service
    └── src/
        └── index.ts                 # SQS consumer that verifies HMAC, retries, handles DLQ
```

### 2. Admin Dashboard (Management UI)

```text
src/
├── server/
│   └── api/
│       └── routers/
│           └── webhook.ts           # tRPC API for CRUD operations, stats, monitoring
├── app/
│   └── admin/
│       └── webhooks/
│           ├── page.tsx             # Dashboard with real-time stats, endpoint management
│           └── _components/
│               └── webhook-endpoint-form.tsx # Create/configure webhook endpoints
└── lib/
    └── webhook-security.ts          # HMAC verification library (Stripe/GitHub/Generic)
```

### 3. Infrastructure as Code

```text
infra/
└── terraform/
    └── main.tf                      # Production AWS infrastructure (ECS, SQS, DynamoDB, S3)

scripts/
└── localstack/
    └── bootstrap.sh                 # Local dev environment setup (creates queues, tables, buckets)
```

### 4. AWS Lambda Handlers (Production)

```text
aws/
└── handlers/
    ├── ingest-handler.ts            # API Gateway → SQS ingestion
    └── delivery-worker.ts           # SQS → HTTP delivery worker
```

### 5. Tests (Limited Coverage)

```text
src/
└── lib/
    └── __tests__/
        └── webhook-security.test.ts # ✅ Comprehensive HMAC verification tests
```

- **Missing tests**
  - `services/ingest-local/` — No tests
  - `services/worker/` — No tests

### What Each Component Does

#### Ingestion Flow

- `services/ingest-local/src/index.ts`
  - Receives webhooks at `/ingest/:endpointId`
  - Captures raw body + headers
  - Publishes to SQS queue
  - Returns 200 immediately

#### Processing Flow

- `services/worker/src/index.ts`
  - Polls SQS for messages
  - Verifies HMAC signatures (timing-safe)
  - Checks idempotency (DynamoDB)
  - Delivers to destination URL
  - Retries with exponential backoff
  - Sends to DLQ (S3) after 6 failures

#### Management Layer

- `src/server/api/routers/webhook.ts`
  - CRUD operations for webhook endpoints
  - Real-time delivery statistics
  - Queue monitoring

- `src/app/admin/webhooks/page.tsx`
  - Visual dashboard
  - Endpoint management UI
  - Live delivery feed
  - Performance metrics

#### Infrastructure

- `infra/terraform/main.tf`
  - ECS Fargate (scale-to-zero)
  - SQS queues with encryption
  - DynamoDB tables (endpoints, idempotency, deliveries)
  - S3 bucket for DLQ
  - CloudWatch alarms
  - KMS encryption

### Critical Gaps for Production

- **CRITICAL**: Zero test coverage for business logic
  - `services/ingest-local/` — No tests
  - `services/worker/` — No tests
  - These services contain all core webhook processing logic

- **SECURITY**: Development bypasses in production code
  - Worker service has `DISABLE_HMAC_VERIFICATION` bypass
  - Remove before production

- **OPERATIONS**: Basic logging only
  - `console.log` throughout
  - No structured logging or correlation IDs
  - No CloudWatch metrics emission

- Final note:
  This is a solid foundation with excellent architecture, but needs hardening before production launch. The core logic is implemented and working; it just needs tests, security fixes, and operational polish.
