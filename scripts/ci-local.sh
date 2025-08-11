#!/bin/bash

# ==============================================================================
# CI Local Pipeline Simulation Script
# ==============================================================================
# This script simulates the complete GitHub Actions CI pipeline locally
# using Docker Compose configurations that mirror the actual CI environment.
#
# Usage:
#   ./scripts/ci-local.sh [options]
#
# Options:
#   --full        Run complete CI pipeline (default)
#   --quick       Run quick validation only
#   --matrix      Run test matrix scenarios
#   --parallel    Run tests in parallel
#   --clean       Clean up before running
#   --verbose     Enable verbose logging
#   --help        Show this help message
#
# Examples:
#   ./scripts/ci-local.sh --full --clean
#   ./scripts/ci-local.sh --quick --verbose
#   ./scripts/ci-local.sh --matrix --parallel
# ==============================================================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
LOG_DIR="$PROJECT_ROOT/ci-logs"
RESULTS_DIR="$PROJECT_ROOT/ci-results"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default options
FULL_PIPELINE=true
QUICK_MODE=false
MATRIX_MODE=false
PARALLEL_MODE=false
CLEAN_MODE=false
VERBOSE_MODE=false
DOCKER_COMPOSE_FILES=()

# ==============================================================================
# UTILITY FUNCTIONS
# ==============================================================================

log() {
    echo -e "${CYAN}[$(date '+%H:%M:%S')] $*${NC}"
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
    echo -e "${BLUE}[$(date '+%H:%M:%S')] ℹ️  $*${NC}"
}

log_step() {
    echo -e "${PURPLE}[$(date '+%H:%M:%S')] 🚀 $*${NC}"
}

show_help() {
    cat << EOF
CI Local Pipeline Simulation Script

USAGE:
    ./scripts/ci-local.sh [OPTIONS]

OPTIONS:
    --full        Run complete CI pipeline (default)
    --quick       Run quick validation only  
    --matrix      Run test matrix scenarios
    --parallel    Run tests in parallel
    --clean       Clean up before running
    --verbose     Enable verbose logging
    --help        Show this help message

EXAMPLES:
    ./scripts/ci-local.sh --full --clean
    ./scripts/ci-local.sh --quick --verbose
    ./scripts/ci-local.sh --matrix --parallel

DOCKER COMPOSE CONFIGURATIONS:
    docker-compose.yml           - Enhanced local testing with parallel services
    docker-compose.ci.yml        - CI environment mirror (matches GitHub Actions)
    docker-compose.test-matrix.yml - Comprehensive test matrix scenarios

LOG FILES:
    All logs are saved to: $LOG_DIR/ci-local-$TIMESTAMP.log
    Results are saved to: $RESULTS_DIR/
EOF
}

# ==============================================================================
# SETUP FUNCTIONS
# ==============================================================================

setup_directories() {
    log_step "Setting up directories..."
    
    mkdir -p "$LOG_DIR"
    mkdir -p "$RESULTS_DIR"
    mkdir -p "$PROJECT_ROOT/test-results"
    mkdir -p "$PROJECT_ROOT/playwright-report"
    mkdir -p "$PROJECT_ROOT/coverage"
    
    log_success "Directories created"
}

