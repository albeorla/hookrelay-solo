# CI Testing Scripts

This directory contains comprehensive scripts for testing and optimizing the CI pipeline locally.

## Scripts Overview

### **Phase 1 - Local CI Testing Infrastructure**

### 🚀 ci-local.sh - Full Pipeline Simulation
Simulates the complete GitHub Actions CI pipeline locally using Docker Compose configurations.

```bash
./scripts/ci-local.sh --full --clean    # Full pipeline with cleanup
./scripts/ci-local.sh --quick           # Quick validation only
./scripts/ci-local.sh --matrix          # Test matrix scenarios
./scripts/ci-local.sh --parallel        # Parallel execution
```

**Features:**
- Complete CI environment mirror
- Multiple execution modes (full, quick, matrix, parallel)
- Comprehensive logging and reporting
- Clean environment setup

### 🔍 ci-validate.sh - Quick Validation
Provides fast validation checks for code quality and basic functionality.

```bash
./scripts/ci-validate.sh --fast                # Basic checks (~30s)
./scripts/ci-validate.sh --standard --fix      # Full validation with auto-fix
./scripts/ci-validate.sh --strict --verbose    # Zero-tolerance validation
```

**Features:**
- Three validation levels (fast, standard, strict)
- Auto-fix capabilities for common issues
- Performance-optimized for rapid feedback
- Detailed error reporting

### 📊 ci-performance.sh - Benchmark Analysis
Measures and analyzes CI pipeline performance characteristics.

```bash
./scripts/ci-performance.sh --baseline         # Create performance baseline
./scripts/ci-performance.sh --compare          # Compare against baseline
./scripts/ci-performance.sh --profile --export # Detailed profiling with export
```

**Features:**
- Performance benchmarking across all CI components
- Baseline creation and comparison
- Detailed profiling and analysis
- CSV/JSON export capabilities
- Performance regression detection

### 🧹 ci-cleanup.sh - Environment Reset
Comprehensive cleanup and reset functionality for the CI testing environment.

```bash
./scripts/ci-cleanup.sh --all --force          # Complete cleanup
./scripts/ci-cleanup.sh --cache --logs         # Clean caches and logs only
./scripts/ci-cleanup.sh --dry-run --verbose    # Preview cleanup actions
```

**Features:**
- Selective cleanup categories (containers, volumes, images, cache, logs)
- Dry-run mode for safe preview
- Soft cleanup mode to preserve important data
- Confirmation prompts and safety features

### **Phase 2 - GitHub CLI Integration & Act Tool Setup**

### 🔗 gh-workflows.sh - GitHub Workflow Management
Comprehensive management of GitHub Actions workflows through the GitHub CLI.

```bash
./scripts/gh-workflows.sh list --verbose          # List all workflows with details
./scripts/gh-workflows.sh status --workflow=ci.yml # Show workflow run status
./scripts/gh-workflows.sh trigger --workflow=ci.yml # Trigger workflow manually
./scripts/gh-workflows.sh watch --verbose         # Watch workflows in real-time
./scripts/gh-workflows.sh analyze --workflow=ci.yml # Analyze workflow performance
```

**Features:**
- Real-time workflow monitoring and management
- Performance analysis and metrics
- Workflow triggering and cancellation
- Comprehensive reporting and analytics
- Integration with GitHub Actions API

### 🎯 gh-actions.sh - GitHub Actions Integration
Provides comprehensive GitHub Actions integration for CI testing and automation.

```bash
./scripts/gh-actions.sh pr create --branch=feature/new-feature # Create PR with automation
./scripts/gh-actions.sh pr status --pr-number=123              # Check PR CI status
./scripts/gh-actions.sh status --branch=main                  # Check CI health
./scripts/gh-actions.sh deploy --environment=staging          # Deployment management
./scripts/gh-actions.sh metrics --json                        # Repository analytics
```

**Features:**
- Automated PR creation and management
- CI status monitoring and reporting
- Deployment pipeline automation
- Repository metrics and analytics
- Integration with GitHub REST API

### 🎭 act-local.sh - Local GitHub Actions Execution
Run and test GitHub Actions workflows locally using the act tool.

```bash
./scripts/act-local.sh run --workflow=ci.yml --verbose        # Run workflow locally
./scripts/act-local.sh dry-run --event=pull_request          # Dry run simulation
./scripts/act-local.sh validate --workflow=ci.yml            # Validate workflow
./scripts/act-local.sh secrets                               # Manage local secrets
./scripts/act-local.sh debug --workflow=ci.yml --job=e2e     # Debug workflow execution
```

**Features:**
- Local GitHub Actions workflow execution
- Multiple event type simulation (push, pull_request, etc.)
- Secrets management for local testing
- Comprehensive debugging and logging
- Docker container optimization

### 🔍 act-validate.sh - Workflow Validation
Comprehensive validation of GitHub Actions workflows with security and performance analysis.

