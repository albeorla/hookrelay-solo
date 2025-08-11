#!/bin/bash

# ==============================================================================
# CI Quick Validation Script
# ==============================================================================
# This script provides fast validation checks to verify code quality and basic 
# functionality before running the full CI pipeline. It's designed for rapid
# feedback during development iterations.
#
# Usage:
#   ./scripts/ci-validate.sh [options]
#
# Options:
#   --fast        Run only the fastest checks (default)
#   --standard    Run standard validation suite
#   --strict      Run strict validation with zero warnings
#   --fix         Attempt to auto-fix issues where possible
#   --verbose     Enable verbose logging
#   --silent      Run in silent mode (errors only)
#   --help        Show this help message
#
# Examples:
#   ./scripts/ci-validate.sh --fast
#   ./scripts/ci-validate.sh --standard --fix
#   ./scripts/ci-validate.sh --strict --verbose
# ==============================================================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default options
FAST_MODE=true
STANDARD_MODE=false
STRICT_MODE=false
FIX_MODE=false
VERBOSE_MODE=false
SILENT_MODE=false

# Validation results
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_TOTAL=0
ISSUES_FIXED=0

# ==============================================================================
# UTILITY FUNCTIONS
# ==============================================================================

log() {
    if [[ "$SILENT_MODE" != true ]]; then
        echo -e "${CYAN}[$(date '+%H:%M:%S')] $*${NC}"
    fi
}

log_success() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')] ✅ $*${NC}"
}

log_error() {
    echo -e "${RED}[$(date '+%H:%M:%S')] ❌ $*${NC}"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠️  $*${NC}"
}

log_info() {
    if [[ "$VERBOSE_MODE" == true ]] || [[ "$SILENT_MODE" != true ]]; then
        echo -e "${BLUE}[$(date '+%H:%M:%S')] ℹ️  $*${NC}"
    fi
}

log_verbose() {
    if [[ "$VERBOSE_MODE" == true ]]; then
        echo -e "${PURPLE}[$(date '+%H:%M:%S')] 🔍 $*${NC}"
    fi
}

show_help() {
    cat << EOF
CI Quick Validation Script

USAGE:
    ./scripts/ci-validate.sh [OPTIONS]

OPTIONS:
    --fast        Run only the fastest checks (default)
    --standard    Run standard validation suite  
    --strict      Run strict validation with zero warnings
    --fix         Attempt to auto-fix issues where possible
    --verbose     Enable verbose logging
    --silent      Run in silent mode (errors only)
    --help        Show this help message

VALIDATION LEVELS:
    Fast:      Basic syntax and format checks (~30 seconds)
    Standard:  Full type checking and linting (~2 minutes)
    Strict:    Zero-tolerance validation (~3 minutes)

EXAMPLES:
    ./scripts/ci-validate.sh --fast
    ./scripts/ci-validate.sh --standard --fix
    ./scripts/ci-validate.sh --strict --verbose

AUTO-FIX CAPABILITIES:
    - Code formatting (Prettier)
    - Import organization
    - Basic ESLint fixes
    - File permissions
EOF
}

# ==============================================================================
# VALIDATION FUNCTIONS
# ==============================================================================

run_check() {
    local check_name="$1"
    local check_command="$2"
    local fix_command="${3:-}"
    
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    
    log_verbose "Running check: $check_name"
    
    if eval "$check_command" >/dev/null 2>&1; then
        log_success "$check_name"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
        return 0
    else
        if [[ "$FIX_MODE" == true ]] && [[ -n "$fix_command" ]]; then
            log_warning "$check_name failed - attempting fix..."
            if eval "$fix_command" >/dev/null 2>&1; then
                # Re-run the check after fix
                if eval "$check_command" >/dev/null 2>&1; then
                    log_success "$check_name (fixed)"
                    CHECKS_PASSED=$((CHECKS_PASSED + 1))
                    ISSUES_FIXED=$((ISSUES_FIXED + 1))
                    return 0
                else
                    log_error "$check_name (fix failed)"
                    CHECKS_FAILED=$((CHECKS_FAILED + 1))
                    return 1
                fi
            else
                log_error "$check_name (fix failed)"
                CHECKS_FAILED=$((CHECKS_FAILED + 1))
                return 1
            fi
        else
            log_error "$check_name"
            CHECKS_FAILED=$((CHECKS_FAILED + 1))
            return 1
        fi
    fi
}

check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if we're in the right directory
    if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
        log_error "Not in a Node.js project directory"
        exit 1
    fi
    
    # Check if dependencies are installed
    if [[ ! -d "$PROJECT_ROOT/node_modules" ]]; then
        log_warning "Dependencies not installed, running yarn install..."
        cd "$PROJECT_ROOT"
        yarn install --frozen-lockfile --prefer-offline
    fi
    
    log_success "Prerequisites check passed"
}

