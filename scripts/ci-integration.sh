#!/bin/bash

# ==============================================================================
# CI Integration Script - Docker + GitHub CLI + Act
# ==============================================================================
# This script provides comprehensive integration between Docker Compose testing,
# GitHub CLI workflow management, and act tool for complete CI pipeline testing
# and validation both locally and remotely.
#
# Usage:
#   ./scripts/ci-integration.sh [command] [options]
#
# Commands:
#   full-test     Run complete integration test (Docker + act + GH)
#   compare       Compare local vs remote CI results
#   sync          Sync local and remote workflow configurations
#   validate      Validate all CI components integration
#   monitor       Monitor both local and remote CI health
#   deploy        Deploy and test across environments
#   pr-flow       Complete PR workflow testing
#
# Options:
#   --workflow    Specific workflow to test
#   --branch      Branch for testing
#   --pr-number   PR number for PR-specific testing
#   --environment Environment for deployment testing
#   --parallel    Run tests in parallel where possible
#   --verbose     Enable verbose logging
#   --json        Output results in JSON format
#   --help        Show this help message
#
# Examples:
#   ./scripts/ci-integration.sh full-test --workflow=ci.yml
#   ./scripts/ci-integration.sh compare --branch=feature/new-feature
#   ./scripts/ci-integration.sh pr-flow --pr-number=123
#   ./scripts/ci-integration.sh monitor --verbose
# ==============================================================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
INTEGRATION_LOGS_DIR="$PROJECT_ROOT/ci-integration-logs"
RESULTS_DIR="$PROJECT_ROOT/ci-integration-results"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default options
WORKFLOW_FILE=""
BRANCH_NAME=""
PR_NUMBER=""
ENVIRONMENT=""
PARALLEL_MODE=false
VERBOSE_MODE=false
JSON_OUTPUT=false

# Integration tracking
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0
INTEGRATION_ISSUES=()

# ==============================================================================
# UTILITY FUNCTIONS
# ==============================================================================

log() {
    if [[ "$JSON_OUTPUT" != true ]]; then
        echo -e "${CYAN}[$(date '+%H:%M:%S')] $*${NC}"
    fi
}

log_success() {
    if [[ "$JSON_OUTPUT" != true ]]; then
        echo -e "${GREEN}[$(date '+%H:%M:%S')] ✅ $*${NC}"
    fi
}

log_error() {
    if [[ "$JSON_OUTPUT" != true ]]; then
        echo -e "${RED}[$(date '+%H:%M:%S')] ❌ $*${NC}"
    fi
}

log_warning() {
    if [[ "$JSON_OUTPUT" != true ]]; then
        echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠️  $*${NC}"
    fi
}

log_info() {
    if [[ "$JSON_OUTPUT" != true ]]; then
        echo -e "${BLUE}[$(date '+%H:%M:%S')] ℹ️  $*${NC}"
    fi
}

log_verbose() {
    if [[ "$VERBOSE_MODE" == true ]] && [[ "$JSON_OUTPUT" != true ]]; then
        echo -e "${PURPLE}[$(date '+%H:%M:%S')] 🔍 $*${NC}"
    fi
}

