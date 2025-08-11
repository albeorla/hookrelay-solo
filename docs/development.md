# Development Guide

Complete guide for developing features and maintaining code quality in the T3 Stack Starter Application.

## Daily Development Workflow

### Starting Development

```bash
# Pull latest changes
git pull origin main

# Install any new dependencies
yarn install

# Run database migrations if any
yarn db:generate

# Start development server with Turbo
yarn dev
```

Your development server will be available at [http://localhost:3000](http://localhost:3000).

### Essential Commands

#### Development Servers
```bash
yarn dev              # Start development server (port 3000)
yarn dev:test         # Start test server (port 3001) for E2E tests
```

#### Code Quality
```bash
yarn typecheck        # Run TypeScript type checking
yarn lint             # Run ESLint
yarn lint:fix         # Fix linting issues automatically
yarn format:check     # Check code formatting
yarn format:write     # Format code with Prettier
yarn ci               # Run all checks (typecheck, lint, format, E2E tests)
```

#### Database Operations
```bash
yarn db:generate      # Create new migration after schema changes
yarn db:migrate       # Deploy migrations to production
yarn db:push          # Push schema changes without migration (dev only)
yarn db:studio        # Open Prisma Studio GUI
```

#### Build & Production Testing
```bash
yarn build            # Build for production
yarn start            # Start production server
yarn preview          # Build and start production server
```

## Code Quality Standards

### Pre-commit Checklist

Run these commands before committing code:

```bash
# Check all code quality standards
yarn ci

# Or run individually:
yarn typecheck        # Must pass - no TypeScript errors
yarn lint             # Must pass - no ESLint errors  
yarn format:check     # Must pass - code properly formatted
yarn build            # Must succeed - no build errors
```

### Code Style Guidelines

#### TypeScript Standards
- Use TypeScript for all new code
- Define proper types for all functions and components
- Avoid `any` type - use proper typing or `unknown`
- Use type imports with `type` keyword: `import { type User } from "..."`

#### Component Standards
```typescript
"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

interface MyComponentProps {
  id: string;
  title?: string;
}

export function MyComponent({ id, title }: MyComponentProps) {
  const [isLoading, setIsLoading] = useState(false);
  
  const { data, error } = api.post.getById.useQuery({ id });
  
  if (error) return <div>Error: {error.message}</div>;
  if (!data) return <div>Loading...</div>;
  
  return (
    <div className="rounded-lg bg-white/10 p-4">
      <h2 className="text-lg font-semibold">{title ?? data.title}</h2>
      {/* Component content */}
    </div>
  );
}
```

#### Styling Standards
- Use Tailwind CSS for all styling
- Implement responsive design with Tailwind breakpoints
- Use shadcn/ui components where possible
- Follow consistent spacing patterns

## Database Development

### Working with Prisma Schema

#### Making Schema Changes

1. Edit `prisma/schema.prisma`
2. Generate migration: `yarn db:generate`
3. Review migration files in `prisma/migrations/`
4. Test migration in development
5. Commit schema and migration files

```bash
# Example workflow
# 1. Edit schema.prisma
# 2. Generate migration
yarn db:generate

# 3. Apply to development database
yarn db:push

# 4. Test with Prisma Studio
yarn db:studio
```

#### Example Schema Addition

```prisma
model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  author   User   @relation(fields: [authorId], references: [id])
  authorId String
  
  @@index([published])
  @@index([createdAt])
}
```

### Database Best Practices

- Always use migrations for schema changes
- Add database indexes for frequently queried fields
- Use meaningful constraint names
- Test migrations with data before production deployment

## API Development

### Creating tRPC Procedures

#### 1. Define Procedure in Router

```typescript
// src/server/api/routers/post.ts
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";

export const postRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({ 
      title: z.string().min(1).max(100),
      content: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.post.create({
        data: {
          title: input.title,
          content: input.content,
          authorId: ctx.session.user.id,
        },
      });
    }),

  getLatest: publicProcedure.query(({ ctx }) => {
    return ctx.db.post.findFirst({
      orderBy: { createdAt: "desc" },
      include: { author: { select: { name: true } } },
    });
  }),
});
```

#### 2. Add to Main Router

```typescript
// src/server/api/root.ts
import { postRouter } from "~/server/api/routers/post";

export const appRouter = createTRPCRouter({
  post: postRouter,
  // ... other routers
});
```

#### 3. Use in Components

```typescript
// Client-side usage
const createPost = api.post.create.useMutation({
  onSuccess: () => {
    utils.post.invalidate(); // Refresh queries
  },
});

const { data: latestPost } = api.post.getLatest.useQuery();
```

### API Development Best Practices

- Use Zod for input validation
- Implement proper error handling
- Use `protectedProcedure` for authenticated endpoints
- Include relevant database relations to avoid N+1 queries
- Add TypeScript types for complex return values

## Component Development

### Creating New Components

#### Component Structure
```
src/components/
├── ui/              # shadcn/ui components (don't edit directly)
├── forms/           # Form components
├── layout/          # Layout-specific components
└── features/        # Feature-specific components
```

#### Component Template

```typescript
"use client";

import { type ReactNode } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

interface FeatureCardProps {
  title: string;
  children: ReactNode;
  onAction?: () => void;
  isLoading?: boolean;
}

export function FeatureCard({ 
  title, 
  children, 
  onAction, 
  isLoading = false 
}: FeatureCardProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {children}
        {onAction && (
          <Button 
            onClick={onAction} 
            disabled={isLoading}
            className="mt-4"
          >
            {isLoading ? "Loading..." : "Action"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

### Component Best Practices

- Use TypeScript interfaces for props
- Implement loading and error states
- Use semantic HTML elements
- Add proper accessibility attributes
- Keep components focused and single-purpose

## Git Workflow

### Branch Naming Convention

```bash
# Feature branches
git checkout -b feat/add-user-profiles

# Bug fixes  
git checkout -b fix/authentication-redirect

# Documentation
git checkout -b docs/api-reference

# Refactoring
git checkout -b refactor/database-queries
```

### Commit Message Format

Use semantic commit messages:

```bash
git commit -m "feat: add user profile management"
git commit -m "fix: resolve Discord OAuth redirect issue"
git commit -m "docs: update API documentation"
git commit -m "refactor: optimize database queries"
git commit -m "test: add integration tests for auth flow"
```

### Pull Request Process

1. **Create Feature Branch**: Branch from `main`
2. **Develop Feature**: Implement changes with proper testing
3. **Quality Checks**: Run `yarn ci` and ensure all checks pass
4. **Update Documentation**: Update relevant docs if needed
5. **Create Pull Request**: Use descriptive title and description
6. **Address Feedback**: Respond to review comments
7. **Merge**: Squash and merge after approval

### Pre-commit Validation

The project uses Husky and lint-staged for automatic code quality:

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx,mdx}": [
      "prettier --write",
      "eslint --fix"
    ]
  }
}
```

## Debugging

### Development Tools

```bash
# Database GUI
yarn db:studio

# Build analysis
yarn build --analyze

# TypeScript diagnostics
yarn typecheck --listFiles

# Environment validation
yarn build
```

### Common Development Issues

#### Database Connection Problems
```bash
# Test database connection
npx prisma db pull

# Check database status
docker ps  # if using Docker
brew services list | grep postgresql  # if using local Postgres
```

#### TypeScript Errors
- Check imports and file paths
- Verify types are properly exported/imported
- Run `yarn typecheck` for detailed error information

#### tRPC Issues
- Verify procedure names match between client and server
- Check browser Network tab for API call errors
- Ensure proper authentication for protected procedures
- Validate input schemas with Zod

#### Build Errors
- Clear Next.js cache: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && yarn install`
- Check for circular dependencies

## Performance Optimization

### Development Performance

```bash
# Use Turbo mode for faster builds
yarn dev

# Analyze bundle size
yarn build --analyze

# Check TypeScript performance
yarn typecheck --extendedDiagnostics
```

### Code Optimization

#### Dynamic Imports
```typescript
// Lazy load heavy components
const HeavyComponent = dynamic(() => import("./HeavyComponent"), {
  loading: () => <div className="animate-pulse">Loading...</div>,
});
```

#### Database Query Optimization
```typescript
// Include relations to avoid N+1 queries
const posts = await ctx.db.post.findMany({
  include: {
    author: {
      select: { name: true, image: true }
    },
    _count: {
      select: { comments: true }
    }
  }
});
```

## Testing During Development

### Running Tests

```bash
# Run E2E tests
yarn test:e2e

# Run tests in UI mode for debugging
yarn test:e2e:ui

# Run specific test file
yarn test:e2e auth-flows.spec.ts
```

### Writing Tests

When adding new features, include appropriate tests:

- **E2E Tests**: For user workflows and integration testing
- **Component Tests**: For complex UI components (if added)
- **API Tests**: For tRPC procedures (if added)

## Contributing Guidelines

### Code Review Checklist

- [ ] Code follows TypeScript and ESLint standards
- [ ] All tests pass (`yarn ci`)
- [ ] Database migrations are included if schema changed
- [ ] Documentation updated for new features
- [ ] No console.log statements in production code
- [ ] Error handling implemented appropriately
- [ ] Performance considerations addressed

### Review Process

1. **Self Review**: Test your changes thoroughly
2. **Automated Checks**: Ensure CI passes
3. **Peer Review**: Address feedback constructively
4. **Final Testing**: Verify changes work as expected

---

**Next Steps**: 
- **[Testing Guide](./testing.md)** - Learn about the testing strategy and E2E test execution
- **[Architecture Guide](./architecture.md)** - Deep dive into the technical architecture
- **[Deployment Guide](./deployment.md)** - Production deployment and Docker setup