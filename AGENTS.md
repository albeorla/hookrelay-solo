# Repository Guidelines

## Project Structure & Module Organization
- `src/`: Next.js app, API routes, and UI components.
- `prisma/`: Prisma schema, migrations, and seed script.
- `e2e/`: Playwright tests and helpers.
- `infra/terraform/`: AWS infra (ECS Fargate, S3, SQS, DynamoDB, KMS).
- `aws/handlers/`: Lambda/worker code used by infra.
- `scripts/`: CI/local scripts; Docker Compose for E2E.
- `docs/`: PRDs, dev plans, and ops notes.

## Build, Test, and Development Commands
- `yarn dev`: Start Next.js dev server.
- `yarn build`: Create production build.
- `yarn preview`: Build then start server locally.
- `yarn typecheck`: TypeScript no‑emit type check.
- `yarn lint` / `yarn lint:fix`: Lint and auto‑fix.
- `yarn format:check` / `yarn format:write`: Prettier check/format.
- `yarn test:e2e` (`:ui`, `:ci`, `:headed`): Run Playwright E2E.
- `yarn db:push` / `yarn db:migrate` / `yarn db:studio`: Prisma apply/migrate/studio.

## Coding Style & Naming Conventions
- Language: TypeScript; framework: Next.js; styles: Tailwind (if present).
- Tools: ESLint (Next.js config) + Prettier (Tailwind plugin).
- Run `yarn format:write` before PRs; prefer default Prettier settings.
- Naming: `camelCase` for variables/functions, `PascalCase` for React components, route files follow Next.js conventions.

## Testing Guidelines
- Framework: Playwright E2E (`e2e/**/*.spec.ts`).
- Tags: mark long tests with `@slow`; quick suite via `yarn test:e2e:quick`.
- Local debug: `yarn test:e2e:headed` or `yarn test:e2e:ui`.

## Commit & Pull Request Guidelines
- Commits: concise imperative prefix (`feat:`, `fix:`, `chore:`); group related changes.
- PRs: include description, linked issues/milestones, and screenshots for UI changes.
- CI: ensure `yarn ci` passes (typecheck, lint, format check, minimal E2E).

## Security & Configuration Tips
- Development: copy `.env.example` → `.env.local`; never commit secrets.
- AWS: store secrets in Secrets Manager/SSM; encrypt with KMS.
- Infra: prefer ECS Fargate; keep infra code in `infra/terraform`; use private subnets with NAT.