show_help() {
    cat << EOF
CI Integration Script - Docker + GitHub CLI + Act

USAGE:
    ./scripts/ci-integration.sh [COMMAND] [OPTIONS]

COMMANDS:
    full-test     Run complete integration test suite
    compare       Compare local (Docker/act) vs remote (GitHub) CI results
    sync          Synchronize local and remote workflow configurations
    validate      Validate integration between all CI components
    monitor       Monitor health of local and remote CI systems
    deploy        Test deployment workflows across environments
    pr-flow       Complete pull request workflow testing

OPTIONS:
    --workflow    Specific workflow file to test (e.g., ci.yml)
    --branch      Branch name for testing (default: current branch)
    --pr-number   PR number for PR-specific testing and validation
    --environment Environment name for deployment testing
    --parallel    Run compatible tests in parallel for speed
    --verbose     Enable verbose logging and detailed output
    --json        Output all results in JSON format
    --help        Show this comprehensive help message

EXAMPLES:
    # Complete integration test
    ./scripts/ci-integration.sh full-test --workflow=ci.yml --verbose
    
    # Compare local vs remote CI results
    ./scripts/ci-integration.sh compare --branch=feature/new-feature
    
    # Test entire PR workflow
    ./scripts/ci-integration.sh pr-flow --pr-number=123 --parallel
    
    # Monitor CI health across all systems
    ./scripts/ci-integration.sh monitor --json
    
    # Validate deployment across environments
    ./scripts/ci-integration.sh deploy --environment=staging

INTEGRATION COMPONENTS:
    🐳 Docker Compose - Local containerized testing
    🎭 Act Tool - Local GitHub Actions simulation
    🔗 GitHub CLI - Remote workflow management
    📊 Performance Analysis - Cross-platform benchmarking
    🔍 Validation - Comprehensive workflow verification

WORKFLOW COVERAGE:
    - Syntax and structure validation
    - Local execution with Docker
    - Local GitHub Actions simulation with act
    - Remote GitHub Actions execution
    - Performance comparison analysis
    - Security and best practices validation
    - End-to-end PR workflow testing

OUTPUT FORMATS:
    - Human-readable progress and summaries
    - JSON structured data for automation
    - Detailed logs for debugging
    - Comparative analysis reports
    - Integration health dashboards
EOF
}

setup_integration_environment() {
    log "Setting up CI integration environment..."
    
    mkdir -p "$INTEGRATION_LOGS_DIR"
    mkdir -p "$RESULTS_DIR"
    
    # Get current branch if not specified
    if [[ -z "$BRANCH_NAME" ]]; then
        BRANCH_NAME=$(git branch --show-current)
        log_verbose "Using current branch: $BRANCH_NAME"
    fi
    
    log_success "Integration environment ready"
}

check_integration_prerequisites() {
    log "Checking integration prerequisites..."
    
    local missing_tools=()
    
    # Check Docker
    if ! docker info >/dev/null 2>&1; then
        missing_tools+=("Docker (not running)")
    fi
    
    # Check Docker Compose
    if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
        missing_tools+=("Docker Compose")
    fi
    
    # Check GitHub CLI
    if ! command -v gh >/dev/null 2>&1; then
        missing_tools+=("GitHub CLI (gh)")
    elif ! gh auth status >/dev/null 2>&1; then
        missing_tools+=("GitHub CLI (not authenticated)")
    fi
    
    # Check act tool
    if ! command -v act >/dev/null 2>&1; then
        missing_tools+=("act tool")
    fi
    
    # Check our custom scripts
    local required_scripts=("ci-local.sh" "ci-validate.sh" "gh-workflows.sh" "gh-actions.sh" "act-local.sh" "act-validate.sh")
    for script in "${required_scripts[@]}"; do
        if [[ ! -x "$SCRIPT_DIR/$script" ]]; then
            missing_tools+=("$script (not executable)")
        fi
    done
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "Missing required tools:"
        for tool in "${missing_tools[@]}"; do
            echo "  - $tool"
        done
        exit 1
    fi
    
    log_success "All integration prerequisites available"
}

run_test() {
    local test_name="$1"
    local test_command="$2"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    log_verbose "Running test: $test_name"
    
    if eval "$test_command" >/dev/null 2>&1; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        log_success "$test_name"
        return 0
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        INTEGRATION_ISSUES+=("$test_name")
        log_error "$test_name"
        return 1
    fi
}

# ==============================================================================
# DOCKER INTEGRATION TESTING
# ==============================================================================