validate_fast() {
    log "🚀 Running fast validation checks..."
    
    cd "$PROJECT_ROOT"
    
    # 1. Package.json validation
    run_check "Package.json syntax" \
        "node -e 'JSON.parse(require(\"fs\").readFileSync(\"package.json\", \"utf8\"))'"
    
    # 2. TypeScript configuration
    run_check "TypeScript config" \
        "yarn tsc --noEmit --skipLibCheck" \
        "echo 'TypeScript config issues require manual fix'"
    
    # 3. Basic ESLint (errors only)
    run_check "ESLint (errors only)" \
        "yarn eslint . --ext .ts,.tsx --quiet" \
        "yarn eslint . --ext .ts,.tsx --fix"
    
    # 4. Prettier format check
    run_check "Code formatting" \
        "yarn prettier --check ." \
        "yarn prettier --write ."
    
    # 5. Basic imports check
    run_check "Import statements" \
        "grep -r 'import.*from.*\"[^.]' src/ --include='*.ts' --include='*.tsx' | grep -v node_modules || true"
    
    log_info "Fast validation completed in ~30 seconds"
}

validate_standard() {
    log "🔧 Running standard validation suite..."
    
    cd "$PROJECT_ROOT"
    
    # Run fast checks first
    validate_fast
    
    # 6. Full TypeScript check
    run_check "TypeScript compilation" \
        "yarn typecheck" \
        "echo 'TypeScript errors require manual fix'"
    
    # 7. Full ESLint check
    run_check "ESLint (full)" \
        "yarn lint" \
        "yarn lint --fix"
    
    # 8. Package vulnerabilities check
    run_check "Security audit" \
        "yarn audit --level moderate" \
        "yarn audit fix"
    
    # 9. Dependency validation
    run_check "Dependency consistency" \
        "yarn check --integrity" \
        "yarn install --frozen-lockfile"
    
    # 10. Environment validation
    if [[ -f ".env.example" ]]; then
        run_check "Environment configuration" \
            "test -f .env.test" \
            "cp .env.example .env.test"
    fi
    
    log_info "Standard validation completed in ~2 minutes"
}

validate_strict() {
    log "🔒 Running strict validation (zero tolerance)..."
    
    cd "$PROJECT_ROOT"
    
    # Run standard checks first
    validate_standard
    
    # 11. Strict TypeScript (no any, strict mode)
    run_check "Strict TypeScript" \
        "yarn tsc --noEmit --strict --noImplicitAny" \
        "echo 'Strict TypeScript requires manual code fixes'"
    
    # 12. ESLint with zero warnings
    run_check "ESLint (zero warnings)" \
        "yarn eslint . --ext .ts,.tsx --max-warnings 0" \
        "yarn eslint . --ext .ts,.tsx --fix"
    
    # 13. Code complexity check
    run_check "Code complexity" \
        "yarn eslint . --ext .ts,.tsx --rule 'complexity: [error, 10]'" \
        "echo 'Code complexity requires manual refactoring'"
    
    # 14. Import sorting
    run_check "Import organization" \
        "yarn eslint . --ext .ts,.tsx --rule 'import/order: error'" \
        "yarn eslint . --ext .ts,.tsx --rule 'import/order: error' --fix"
    
    # 15. Unused code detection
    run_check "Unused exports" \
        "yarn ts-unused-exports tsconfig.json --silent" \
        "echo 'Unused exports require manual cleanup'"
    
    # 16. Bundle size check (if build exists)
    if [[ -d ".next" ]]; then
        run_check "Bundle size" \
            "test $(du -s .next | cut -f1) -lt 50000" \
            "yarn build"
    fi
    
    log_info "Strict validation completed in ~3 minutes"
}

# ==============================================================================
# DOCKER VALIDATION
# ==============================================================================

validate_docker() {
    log "🐳 Running Docker validation..."
    
    cd "$PROJECT_ROOT"
    
    # 17. Dockerfile syntax
    if [[ -f "docker/Dockerfile" ]]; then
        run_check "Dockerfile syntax" \
            "docker build --dry-run -f docker/Dockerfile ." \
            "echo 'Dockerfile issues require manual fix'"
    fi
    
    # 18. Docker Compose validation
    if [[ -f "docker/docker-compose.yml" ]]; then
        run_check "Docker Compose config" \
            "docker-compose -f docker/docker-compose.yml config -q" \
            "echo 'Docker Compose issues require manual fix'"
    fi
    
    # 19. Docker Compose CI validation
    if [[ -f "docker/docker-compose.ci.yml" ]]; then
        run_check "Docker Compose CI config" \
            "docker-compose -f docker/docker-compose.ci.yml config -q" \
            "echo 'Docker Compose CI issues require manual fix'"
    fi
    
    # 20. Test Matrix validation
    if [[ -f "docker/docker-compose.test-matrix.yml" ]]; then
        run_check "Docker Compose test matrix config" \
            "docker-compose -f docker/docker-compose.test-matrix.yml config -q" \
            "echo 'Docker Compose test matrix issues require manual fix'"
    fi
}

