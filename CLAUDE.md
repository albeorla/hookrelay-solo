# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **composable startup platform** providing enterprise-grade infrastructure modules that any startup can bootstrap quickly. The architecture follows SOLID principles and GoF Design Patterns for maximum extensibility and maintainability.

### Core Foundation
1. **T3 Stack RBAC Dashboard**: Complete authentication, role-based access control, and admin UI that serves as the unified control plane for all modules
2. **HookRelay Module**: Production-ready webhook processing with retry logic, HMAC verification, idempotency, and dead letter queues

### Modular Expansion Vision
The platform is designed for incremental module addition over time:
- **Day 1**: Deploy with auth + webhook processing (covers 80% of SaaS infrastructure needs)
- **Day N**: Add modules like billing, email, analytics, file storage as business requirements evolve
- **Focus**: Spend time on unique business logic, not rebuilding common infrastructure

Each module follows strict architectural patterns ensuring loose coupling, high cohesion, and enterprise-grade reliability.

## Essential Commands

### Development
```bash
yarn dev              # Start development server (port 3000)
yarn dev:test         # Start test server (port 3001) for E2E tests
```

### Code Quality
```bash
yarn typecheck        # Run TypeScript type checking
yarn lint             # Run ESLint
yarn lint:fix         # Fix linting issues automatically
yarn format:check     # Check code formatting
yarn format:write     # Format code with Prettier
yarn ci               # Run all checks (typecheck, lint, format, E2E tests)
```

### Database
```bash
yarn db:generate      # Create new migration after schema changes
yarn db:migrate       # Deploy migrations to production
yarn db:push          # Push schema changes without migration (dev only)
yarn db:studio        # Open Prisma Studio GUI
```

### Testing
```bash
yarn test:e2e         # Run Playwright E2E tests
yarn test:e2e:ui      # Run tests with UI mode
yarn test:e2e:headed  # Run tests in headed browser
yarn test:e2e:ci      # Run tests in CI mode (optimized, minimal output)
yarn test:e2e:docker  # Run tests in Docker with bundled PostgreSQL

# Logging Control (NEW)
yarn test:e2e:silent  # Run tests with no output (LOG_LEVEL=SILENT)
yarn test:e2e:debug   # Run tests with debug logging (LOG_LEVEL=DEBUG)
yarn test:e2e:verbose # Run tests with verbose logging (LOG_LEVEL=VERBOSE)

# Test Filtering
yarn test:e2e:quick   # Run tests excluding @slow tagged tests
yarn test:e2e:slow    # Run only @slow tagged tests
yarn test:e2e:coverage # Run tests with HTML and JUnit reports
```

### Build & Production
```bash
yarn build            # Build for production
yarn start            # Start production server
yarn preview          # Build and start production server
```

### Docker Commands
```bash
yarn test:e2e:docker  # Run E2E tests in Docker with PostgreSQL
docker compose up --build --exit-code-from e2e e2e  # Manual Docker test run
docker compose up  # Development with hot reload
```

## High-Level Architecture

### Stack Components
- **Frontend**: Next.js 15 App Router with React 19
- **Styling**: Tailwind CSS v4 with shadcn/ui components
- **API**: tRPC for type-safe APIs
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: NextAuth.js v5 with Discord OAuth
- **Testing**: Playwright for E2E tests