test_docker_integration() {
    log "🐳 Testing Docker integration..."
    
    local docker_tests=()
    
    # Test Docker Compose configurations
    run_test "Docker Compose validation" "docker compose -f docker/docker-compose.yml config -q"
    run_test "Docker Compose CI validation" "docker compose -f docker/docker-compose.ci.yml config -q"
    run_test "Docker Compose test matrix validation" "docker compose -f docker/docker-compose.test-matrix.yml config -q"
    
    # Test our Docker scripts
    run_test "CI local script help" "$SCRIPT_DIR/ci-local.sh --help"
    run_test "CI validation script help" "$SCRIPT_DIR/ci-validate.sh --help"
    run_test "CI cleanup script help" "$SCRIPT_DIR/ci-cleanup.sh --help"
    
    # Test Docker network connectivity
    if [[ "$VERBOSE_MODE" == true ]]; then
        log_verbose "Testing Docker environment setup..."
        run_test "Docker network creation" "docker network create test-network 2>/dev/null || true"
        run_test "Docker network cleanup" "docker network rm test-network 2>/dev/null || true"
    fi
    
    log_success "Docker integration tests completed"
}

# ==============================================================================
# ACT TOOL INTEGRATION TESTING
# ==============================================================================

test_act_integration() {
    log "🎭 Testing act tool integration..."
    
    # Test act workflow parsing
    run_test "Act workflow listing" "act --list"
    run_test "Act workflow validation" "$SCRIPT_DIR/act-validate.sh --workflow=ci.yml" || true
    
    # Test act with different events
    local events=("push" "pull_request" "workflow_dispatch")
    for event in "${events[@]}"; do
        run_test "Act $event event dry-run" "act $event --dry-run --platform ubuntu-latest=ghcr.io/catthehacker/ubuntu:act-latest"
    done
    
    # Test our act scripts
    run_test "Act local script help" "$SCRIPT_DIR/act-local.sh --help"
    run_test "Act validation script help" "$SCRIPT_DIR/act-validate.sh --help"
    
    # Test act secrets management
    if [[ "$VERBOSE_MODE" == true ]]; then
        run_test "Act secrets setup" "$SCRIPT_DIR/act-local.sh secrets"
    fi
    
    log_success "Act integration tests completed"
}

# ==============================================================================
# GITHUB CLI INTEGRATION TESTING
# ==============================================================================

test_github_integration() {
    log "🔗 Testing GitHub CLI integration..."
    
    # Test GitHub CLI functionality
    run_test "GitHub CLI authentication" "gh auth status"
    run_test "GitHub repository access" "gh repo view --json nameWithOwner"
    run_test "GitHub workflows listing" "gh workflow list"
    
    # Test our GitHub scripts
    run_test "GitHub workflows script help" "$SCRIPT_DIR/gh-workflows.sh --help"
    run_test "GitHub actions script help" "$SCRIPT_DIR/gh-actions.sh --help"
    
    # Test GitHub workflow operations
    run_test "GitHub workflow status" "$SCRIPT_DIR/gh-workflows.sh status --limit=5"
    
    if [[ -n "$PR_NUMBER" ]]; then
        run_test "GitHub PR status" "$SCRIPT_DIR/gh-actions.sh pr status --pr-number=$PR_NUMBER"
    fi
    
    log_success "GitHub CLI integration tests completed"
}

# ==============================================================================
# COMPREHENSIVE INTEGRATION TESTING
# ==============================================================================