```bash
./scripts/act-validate.sh --workflow=ci.yml --fix            # Validate and auto-fix
./scripts/act-validate.sh --strict --security --verbose     # Strict security validation
./scripts/act-validate.sh --performance --json              # Performance analysis
```

**Features:**
- Multi-level validation (syntax, security, performance)
- Auto-fix capabilities for common issues
- Security vulnerability detection
- Performance optimization suggestions
- Integration with act tool for validation

### 🔗 ci-integration.sh - Comprehensive Integration Testing
Integration between Docker Compose, GitHub CLI, and act tool for complete CI testing.

```bash
./scripts/ci-integration.sh full-test --workflow=ci.yml     # Complete integration test
./scripts/ci-integration.sh compare --branch=feature/test  # Compare local vs remote
./scripts/ci-integration.sh validate --verbose             # Validate all integrations
./scripts/ci-integration.sh monitor --json                 # Monitor CI health
```

**Features:**
- Cross-platform CI testing (Docker + act + GitHub)
- Local vs remote CI comparison
- Integration health monitoring
- Performance benchmarking
- Comprehensive reporting

### 🔀 pr-testing.sh - Pull Request Testing Workflows
Comprehensive testing workflows specifically designed for Pull Request scenarios.

```bash
./scripts/pr-testing.sh create --head=feature/new --title="Add feature"  # Create PR with testing
./scripts/pr-testing.sh validate --pr-number=123 --verbose              # Validate existing PR
./scripts/pr-testing.sh pre-merge --pr-number=123                       # Pre-merge validation
./scripts/pr-testing.sh monitor --pr-number=123                         # Monitor PR status
./scripts/pr-testing.sh compare --pr-number=123 --base=main             # Compare with base
```

**Features:**
- Automated PR creation with comprehensive templates
- Multi-phase PR validation (local + remote)
- Pre-merge conflict detection and resolution
- Real-time PR status monitoring
- Performance impact analysis
- Security and quality gate validation

## Docker Configurations

### docker-compose.yml - Enhanced Local Testing
- Enhanced E2E service with parallel testing support
- Multiple testing services (quality-check, unit-tests, quick-test)
- Node.js version matrix testing (Node 18, 20)
- Performance monitoring capabilities

### docker-compose.ci.yml - CI Environment Mirror
- Exact replica of GitHub Actions environment
- All CI jobs as separate services (quality, unit-tests, e2e-tests, security, build)
- Proper service dependencies and health checks
- Optimized for CI accuracy

### docker-compose.test-matrix.yml - Comprehensive Matrix Testing
- Node.js version compatibility (18, 20)
- Environment matrix (dev, test, prod)
- Database version testing (PostgreSQL 14, 15, 16)
- Feature flag scenarios (strict mode, performance mode)
- Results aggregation service

## Usage Workflows

### Development Workflow
```bash
# Quick validation during development
./scripts/ci-validate.sh --fast --fix

# Clean environment for fresh testing
./scripts/ci-cleanup.sh --cache --logs --force

# Run specific tests
docker compose up --build quality-check
```

### Pre-Commit Workflow
```bash
# Standard validation before commit
./scripts/ci-validate.sh --standard --verbose

# Performance check
./scripts/ci-performance.sh --quick

# Full pipeline simulation
./scripts/ci-local.sh --full
```

### Release Workflow
```bash
# Create performance baseline
./scripts/ci-performance.sh --baseline

# Run comprehensive matrix tests
./scripts/ci-local.sh --matrix

# Full cleanup after testing
./scripts/ci-cleanup.sh --all --force
```

## Output and Logging

### Log Directories
- `ci-logs/` - Script execution logs
- `ci-results/` - Test results and reports
- `ci-performance/` - Performance benchmarks and baselines

### Report Generation
All scripts generate detailed reports:
- Execution summaries
- Performance metrics
- Error analysis
- Recommendations for optimization

## Integration with Existing Workflow

These scripts complement the existing workflow:
- Use before committing changes
- Integrate with git hooks
- Run in CI for validation
- Performance monitoring in production

## Prerequisites

- Docker and Docker Compose
- Node.js and Yarn
- Git repository
- Appropriate environment files (.env.test)

## Troubleshooting

### Common Issues
1. **Docker not running**: Start Docker Desktop
2. **Dependencies missing**: Run `yarn install`
3. **Permission errors**: Ensure scripts are executable (`chmod +x scripts/*.sh`)
4. **Port conflicts**: Check for existing services on ports 3000, 3001, 5432

### Getting Help
```bash
./scripts/ci-local.sh --help
./scripts/ci-validate.sh --help
./scripts/ci-performance.sh --help
./scripts/ci-cleanup.sh --help
```

## Contributing

When adding new scripts or modifying existing ones:
1. Follow the established patterns for logging and error handling
2. Include comprehensive help documentation
3. Add dry-run capabilities where appropriate
4. Ensure proper cleanup and resource management
5. Update this README with new functionality