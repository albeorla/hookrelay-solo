# Playwright Authentication Setup

This guide explains how automated authentication works for Playwright E2E tests.

## Overview

Our E2E tests use **fully automated authentication** with no manual intervention required. This works for both local development and CI/CD environments.

## How It Works

1. **Direct Database Sessions**: Tests create authenticated sessions directly in the database
2. **Session Cookies**: The session token is set as a cookie in the browser context
3. **State Persistence**: Authentication state is saved and reused across test runs

## Running Tests

```bash
# Run all E2E tests
yarn test:e2e

# Run tests in headed mode (see browser)
yarn test:e2e:headed

# Run tests in UI mode (interactive)
yarn test:e2e:ui

# Run tests in CI mode (same as regular, explicit for CI)
yarn test:e2e:ci --max-failures=0 --reporter=console
```

All commands work identically - there's no manual login required.

## Authentication Flow

1. auth.setup.ts executes before tests
2. It creates a test user in the database (or uses existing)
3. It creates a valid session token
4. The session is set as cookies in the browser
5. Authentication state is saved to `e2e/.auth/user.json`
6. All subsequent tests reuse this authentication

## Test User Details

- **Email**: test@example.com
- **Name**: Test User
- **Role**: USER (default role)

## Troubleshooting

### Authentication Failed

If you see "Failed to verify authentication":

1. **Check Database Connection**
   ```bash
   # Ensure database is running
   yarn db:push
   yarn prisma db seed
   ```

2. **Check Test Server**
   - Ensure the test server starts on port 3001
   - Check for any startup errors in the console

3. **Clear Auth State**
   ```bash
   rm -rf e2e/.auth/
   ```

### Session Expired

Sessions are set to expire after 30 days. If tests fail after long periods:
```bash
rm -rf e2e/.auth/
yarn test:e2e  # Will create new session
```

## CI/CD Configuration

No special configuration needed! Tests work the same in CI as locally:

```yaml
# Example GitHub Actions
- name: Run E2E Tests
  run: |
    yarn install
    yarn db:push
    yarn prisma db seed
    yarn test:e2e
```

## Security Notes

- Test sessions are only created when running tests
- The test user is isolated and has limited permissions
- Never use test authentication in production
- Keep `e2e/.auth/` in `.gitignore`

## Implementation Details

The authentication system uses:
- **NextAuth v5** with Prisma adapter
- **Direct session creation** bypassing OAuth flows
- **Cookie-based sessions** compatible with server-side auth

No OAuth providers, no manual logins, no external dependencies - just fast, reliable test authentication. 

Last Updated: October 2024 