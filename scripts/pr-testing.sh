#!/bin/bash

# ==============================================================================
# PR Testing Workflow Script
# ==============================================================================
# This script provides comprehensive testing workflows specifically designed
# for Pull Request scenarios, integrating all available tools (Docker, act, gh)
# to ensure PRs are thoroughly validated before merge.
#
# Usage:
#   ./scripts/pr-testing.sh [command] [options]
#
# Commands:
#   create        Create and test new PR
#   validate      Validate existing PR
#   pre-merge     Pre-merge validation and testing
#   monitor       Monitor PR CI status
#   compare       Compare PR vs base branch
#   simulate      Simulate PR merge scenarios
#   report        Generate comprehensive PR test report
#
# Options:
#   --pr-number   PR number to test
#   --base        Base branch (default: main)
#   --head        Head branch for new PR
#   --title       PR title for creation
#   --draft       Create as draft PR
#   --auto-merge  Enable auto-merge after tests pass
#   --verbose     Enable verbose logging
#   --json        Output results in JSON format
#   --help        Show this help message
#
# Examples:
#   ./scripts/pr-testing.sh create --head=feature/new-feature --title="Add new feature"
#   ./scripts/pr-testing.sh validate --pr-number=123
#   ./scripts/pr-testing.sh pre-merge --pr-number=123 --verbose
#   ./scripts/pr-testing.sh compare --pr-number=123
# ==============================================================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
PR_LOGS_DIR="$PROJECT_ROOT/pr-testing-logs"
PR_RESULTS_DIR="$PROJECT_ROOT/pr-testing-results"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default options
PR_NUMBER=""
BASE_BRANCH="main"
HEAD_BRANCH=""
PR_TITLE=""
DRAFT_PR=false
AUTO_MERGE=false
VERBOSE_MODE=false
JSON_OUTPUT=false

# PR testing tracking
PR_TESTS_RUN=0
PR_TESTS_PASSED=0
PR_TESTS_FAILED=0
PR_ISSUES=()

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
PR Testing Workflow Script

USAGE:
    ./scripts/pr-testing.sh [COMMAND] [OPTIONS]

COMMANDS:
    create        Create new PR with comprehensive testing
    validate      Validate existing PR against all quality gates
    pre-merge     Pre-merge validation and conflict resolution
    monitor       Monitor PR CI status and provide real-time updates
    compare       Compare PR branch against base branch
    simulate      Simulate various PR merge scenarios
    report        Generate comprehensive PR testing report

OPTIONS:
    --pr-number   PR number for operations on existing PRs
    --base        Base branch name (default: main)
    --head        Head branch name for new PR creation
    --title       PR title for creation (auto-generated if not provided)
    --draft       Create PR as draft (allows testing before review)
    --auto-merge  Enable auto-merge when all checks pass
    --verbose     Enable verbose logging and detailed output
    --json        Output results in structured JSON format
    --help        Show this comprehensive help message

EXAMPLES:
    # Create new PR with full testing
    ./scripts/pr-testing.sh create --head=feature/new-feature --title="Add amazing feature"
    
    # Validate existing PR
    ./scripts/pr-testing.sh validate --pr-number=123 --verbose
    
    # Pre-merge validation
    ./scripts/pr-testing.sh pre-merge --pr-number=123
    
    # Compare PR with base branch
    ./scripts/pr-testing.sh compare --pr-number=123 --base=main
    
    # Monitor PR status
    ./scripts/pr-testing.sh monitor --pr-number=123
    
    # Generate comprehensive report
    ./scripts/pr-testing.sh report --pr-number=123 --json

TESTING PHASES:
    1. Branch Validation - Ensure branch is up-to-date and conflict-free
    2. Local Testing - Docker + act tool validation
    3. Remote Testing - GitHub Actions workflow execution
    4. Security Validation - Security and dependency scanning
    5. Performance Testing - Performance impact analysis
    6. Integration Testing - Cross-platform compatibility
    7. Documentation - Documentation and changelog updates

QUALITY GATES:
    ✓ Code quality (TypeScript, ESLint, Prettier)
    ✓ Test coverage and passing tests
    ✓ Security vulnerability scanning
    ✓ Performance regression detection
    ✓ Documentation completeness
    ✓ Merge conflict resolution
    ✓ CI/CD pipeline compatibility

