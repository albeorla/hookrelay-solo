# HookRelay — Pre‑Seed Founder Brief

## Executive Summary
HookRelay is the reliability front door for webhooks. We ensure mission‑critical events are delivered, observable, and recoverable (verify → dedupe → retry → DLQ → replay), with analytics and alerts. Architecture is near‑zero idle cost (API Gateway → SQS → scale‑to‑zero Fargate worker; DynamoDB, S3, KMS).

## Current State
- MVP scope: ingest→retry→DLQ→replay, delivery analytics, Slack/email alerts, Stripe metering.
- Infra: Terraform modules checked in; CI builds worker image to ECR; API GW → SQS live after apply.
- Tracking: GitHub milestones + project board seeded.

## Architecture & Cost
- Ingest: API Gateway HTTP API → SQS (no Lambda, per‑request pricing).
- Processing: ECS Fargate worker (Spot) with autoscaling to zero on idle; scale up on SQS backlog.
- Storage: DynamoDB (on‑demand), S3 (DLQ), KMS (encryption). Cost at idle ≈ pennies/day.

## Go‑To‑Market (Bottom‑Up)
- Self‑serve: quickstart, Stripe/GitHub guides, SDKs/CLI, copy‑paste ingest URL.
- Content: “How to never drop webhooks”, “Stripe‑style HMAC in 5 min”.
- Design partners: 5–10 SaaS teams with event volume and reliability pain.

## 0–90 Day Plan & KPIs
- 0–30: MVP live; HMAC modes + idempotency; replay UI; alerts; billing; 3 partners onboarded.
- 31–60: Metrics p50/p95; SLO burn alerts; docs; 5–8 partners; first paid conversions.
- 61–90: Transforms v1; enterprise controls (IP allowlist); 10+ partners.
- KPIs: Day‑7 activation ≥ 40%; trial→paid ≥ 30%; delivery success ≥ 99.5%; p95 ≤ 250 ms ingest ACK.

## Fundraise Plan (Pre‑Seed)
- Ask: $750k–$1.5M for 18–24 months.
- Use: 60% product/infra, 25% GTM (content/integrations), 15% ops/compliance.
- Key hires: Founding backend, founding frontend, DevRel/solutions (part‑time initially).

## Risks & Mitigations
- Commoditization → Win on UX + analytics depth + replay ergonomics.
- Data sensitivity → Pass‑through mode, encryption, audit, IP allowlists.
- GTM friction → Self‑serve setup, transparent usage pricing, design‑partner velocity.

