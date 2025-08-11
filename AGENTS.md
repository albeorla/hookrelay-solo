# Repository Guidelines

## Project Structure & Module Organization
- `src/`: Next.js app, API routes, UI components.
- `prisma/`: schema, migrations, and seed script.
- `e2e/`: Playwright tests and helpers.
- `infra/terraform/`: AWS infrastructure (ECS Fargate preferred, S3, SQS, DynamoDB, KMS).
- `aws/handlers/`: Lambda/worker code used by infra.
- `scripts/`: CI/local scripts; Docker Compose for E2E.
- `docs/`: PRDs, dev plans, and ops notes.

## Build, Test, and Development Commands
- `yarn dev`: Start Next.js dev server.
- `yarn build`: Production build.
- `yarn preview`: Build then start server.
- `yarn typecheck`: TypeScript no‑emit type check.
- `yarn lint` / `yarn lint:fix`: Lint (fix on save).
- `yarn format:check` / `yarn format:write`: Prettier check/format.
- `yarn test:e2e` (`:ui`, `:ci`, `:headed`): Run Playwright E2E.
- `yarn db:push` / `yarn db:migrate` / `yarn db:studio`: Prisma schema apply/migrate/studio.

## Coding Style & Naming Conventions
- TypeScript, ESLint (Next.js config) and Prettier (Tailwind plugin).
- Use Prettier defaults; run `yarn format:write` before PRs.
- Naming: `camelCase` for vars/functions, `PascalCase` for React components, route files per Next.js conventions.

## Testing Guidelines
- Framework: Playwright for E2E (`e2e/**/*.spec.ts`).
- Tags: use `@slow` for long‑running tests; run quick suite via `yarn test:e2e:quick`.
- CI: `yarn ci` runs typecheck, lint, format check, and E2E minimal suite.

## Commit & Pull Request Guidelines
- Commit style: concise imperative (e.g., `feat:`, `fix:`, `chore:`). Group related changes.
- PRs: include description, linked issues/milestones, and screenshots for UI.
- Keep PRs small and focused; ensure passing `yarn ci`.

## Security & Configuration Tips
- Copy `.env.example` → `.env.local` for dev. Do not commit secrets.
- For AWS: store secrets in Secrets Manager/SSM; encrypt with KMS.
- Containers: target ECS Fargate for services; place infra in `infra/terraform` and prefer private subnets with NAT.