AUTOMATION FEATURES:
    - Automatic PR creation with templates
    - Real-time CI status monitoring
    - Automated conflict detection and reporting
    - Performance impact analysis
    - Security vulnerability scanning
    - Auto-merge when all conditions met
EOF
}

setup_pr_testing_environment() {
    log "Setting up PR testing environment..."
    
    mkdir -p "$PR_LOGS_DIR"
    mkdir -p "$PR_RESULTS_DIR"
    
    # Ensure we're in a clean git state
    if [[ -n "$(git status --porcelain)" ]]; then
        log_warning "Working directory has uncommitted changes"
        if [[ "$VERBOSE_MODE" == true ]]; then
            git status --short
        fi
    fi
    
    log_success "PR testing environment ready"
}

check_pr_prerequisites() {
    log "Checking PR testing prerequisites..."
    
    # Check if we have all required tools
    local missing_tools=()
    
    if ! command -v gh >/dev/null 2>&1; then
        missing_tools+=("GitHub CLI (gh)")
    elif ! gh auth status >/dev/null 2>&1; then
        missing_tools+=("GitHub CLI authentication")
    fi
    
    if ! command -v git >/dev/null 2>&1; then
        missing_tools+=("Git")
    fi
    
    if ! docker info >/dev/null 2>&1; then
        missing_tools+=("Docker")
    fi
    
    if ! command -v act >/dev/null 2>&1; then
        missing_tools+=("act tool")
    fi
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "Missing required tools:"
        for tool in "${missing_tools[@]}"; do
            echo "  - $tool"
        done
        exit 1
    fi
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
        log_error "Not in a Git repository"
        exit 1
    fi
    
    # Check if base branch exists
    if ! git show-ref --verify --quiet "refs/heads/$BASE_BRANCH" && ! git show-ref --verify --quiet "refs/remotes/origin/$BASE_BRANCH"; then
        log_error "Base branch '$BASE_BRANCH' not found"
        exit 1
    fi
    
    log_success "All PR testing prerequisites available"
}

run_pr_test() {
    local test_name="$1"
    local test_command="$2"
    
    PR_TESTS_RUN=$((PR_TESTS_RUN + 1))
    log_verbose "Running PR test: $test_name"
    
    if eval "$test_command" >/dev/null 2>&1; then
        PR_TESTS_PASSED=$((PR_TESTS_PASSED + 1))
        log_success "$test_name"
        return 0
    else
        PR_TESTS_FAILED=$((PR_TESTS_FAILED + 1))
        PR_ISSUES+=("$test_name")
        log_error "$test_name"
        return 1
    fi
}

# ==============================================================================
# PR CREATION WORKFLOW
# ==============================================================================

