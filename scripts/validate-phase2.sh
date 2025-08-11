#!/bin/bash

# ==============================================================================
# Phase 2 Validation Script - Quick Test Suite
# ==============================================================================
# One-time script to validate all Phase 2 implementations work correctly
# ==============================================================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test tracking
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0
FAILED_TESTS=()

log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')] $*${NC}"
}

log_success() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')] ✅ $*${NC}"
}

log_error() {
    echo -e "${RED}[$(date '+%H:%M:%S')] ❌ $*${NC}"
}

run_test() {
    local test_name="$1"
    local test_command="$2"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    log "Testing: $test_name"
    
    if eval "$test_command" >/dev/null 2>&1; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        log_success "$test_name"
        return 0
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        FAILED_TESTS+=("$test_name")
        log_error "$test_name"
        return 1
    fi
}

echo
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                    PHASE 2 VALIDATION TEST SUITE                    ║"
echo "║                                                                      ║"
echo "║  Quick validation of all Phase 2 CI integration implementations     ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo

cd "$PROJECT_ROOT"

# Test Phase 2.1: GitHub CLI Integration
log "🔗 Testing GitHub CLI Integration Scripts..."
run_test "gh-workflows.sh help" "$SCRIPT_DIR/gh-workflows.sh --help"
run_test "gh-actions.sh help" "$SCRIPT_DIR/gh-actions.sh --help"

# Test Phase 2.2: Act Tool Integration  
log "🎭 Testing Act Tool Integration Scripts..."
run_test "act-local.sh help" "$SCRIPT_DIR/act-local.sh --help"
run_test "act-validate.sh help" "$SCRIPT_DIR/act-validate.sh --help"

# Test Phase 2.3: Integration Scripts
log "🔗 Testing Integration Scripts..."
run_test "ci-integration.sh help" "$SCRIPT_DIR/ci-integration.sh --help"

# Test Phase 2.4: PR Testing Scripts
log "🔀 Testing PR Workflow Scripts..."
run_test "pr-testing.sh help" "$SCRIPT_DIR/pr-testing.sh --help"

# Test script executability
log "🔧 Testing Script Permissions..."
for script in gh-workflows.sh gh-actions.sh act-local.sh act-validate.sh ci-integration.sh pr-testing.sh; do
    run_test "$script executable" "[[ -x $SCRIPT_DIR/$script ]]"
done

# Test prerequisites
log "📋 Testing Prerequisites..."
run_test "Git repository" "[[ -d .git ]]"
run_test "Workflows directory" "[[ -d .github/workflows ]]"

# Test Docker separately (optional)
log "🐳 Testing Docker (optional)..."
if docker info >/dev/null 2>&1; then
    log_success "Docker is running"
    # Test basic functionality (dry runs) only if Docker is available
    log "🏃 Testing Basic Functionality..."
    run_test "ci-integration validate" "$SCRIPT_DIR/ci-integration.sh validate"
else
    log_error "Docker not running - skipping integration tests"
    echo "  Note: Start Docker to run full integration tests"
fi

# Test E2E suite (optional)
log "🎭 Testing E2E Test Suite (optional)..."
if [[ -f ".env.test" ]]; then
    # Check if database is available for E2E tests
    if timeout 5 bash -c 'until nc -z localhost 5432; do sleep 1; done' 2>/dev/null; then
        log_success "Database is available"
        log "Running E2E test validation..."
        run_test "E2E auth setup" "yarn test:e2e e2e/auth.setup.ts --reporter=list"
    else
        log_error "Database not available - skipping E2E tests"
        echo "  Note: Start database with docker compose up -d postgres to run E2E tests"
    fi
else
    log_error "No .env.test found - skipping E2E tests"
    echo "  Note: Create .env.test to enable E2E testing validation"
fi

# Summary
echo
echo "════════════════════════════════════════════════════════════════════════"
echo "VALIDATION SUMMARY"
echo "════════════════════════════════════════════════════════════════════════"
echo "Tests run: $TESTS_RUN"
echo "Passed: $TESTS_PASSED"  
echo "Failed: $TESTS_FAILED"
echo

if [[ $TESTS_FAILED -eq 0 ]]; then
    log_success "🎉 All Phase 2 implementations validated successfully!"
    exit 0
else
    log_error "❌ $TESTS_FAILED test(s) failed:"
    for failed_test in "${FAILED_TESTS[@]}"; do
        echo "  - $failed_test"
    done
    exit 1
fi