check_prerequisites() {
    log_step "Checking prerequisites..."
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker Desktop."
        exit 1
    fi
    
    # Check if Docker Compose is available
    if ! command -v docker-compose >/dev/null 2>&1; then
        log_error "Docker Compose is not installed."
        exit 1
    fi
    
    # Check if required files exist
    local required_files=(
        "$PROJECT_ROOT/docker-compose.yml"
        "$PROJECT_ROOT/docker-compose.ci.yml"
        "$PROJECT_ROOT/docker-compose.test-matrix.yml"
        "$PROJECT_ROOT/Dockerfile"
        "$PROJECT_ROOT/.env.test"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            log_error "Required file not found: $file"
            exit 1
        fi
    done
    
    log_success "Prerequisites check passed"
}

cleanup_previous_runs() {
    if [[ "$CLEAN_MODE" == true ]]; then
        log_step "Cleaning up previous runs..."
        
        # Stop and remove containers
        docker-compose -f "$PROJECT_ROOT/docker-compose.yml" down --remove-orphans --volumes 2>/dev/null || true
        docker-compose -f "$PROJECT_ROOT/docker-compose.ci.yml" down --remove-orphans --volumes 2>/dev/null || true
        docker-compose -f "$PROJECT_ROOT/docker-compose.test-matrix.yml" down --remove-orphans --volumes 2>/dev/null || true
        
        # Clean up volumes
        docker volume prune -f 2>/dev/null || true
        
        # Clean up networks
        docker network prune -f 2>/dev/null || true
        
        # Clean up previous results
        rm -rf "$PROJECT_ROOT/test-results"/*
        rm -rf "$PROJECT_ROOT/playwright-report"/*
        rm -rf "$PROJECT_ROOT/coverage"/*
        
        log_success "Cleanup completed"
    fi
}

# ==============================================================================
# PIPELINE EXECUTION FUNCTIONS
# ==============================================================================

run_quick_validation() {
    log_step "Running quick validation pipeline..."
    
    local compose_file="$PROJECT_ROOT/docker-compose.yml"
    local log_file="$LOG_DIR/quick-validation-$TIMESTAMP.log"
    
    {
        echo "======================================="
        echo "Quick Validation Pipeline"
        echo "Started: $(date)"
        echo "======================================="
        
        # Run quality checks in parallel
        log_info "Starting parallel quality checks..."
        docker-compose -f "$compose_file" up --build --exit-code-from quick-test quick-test
        
        echo "======================================="
        echo "Quick Validation Completed: $(date)"
        echo "======================================="
        
    } 2>&1 | tee "$log_file"
    
    if [[ ${PIPESTATUS[0]} -eq 0 ]]; then
        log_success "Quick validation pipeline completed successfully"
        return 0
    else
        log_error "Quick validation pipeline failed"
        return 1
    fi
}

run_full_pipeline() {
    log_step "Running full CI pipeline simulation..."
    
    local compose_file="$PROJECT_ROOT/docker-compose.ci.yml"
    local log_file="$LOG_DIR/full-pipeline-$TIMESTAMP.log"
    
    {
        echo "======================================="
        echo "Full CI Pipeline Simulation"
        echo "Started: $(date)"
        echo "======================================="
        
        # Step 1: Code Quality & Security
        log_info "Step 1: Running code quality checks..."
        docker-compose -f "$compose_file" up --build --exit-code-from quality-check quality-check postgres
        
        # Step 2: Unit & Integration Tests
        log_info "Step 2: Running unit and integration tests..."
        docker-compose -f "$compose_file" up --build --exit-code-from unit-tests unit-tests postgres
        
        # Step 3: E2E Tests
        log_info "Step 3: Running E2E tests..."
        docker-compose -f "$compose_file" up --build --exit-code-from e2e-tests e2e-tests postgres
        
        # Step 4: Security Audit
        log_info "Step 4: Running security audit..."
        docker-compose -f "$compose_file" up --build --exit-code-from security-audit security-audit
        
        # Step 5: Build Check
        log_info "Step 5: Running build check..."
        docker-compose -f "$compose_file" up --build --exit-code-from build-check build-check
        
        # Step 6: Parallel Runner (verification)
        log_info "Step 6: Running parallel verification..."
        docker-compose -f "$compose_file" up --build --exit-code-from parallel-runner parallel-runner
        
        echo "======================================="
        echo "Full Pipeline Completed: $(date)"
        echo "======================================="
        
    } 2>&1 | tee "$log_file"
    
    if [[ ${PIPESTATUS[0]} -eq 0 ]]; then
        log_success "Full CI pipeline completed successfully"
        return 0
    else
        log_error "Full CI pipeline failed"
        return 1
    fi
}

run_matrix_tests() {
    log_step "Running test matrix scenarios..."
    
    local compose_file="$PROJECT_ROOT/docker-compose.test-matrix.yml"
    local log_file="$LOG_DIR/matrix-tests-$TIMESTAMP.log"
    
    {
        echo "======================================="
        echo "Test Matrix Scenarios"
        echo "Started: $(date)"
        echo "======================================="
        
        # Node.js version matrix
        log_info "Testing Node.js version compatibility..."
        docker-compose -f "$compose_file" up --build --exit-code-from matrix-node18-quality matrix-node18-quality postgres-matrix
        docker-compose -f "$compose_file" up --build --exit-code-from matrix-node20-quality matrix-node20-quality postgres-matrix
        
        # Environment matrix
        log_info "Testing environment configurations..."
        docker-compose -f "$compose_file" up --build --exit-code-from matrix-dev-env matrix-dev-env postgres-matrix
        docker-compose -f "$compose_file" up --build --exit-code-from matrix-test-env matrix-test-env postgres-matrix
        docker-compose -f "$compose_file" up --build --exit-code-from matrix-prod-env matrix-prod-env
        
        # Database version matrix
        log_info "Testing database compatibility..."
        docker-compose -f "$compose_file" up --build --exit-code-from matrix-db14-test matrix-db14-test matrix-postgres14
        docker-compose -f "$compose_file" up --build --exit-code-from matrix-db16-test matrix-db16-test matrix-postgres16
        
        # Feature flag matrix
        log_info "Testing feature configurations..."
        docker-compose -f "$compose_file" up --build --exit-code-from matrix-strict-mode matrix-strict-mode
        docker-compose -f "$compose_file" up --build --exit-code-from matrix-performance matrix-performance
        
        # Results aggregation
        log_info "Aggregating matrix results..."
        docker-compose -f "$compose_file" up --build --exit-code-from matrix-aggregator matrix-aggregator
        
        echo "======================================="
        echo "Matrix Tests Completed: $(date)"
        echo "======================================="
        
    } 2>&1 | tee "$log_file"
    
    if [[ ${PIPESTATUS[0]} -eq 0 ]]; then
        log_success "Matrix tests completed successfully"
        return 0
    else
        log_error "Matrix tests failed"
        return 1
    fi
}

run_parallel_pipeline() {
    log_step "Running parallel pipeline..."
    
    local compose_file="$PROJECT_ROOT/docker-compose.yml"
    local log_file="$LOG_DIR/parallel-pipeline-$TIMESTAMP.log"
    
    {
        echo "======================================="
        echo "Parallel Pipeline Execution"
        echo "Started: $(date)"
        echo "======================================="
        
        # Start database first
        log_info "Starting database..."
        docker-compose -f "$compose_file" up -d db
        
        # Wait for database to be ready
        log_info "Waiting for database to be ready..."
        docker-compose -f "$compose_file" exec -T db pg_isready -U postgres -d test_db
        
        # Run services in parallel
        log_info "Starting parallel services..."
        docker-compose -f "$compose_file" up --build --exit-code-from perf-monitor \
            quality-check unit-tests quick-test build-test perf-monitor
        
        echo "======================================="
        echo "Parallel Pipeline Completed: $(date)"
        echo "======================================="
        
    } 2>&1 | tee "$log_file"
    
    if [[ ${PIPESTATUS[0]} -eq 0 ]]; then
        log_success "Parallel pipeline completed successfully"
        return 0
    else
        log_error "Parallel pipeline failed"
        return 1
    fi
}

# ==============================================================================
# RESULTS AND REPORTING
# ==============================================================================

generate_report() {
    log_step "Generating CI results report..."
    
    local report_file="$RESULTS_DIR/ci-report-$TIMESTAMP.md"
    
    cat > "$report_file" << EOF
# CI Local Pipeline Report

**Generated:** $(date)  
**Duration:** $SECONDS seconds

## Pipeline Configuration

- **Mode:** $([ "$QUICK_MODE" == true ] && echo "Quick" || [ "$MATRIX_MODE" == true ] && echo "Matrix" || [ "$PARALLEL_MODE" == true ] && echo "Parallel" || echo "Full")
- **Clean Mode:** $CLEAN_MODE
- **Verbose Mode:** $VERBOSE_MODE

## Results Summary

### Log Files
$(find "$LOG_DIR" -name "*$TIMESTAMP*" -type f | sed 's|^|- |')

### Test Results
$(find "$PROJECT_ROOT/test-results" -name "*.json" -type f 2>/dev/null | wc -l) test result files generated
$(find "$PROJECT_ROOT/playwright-report" -name "*.html" -type f 2>/dev/null | wc -l) HTML reports generated
$(find "$PROJECT_ROOT/coverage" -name "*.json" -type f 2>/dev/null | wc -l) coverage reports generated

### Docker Status
\`\`\`
$(docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}")
\`\`\`

### Volume Usage
\`\`\`  
$(docker volume ls | grep -E "(test_|ci_|matrix_)" | head -10)
\`\`\`

---
*Generated by ci-local.sh*
EOF
    
    log_success "Report generated: $report_file"
}

cleanup_after_run() {
    log_step "Cleaning up after pipeline run..."
    
    # Stop all running containers
    docker-compose -f "$PROJECT_ROOT/docker-compose.yml" down 2>/dev/null || true
    docker-compose -f "$PROJECT_ROOT/docker-compose.ci.yml" down 2>/dev/null || true
    docker-compose -f "$PROJECT_ROOT/docker-compose.test-matrix.yml" down 2>/dev/null || true
    
    log_success "Cleanup completed"
}

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================

main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --full)
                FULL_PIPELINE=true
                QUICK_MODE=false
                MATRIX_MODE=false
                PARALLEL_MODE=false
                shift
                ;;
            --quick)
                QUICK_MODE=true
                FULL_PIPELINE=false
                MATRIX_MODE=false
                PARALLEL_MODE=false
                shift
                ;;
            --matrix)
                MATRIX_MODE=true
                FULL_PIPELINE=false
                QUICK_MODE=false
                PARALLEL_MODE=false
                shift
                ;;
            --parallel)
                PARALLEL_MODE=true
                FULL_PIPELINE=false
                QUICK_MODE=false
                MATRIX_MODE=false
                shift
                ;;
            --clean)
                CLEAN_MODE=true
                shift
                ;;
            --verbose)
                VERBOSE_MODE=true
                set -x
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
    
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Print header
    cat << EOF

╔══════════════════════════════════════════════════════════════════════╗
║                     CI LOCAL PIPELINE SIMULATION                     ║
║                                                                      ║
║  Simulates GitHub Actions CI pipeline using Docker Compose          ║
║  Timestamp: $(date)                                ║
╚══════════════════════════════════════════════════════════════════════╝

EOF
    
    # Setup and prerequisites
    setup_directories
    check_prerequisites
    cleanup_previous_runs
    
    # Execute pipeline based on mode
    local exit_code=0
    
    if [[ "$QUICK_MODE" == true ]]; then
        run_quick_validation || exit_code=$?
    elif [[ "$MATRIX_MODE" == true ]]; then
        run_matrix_tests || exit_code=$?
    elif [[ "$PARALLEL_MODE" == true ]]; then
        run_parallel_pipeline || exit_code=$?
    else
        run_full_pipeline || exit_code=$?
    fi
    
    # Generate report and cleanup
    generate_report
    cleanup_after_run
    
    # Final status
    if [[ $exit_code -eq 0 ]]; then
        log_success "CI Local Pipeline completed successfully! 🎉"
        log_info "Check logs in: $LOG_DIR"
        log_info "Check results in: $RESULTS_DIR"
    else
        log_error "CI Local Pipeline failed! ❌"
        log_info "Check logs for details: $LOG_DIR"
        exit $exit_code
    fi
}

# Execute main function with all arguments
main "$@"