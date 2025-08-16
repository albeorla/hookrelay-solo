# HookRelay Solo

[![CI/CD Pipeline (Optimized)](https://github.com/albeorla/hookrelay-solo/actions/workflows/ci-optimized.yml/badge.svg)](https://github.com/albeorla/hookrelay-solo/actions/workflows/ci-optimized.yml)

[![Build and Push Images](https://github.com/albeorla/hookrelay-solo/actions/workflows/ecr-build-push.yml/badge.svg)](https://github.com/albeorla/hookrelay-solo/actions/workflows/ecr-build-push.yml)

Modern full-stack TypeScript application with authentication, RBAC, and a complete UI component library.

## 🚀 Tech Stack

- **Framework**: Next.js 15 with React 19 and App Router
- **Styling**: Tailwind CSS v4 + complete shadcn/ui component suite
- **Backend**: tRPC with type-safe APIs and RBAC system
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js v5 with Discord OAuth
- **Testing**: Playwright E2E testing

## ✨ Key Features

- **Role-Based Access Control (RBAC)** with admin panels for users, roles, and permissions
- **Complete shadcn/ui Implementation** with 25+ pre-configured components
- **Responsive Dashboard** with theme toggle and user management  
- **Docker Support** for development and deployment
- **Comprehensive Testing** with automated E2E test suite

## 🏃‍♂️ Quick Start

```bash
# Install dependencies
yarn install

# Set up environment (copy .env.example to .env)
cp .env.example .env

# Start development server
yarn dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## 📚 Documentation

For comprehensive guides, visit the [docs](./docs/) directory:

- **[Getting Started](./docs/getting-started.md)** - Complete setup and installation guide
- **[Development](./docs/development.md)** - Development workflow and coding standards  
- **[Testing](./docs/testing.md)** - Testing strategy and E2E test execution
- **[Deployment](./docs/deployment.md)** - Docker setup and production deployment
- **[Architecture](./docs/architecture.md)** - Technical architecture and project structure
- **[Features](./docs/features.md)** - RBAC system and feature documentation

## 📈 Learn More

To learn more about the [T3 Stack](https://create.t3.gg/), check out the [documentation](https://create.t3.gg/) and [tutorials](https://create.t3.gg/en/faq#what-learning-resources-are-currently-available).

---

**Last Updated**: January 2025