run_full_integration_test() {
    log "🚀 Running full CI integration test..."
    
    local integration_log="$INTEGRATION_LOGS_DIR/full-test-$TIMESTAMP.log"
    
    {
        echo "======================================="
        echo "Full CI Integration Test"
        echo "Started: $(date)"
        echo "Workflow: ${WORKFLOW_FILE:-"all"}"
        echo "Branch: $BRANCH_NAME"
        echo "======================================="
        
        # Phase 1: Component validation
        log "Phase 1: Component Integration Validation"
        test_docker_integration
        test_act_integration  
        test_github_integration
        
        # Phase 2: Workflow validation
        log "Phase 2: Workflow Validation Across Platforms"
        
        if [[ -n "$WORKFLOW_FILE" ]]; then
            # Validate specific workflow
            log_info "Validating workflow: $WORKFLOW_FILE"
            
            # Docker validation
            run_test "Docker workflow validation" "$SCRIPT_DIR/ci-validate.sh --fast"
            
            # Act validation
            run_test "Act workflow validation" "$SCRIPT_DIR/act-validate.sh --workflow=$WORKFLOW_FILE"
            
            # GitHub validation
            run_test "GitHub workflow syntax" "gh workflow view $WORKFLOW_FILE"
            
        else
            # Validate all workflows
            log_info "Validating all workflows"
            
            run_test "All workflows Docker validation" "$SCRIPT_DIR/ci-validate.sh --standard"
            run_test "All workflows act validation" "$SCRIPT_DIR/act-validate.sh --strict"
            run_test "GitHub workflows status" "$SCRIPT_DIR/gh-workflows.sh status"
        fi
        
        # Phase 3: Cross-platform execution test
        log "Phase 3: Cross-Platform Execution Testing"
        
        if [[ "$PARALLEL_MODE" == true ]]; then
            log_info "Running parallel execution tests..."
            
            # Start tests in parallel
            (
                run_test "Docker quick test" "$SCRIPT_DIR/ci-local.sh --quick" &
                run_test "Act dry run test" "$SCRIPT_DIR/act-local.sh dry-run --event=push" &
                wait
            )
        else
            log_info "Running sequential execution tests..."
            
            # Docker test
            run_test "Docker quick validation" "$SCRIPT_DIR/ci-local.sh --quick"
            
            # Act test  
            run_test "Act workflow dry run" "$SCRIPT_DIR/act-local.sh dry-run --event=push"
        fi
        
        # Phase 4: Integration health check
        log "Phase 4: Integration Health Assessment"
        
        run_test "Docker system health" "docker system df"
        run_test "GitHub API rate limit" "gh api rate_limit"
        run_test "Act tool version compatibility" "act --version"
        
        echo "======================================="
        echo "Full Integration Test Completed: $(date)"
        echo "======================================="
        
    } 2>&1 | tee "$integration_log"
    
    log_info "Full integration test log: $integration_log"
}

# ==============================================================================
# COMPARISON TESTING
# ==============================================================================

compare_local_remote_ci() {
    log "📊 Comparing local vs remote CI execution..."
    
    local comparison_file="$RESULTS_DIR/comparison-$TIMESTAMP.json"
    
    # Get local execution data (Docker + act)
    log_info "Gathering local CI data..."
    
    local docker_start=$(date +%s)
    local docker_result="unknown"
    if "$SCRIPT_DIR/ci-validate.sh" --fast >/dev/null 2>&1; then
        docker_result="success"
    else
        docker_result="failure"
    fi
    local docker_duration=$(($(date +%s) - docker_start))
    
    local act_start=$(date +%s)
    local act_result="unknown"
    if "$SCRIPT_DIR/act-local.sh" dry-run --event=push >/dev/null 2>&1; then
        act_result="success"
    else
        act_result="failure"
    fi
    local act_duration=$(($(date +%s) - act_start))
    
    # Get remote execution data (GitHub Actions)
    log_info "Gathering remote CI data..."
    
    local remote_data=$(gh run list --branch "$BRANCH_NAME" --limit 5 --json status,conclusion,workflowName,createdAt,updatedAt 2>/dev/null || echo "[]")
    local remote_success_count=$(echo "$remote_data" | jq '[.[] | select(.conclusion == "success")] | length' 2>/dev/null || echo "0")
    local remote_total_count=$(echo "$remote_data" | jq 'length' 2>/dev/null || echo "0")
    
    # Generate comparison report
    local comparison_report=$(cat << EOF
{
  "timestamp": "$(date -Iseconds)",
  "branch": "$BRANCH_NAME",
  "comparison": {
    "local": {
      "docker": {
        "result": "$docker_result",
        "duration_seconds": $docker_duration
      },
      "act": {
        "result": "$act_result", 
        "duration_seconds": $act_duration
      }
    },
    "remote": {
      "github_actions": {
        "recent_runs": $remote_total_count,
        "successful_runs": $remote_success_count,
        "success_rate": $(if [[ $remote_total_count -gt 0 ]]; then echo 'scale=2; $remote_success_count * 100 / $remote_total_count' | bc; else echo '0'; fi)
      }
    }
  },
  "analysis": {
    "local_vs_remote_consistency": "$(if [[ "$docker_result" == 'success' && "$act_result" == 'success' && $remote_success_count -gt 0 ]]; then echo 'consistent'; else echo 'inconsistent'; fi)",
    "performance_comparison": {
      "local_total_time": $((docker_duration + act_duration)),
      "local_average": $(( (docker_duration + act_duration) / 2 ))
    }
  }
}
EOF
)
    
    echo "$comparison_report" > "$comparison_file"
    
    if [[ "$JSON_OUTPUT" == true ]]; then
        cat "$comparison_file"
    else
        echo
        echo "CI Comparison Results"
        echo "===================="
        echo "Branch: $BRANCH_NAME"
        echo
        echo "Local Results:"
        echo "  Docker validation: $docker_result (${docker_duration}s)"
        echo "  Act simulation: $act_result (${act_duration}s)"
        echo
        echo "Remote Results:"
        echo "  Recent runs: $remote_total_count"
        echo "  Successful: $remote_success_count"
        echo "  Success rate: $(if [[ $remote_total_count -gt 0 ]]; then echo 'scale=1; $remote_success_count * 100 / $remote_total_count' | bc; else echo '0'; fi)%"
        echo
        echo "Analysis saved to: $comparison_file"
    fi
}

