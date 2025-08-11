# GitHub Branch Protection Setup

## 🛡️ Required Branch Protection Rules

To ensure code quality and prevent breaking changes, configure the following branch protection rules in your GitHub repository settings:

### Main Branch Protection

Navigate to: **Settings** → **Branches** → **Add rule** for `main`

#### ✅ Required Settings:

1. **Require pull request reviews before merging**
   - ✅ Required approving reviews: **1** (minimum)
   - ✅ Dismiss stale reviews when new commits are pushed
   - ✅ Require review from code owners (if CODEOWNERS file exists)

2. **Require status checks to pass before merging**
   - ✅ Require branches to be up to date before merging
   - **Required status checks:**
     - `quality` (Code Quality & Security)
     - `test` (Unit & Integration Tests)
     - `e2e` (E2E Tests with Coverage)
     - `security` (Security Audit)
     - `quality-gate` (Quality Gate)

3. **Require conversation resolution before merging**
   - ✅ All conversations must be resolved

4. **Additional protections:**
   - ✅ Require linear history (optional, for clean git history)
   - ✅ Include administrators (apply rules to admins too)
   - ✅ Allow force pushes (❌ disable this)
   - ✅ Allow deletions (❌ disable this)

### Development Branch Protection (Optional)

For `develop` branch, you can use similar rules but potentially less strict:

- Require pull request reviews: **1**
- Required status checks: Same as main
- Allow squash merging

## 🚀 Quick Setup Commands

If you prefer using GitHub CLI:

```bash
# Install GitHub CLI if not already installed
# macOS: brew install gh
# Other: https://cli.github.com/

# Login to GitHub
gh auth login

# Set up main branch protection
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["quality","test","e2e","security","quality-gate"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false
```

## 📊 Status Check Configuration

The CI pipeline provides these status checks:

| Status Check | Purpose | Required |
|-------------|---------|----------|
| `quality` | TypeScript, Linting, Formatting | ✅ Yes |
| `test` | Unit & Integration Tests | ✅ Yes |
| `e2e` | End-to-End Tests with Coverage | ✅ Yes |
| `security` | Dependency & Security Audit | ✅ Yes |
| `quality-gate` | Overall Quality Gate | ✅ Yes |

## 🔧 Environment Setup

Ensure these secrets are configured in your repository:

### Required Secrets:
- `NEXTAUTH_SECRET` - NextAuth.js secret key
- `CODECOV_TOKEN` - Codecov upload token (optional, for coverage)

### Optional Secrets:
- `DISCORD_CLIENT_ID` - Discord OAuth client ID
- `DISCORD_CLIENT_SECRET` - Discord OAuth client secret

### How to add secrets:
1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add each required secret

## 🎯 Quality Gate Rules

The pipeline will **fail** if any of these conditions are met:

- ❌ TypeScript compilation errors
- ❌ Linting errors (not warnings)
- ❌ Formatting issues
- ❌ E2E test failures (more than max-failures threshold)
- ❌ High-severity security vulnerabilities
- ❌ Build failures

## 📈 Coverage Reporting

Coverage is automatically:
- ✅ Collected during E2E test runs
- ✅ Uploaded to Codecov (if token provided)
- ✅ Available as artifacts in GitHub Actions
- ✅ Commented on pull requests

## 🚨 Emergency Procedures

In case of urgent hotfixes:

1. **Temporary bypass** (use sparingly):
   - Repository admins can temporarily disable branch protection
   - Create hotfix branch → immediate review → merge
   - Re-enable protection immediately

2. **CI failure override**:
   - If CI fails due to infrastructure issues
   - Verify all tests pass locally
   - Admin can override with manual approval

## 🔍 Monitoring & Maintenance

Weekly/Monthly tasks:
- Review failed CI runs and improve test stability
- Update dependencies and security patches
- Monitor coverage trends
- Review and update protection rules as needed 