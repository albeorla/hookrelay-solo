## User Journey & Implementation Checklists

Goal: Make the end-to-end journey crystal clear and eliminate ambiguity/errors with simple, actionable checklists.

### 1) High-level User Journeys

- Guest → Auth: Guest reaches any page and is redirected to `\/auth`. Signs in with Discord (or test creds in dev). Upon authentication, user receives roles.
- User (non-admin): Lands on `\/` dashboard. Can view profile and update basic info at `\/settings\/profile`.
- Admin: Should primarily operate from the Webhooks area. Create endpoints, observe deliveries and health, manage DLQ, configure settings/notifications, and manage users\/roles\/permissions.

### 2) Route Map (as implemented)

- Public: `\/auth`
- Authenticated: `\/` (dashboard), `\/settings\/profile`
- Admin (RBAC: `ADMIN`):
  - Webhooks: `\/admin\/webhooks`, `\/admin\/webhooks\/dashboard`, `\/admin\/webhooks\/deliveries`, `\/admin\/webhooks\/health`, `\/admin\/webhooks\/dlq`, `\/admin\/webhooks\/settings`, `\/admin\/webhooks\/settings\/notifications`, `\/admin\/webhooks\/[endpointId]`
  - Org: `\/admin\/users`, `\/admin\/roles`, `\/admin\/permissions`
- Realtime: `\/api\/sse` (Server-Sent Events). `\/api\/ws` is a placeholder (501) and not used.

### 3) RBAC Summary

- USER: Access `\/`, `\/settings\/profile`. Admin items hidden in sidebar.
- ADMIN: All of USER plus Webhooks suite and user\/role\/permission management.

### 4) Known Friction / Error Sources

- Local infra not running (LocalStack for DynamoDB\/SQS\/S3 and database) → tRPC calls fail.
- Admin vs User journey not obvious post-login (admins currently land on `\/` rather than the webhooks dashboard).
- Minor UI mismatch: Discord login uses a GitHub icon.

---

## Action Plan Checklists

Keep changes simple and focused. Do the minimum necessary to clarify the journey and stabilize dev.

### Webhooks Journey Sanity Checklist (verified)

- **Login (Admin)**
  - Go to `\/auth`
  - Click "Advanced: Test Logins" → "Test Login (albeorla - Admin)"
  - Expect redirect to `\/`
- **Create Endpoint**
  - Navigate to `\/admin\/webhooks`
  - Click "Add Endpoint" and submit:
    - **endpointId**: `ep_demo2`
    - **destUrl**: `https:\/\/httpbin.org\/post`
- **Test Webhook**
  - From `\/admin\/webhooks\/dashboard` use "Test Webhook" (Quick Actions),
    or open `\/admin\/webhooks\/[endpointId]` and use the test tool
- **Verify KPIs on `\/admin\/webhooks\/dashboard`**
  - **Total Deliveries** ≥ 1
  - **Active Endpoints** ≥ 1
  - **Recent Activity** shows at least one item
- **Troubleshooting**
  - Ensure LocalStack is bootstrapped: `bash scripts\/localstack\/bootstrap.sh`
  - If KPIs remain zero, trigger another test webhook and refresh

### A) Infra & Local Dev (stability)

- [ ] Start LocalStack and Postgres via Docker
  - [ ] `docker compose -f docker\/docker-compose.dev.yml up -d`
- [ ] Apply Prisma migrations
  - [ ] `yarn prisma migrate deploy`
- [ ] Seed database (roles, permissions, baseline users)
  - [ ] `yarn ts-node prisma\/seed.ts`
- [ ] Enable test auth in dev (optional)
  - [ ] `export ENABLE_TEST_AUTH=true`
- [ ] Verify webhook tRPC endpoints return data (stats, endpoints, deliveries)

### B) Role-based Landing & Navigation (clarity)

- [ ] Admin default landing → `\/admin\/webhooks\/dashboard` after login
- [ ] Add Webhooks sub-navigation visible on all `\/admin\/webhooks\/*` pages:
  - [ ] Dashboard
  - [ ] Endpoints
  - [ ] Deliveries
  - [ ] Health
  - [ ] DLQ
  - [ ] Settings
- [ ] Add breadcrumbs to Webhooks pages for quick orientation
- [ ] Non-admin access to admin pages shows a brief “Not authorized” message before redirect

### C) Quick UX Polish (low effort, high impact)

- [ ] `\/auth`: Use a Discord icon on the Discord sign-in button
- [ ] `\/`: For USER role, show a simple “Getting started” list (profile, notification preferences)
- [ ] `\/admin\/webhooks`: Add links to sub-pages (already present) and ensure copy communicates the flow: Create → Observe → Act

### D) Webhooks Operations Flow (functional check)

- [ ] Create an endpoint at `\/admin\/webhooks` → appears in list
- [ ] View endpoint details at `\/admin\/webhooks\/[endpointId]`
  - [ ] Generate HMAC secret and test endpoint
- [ ] Observe in Dashboard `\/admin\/webhooks\/dashboard`
  - [ ] KPIs render, recent deliveries update, SSE status OK
- [ ] Inspect logs at `\/admin\/webhooks\/deliveries`
  - [ ] Filters, search, pagination, retry action work
- [ ] Health at `\/admin\/webhooks\/health`
  - [ ] Alerts show; thresholds configurable
- [ ] DLQ at `\/admin\/webhooks\/dlq`
  - [ ] Items list, replay, bulk delete function
- [ ] Settings at `\/admin\/webhooks\/settings` and Notifications
  - [ ] Save and Test Connection buttons function

### E) Org Management (RBAC hygiene)

- [ ] Users list loads for ADMIN
- [ ] Role create\/edit works and updates effective permissions
- [ ] Permissions page is read-only and matches seeded catalog

### F) Documentation & Hand-off

- [ ] Keep this doc updated as the source of truth for the journey
- [ ] Add a short README snippet in `docs\/development.md` pointing to this file
- [ ] Capture decisions about admin landing and subnav in this doc

---

## Acceptance Criteria (Definition of Done for this pass)

- Admins land on `\/admin\/webhooks\/dashboard` post-login. Users continue to land on `\/`.
- Webhooks subnav appears consistently across `\/admin\/webhooks\/*` pages with correct active state.
- Local infra up: endpoints, stats, deliveries, health, DLQ, and exports routes work without unhandled errors in dev.
- Minor UI polish applied (Discord icon, friendly not-authorized message, getting-started list).
- This document remains in sync with what the app does.

---

## References (for journey and dashboard best practices)

- Dashboard design best practices (hierarchy, clarity, minimalism):
  - https:\/\/www.toptal.com\/designers\/data-visualization\/dashboard-design-best-practices
  - https:\/\/www.justinmind.com\/ui-design\/dashboard-design-best-practices-ux
- Dashboard patterns survey (trade-offs and grouping):
  - https:\/\/arxiv.org\/abs\/2205.00757

---

## Notes (implementation pointers)

- Auth & redirects: `src\/middleware.ts`, `src\/app\/auth\/page.tsx`
- Session & roles: `src\/server\/auth\/config.ts`
- Sidebar nav & hiding admin items: `src\/components\/layout\/sidebar.tsx`
- Webhooks pages and components: `src\/app\/admin\/webhooks\/*`
- tRPC router: `src\/server\/api\/routers\/webhook.ts` and submodules
- Local AWS config (LocalStack defaults): `src\/config\/aws.ts`