### Directory Structure
```
├── aws/                    # AWS Lambda handlers (for production deployment)
│   └── handlers/           # Lambda function handlers
├── docker/                 # Docker configuration files
│   ├── Dockerfile          # Application container definition
│   ├── docker-compose.yml  # Full microservices stack with LocalStack
│   ├── docker-compose.ci.yml # CI environment configuration
│   └── *.yml               # Additional compose configurations
├── docs/                   # Project documentation
│   └── hookrelay/          # HookRelay business documentation
├── e2e/                    # End-to-end test files
├── infra/                  # Infrastructure as code
│   └── terraform/          # Terraform modules for AWS resources
├── scripts/                # Build and automation scripts
│   ├── localstack/         # LocalStack bootstrap scripts
│   ├── setup-tests.sh      # Test environment setup
│   └── *.sh                # CI/CD and validation scripts
├── services/               # Microservices (HookRelay modules)
│   ├── ingest-local/       # Webhook ingestion service (Express.js)
│   └── worker/             # Webhook delivery worker (SQS consumer)
├── src/                    # T3 Stack application source code
│   ├── app/                # Next.js App Router pages and layouts
│   │   ├── admin/          # Admin dashboard with RBAC management
│   │   └── api/            # API routes (auth, tRPC)
│   ├── components/ui/      # shadcn/ui components (25+ components)
│   ├── config/             # Centralized application configuration
│   ├── core/               # Module system architecture (future)
│   │   ├── module-registry.ts # Module registration and lifecycle
│   │   ├── event-bus.ts    # Inter-module communication
│   │   └── container.ts    # Dependency injection
│   ├── modules/            # Business modules (future)
│   │   ├── billing/        # Stripe integration module
│   │   ├── email/          # Email service module
│   │   └── analytics/      # Analytics and tracking module
│   ├── server/             # Backend logic
│   │   └── api/routers/    # tRPC routers (user, role, permission)
│   └── trpc/               # tRPC client configuration
└── prisma/                 # Database schema and migrations
```

### SOLID Principles & Design Patterns

The platform architecture strictly adheres to SOLID principles and implements GoF Design Patterns for enterprise-grade modularity:

#### SOLID Principles Implementation
- **Single Responsibility**: Each module handles one business concern (auth, webhooks, billing, etc.)
- **Open/Closed**: New modules can be added without modifying core infrastructure
- **Liskov Substitution**: All modules implement common interfaces and can be swapped
- **Interface Segregation**: Modules only depend on interfaces they actually use
- **Dependency Inversion**: Core system depends on abstractions, not concrete implementations

#### Core Design Patterns

**1. Strategy Pattern** - Module implementations
```typescript
interface ModuleStrategy {
  install(): Promise<void>
  configure(config: ModuleConfig): void
  getRoutes(): TRPCRouter[]
  getMiddleware(): Middleware[]
  getEventHandlers(): EventHandler[]
}
```

**2. Factory Pattern** - Module instantiation
```typescript
class ModuleFactory {
  static createModule(type: ModuleType, config: ModuleConfig): ModuleStrategy
}
```

**3. Observer Pattern** - Inter-module communication
```typescript
interface ModuleEventBus {
  subscribe(event: string, handler: EventHandler): void
  publish(event: string, payload: any): Promise<void>
}
```

**4. Dependency Injection** - Loose coupling
```typescript
class ModuleContainer {
  register<T>(token: string, implementation: T): void
  resolve<T>(token: string): T
}
```

**5. Chain of Responsibility** - Request processing
```typescript
abstract class ModuleMiddleware {
  protected next?: ModuleMiddleware
  setNext(middleware: ModuleMiddleware): ModuleMiddleware
  abstract handle(request: Request): Promise<Response>
}
```

### Current Architectural Patterns

**6. tRPC Router Pattern**: All API endpoints are defined as tRPC procedures in `src/server/api/routers/`. Each feature has its own router file that gets combined in `src/server/api/root.ts`.

**7. Authentication Flow**: NextAuth.js handles Discord OAuth. Protected procedures use `protectedProcedure` from tRPC context. Session data is available in `ctx.session`.

**8. RBAC System**: Complete role-based access control with:
   - Users can have multiple roles
   - Roles have multiple permissions
   - Admin UI at `/admin/*` for managing users, roles, and permissions

**9. Database Access**: All database operations go through Prisma client (`ctx.db`). Schema is defined in `prisma/schema.prisma`.

**10. Component Architecture**: shadcn/ui components in `src/components/ui/` use Radix UI primitives with Tailwind CSS v4 styling.

**11. Configuration Management**: Centralized configuration pattern with consolidated tooling configs:
   - **Runtime Config**: All application configuration centralized in `src/config/index.ts`
   - **Environment Variables**: Validated in `src/env.js` using T3 env
   - **Tool Configs**: Consolidated in `package.json` where possible (prettier, postcss, lint-staged, prisma seed)
   - **Complex Configs**: Remain as separate files when appropriate (eslint, typescript, playwright)

## Module System Architecture

### Module Integration Patterns

New modules integrate seamlessly using these established patterns:

#### Module Registration
```typescript
// src/core/module-registry.ts
class ModuleRegistry {
  private modules = new Map<string, ModuleStrategy>()
  private eventBus = new ModuleEventBus()
  private container = new ModuleContainer()
  
  registerModule(name: string, module: ModuleStrategy): void {
    // Validate module interfaces
    // Register dependencies
    // Subscribe to events
    // Add to tRPC router
  }
}
```

#### Event-Driven Communication
```typescript
// Inter-module events (loosely coupled)
eventBus.publish('user.created', { userId, email, roles })
eventBus.publish('webhook.received', { endpointId, payload, headers })
eventBus.publish('payment.succeeded', { customerId, amount, metadata })
```

#### Shared Interfaces
```typescript
interface ModuleConfig {
  name: string
  version: string
  dependencies: string[]
  permissions: Permission[]
  migrations?: Migration[]
}

interface ModuleHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  dependencies: HealthStatus[]
  lastCheck: Date
}
```

### Planned Module Examples

**Billing Module** (`src/modules/billing/`)
- Stripe integration with webhook handling
- Usage tracking and metering
- Subscription management UI in admin dashboard
- Integrates with RBAC for payment-based permissions

**Email Module** (`src/modules/email/`)
- Transactional email templates
- SES/SendGrid provider abstraction
- Email analytics and delivery tracking
- Event-driven triggers (user.created → welcome email)

**Analytics Module** (`src/modules/analytics/`)
- Event tracking and funnels
- Custom dashboard widgets
- Privacy-compliant data collection
- Integration with existing admin UI

## Configuration Consolidation Strategy

The project follows a strategic approach to configuration management:

### Consolidated in package.json:
- **Prettier**: Simple Tailwind CSS plugin configuration
- **PostCSS**: Simple Tailwind CSS plugin configuration  
- **lint-staged**: Pre-commit formatting rules
- **Prisma**: Database seed script configuration

### Centralized in src/config/index.ts:
- **Application Settings**: Port, environment, feature flags
- **Authentication**: Discord OAuth configuration
- **Database**: Connection settings
- **Testing**: Log levels and CI configurations

### Separate Configuration Files (Complex):
- **ESLint** (`eslint.config.js`): Complex TypeScript rules and Next.js integration
- **TypeScript** (`tsconfig.json`): Compiler options and path aliases  
- **Playwright** (`playwright.config.ts`): Test configuration (uses centralized config)
- **Next.js** (`next.config.js`): Minimal build configuration

### Direct process.env Usage (Appropriate):
- Platform-specific variables (VERCEL_URL, CI, PORT)
- Special npm variables (npm_package_version)
- Node.js environment checking (NODE_ENV)
- Test framework variables (PLAYWRIGHT_SHARD)

## Project Organization Strategy

The project follows a clean directory structure with organized separation of concerns:

### Core Directories:
- **`src/`**: All application source code with clear domain separation
- **`scripts/`**: All automation, build, and utility scripts in one location
- **`docker/`**: All Docker-related configuration files consolidated
- **`docs/`**: Comprehensive project documentation
- **`e2e/`**: End-to-end testing with Playwright

### Build Artifacts (Gitignored):
- **`/coverage`**: Code coverage reports generated by test tools
- **`/playwright-report/`** & **`/test-results/`**: Playwright test outputs and reports
- **`/act-logs`, `/ci-*-logs`, `/ci-*-results`**: Temporary CI and validation logs
- **`*.log`**: General log files from various tools

### Script Organization:
- **Setup Scripts**: `scripts/setup-tests.sh`, `scripts/start-database.sh`
- **CI/CD Scripts**: `scripts/ci-*.sh` for various CI operations
- **Validation Scripts**: `scripts/*-validate.sh` for different validation tasks
- **Integration Scripts**: Comprehensive testing and integration workflows

### Docker Organization:
- **Main Dockerfile**: `docker/Dockerfile` for application builds
- **Development**: `docker/docker-compose.yml` for local development
- **CI Environment**: `docker/docker-compose.ci.yml` mirrors GitHub Actions
- **Test Matrix**: `docker/docker-compose.test-matrix.yml` for comprehensive testing

## Test Logging System

The project uses a centralized logging system for E2E tests with configurable verbosity:

### Log Levels (in order of verbosity):
- `SILENT` - No output except errors
- `ERROR` - Only errors
- `WARN` - Warnings and errors  
- `INFO` - General information (default for local)
- `DEBUG` - Detailed debugging information
- `VERBOSE` - Maximum detail including performance metrics

### Environment Variables:
- `LOG_LEVEL` - Set specific log level (e.g., `LOG_LEVEL=DEBUG`)
- `CI=true` - Automatically reduces logging to ERROR level
- `VERBOSE_TEST_LOGS=true` - Legacy support (use LOG_LEVEL=VERBOSE instead)

### CI Optimizations:
- Uses 1 worker for stability (Playwright best practice)
- Minimal reporters: only 'dot' and 'github' in CI
- Quiet mode enabled to reduce output
- Fail-fast on flaky tests
- Optimized Docker builds with pre-installed dependencies

## Development Workflow

### Enterprise Module Development

**1. Creating a New Module** (Following SOLID Principles):

```bash
# Create module structure
mkdir -p src/modules/new-module/{components,services,types,migrations}

# Implement ModuleStrategy interface
# src/modules/new-module/index.ts
export class NewModule implements ModuleStrategy {
  async install(): Promise<void> { /* setup logic */ }
  configure(config: ModuleConfig): void { /* configuration */ }
  getRoutes(): TRPCRouter[] { /* tRPC procedures */ }
  getMiddleware(): Middleware[] { /* request processing */ }
  getEventHandlers(): EventHandler[] { /* event subscriptions */ }
}
```

**2. Module Integration Checklist**:
- ✅ Implement `ModuleStrategy` interface
- ✅ Define clear module boundaries (Single Responsibility)
- ✅ Use dependency injection for external dependencies
- ✅ Subscribe to relevant events via `ModuleEventBus`
- ✅ Add tRPC procedures to admin dashboard
- ✅ Include database migrations if needed
- ✅ Write comprehensive E2E tests
- ✅ Document module API and configuration

**3. Pattern Compliance**:
```typescript
// ❌ Bad: Direct dependencies
import { StripeService } from '../billing/stripe-service'

// ✅ Good: Dependency injection
constructor(@Inject('PaymentService') private payments: PaymentService)
```

```typescript
// ❌ Bad: Tight coupling
this.userService.updateProfile(data)

// ✅ Good: Event-driven
this.eventBus.publish('profile.update.requested', data)
```

### Traditional T3 Stack Development

**4. Adding T3 Features**:
   - Create tRPC router in `src/server/api/routers/`
   - Add router to `src/server/api/root.ts`
   - Create UI components using shadcn/ui components
   - Use `api.<router>.<procedure>.useQuery/useMutation()` in components

**5. Database Changes**:
   - Edit `prisma/schema.prisma`
   - Run `yarn db:generate` to create migration
   - Test migration locally before committing

### Microservices Development (HookRelay)

**6. Service Development**:
   - Modify `services/ingest-local/src/index.ts` for ingestion logic
   - Modify `services/worker/src/index.ts` for delivery logic
   - Update DynamoDB schemas in `scripts/localstack/bootstrap.sh`
   - Test with LocalStack: `docker compose up`

**7. Infrastructure Changes**:
   - Update Terraform modules in `infra/terraform/`
   - Plan changes: `cd infra/terraform && terraform plan`
   - Apply changes: `terraform apply` (after review)

### Quality Assurance

**8. Before Committing**:
   - Run `yarn ci` to ensure all checks pass
   - Verify SOLID principle compliance
   - Check design pattern usage is appropriate
   - Fix any TypeScript, linting, or formatting issues
   - Ensure E2E tests pass if UI was modified
   - Test module integration if new modules added

**9. Debugging Test Issues**:
   - Use `yarn test:e2e:debug` for detailed logging
   - Use `yarn test:e2e:verbose` for maximum detail
   - Use `yarn test:e2e:ui` for interactive debugging
   - Check `test-results/` directory for traces and screenshots
   - Check LocalStack logs: `docker compose logs localstack`

## Environment Setup

Required environment variables (see `.env.example`):
- `DATABASE_URL`: PostgreSQL connection string
- `AUTH_SECRET`: NextAuth.js secret
- `AUTH_DISCORD_ID`: Discord OAuth app ID
- `AUTH_DISCORD_SECRET`: Discord OAuth app secret