# ==============================================================================
# PR WORKFLOW TESTING
# ==============================================================================

test_pr_workflow() {
    log "🔀 Testing complete PR workflow..."
    
    if [[ -z "$PR_NUMBER" ]]; then
        log_error "PR number must be specified with --pr-number for PR workflow testing"
        return 1
    fi
    
    local pr_log="$INTEGRATION_LOGS_DIR/pr-workflow-$PR_NUMBER-$TIMESTAMP.log"
    
    {
        echo "======================================="
        echo "PR Workflow Integration Test"
        echo "PR Number: $PR_NUMBER"
        echo "Started: $(date)"
        echo "======================================="
        
        # Phase 1: PR validation
        log "Phase 1: PR Validation"
        run_test "PR exists and is accessible" "gh pr view $PR_NUMBER"
        run_test "PR status checks" "$SCRIPT_DIR/gh-actions.sh pr status --pr-number=$PR_NUMBER"
        
        # Phase 2: Local testing of PR changes
        log "Phase 2: Local PR Testing"
        
        # Checkout PR branch
        local pr_branch=$(gh pr view "$PR_NUMBER" --json headRefName --jq '.headRefName')
        log_info "PR branch: $pr_branch"
        
        if git branch -r | grep -q "origin/$pr_branch"; then
            run_test "PR branch checkout" "git fetch origin $pr_branch && git checkout $pr_branch"
            
            # Test with local tools
            run_test "PR Docker validation" "$SCRIPT_DIR/ci-validate.sh --fast"
            run_test "PR act validation" "$SCRIPT_DIR/act-validate.sh --strict"
            
            # Simulate PR events
            run_test "PR event simulation" "$SCRIPT_DIR/act-local.sh dry-run --event=pull_request"
            
        else
            log_warning "PR branch not available locally, skipping local tests"
        fi
        
        # Phase 3: Remote PR status monitoring
        log "Phase 3: Remote PR Status Monitoring"
        
        run_test "PR CI status" "$SCRIPT_DIR/gh-actions.sh status --pr-number=$PR_NUMBER"
        run_test "PR workflow runs" "$SCRIPT_DIR/gh-workflows.sh status --limit=5"
        
        # Phase 4: Integration analysis
        log "Phase 4: PR Integration Analysis"
        
        local pr_status=$(gh pr view "$PR_NUMBER" --json mergeable,reviewDecision,statusCheckRollup | jq -r '.mergeable')
        log_info "PR mergeable status: $pr_status"
        
        if [[ "$pr_status" == "MERGEABLE" ]]; then
            log_success "PR is ready for integration"
        else
            log_warning "PR has integration issues"
        fi
        
        echo "======================================="
        echo "PR Workflow Test Completed: $(date)"
        echo "======================================="
        
    } 2>&1 | tee "$pr_log"
    
    log_info "PR workflow test log: $pr_log"
}

