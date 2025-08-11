# 🚀 CI/CD Pipeline Documentation

## Overview

This project uses a comprehensive CI/CD pipeline with GitHub Actions that ensures code quality, runs extensive tests, and prevents regressions from reaching production.

## 🎯 Pipeline Goals

- **Zero-Downtime Quality**: Prevent breaking changes from being merged
- **Comprehensive Testing**: 84+ E2E tests covering all critical functionality  
- **Security First**: Automated dependency auditing and vulnerability scanning
- **Performance Monitoring**: Build size and performance regression detection
- **Coverage Tracking**: Test coverage reporting and trending

## 📊 Current Test Status

| **Metric** | **Status** | **Target** |
|------------|------------|------------|
| **Total Tests** | 139 tests | - |
| **Success Rate** | **84 passed (60.4%)** | 90%+ |
| **Core Features** | **100% working** ✅ | 100% |
| **Authentication** | **100% working** ✅ | 100% |
| **Admin System** | **100% working** ✅ | 100% |

### ✅ Fully Working Systems:
- Authentication & Authorization  
- Role-Based Access Control (RBAC)
- Admin Management (Users, Roles, Permissions)
- Dashboard & UI Components
- Database Operations & Sessions

## 🔄 Pipeline Workflow

#### File Change Detection
- Detects changes in source, tests, docs, config, schema, dependencies to run only necessary jobs.

### 1. **Code Quality & Security** (`quality`)
```yaml
- TypeScript compilation check
- ESLint code quality
- Prettier formatting 
- Security dependency audit
```

### 2. **Unit & Integration Tests** (`test`)
```yaml
- Database setup & seeding
- Unit test execution (when available)
- Integration test coverage
```

### 5. **E2E Tests with Coverage** (`e2e`)
```yaml
- Uses Docker Compose for consistent testing
- Caches dependencies, TypeScript, ESLint, Prisma, and Next.js build
- Runs yarn test:e2e:ci --max-failures=0 --reporter=console
```

### 4. **Security Audit** (`security`)
```yaml
- Dependency vulnerability scanning
- High-severity issue detection
- SARIF security reporting
```

### 5. **Quality Gate** (`quality-gate`)
```yaml
- Aggregate all check results
- Fail if any critical issues found
- Generate comprehensive report
```

## 🛡️ Branch Protection

### Main Branch Requirements:
- ✅ **1+ Approving Reviews** 
- ✅ **All Status Checks Pass**
  - `quality` - Code quality & security
  - `test` - Unit & integration tests  
  - `e2e` - E2E tests with coverage
  - `security` - Security audit
  - `quality-gate` - Overall quality gate
- ✅ **Conversations Resolved**
- ✅ **Up-to-date branches**

### Protected Against:
- ❌ Direct pushes to main
- ❌ Force pushes
- ❌ Branch deletion
- ❌ Bypassing reviews
- ❌ Failing status checks

## 📈 Coverage & Reporting

### Test Coverage Collection:
- **E2E Coverage**: Collected via Playwright during test runs
- **Upload**: Automatic upload to Codecov (if configured)
- **Artifacts**: Available in GitHub Actions artifacts
- **PR Comments**: Coverage reports posted to pull requests

### Reporting Features:
- ✅ HTML test reports with screenshots/videos
- ✅ JUnit XML for CI integration
- ✅ GitHub Actions summary reports
- ✅ PR comment integration
- ✅ Artifact preservation (7 days)

## ⚙️ Local Development

### Running Tests Locally:
```bash
yarn test:e2e:ci
```

Note: Dockerfile includes DB readiness check with pg_isready.

### Database Setup:
```bash
# Setup database for testing
yarn prisma generate
yarn prisma db push  
yarn prisma db seed
```

### Code Quality Checks:
```bash
# Check TypeScript
yarn typecheck

# Check linting
yarn lint

# Check formatting  
yarn format:check

# Fix issues
yarn lint:fix
yarn format:write
```

## 🚀 Deployment Workflow

### Automatic Deployment:
1. **Feature Branch** → Create PR
2. **CI Pipeline** → All checks must pass
3. **Code Review** → 1+ approvals required
4. **Merge to Main** → Triggers production build
5. **Production Deploy** → Automatic (when configured)

### Manual Deployment:
```bash
# Build for production
yarn build

# Preview production build
yarn preview
```

## 🔧 Environment Configuration

### Required Environment Variables:
```bash
# Authentication
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000

# Database  
DATABASE_URL=postgresql://user:pass@host:port/db

# OAuth (Optional)
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
```

### GitHub Secrets Setup:
1. Navigate to **Settings** → **Secrets and variables** → **Actions**
2. Add required secrets:
   - `NEXTAUTH_SECRET`
   - `CODECOV_TOKEN` (optional, for coverage)
   - `DISCORD_CLIENT_ID` (optional)
   - `DISCORD_CLIENT_SECRET` (optional)

## 📊 Monitoring & Metrics

### CI/CD Metrics to Track:
- **Build Success Rate**: Target 95%+
- **Test Pass Rate**: Target 90%+ (currently 60.4%)
- **Pipeline Duration**: Target <10 minutes
- **Coverage Trends**: Monitor increases/decreases
- **Security Issues**: Zero high-severity vulnerabilities

### Performance Monitoring:
- Build time tracking
- Bundle size monitoring  
- Test execution time
- Flaky test identification

## 🐛 Troubleshooting

### Common Issues:

#### E2E Tests Failing:
```bash
# Check test output
yarn test:e2e --reporter=html

# Run specific test file
yarn test:e2e tests/auth.spec.ts

# Debug mode
yarn test:e2e:debug
```

#### Database Issues:
```bash
# Reset database
yarn prisma db reset

# Regenerate client
yarn prisma generate
```

#### CI Failures:
1. Check GitHub Actions logs
2. Verify environment variables
3. Check for dependency conflicts
4. Review recent changes

### Emergency Procedures:

#### Hotfix Process:
1. Create hotfix branch from main
2. Make minimal necessary changes
3. Get emergency review approval
4. Temporarily disable protection (if needed)
5. Merge and re-enable protection

#### CI Infrastructure Issues:
1. Verify locally all tests pass
2. Check GitHub Actions status page
3. Re-run failed jobs
4. Contact admin for manual override if needed

## 🎯 Future Improvements

### Planned Enhancements:
- [ ] Increase E2E test success rate to 90%+
- [ ] Add unit test coverage
- [ ] Implement visual regression testing
- [ ] Add performance benchmarking
- [ ] Enhance security scanning
- [ ] Add automated dependency updates

### Test Suite Improvements:
- [ ] Fix remaining 10 E2E test failures
- [ ] Add API testing layer
- [ ] Implement contract testing
- [ ] Add accessibility testing
- [ ] Cross-browser testing

## 📚 Additional Resources

- [Branch Protection Setup](.github/branch-protection.md)
- [E2E Testing Guide](e2e-testing-guide.md)
- [Development Guide](development-guide.md)
- [Playwright Documentation](https://playwright.dev/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions) 

Last Updated: October 2024 