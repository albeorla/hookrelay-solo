# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a T3 Stack starter application with authentication, RBAC, and shadcn/ui components. Built with Next.js 15, React 19, TypeScript, tRPC, Prisma, and PostgreSQL.

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
├── docker/                 # Docker configuration files
│   ├── Dockerfile          # Application container definition
│   ├── docker-compose.yml  # Local development setup
│   ├── docker-compose.ci.yml # CI environment configuration
│   └── *.yml               # Additional compose configurations
├── docs/                   # Project documentation
├── e2e/                    # End-to-end test files
├── scripts/                # Build and automation scripts
│   ├── setup-tests.sh      # Test environment setup
│   ├── start-database.sh   # Database startup script
│   └── *.sh                # CI/CD and validation scripts
├── src/                    # Application source code
│   ├── app/                # Next.js App Router pages and layouts
│   │   ├── _components/    # Page-specific components
│   │   ├── admin/          # Admin dashboard with RBAC management
│   │   ├── api/            # API routes (auth, tRPC)
│   │   └── auth/           # Authentication pages
│   ├── components/ui/      # shadcn/ui components (25+ components)
│   ├── config/             # Centralized application configuration
│   ├── server/             # Backend logic
│   │   ├── api/            # tRPC routers and procedures
│   │   │   └── routers/    # Feature-specific routers (user, role, permission)
│   │   ├── auth/           # NextAuth.js configuration
│   │   └── db.ts           # Prisma database client
│   └── trpc/               # tRPC client configuration
└── prisma/                 # Database schema and migrations
```

### Key Architectural Patterns

1. **tRPC Router Pattern**: All API endpoints are defined as tRPC procedures in `src/server/api/routers/`. Each feature has its own router file that gets combined in `src/server/api/root.ts`.

2. **Authentication Flow**: NextAuth.js handles Discord OAuth. Protected procedures use `protectedProcedure` from tRPC context. Session data is available in `ctx.session`.

3. **RBAC System**: Complete role-based access control with:
   - Users can have multiple roles
   - Roles have multiple permissions
   - Admin UI at `/admin/*` for managing users, roles, and permissions

4. **Database Access**: All database operations go through Prisma client (`ctx.db`). Schema is defined in `prisma/schema.prisma`.

5. **Component Architecture**: shadcn/ui components in `src/components/ui/` use Radix UI primitives with Tailwind CSS v4 styling.

6. **Configuration Management**: Centralized configuration pattern with consolidated tooling configs:
   - **Runtime Config**: All application configuration centralized in `src/config/index.ts`
   - **Environment Variables**: Validated in `src/env.js` using T3 env
   - **Tool Configs**: Consolidated in `package.json` where possible (prettier, postcss, lint-staged, prisma seed)
   - **Complex Configs**: Remain as separate files when appropriate (eslint, typescript, playwright)

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

1. **Adding New Features**:
   - Create tRPC router in `src/server/api/routers/`
   - Add router to `src/server/api/root.ts`
   - Create UI components using shadcn/ui components
   - Use `api.<router>.<procedure>.useQuery/useMutation()` in components

2. **Database Changes**:
   - Edit `prisma/schema.prisma`
   - Run `yarn db:generate` to create migration
   - Test migration locally before committing

3. **Before Committing**:
   - Run `yarn ci` to ensure all checks pass
   - Fix any TypeScript, linting, or formatting issues
   - Ensure E2E tests pass if UI was modified

4. **Debugging Test Issues**:
   - Use `yarn test:e2e:debug` for detailed logging
   - Use `yarn test:e2e:verbose` for maximum detail
   - Use `yarn test:e2e:ui` for interactive debugging
   - Check `test-results/` directory for traces and screenshots

## Environment Setup

Required environment variables (see `.env.example`):
- `DATABASE_URL`: PostgreSQL connection string
- `AUTH_SECRET`: NextAuth.js secret
- `AUTH_DISCORD_ID`: Discord OAuth app ID
- `AUTH_DISCORD_SECRET`: Discord OAuth app secret