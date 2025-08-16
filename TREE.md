# Project Tree Structure

This document provides a comprehensive overview of the HookRelay Solo project structure, explaining the purpose and functionality of each file and directory.

## Project Overview

HookRelay Solo is a composable startup platform built with modern TypeScript technologies, providing enterprise-grade infrastructure modules including authentication, RBAC, and webhook processing. The architecture follows SOLID principles and GoF Design Patterns for maximum extensibility and maintainability.

### Core Technologies
- **Frontend**: Next.js 15 with React 19 and App Router
- **Styling**: Tailwind CSS v4 + shadcn/ui component library
- **API**: tRPC for type-safe APIs
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: NextAuth.js v5 with Discord OAuth
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Infrastructure**: Docker, AWS Lambda, Terraform

## Complete Project Structure

```
.
├── .github/                          # GitHub configuration and workflows
│   ├── workflows/
│   │   ├── ci-optimized.yml          # Main CI/CD pipeline with optimized performance
│   │   └── ecr-build-push.yml        # AWS ECR container image build and deployment
│   └── branch-protection.md          # Documentation for branch protection rules
│
├── .husky/                           # Git hooks management via Husky
│   ├── _/
│   │   └── husky.sh                  # Husky runtime script
│   └── pre-commit                    # Pre-commit hook running lint-staged
│
├── aws/                              # AWS Lambda handlers for production deployment
│   └── handlers/
│       ├── delivery-worker.ts        # Lambda function for webhook delivery processing
│       └── ingest-handler.ts         # Lambda function for webhook ingestion
│
├── docker/                           # Docker configuration for development and CI
│   ├── Dockerfile                    # Multi-stage container definition for the app
│   ├── docker-compose.yml            # Full development stack with LocalStack
│   ├── docker-compose.ci.yml         # CI environment matching GitHub Actions
│   ├── docker-compose.dev.yml        # Development-optimized configuration
│   ├── docker-compose.test-matrix.yml # Comprehensive testing environment
│   └── .env.test                     # Test environment variables
│
├── docs/                             # Project documentation
│   ├── hookrelay/                    # HookRelay business documentation
│   │   ├── hookrelay-dev-plan.md     # Development roadmap and technical plan
│   │   ├── HookRelay-One-Pager.md    # Executive summary and value proposition
│   │   ├── HookRelay-Pitch-Deck.md   # Investor pitch presentation content
│   │   ├── hookrelay-prd.md          # Product Requirements Document
│   │   ├── HookRelay-Project-Audit.md # Technical audit and security assessment
│   │   ├── Implementation-Files.md   # File-by-file implementation guide
│   │   ├── Investor-FAQ.md           # Frequently asked questions for investors
│   │   ├── Preseed-Brief.md          # Pre-seed funding brief
│   │   ├── Preseed-Data-Room-Checklist.md # Due diligence documentation
│   │   └── Value-Prop.md             # Value proposition analysis
│   ├── project-management/           # Development project management
│   │   ├── 7-day-launch-plan.md      # Aggressive launch timeline
│   │   ├── epic-modular-platform.md  # Modular platform architecture plan
│   │   ├── README.md                 # Project management overview
│   │   ├── stories-breakdown.md      # User stories and feature breakdown
│   │   ├── tasks-detailed.md         # Detailed task specifications
│   │   └── templates-and-guidelines.md # Development templates and standards
│   ├── ci-cd-setup.md                # CI/CD pipeline documentation
│   ├── core-module-system-primer.md  # Module system architecture guide
│   ├── development.md                # Development workflow and standards
│   ├── e2e-testing-guide.md          # End-to-end testing guide
│   ├── feature-status.md             # Current feature implementation status
│   ├── getting-started.md            # Setup and installation guide
│   ├── implementation-status.md      # Technical implementation progress
│   ├── management-update-memo-august-2025.md # Management status report
│   ├── playwright-auth-setup.md      # Playwright authentication configuration
│   ├── progress-tracker.md           # Development progress tracking
│   ├── rbac-journey.md               # RBAC system implementation journey
│   └── shadcn-ui-guide.md            # shadcn/ui components usage guide
│
├── html/                             # Static HTML build artifacts (gitignored)
│   ├── assets/                       # Built JavaScript and CSS assets
│   ├── data/                         # Static data files
│   ├── bg.png                        # Background images
│   ├── favicon.ico                   # Site favicon
│   ├── favicon.svg                   # SVG favicon
│   ├── html.meta.json.gz             # Compressed metadata
│   └── index.html                    # Main HTML entry point
│
├── infra/                            # Infrastructure as Code (Terraform)
│   ├── terraform/                    # Terraform modules for AWS resources
│   │   ├── main.tf                   # Primary infrastructure definitions
│   │   ├── outputs.tf                # Terraform output values
│   │   ├── provider.tf               # AWS provider configuration
│   │   └── variables.tf              # Input variables definition
│   └── README.md                     # Infrastructure deployment guide
│
├── prisma/                           # Database schema and migrations
│   ├── migrations/                   # Database migration files
│   │   ├── 20250711233023_init/      # Initial database schema
│   │   ├── 20250712170926_rbac_init/ # RBAC system initialization
│   │   ├── 20250712171522_feat_rbac_schema/ # Complete RBAC schema
│   │   └── migration_lock.toml       # Migration lock file
│   ├── schema.prisma                 # Prisma schema definition (main database model)
│   └── seed.ts                       # Database seeding script for development
│
├── public/                           # Static public assets
│   └── favicon.ico                   # Site favicon
│
├── scripts/                          # Build, automation, and utility scripts
│   ├── localstack/                   # LocalStack development setup
│   │   └── bootstrap.sh              # LocalStack AWS services initialization
│   ├── act-local.sh                  # GitHub Actions local testing via act
│   ├── act-validate.sh               # Local action validation
│   ├── ci-cleanup.sh                 # CI artifact cleanup
│   ├── ci-integration.sh             # Integration testing automation
│   ├── ci-local.sh                   # Local CI simulation
│   ├── ci-performance.sh             # Performance testing automation
│   ├── ci-validate.sh                # CI validation checks
│   ├── cleanup.sh                    # General cleanup utility
│   ├── entrypoint.sh                 # Docker container entrypoint
│   ├── gh-actions.sh                 # GitHub Actions utilities
│   ├── gh-workflows.sh               # GitHub workflow management
│   ├── make-admin.ts                 # User admin privilege assignment
│   ├── pr-testing.sh                 # Pull request testing automation
│   ├── README.md                     # Scripts documentation
│   ├── setup_hookrelay_project.sh    # Project setup automation
│   ├── setup-tests.sh                # Test environment setup
│   ├── start-database.sh             # Database startup utility
│   ├── test-full-stack.sh            # Full stack testing
│   ├── update-permissions.sql        # Database permissions update
│   └── validate-phase2.sh            # Phase 2 validation checks
│
├── services/                         # Microservices (HookRelay components)
│   ├── ingest/                       # Original ingest service (placeholder)
│   │   └── src/                      # Source code directory
│   ├── ingest-local/                 # Local webhook ingestion service
│   │   ├── src/
│   │   │   └── index.ts              # Express.js webhook receiver with HMAC verification
│   │   ├── Dockerfile                # Container definition for ingestion service
│   │   ├── package.json              # Node.js dependencies and scripts
│   │   ├── package-lock.json         # Dependency lock file
│   │   ├── tsconfig.json             # TypeScript configuration
│   │   └── yarn.lock                 # Yarn dependency lock
│   └── worker/                       # Webhook delivery worker service
│       ├── src/
│       │   └── index.ts              # SQS message processor for webhook delivery
│       ├── Dockerfile                # Container definition for worker service
│       ├── package.json              # Node.js dependencies and scripts
│       ├── tsconfig.json             # TypeScript configuration
│       └── yarn.lock                 # Yarn dependency lock
│
├── src/                              # Main application source code (T3 Stack)
│   ├── app/                          # Next.js App Router pages and layouts
│   │   ├── admin/                    # Admin dashboard with RBAC management
│   │   │   ├── permissions/          # Permission management pages
│   │   │   ├── roles/                # Role management pages
│   │   │   ├── users/                # User management pages
│   │   │   ├── layout.tsx            # Admin layout component
│   │   │   └── page.tsx              # Admin dashboard homepage
│   │   ├── api/                      # API routes
│   │   │   ├── auth/                 # NextAuth.js authentication routes
│   │   │   │   └── [...nextauth]/
│   │   │   │       └── route.ts      # NextAuth configuration endpoint
│   │   │   └── trpc/                 # tRPC API endpoints
│   │   │       └── [...trpc]/
│   │   │           └── route.ts      # tRPC request handler
│   │   ├── auth/                     # Authentication pages
│   │   │   ├── signin/               # Sign-in page
│   │   │   │   └── page.tsx          # Sign-in form component
│   │   │   └── signout/              # Sign-out page
│   │   │       └── page.tsx          # Sign-out confirmation
│   │   ├── settings/                 # User settings pages
│   │   │   └── page.tsx              # Settings page component
│   │   ├── layout.tsx                # Root layout component with providers
│   │   └── page.tsx                  # Homepage component
│   ├── components/                   # Reusable React components
│   │   ├── layout/                   # Layout components
│   │   │   ├── header.tsx            # Application header with navigation
│   │   │   ├── sidebar.tsx           # Sidebar navigation component
│   │   │   └── theme-toggle.tsx      # Dark/light theme switch
│   │   ├── providers/                # React context providers
│   │   │   ├── query-provider.tsx    # TanStack Query provider
│   │   │   └── theme-provider.tsx    # Theme context provider
│   │   └── ui/                       # shadcn/ui component library (25+ components)
│   │       ├── accordion.tsx         # Collapsible content sections
│   │       ├── alert-dialog.tsx      # Modal confirmation dialogs
│   │       ├── alert.tsx             # Inline alert notifications
│   │       ├── aspect-ratio.tsx      # Responsive aspect ratio container
│   │       ├── avatar.tsx            # User profile picture component
│   │       ├── badge.tsx             # Status and category badges
│   │       ├── breadcrumb.tsx        # Navigation breadcrumb
│   │       ├── button.tsx            # Primary button component
│   │       ├── calendar.tsx          # Date picker calendar
│   │       ├── card.tsx              # Content container cards
│   │       ├── checkbox.tsx          # Form checkbox input
│   │       ├── collapsible.tsx       # Expandable content sections
│   │       ├── context-menu.tsx      # Right-click context menus
│   │       ├── dialog.tsx            # Modal dialog component
│   │       ├── dropdown-menu.tsx     # Dropdown menu component
│   │       ├── form.tsx              # Form wrapper with validation
│   │       ├── hover-card.tsx        # Hover-triggered information cards
│   │       ├── input.tsx             # Text input component
│   │       ├── label.tsx             # Form input labels
│   │       ├── menubar.tsx           # Horizontal menu bar
│   │       ├── navigation-menu.tsx   # Complex navigation component
│   │       ├── popover.tsx           # Floating content containers
│   │       ├── progress.tsx          # Progress indicator bars
│   │       ├── radio-group.tsx       # Radio button groups
│   │       ├── scroll-area.tsx       # Custom scrollable areas
│   │       ├── select.tsx            # Dropdown select component
│   │       ├── separator.tsx         # Visual content separators
│   │       ├── sheet.tsx             # Slide-out panel component
│   │       ├── skeleton.tsx          # Loading state placeholders
│   │       ├── slider.tsx            # Range slider component
│   │       ├── switch.tsx            # Toggle switch component
│   │       ├── table.tsx             # Data table component
│   │       ├── tabs.tsx              # Tabbed content interface
│   │       ├── textarea.tsx          # Multi-line text input
│   │       ├── toast.tsx             # Notification toast messages
│   │       ├── toggle-group.tsx      # Toggle button groups
│   │       ├── toggle.tsx            # Toggle button component
│   │       └── tooltip.tsx           # Hover tooltip component
│   ├── config/                       # Centralized application configuration
│   │   └── index.ts                  # Environment-based configuration management
│   ├── core/                         # Module system architecture (SOLID principles)
│   │   ├── __tests__/                # Unit tests for core module system
│   │   │   ├── container.test.ts     # Dependency injection container tests
│   │   │   ├── event-bus.test.ts     # Event bus communication tests
│   │   │   ├── health-monitor.test.ts # Health check system tests
│   │   │   ├── index.test.ts         # Core system integration tests
│   │   │   ├── lifecycle-manager.test.ts # Module lifecycle tests
│   │   │   ├── middleware-chain.test.ts # Request processing chain tests
│   │   │   ├── module-factory.test.ts # Module instantiation tests
│   │   │   ├── module-registry.test.ts # Module registry tests
│   │   │   ├── module-strategy.test.ts # Module strategy pattern tests
│   │   │   ├── security.test.ts      # Security framework tests
│   │   │   ├── trpc-integration.test.ts # tRPC integration tests
│   │   │   └── types.test.ts         # Type system validation tests
│   │   ├── container.ts              # Dependency injection container (IoC pattern)
│   │   ├── event-bus.ts              # Inter-module communication (Observer pattern)
│   │   ├── health-monitor.ts         # System health monitoring
│   │   ├── index.ts                  # Core system exports and initialization
│   │   ├── lifecycle-manager.ts      # Module lifecycle management
│   │   ├── middleware-chain.ts       # Request processing chain (Chain of Responsibility)
│   │   ├── module-factory.ts         # Module instantiation (Factory pattern)
│   │   ├── module-registry.ts        # Module registration and management (Singleton)
│   │   ├── module-strategy.ts        # Module interface definitions (Strategy pattern)
│   │   ├── security.ts               # Security framework and validation
│   │   ├── trpc-integration.ts       # tRPC router integration utilities
│   │   └── types.ts                  # Core system type definitions
│   ├── hooks/                        # Custom React hooks
│   │   └── use-media-query.tsx       # Responsive design media query hook
│   ├── lib/                          # Utility libraries and helpers
│   │   ├── __tests__/                # Unit tests for utility functions
│   │   │   └── webhook-security.test.ts # Webhook security validation tests
│   │   ├── utils.ts                  # General utility functions and class merging
│   │   └── webhook-security.ts       # HMAC verification and webhook validation
│   ├── server/                       # Backend server logic (tRPC)
│   │   ├── api/                      # tRPC API definitions
│   │   │   ├── routers/              # Feature-specific API routers
│   │   │   │   ├── permission.ts     # Permission management API
│   │   │   │   ├── role.ts           # Role management API
│   │   │   │   └── user.ts           # User management API
│   │   │   ├── root.ts               # Main tRPC router combining all sub-routers
│   │   │   └── trpc.ts               # tRPC configuration and middleware
│   │   ├── auth/                     # Authentication configuration
│   │   │   ├── config.ts             # NextAuth.js configuration
│   │   │   └── index.ts              # Authentication utilities and exports
│   │   └── db.ts                     # Prisma database client initialization
│   ├── styles/                       # Global CSS styles
│   │   └── globals.css               # Tailwind CSS imports and global styles
│   ├── trpc/                         # tRPC client configuration
│   │   ├── query-client.ts           # TanStack Query client setup
│   │   ├── react.tsx                 # tRPC React hooks and providers
│   │   └── server.ts                 # Server-side tRPC client
│   ├── env.js                        # Environment variable validation (T3 pattern)
│   └── middleware.ts                 # Next.js middleware for authentication
│
├── AGENTS.md                         # Documentation for AI agent interactions
├── CLAUDE.md                         # Claude Code instructions and project guide
├── components.json                   # shadcn/ui component configuration
├── docker-compose.yml                # Primary Docker Compose configuration
├── eslint.config.js                  # ESLint linting configuration
├── jest.config.js                    # Jest unit testing configuration
├── jest.setup.js                     # Jest test setup and global configuration
├── next.config.js                    # Next.js build and runtime configuration
├── package.json                      # Node.js dependencies, scripts, and metadata
├── playwright.config.ts              # Playwright E2E testing configuration
├── README.md                         # Project overview and quick start guide
├── test-webhook.js                   # Webhook testing utility script
├── tsconfig.app.json                 # TypeScript config for application code
├── tsconfig.json                     # Main TypeScript configuration
├── vitest.config.ts                  # Vitest unit testing configuration
├── vitest.setup.ts                   # Vitest test setup and environment
└── yarn.lock                         # Yarn dependency lock file
```