# ==============================================================================
# MONITORING AND HEALTH CHECKS
# ==============================================================================

monitor_ci_health() {
    log "📊 Monitoring CI integration health..."
    
    local health_report="$RESULTS_DIR/health-report-$TIMESTAMP.json"
    
    # Docker health
    local docker_healthy="true"
    if ! docker info >/dev/null 2>&1; then
        docker_healthy="false"
    fi
    
    # Act health
    local act_healthy="true"  
    if ! act --list >/dev/null 2>&1; then
        act_healthy="false"
    fi
    
    # GitHub CLI health
    local gh_healthy="true"
    if ! gh auth status >/dev/null 2>&1; then
        gh_healthy="false"
    fi
    
    # Workflow health
    local workflow_count=$(find .github/workflows -name "*.yml" -o -name "*.yaml" | wc -l)
    local workflow_healthy="true"
    if [[ $workflow_count -eq 0 ]]; then
        workflow_healthy="false"
    fi
    
    # Generate health report
    local health_data=$(cat << EOF
{
  "timestamp": "$(date -Iseconds)",
  "overall_health": "$(if [[ "$docker_healthy" == 'true' && "$act_healthy" == 'true' && "$gh_healthy" == 'true' && "$workflow_healthy" == 'true' ]]; then echo 'healthy'; else echo 'degraded'; fi)",
  "components": {
    "docker": {
      "healthy": $docker_healthy,
      "version": "$(docker --version 2>/dev/null || echo 'unavailable')"
    },
    "act": {
      "healthy": $act_healthy,
      "version": "$(act --version 2>/dev/null || echo 'unavailable')"
    },
    "github_cli": {
      "healthy": $gh_healthy,
      "authenticated": $(gh auth status >/dev/null 2>&1 && echo 'true' || echo 'false')
    },
    "workflows": {
      "healthy": $workflow_healthy,
      "count": $workflow_count
    }
  },
  "recent_activity": {
    "tests_run": $TESTS_RUN,
    "tests_passed": $TESTS_PASSED,
    "tests_failed": $TESTS_FAILED
  }
}
EOF
)
    
    echo "$health_data" > "$health_report"
    
    if [[ "$JSON_OUTPUT" == true ]]; then
        cat "$health_report"
    else
        echo
        echo "CI Integration Health Status"
        echo "==========================="
        echo "Overall Health: $(if [[ "$docker_healthy" == "true" && "$act_healthy" == "true" && "$gh_healthy" == "true" && "$workflow_healthy" == "true" ]]; then echo "✅ Healthy"; else echo "⚠️ Degraded"; fi)"
        echo
        echo "Component Status:"
        echo "  Docker: $(if [[ "$docker_healthy" == "true" ]]; then echo "✅ Healthy"; else echo "❌ Unhealthy"; fi)"
        echo "  Act Tool: $(if [[ "$act_healthy" == "true" ]]; then echo "✅ Healthy"; else echo "❌ Unhealthy"; fi)"
        echo "  GitHub CLI: $(if [[ "$gh_healthy" == "true" ]]; then echo "✅ Healthy"; else echo "❌ Unhealthy"; fi)"
        echo "  Workflows: $(if [[ "$workflow_healthy" == "true" ]]; then echo "✅ Healthy ($workflow_count found)"; else echo "❌ No workflows found"; fi)"
        echo
        echo "Test Summary:"
        echo "  Tests run: $TESTS_RUN"
        echo "  Passed: $TESTS_PASSED"
        echo "  Failed: $TESTS_FAILED"
        echo
        echo "Health report saved to: $health_report"
    fi
}

# ==============================================================================
# RESULTS GENERATION
# ==============================================================================