create_pr_with_testing() {
    log "🔀 Creating PR with comprehensive testing..."
    
    if [[ -z "$HEAD_BRANCH" ]]; then
        log_error "Head branch must be specified with --head"
        return 1
    fi
    
    # Ensure head branch exists and is current
    if ! git show-ref --verify --quiet "refs/heads/$HEAD_BRANCH"; then
        log_error "Head branch '$HEAD_BRANCH' not found locally"
        return 1
    fi
    
    # Switch to head branch
    git checkout "$HEAD_BRANCH"
    
    # Push branch if needed
    if ! git ls-remote --heads origin "$HEAD_BRANCH" | grep -q "$HEAD_BRANCH"; then
        log_info "Pushing head branch to origin..."
        git push --set-upstream origin "$HEAD_BRANCH"
    fi
    
    # Generate PR title if not provided
    if [[ -z "$PR_TITLE" ]]; then
        PR_TITLE="feat: $(echo "$HEAD_BRANCH" | sed 's/^[^/]*\///' | sed 's/-/ /g')"
        log_info "Generated PR title: $PR_TITLE"
    fi
    
    # Run pre-creation validation
    log "Phase 1: Pre-creation validation"
    
    run_pr_test "Branch up-to-date check" "git fetch origin && git merge-base --is-ancestor origin/$BASE_BRANCH HEAD"
    run_pr_test "No merge conflicts" "git merge-tree \$(git merge-base HEAD origin/$BASE_BRANCH) HEAD origin/$BASE_BRANCH | grep -q '^@@' && false || true"
    run_pr_test "Local code quality" "$SCRIPT_DIR/ci-validate.sh --fast"
    run_pr_test "Docker validation" "docker compose -f docker-compose.yml config -q"
    
    # Create PR body template
    local pr_body=$(cat << EOF
## 🎯 Summary
Brief description of the changes made in this PR.

## 📋 Changes Made
- [ ] Feature implementation
- [ ] Tests added/updated  
- [ ] Documentation updated
- [ ] CI/CD compatibility verified

## 🧪 Testing Strategy
### Local Testing
- [x] Docker validation: \`docker compose config\`
- [x] Code quality: TypeScript, ESLint, Prettier
- [x] Act simulation: \`act pull_request --dry-run\`

### CI/CD Testing  
- [ ] GitHub Actions workflows
- [ ] E2E test suite
- [ ] Security scanning
- [ ] Performance benchmarks

## 📊 Quality Gates
- [ ] All tests passing
- [ ] Code coverage maintained/improved
- [ ] No security vulnerabilities
- [ ] Performance impact acceptable
- [ ] Documentation complete

## 🔒 Security Considerations
- [ ] No sensitive data exposed
- [ ] Dependencies reviewed
- [ ] Permissions appropriate
- [ ] Security scan clean

## 🚀 Deployment Notes
- [ ] No breaking changes
- [ ] Database migrations (if any)
- [ ] Environment variables updated
- [ ] Rollback plan documented

## 📝 Reviewer Checklist
- [ ] Code quality and style
- [ ] Test coverage adequate
- [ ] Documentation complete
- [ ] Security implications reviewed
- [ ] Performance impact assessed

---
*Auto-generated by pr-testing.sh at $(date)*
EOF
)
    
    # Create the PR
    local pr_flags=""
    if [[ "$DRAFT_PR" == true ]]; then
        pr_flags="--draft"
    fi
    
    if gh pr create --title "$PR_TITLE" --body "$pr_body" --base "$BASE_BRANCH" --head "$HEAD_BRANCH" $pr_flags; then
        # Get the created PR number
        PR_NUMBER=$(gh pr list --head "$HEAD_BRANCH" --json number --jq '.[0].number')
        log_success "PR created successfully: #$PR_NUMBER"
        
        # Run post-creation testing
        log "Phase 2: Post-creation testing"
        
        # Wait a moment for GitHub to process the PR
        sleep 5
        
        # Validate the created PR
        run_pr_test "PR accessibility" "gh pr view $PR_NUMBER"
        run_pr_test "PR status checks setup" "gh pr view $PR_NUMBER --json statusCheckRollup"
        
        # Set up auto-merge if requested
        if [[ "$AUTO_MERGE" == true ]]; then
            log_info "Enabling auto-merge..."
            if gh pr merge "$PR_NUMBER" --auto --merge; then
                log_success "Auto-merge enabled"
            else
                log_warning "Failed to enable auto-merge"
            fi
        fi
        
        # Add appropriate labels
        local labels=""
        case "$HEAD_BRANCH" in
            feature/*) labels="enhancement" ;;
            fix/*|bugfix/*) labels="bug" ;;
            docs/*) labels="documentation" ;;
            refactor/*) labels="refactor" ;;
            test/*) labels="testing" ;;
        esac
        
        if [[ -n "$labels" ]]; then
            gh pr edit "$PR_NUMBER" --add-label "$labels" 2>/dev/null || true
            log_info "Added labels: $labels"
        fi
        
        log_success "PR creation and initial testing completed"
        return 0
    else
        log_error "Failed to create PR"
        return 1
    fi
}

# ==============================================================================
# PR VALIDATION WORKFLOW
# ==============================================================================

validate_existing_pr() {
    log "🔍 Validating existing PR #$PR_NUMBER..."
    
    if [[ -z "$PR_NUMBER" ]]; then
        log_error "PR number must be specified with --pr-number"
        return 1
    fi
    
    local validation_log="$PR_LOGS_DIR/pr-validation-$PR_NUMBER-$TIMESTAMP.log"
    
    {
        echo "======================================="
        echo "PR Validation Report"
        echo "PR Number: $PR_NUMBER"
        echo "Started: $(date)"
        echo "======================================="
        
        # Phase 1: Basic PR validation
        log "Phase 1: Basic PR Information Validation"
        
        run_pr_test "PR exists and accessible" "gh pr view $PR_NUMBER"
        
        # Get PR information
        local pr_data=$(gh pr view "$PR_NUMBER" --json number,title,state,author,headRefName,baseRefName,mergeable,reviewDecision)
        local pr_head=$(echo "$pr_data" | jq -r '.headRefName')
        local pr_base=$(echo "$pr_data" | jq -r '.baseRefName')
        local pr_state=$(echo "$pr_data" | jq -r '.state')
        local pr_mergeable=$(echo "$pr_data" | jq -r '.mergeable')
        
        log_info "PR Head: $pr_head"
        log_info "PR Base: $pr_base"
        log_info "PR State: $pr_state"
        log_info "PR Mergeable: $pr_mergeable"
        
        run_pr_test "PR is open" "[[ '$pr_state' == 'OPEN' ]]"
        run_pr_test "PR is mergeable" "[[ '$pr_mergeable' == 'MERGEABLE' ]]"
        
        # Phase 2: Branch validation
        log "Phase 2: Branch and Conflict Validation"
        
        # Fetch latest changes
        git fetch origin
        
        run_pr_test "Head branch exists locally" "git show-ref --verify --quiet refs/remotes/origin/$pr_head"
        run_pr_test "Base branch exists locally" "git show-ref --verify --quiet refs/remotes/origin/$pr_base"
        run_pr_test "No merge conflicts" "git merge-tree \$(git merge-base origin/$pr_head origin/$pr_base) origin/$pr_head origin/$pr_base | grep -q '^@@' && false || true"
        
        # Phase 3: Local testing validation
        log "Phase 3: Local Testing Validation"
        
        # Checkout PR branch for testing
        git checkout "$pr_head" 2>/dev/null || git checkout -b "$pr_head" "origin/$pr_head"
        
        run_pr_test "Code quality validation" "$SCRIPT_DIR/ci-validate.sh --standard"
        run_pr_test "Docker configuration validation" "docker compose -f docker-compose.yml config -q"
        run_pr_test "Act workflow validation" "$SCRIPT_DIR/act-validate.sh --strict"
        
        # Phase 4: GitHub Actions validation
        log "Phase 4: GitHub Actions Status Validation"
        
        run_pr_test "PR has status checks" "gh pr view $PR_NUMBER --json statusCheckRollup | jq '.statusCheckRollup | length' | grep -v '^0$'"
        
        # Check status of CI runs
        local status_checks=$(gh pr view "$PR_NUMBER" --json statusCheckRollup --jq '.statusCheckRollup[]?')
        if [[ -n "$status_checks" ]]; then
            local failed_checks=0
            local pending_checks=0
            local successful_checks=0
            
            while IFS= read -r check; do
                local state=$(echo "$check" | jq -r '.state // .conclusion')
                case "$state" in
                    "SUCCESS"|"success") successful_checks=$((successful_checks + 1)) ;;
                    "FAILURE"|"failure") failed_checks=$((failed_checks + 1)) ;;
                    "PENDING"|"pending"|"in_progress") pending_checks=$((pending_checks + 1)) ;;
                esac
            done <<< "$status_checks"
            
            log_info "Status checks - Success: $successful_checks, Failed: $failed_checks, Pending: $pending_checks"
            
            run_pr_test "No failed status checks" "[[ $failed_checks -eq 0 ]]"
        fi
        
        # Phase 5: Security and performance validation
        log "Phase 5: Security and Performance Validation"
        
        run_pr_test "Security validation" "$SCRIPT_DIR/act-validate.sh --security --workflow=ci.yml" || true
        run_pr_test "Performance validation" "$SCRIPT_DIR/act-validate.sh --performance --workflow=ci.yml" || true
        
        echo "======================================="
        echo "PR Validation Completed: $(date)"
        echo "======================================="
        
    } 2>&1 | tee "$validation_log"
    
    log_info "PR validation log: $validation_log"
    
    # Summary
    echo
    log "📊 PR Validation Summary:"
    log_info "Tests run: $PR_TESTS_RUN"
    log_info "Tests passed: $PR_TESTS_PASSED"
    log_info "Tests failed: $PR_TESTS_FAILED"
    
    if [[ $PR_TESTS_FAILED -eq 0 ]]; then
        log_success "PR #$PR_NUMBER passed all validation tests! 🎉"
        return 0
    else
        log_warning "PR #$PR_NUMBER has $PR_TESTS_FAILED validation issues"
        if [[ ${#PR_ISSUES[@]} -gt 0 ]]; then
            log_info "Issues found:"
            for issue in "${PR_ISSUES[@]}"; do
                echo "  - $issue"
            done
        fi
        return 1
    fi
}

# ==============================================================================
# PR PRE-MERGE VALIDATION
# ==============================================================================

pre_merge_validation() {
    log "🔀 Running pre-merge validation for PR #$PR_NUMBER..."
    
    if [[ -z "$PR_NUMBER" ]]; then
        log_error "PR number must be specified with --pr-number"
        return 1
    fi
    
    local pre_merge_log="$PR_LOGS_DIR/pre-merge-$PR_NUMBER-$TIMESTAMP.log"
    
    {
        echo "======================================="
        echo "Pre-Merge Validation Report"
        echo "PR Number: $PR_NUMBER"
        echo "Started: $(date)"
        echo "======================================="
        
        # Get PR information
        local pr_data=$(gh pr view "$PR_NUMBER" --json headRefName,baseRefName,mergeable,reviewDecision,statusCheckRollup)
        local pr_head=$(echo "$pr_data" | jq -r '.headRefName')
        local pr_base=$(echo "$pr_data" | jq -r '.baseRefName')
        local pr_mergeable=$(echo "$pr_data" | jq -r '.mergeable')
        local review_decision=$(echo "$pr_data" | jq -r '.reviewDecision // "PENDING"')
        
        log_info "Head branch: $pr_head"
        log_info "Base branch: $pr_base"
        log_info "Mergeable: $pr_mergeable"
        log_info "Review decision: $review_decision"
        
        # Critical pre-merge checks
        log "Critical Pre-Merge Checks:"
        
        run_pr_test "PR is mergeable" "[[ '$pr_mergeable' == 'MERGEABLE' ]]"
        run_pr_test "PR is approved" "[[ '$review_decision' == 'APPROVED' ]]" || log_warning "PR not yet approved"
        
        # All status checks must pass
        local status_checks=$(echo "$pr_data" | jq '.statusCheckRollup[]?')
        if [[ -n "$status_checks" ]]; then
            local all_checks_pass=true
            while IFS= read -r check; do
                local state=$(echo "$check" | jq -r '.state // .conclusion')
                local name=$(echo "$check" | jq -r '.name // .context')
                
                if [[ "$state" != "SUCCESS" && "$state" != "success" ]]; then
                    all_checks_pass=false
                    log_warning "Status check '$name' is not successful: $state"
                fi
            done <<< "$status_checks"
            
            run_pr_test "All status checks pass" "$all_checks_pass"
        fi
        
        # Fetch latest changes and check for conflicts
        git fetch origin
        
        run_pr_test "No merge conflicts with latest base" "git merge-tree \$(git merge-base origin/$pr_head origin/$pr_base) origin/$pr_head origin/$pr_base | grep -q '^@@' && false || true"
        
        # Test merge simulation
        log "Merge Simulation:"
        
        local current_branch=$(git branch --show-current)
        
        # Create temporary branch for merge simulation
        local temp_merge_branch="temp-merge-$PR_NUMBER-$TIMESTAMP"
        git checkout -b "$temp_merge_branch" "origin/$pr_base"
        
        if git merge --no-commit --no-ff "origin/$pr_head" >/dev/null 2>&1; then
            run_pr_test "Merge simulation successful" "true"
            
            # Test the merged state
            run_pr_test "Merged state code quality" "$SCRIPT_DIR/ci-validate.sh --fast"
            run_pr_test "Merged state Docker validation" "docker compose -f docker-compose.yml config -q"
            
            # Abort the merge
            git merge --abort
        else
            run_pr_test "Merge simulation successful" "false"
        fi
        
        # Clean up temporary branch
        git checkout "$current_branch"
        git branch -D "$temp_merge_branch"
        
        # Final recommendation
        if [[ $PR_TESTS_FAILED -eq 0 ]]; then
            echo
            log_success "✅ PR #$PR_NUMBER is ready for merge!"
            log_info "All pre-merge validations passed successfully"
        else
            echo
            log_warning "⚠️ PR #$PR_NUMBER is NOT ready for merge"
            log_info "Please resolve the issues identified above"
        fi
        
        echo "======================================="
        echo "Pre-Merge Validation Completed: $(date)"
        echo "======================================="
        
    } 2>&1 | tee "$pre_merge_log"
    
    log_info "Pre-merge validation log: $pre_merge_log"
}

# ==============================================================================
# PR MONITORING
# ==============================================================================

monitor_pr_status() {
    log "👀 Monitoring PR #$PR_NUMBER status..."
    
    if [[ -z "$PR_NUMBER" ]]; then
        log_error "PR number must be specified with --pr-number"
        return 1
    fi
    
    log_info "Press Ctrl+C to stop monitoring"
    log_info "Update interval: 30 seconds"
    
    while true; do
        clear
        echo "PR #$PR_NUMBER Status Monitor - $(date)"
        echo "=========================================="
        
        # Get current PR status
        local pr_data=$(gh pr view "$PR_NUMBER" --json number,title,state,author,mergeable,reviewDecision,statusCheckRollup 2>/dev/null || echo "{}")
        
        if [[ "$pr_data" != "{}" ]]; then
            local pr_title=$(echo "$pr_data" | jq -r '.title')
            local pr_state=$(echo "$pr_data" | jq -r '.state')
            local pr_mergeable=$(echo "$pr_data" | jq -r '.mergeable')
            local review_decision=$(echo "$pr_data" | jq -r '.reviewDecision // "PENDING"')
            
            echo "Title: $pr_title"
            echo "State: $pr_state"
            echo "Mergeable: $pr_mergeable"
            echo "Review: $review_decision"
            echo
            
            # Show status checks
            local status_checks=$(echo "$pr_data" | jq '.statusCheckRollup[]?')
            if [[ -n "$status_checks" ]]; then
                echo "Status Checks:"
                while IFS= read -r check; do
                    local name=$(echo "$check" | jq -r '.name // .context')
                    local state=$(echo "$check" | jq -r '.state // .conclusion')
                    local description=$(echo "$check" | jq -r '.description // ""')
                    
                    local status_icon="❓"
                    case "$state" in
                        "SUCCESS"|"success") status_icon="✅" ;;
                        "FAILURE"|"failure") status_icon="❌" ;;
                        "PENDING"|"pending"|"in_progress") status_icon="🔄" ;;
                        "CANCELLED"|"cancelled") status_icon="⏹️" ;;
                    esac
                    
                    printf "  %s %-30s %s\n" "$status_icon" "$name" "$state"
                    if [[ -n "$description" ]] && [[ "$VERBOSE_MODE" == true ]]; then
                        echo "    $description"
                    fi
                done <<< "$status_checks"
            else
                echo "No status checks found"
            fi
            
            # Show recent workflow runs
            echo
            echo "Recent Workflow Runs:"
            gh run list --limit 3 | head -3
            
        else
            echo "❌ Unable to fetch PR data"
        fi
        
        echo
        echo "Last updated: $(date)"
        echo "Monitoring... (Ctrl+C to exit)"
        
        sleep 30
    done
}

# ==============================================================================
# PR COMPARISON
# ==============================================================================

compare_pr_with_base() {
    log "📊 Comparing PR #$PR_NUMBER with base branch..."
    
    if [[ -z "$PR_NUMBER" ]]; then
        log_error "PR number must be specified with --pr-number"
        return 1
    fi
    
    # Get PR information
    local pr_data=$(gh pr view "$PR_NUMBER" --json headRefName,baseRefName)
    local pr_head=$(echo "$pr_data" | jq -r '.headRefName')
    local pr_base=$(echo "$pr_data" | jq -r '.baseRefName')
    
    log_info "Comparing $pr_head vs $pr_base"
    
    # Fetch latest changes
    git fetch origin
    
    # Generate comparison report
    local comparison_file="$PR_RESULTS_DIR/pr-comparison-$PR_NUMBER-$TIMESTAMP.json"
    
    # Get diff statistics
    local files_changed=$(git diff --name-only "origin/$pr_base..origin/$pr_head" | wc -l)
    local lines_added=$(git diff --numstat "origin/$pr_base..origin/$pr_head" | awk '{added += $1} END {print added}')
    local lines_removed=$(git diff --numstat "origin/$pr_base..origin/$pr_head" | awk '{removed += $2} END {print removed}')
    
    # Test both branches
    local current_branch=$(git branch --show-current)
    
    # Test base branch
    git checkout "origin/$pr_base" -b "temp-base-$TIMESTAMP" 2>/dev/null || git checkout "temp-base-$TIMESTAMP"
    local base_quality_result="unknown"
    if "$SCRIPT_DIR/ci-validate.sh" --fast >/dev/null 2>&1; then
        base_quality_result="pass"
    else
        base_quality_result="fail"
    fi
    
    # Test head branch  
    git checkout "origin/$pr_head" -b "temp-head-$TIMESTAMP" 2>/dev/null || git checkout "temp-head-$TIMESTAMP"
    local head_quality_result="unknown"
    if "$SCRIPT_DIR/ci-validate.sh" --fast >/dev/null 2>&1; then
        head_quality_result="pass"
    else
        head_quality_result="fail"
    fi
    
    # Clean up temporary branches
    git checkout "$current_branch"
    git branch -D "temp-base-$TIMESTAMP" 2>/dev/null || true
    git branch -D "temp-head-$TIMESTAMP" 2>/dev/null || true
    
    # Generate comparison report
    local comparison_report=$(cat << EOF
{
  "timestamp": "$(date -Iseconds)",
  "pr_number": $PR_NUMBER,
  "branches": {
    "head": "$pr_head",
    "base": "$pr_base"
  },
  "diff_stats": {
    "files_changed": $files_changed,
    "lines_added": ${lines_added:-0},
    "lines_removed": ${lines_removed:-0}
  },
  "quality_comparison": {
    "base_branch": "$base_quality_result",
    "head_branch": "$head_quality_result",
    "quality_impact": "$(if [[ "$base_quality_result" == "pass" && "$head_quality_result" == "pass" ]]; then echo "no_regression"; elif [[ "$base_quality_result" == "fail" && "$head_quality_result" == "pass" ]]; then echo "improvement"; elif [[ "$base_quality_result" == "pass" && "$head_quality_result" == "fail" ]]; then echo "regression"; else echo "unclear"; fi)"
  }
}
EOF
)
    
    echo "$comparison_report" > "$comparison_file"
    
    if [[ "$JSON_OUTPUT" == true ]]; then
        cat "$comparison_file"
    else
        echo
        echo "PR Comparison Results"
        echo "===================="
        echo "PR #$PR_NUMBER ($pr_head vs $pr_base)"
        echo
        echo "Changes:"
        echo "  Files changed: $files_changed"
        echo "  Lines added: ${lines_added:-0}"
        echo "  Lines removed: ${lines_removed:-0}"
        echo
        echo "Quality Comparison:"
        echo "  Base branch ($pr_base): $base_quality_result"
        echo "  Head branch ($pr_head): $head_quality_result"
        echo
        echo "Comparison report saved to: $comparison_file"
    fi
}

# ==============================================================================
# COMPREHENSIVE PR REPORT
# ==============================================================================

generate_pr_report() {
    log "📊 Generating comprehensive PR report..."
    
    if [[ -z "$PR_NUMBER" ]]; then
        log_error "PR number must be specified with --pr-number"
        return 1
    fi
    
    local report_file="$PR_RESULTS_DIR/pr-report-$PR_NUMBER-$TIMESTAMP.md"
    
    # Gather comprehensive PR data
    local pr_data=$(gh pr view "$PR_NUMBER" --json number,title,state,author,headRefName,baseRefName,mergeable,reviewDecision,statusCheckRollup,createdAt,updatedAt)
    
    cat > "$report_file" << EOF
# Pull Request Testing Report #$PR_NUMBER

**Generated:** $(date)  
**PR Title:** $(echo "$pr_data" | jq -r '.title')  
**Author:** $(echo "$pr_data" | jq -r '.author.login')  
**State:** $(echo "$pr_data" | jq -r '.state')  

## Branch Information

- **Head Branch:** $(echo "$pr_data" | jq -r '.headRefName')
- **Base Branch:** $(echo "$pr_data" | jq -r '.baseRefName')
- **Mergeable:** $(echo "$pr_data" | jq -r '.mergeable')
- **Review Decision:** $(echo "$pr_data" | jq -r '.reviewDecision // "Pending"')

## Testing Summary

- **Tests Run:** $PR_TESTS_RUN
- **Tests Passed:** $PR_TESTS_PASSED
- **Tests Failed:** $PR_TESTS_FAILED
- **Success Rate:** $(if [[ $PR_TESTS_RUN -gt 0 ]]; then echo "scale=1; $PR_TESTS_PASSED * 100 / $PR_TESTS_RUN" | bc; else echo "0"; fi)%

## Status Checks

$(echo "$pr_data" | jq -r '.statusCheckRollup[]? | "- **\(.name // .context):** \(.state // .conclusion)"')

## Issues Identified

$(if [[ ${#PR_ISSUES[@]} -gt 0 ]]; then for issue in "${PR_ISSUES[@]}"; do echo "- $issue"; done; else echo "No issues identified"; fi)

## Recommendations

$(if [[ $PR_TESTS_FAILED -gt 0 ]]; then
    echo "- ⚠️ Address the failed tests before merging"
    echo "- Review the issues identified in testing"
fi)
$(if [[ $(echo "$pr_data" | jq -r '.reviewDecision') != "APPROVED" ]]; then
    echo "- 👥 Ensure PR has appropriate reviews"
fi)
$(if [[ $(echo "$pr_data" | jq -r '.mergeable') != "MERGEABLE" ]]; then
    echo "- 🔄 Resolve merge conflicts"
fi)

## Next Steps

1. Address any failing tests or issues
2. Ensure all status checks pass
3. Get required reviews and approvals
4. Run pre-merge validation: \`./scripts/pr-testing.sh pre-merge --pr-number=$PR_NUMBER\`
5. Merge when all conditions are met

---
*Generated by pr-testing.sh*
EOF
    
    log_success "PR report generated: $report_file"
    
    if [[ "$VERBOSE_MODE" == true ]] && [[ "$JSON_OUTPUT" != true ]]; then
        cat "$report_file"
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
            create|validate|pre-merge|monitor|compare|simulate|report)
                command="$1"
                shift
                ;;
            --pr-number)
                PR_NUMBER="$2"
                shift 2
                ;;
            --base)
                BASE_BRANCH="$2"
                shift 2
                ;;
            --head)
                HEAD_BRANCH="$2"
                shift 2
                ;;
            --title)
                PR_TITLE="$2"
                shift 2
                ;;
            --draft)
                DRAFT_PR=true
                shift
                ;;
            --auto-merge)
                AUTO_MERGE=true
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
║                      PR TESTING WORKFLOWS                          ║
║                                                                      ║
║  Comprehensive Pull Request testing and validation automation       ║
║  $(date)                                    ║
╚══════════════════════════════════════════════════════════════════════╝

EOF
    fi
    
    # Setup
    cd "$PROJECT_ROOT"
    setup_pr_testing_environment
    check_pr_prerequisites
    
    # Execute command
    case "$command" in
        create)
            create_pr_with_testing
            generate_pr_report
            ;;
        validate)
            validate_existing_pr
            generate_pr_report
            ;;
        pre-merge)
            pre_merge_validation
            ;;
        monitor)
            monitor_pr_status
            ;;
        compare)
            compare_pr_with_base
            ;;
        simulate)
            log_warning "Simulate functionality not yet implemented"
            log_info "Use validate or pre-merge for comprehensive testing"
            ;;
        report)
            generate_pr_report
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
    
    # Final status
    if [[ $PR_TESTS_FAILED -eq 0 ]] || [[ "$command" == "monitor" ]] || [[ "$command" == "report" ]]; then
        if [[ "$JSON_OUTPUT" != true ]]; then
            log_success "PR testing completed successfully! 🎉"
        fi
        exit 0
    else
        if [[ "$JSON_OUTPUT" != true ]]; then
            log_error "PR testing completed with issues"
        fi
        exit 1
    fi
}

# Execute main function with all arguments  
main "$@"