## Key Architectural Patterns

### SOLID Principles Implementation
- **Single Responsibility**: Each module handles one business concern (auth, webhooks, billing, etc.)
- **Open/Closed**: New modules can be added without modifying core infrastructure
- **Liskov Substitution**: All modules implement common interfaces and can be swapped
- **Interface Segregation**: Modules only depend on interfaces they actually use
- **Dependency Inversion**: Core system depends on abstractions, not concrete implementations

### Design Patterns Used
- **Strategy Pattern**: Module implementations (`src/core/module-strategy.ts`)
- **Factory Pattern**: Module instantiation (`src/core/module-factory.ts`)
- **Observer Pattern**: Inter-module communication (`src/core/event-bus.ts`)
- **Dependency Injection**: Loose coupling (`src/core/container.ts`)
- **Chain of Responsibility**: Request processing (`src/core/middleware-chain.ts`)
- **Singleton Pattern**: Module registry (`src/core/module-registry.ts`)

### Infrastructure Architecture
- **T3 Stack**: Modern full-stack TypeScript with Next.js, tRPC, and Prisma
- **Microservices**: Separate webhook ingestion and delivery services
- **Event-Driven**: SQS-based message queuing for scalable webhook processing
- **Container-First**: Docker for consistent development and deployment
- **Infrastructure as Code**: Terraform for reproducible AWS deployments

### Testing Strategy
- **Unit Tests**: Vitest for core business logic and utilities
- **Integration Tests**: tRPC procedure testing with database
- **E2E Tests**: Playwright for user workflow validation
- **Security Tests**: HMAC verification and input validation
- **Performance Tests**: Webhook throughput and latency monitoring

## Development Workflow

1. **Core Platform**: T3 Stack foundation with authentication and RBAC
2. **Module System**: Extensible architecture for adding new business modules
3. **HookRelay Service**: Production-ready webhook processing infrastructure
4. **Quality Assurance**: Comprehensive testing and code quality automation
5. **Deployment**: Container-based deployment with infrastructure automation

This structure supports rapid development while maintaining enterprise-grade code quality, security, and scalability.