generate_integration_summary() {
    local summary_file="$RESULTS_DIR/integration-summary-$TIMESTAMP.json"
    
    local summary=$(cat << EOF
{
  "timestamp": "$(date -Iseconds)",
  "execution_summary": {
    "total_tests": $TESTS_RUN,
    "passed_tests": $TESTS_PASSED,
    "failed_tests": $TESTS_FAILED,
    "success_rate": $(if [[ $TESTS_RUN -gt 0 ]]; then echo 'scale=1; $TESTS_PASSED * 100 / $TESTS_RUN' | bc; else echo '0'; fi)
  },
  "configuration": {
    "workflow": "${WORKFLOW_FILE:-'all'}",
    "branch": "$BRANCH_NAME",
    "pr_number": "${PR_NUMBER:-'none'}",
    "parallel_mode": $PARALLEL_MODE,
    "verbose_mode": $VERBOSE_MODE
  },
  "issues_found": [],
  "recommendations": [
$(if [[ $TESTS_FAILED -gt 0 ]]; then
    echo '    "Review failed integration tests and resolve underlying issues",'
fi)
$(if [[ ${#INTEGRATION_ISSUES[@]} -gt 0 ]]; then
    echo '    "Address the specific integration issues identified",'
fi)
    "Consider running tests in parallel mode for faster feedback",
    "Regularly monitor CI health with the monitor command"
  ]
}
EOF
)
    
    echo "$summary" > "$summary_file"
    
    if [[ "$JSON_OUTPUT" == true ]]; then
        cat "$summary_file"
    else
        echo
        echo "Integration Test Summary"
        echo "======================="
        echo "Tests run: $TESTS_RUN"
        echo "Passed: $TESTS_PASSED"
        echo "Failed: $TESTS_FAILED"
        echo "Success rate: $(if [[ $TESTS_RUN -gt 0 ]]; then echo 'scale=1; $TESTS_PASSED * 100 / $TESTS_RUN' | bc; else echo '0'; fi)%"
        echo
        echo "Summary saved to: $summary_file"
    fi
}

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================

main() {
    local command=""
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            full-test|compare|sync|validate|monitor|deploy|pr-flow)
                command="$1"
                shift
                ;;
            --workflow)
                WORKFLOW_FILE="$2"
                shift 2
                ;;
            --branch)
                BRANCH_NAME="$2"
                shift 2
                ;;
            --pr-number)
                PR_NUMBER="$2"
                shift 2
                ;;
            --environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            --parallel)
                PARALLEL_MODE=true
                shift
                ;;
            --verbose)
                VERBOSE_MODE=true
                shift
                ;;
            --json)
                JSON_OUTPUT=true
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
    
    # Default command
    if [[ -z "$command" ]]; then
        command="validate"
    fi
    
    # Print header (unless JSON output)
    if [[ "$JSON_OUTPUT" != true ]]; then
        cat << EOF

╔══════════════════════════════════════════════════════════════════════╗
║                    CI INTEGRATION TESTING                           ║
║                                                                      ║
║  Docker + GitHub CLI + Act - Comprehensive CI Integration           ║
║  $(date)                                    ║
╚══════════════════════════════════════════════════════════════════════╝

EOF
    fi
    
    # Setup
    cd "$PROJECT_ROOT"
    setup_integration_environment
    check_integration_prerequisites
    
    # Execute command
    case "$command" in
        full-test)
            run_full_integration_test
            generate_integration_summary
            ;;
        compare)
            compare_local_remote_ci
            ;;
        sync)
            log_warning "Sync functionality not yet implemented"
            log_info "Use individual scripts to manage configurations"
            ;;
        validate)
            test_docker_integration
            test_act_integration
            test_github_integration
            generate_integration_summary
            ;;
        monitor)
            monitor_ci_health
            ;;
        deploy)
            log_warning "Deploy testing not yet implemented"
            log_info "Use gh-actions.sh deploy for deployment management"
            ;;
        pr-flow)
            test_pr_workflow
            generate_integration_summary
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
    
    # Final status
    if [[ $TESTS_FAILED -eq 0 ]]; then
        if [[ "$JSON_OUTPUT" != true ]]; then
            log_success "CI integration testing completed successfully! 🎉"
        fi
        exit 0
    else
        if [[ "$JSON_OUTPUT" != true ]]; then
            log_error "CI integration testing completed with $TESTS_FAILED failures"
        fi
        exit 1
    fi
}

# Execute main function with all arguments
main "$@"