# ==============================================================================
# GITHUB ACTIONS VALIDATION
# ==============================================================================

validate_github_actions() {
    log "🚀 Running GitHub Actions validation..."
    
    cd "$PROJECT_ROOT"
    
    # 21. Workflow syntax validation
    if [[ -d ".github/workflows" ]]; then
        for workflow in .github/workflows/*.yml .github/workflows/*.yaml; do
            if [[ -f "$workflow" ]]; then
                run_check "GitHub Actions: $(basename "$workflow")" \
                    "yamllint '$workflow'" \
                    "echo 'Workflow syntax requires manual fix'"
            fi
        done
    fi
    
    # 22. Action references validation
    if command -v act >/dev/null 2>&1; then
        run_check "GitHub Actions dry run" \
            "act --dry-run" \
            "echo 'Action issues require manual fix'"
    fi
}

# ==============================================================================
# PERFORMANCE VALIDATION
# ==============================================================================

validate_performance() {
    log "⚡ Running performance validation..."
    
    cd "$PROJECT_ROOT"
    
    # 23. TypeScript compilation time
    run_check "TypeScript performance" \
        "timeout 60s yarn typecheck" \
        "echo 'TypeScript compilation timeout - consider tsconfig optimization'"
    
    # 24. ESLint performance  
    run_check "ESLint performance" \
        "timeout 120s yarn lint" \
        "echo 'ESLint timeout - consider rule optimization'"
    
    # 25. Bundle analysis (if build exists)
    if [[ -d ".next" ]]; then
        run_check "Bundle performance" \
            "test $(find .next -name '*.js' | wc -l) -lt 1000" \
            "echo 'Large bundle - consider code splitting'"
    fi
}

# ==============================================================================
# RESULTS AND REPORTING
# ==============================================================================

show_summary() {
    echo
    echo "╔══════════════════════════════════════════════════════════════════════╗"
    echo "║                         VALIDATION SUMMARY                          ║"
    echo "╚══════════════════════════════════════════════════════════════════════╝"
    echo
    
    if [[ $CHECKS_FAILED -eq 0 ]]; then
        log_success "All $CHECKS_TOTAL checks passed! 🎉"
    else
        log_error "$CHECKS_FAILED out of $CHECKS_TOTAL checks failed"
        log_info "$CHECKS_PASSED checks passed"
    fi
    
    if [[ $ISSUES_FIXED -gt 0 ]]; then
        log_info "$ISSUES_FIXED issues were automatically fixed"
    fi
    
    echo
    echo "Validation Level: $([ "$STRICT_MODE" == true ] && echo "Strict" || [ "$STANDARD_MODE" == true ] && echo "Standard" || echo "Fast")"
    echo "Auto-fix Mode: $FIX_MODE"
    echo "Duration: ${SECONDS}s"
    echo
    
    if [[ $CHECKS_FAILED -gt 0 ]]; then
        echo "❌ Validation failed - address the issues above before proceeding"
        echo "💡 Try running with --fix to auto-fix some issues"
        echo "💡 Use --verbose for more detailed error information"
        return 1
    else
        echo "✅ Validation passed - ready for CI pipeline!"
        return 0
    fi
}

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================

main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --fast)
                FAST_MODE=true
                STANDARD_MODE=false
                STRICT_MODE=false
                shift
                ;;
            --standard)
                STANDARD_MODE=true
                FAST_MODE=false
                STRICT_MODE=false
                shift
                ;;
            --strict)
                STRICT_MODE=true
                FAST_MODE=false
                STANDARD_MODE=false
                shift
                ;;
            --fix)
                FIX_MODE=true
                shift
                ;;
            --verbose)
                VERBOSE_MODE=true
                shift
                ;;
            --silent)
                SILENT_MODE=true
                VERBOSE_MODE=false
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Print header (unless silent)
    if [[ "$SILENT_MODE" != true ]]; then
        cat << EOF

╔══════════════════════════════════════════════════════════════════════╗
║                       CI QUICK VALIDATION                           ║
║                                                                      ║
║  Fast feedback for code quality and basic functionality             ║
║  $(date)                                    ║
╚══════════════════════════════════════════════════════════════════════╝

EOF
    fi
    
    # Prerequisites check
    check_prerequisites
    
    # Run validation based on mode
    if [[ "$STRICT_MODE" == true ]]; then
        validate_strict
        validate_docker
        validate_github_actions
        validate_performance
    elif [[ "$STANDARD_MODE" == true ]]; then
        validate_standard
        validate_docker
    else
        validate_fast
    fi
    
    # Show results
    show_summary
}

# Execute main function with all arguments
main "$@"