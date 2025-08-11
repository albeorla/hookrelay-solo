#!/bin/bash

# ==============================================================================
# GitHub Actions Integration Script
# ==============================================================================
# This script provides comprehensive GitHub Actions integration for CI testing,
# including PR automation, status checks, issue management, and deployment
# workflows through the GitHub CLI.
#
# Usage:
#   ./scripts/gh-actions.sh [command] [options]
#
# Commands:
#   pr            Pull request operations
#   status        Check status checks and CI
#   deploy        Deployment management
#   issues        Issue and bug tracking
#   releases      Release management
#   notifications Setup and manage notifications
#   secrets       Manage repository secrets
#   environments  Manage deployment environments
#   webhooks      Webhook management
#   metrics       Repository and CI metrics
#
# Options:
#   --pr-number   Specific PR number
#   --branch      Branch name
#   --environment Environment name
#   --verbose     Enable verbose logging
#   --json        Output in JSON format
#   --help        Show this help message
#
# Examples:
#   ./scripts/gh-actions.sh pr create --branch=feature/new-feature
#   ./scripts/gh-actions.sh status --pr-number=123
#   ./scripts/gh-actions.sh deploy --environment=staging
#   ./scripts/gh-actions.sh metrics --verbose
# ==============================================================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
LOGS_DIR="$PROJECT_ROOT/gh-actions-logs"

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
BRANCH_NAME=""
ENVIRONMENT=""
VERBOSE_MODE=false
JSON_OUTPUT=false

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

log_verbose() {
    if [[ "$VERBOSE_MODE" == true ]]; then
        echo -e "${PURPLE}[$(date '+%H:%M:%S')] 🔍 $*${NC}"
    fi
}

show_help() {
    cat << EOF
GitHub Actions Integration Script

USAGE:
    ./scripts/gh-actions.sh [COMMAND] [OPTIONS]

COMMANDS:
    pr            Pull request operations (create, merge, status, review)
    status        Check CI status, status checks, and overall health
    deploy        Deployment management and environment operations
    issues        Issue and bug tracking automation
    releases      Release management and changelog generation
    notifications Setup and manage GitHub notifications
    secrets       Manage repository secrets and variables
    environments  Manage deployment environments and protection rules
    webhooks      Webhook management for external integrations
    metrics       Repository metrics, CI performance, and analytics

OPTIONS:
    --pr-number   Specific PR number to operate on
    --branch      Branch name (default: current branch)
    --environment Environment name for deployments
    --verbose     Enable verbose logging and detailed output
    --json        Output results in JSON format
    --help        Show this comprehensive help message

EXAMPLES:
    # Pull Request Operations
    ./scripts/gh-actions.sh pr create --branch=feature/new-feature
    ./scripts/gh-actions.sh pr merge --pr-number=123
    ./scripts/gh-actions.sh pr status --pr-number=123 --verbose
    
    # CI Status and Health Checks
    ./scripts/gh-actions.sh status --branch=main
    ./scripts/gh-actions.sh status --pr-number=123
    
    # Deployment Management
    ./scripts/gh-actions.sh deploy --environment=staging
    ./scripts/gh-actions.sh deploy --environment=production --verbose
    
    # Repository Analytics
    ./scripts/gh-actions.sh metrics --json
    ./scripts/gh-actions.sh metrics --verbose

INTEGRATION FEATURES:
    - Automated PR creation and management
    - CI status monitoring and reporting
    - Deployment pipeline automation
    - Issue tracking and bug triage
    - Release automation with changelog
    - Notification management
    - Security and secrets management
    - Performance metrics and analytics

WORKFLOW INTEGRATION:
    - Integrates with all GitHub Actions workflows
    - Supports parallel CI execution monitoring
    - Automated status reporting to PRs
    - Environment-specific deployment controls
    - Comprehensive audit logging
EOF
}

setup_logging() {
    mkdir -p "$LOGS_DIR"
    
    # Set up log file for this session
    local log_file="$LOGS_DIR/gh-actions-$TIMESTAMP.log"
    
    if [[ "$VERBOSE_MODE" == true ]]; then
        log_verbose "Logging to: $log_file"
        # Enable command logging for verbose mode
        exec 19> "$log_file"
        BASH_XTRACEFD=19
        set -x
    fi
}

check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if gh CLI is installed and authenticated
    if ! command -v gh >/dev/null 2>&1; then
        log_error "GitHub CLI (gh) is not installed"
        log_info "Install with: brew install gh"
        exit 1
    fi
    
    if ! gh auth status >/dev/null 2>&1; then
        log_error "GitHub CLI not authenticated"
        log_info "Authenticate with: gh auth login"
        exit 1
    fi
    
    # Check if in a git repository
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
        log_error "Not in a Git repository"
        exit 1
    fi
    
    # Get current branch if not specified
    if [[ -z "$BRANCH_NAME" ]]; then
        BRANCH_NAME=$(git branch --show-current)
        log_verbose "Using current branch: $BRANCH_NAME"
    fi
    
    log_success "Prerequisites check passed"
}

# ==============================================================================
# PULL REQUEST OPERATIONS
# ==============================================================================

pr_operations() {
    local operation="${1:-status}"
    
    case "$operation" in
        create)
            create_pull_request
            ;;
        merge)
            merge_pull_request
            ;;
        status)
            show_pr_status
            ;;
        review)
            request_pr_review
            ;;
        list)
            list_pull_requests
            ;;
        *)
            log_error "Unknown PR operation: $operation"
            log_info "Available operations: create, merge, status, review, list"
            return 1
            ;;
    esac
}

create_pull_request() {
    log "🔀 Creating pull request..."
    
    # Check if there are changes to commit
    if ! git diff --quiet HEAD; then
        log_warning "You have uncommitted changes"
        read -p "Do you want to commit them first? [y/N] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git add .
            git commit -m "WIP: Changes for PR creation"
            log_success "Changes committed"
        fi
    fi
    
    # Push current branch
    if ! git push origin "$BRANCH_NAME" 2>/dev/null; then
        log_info "Branch not pushed yet, pushing now..."
        git push --set-upstream origin "$BRANCH_NAME"
    fi
    
    # Generate PR title and body
    local pr_title="feat: $(echo "$BRANCH_NAME" | sed 's/^[^/]*\///' | sed 's/-/ /g')"
    local pr_body=$(cat << EOF
## Summary
Brief description of changes made in this PR.

## Changes Made
- [ ] Feature implementation
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] CI/CD pipeline verified

## Test Plan
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed

## Performance Impact
- [ ] No performance impact
- [ ] Performance improved
- [ ] Performance impact documented

## Security Considerations
- [ ] No security implications
- [ ] Security review completed
- [ ] Secrets properly managed

## Deployment Notes
- [ ] No deployment changes required
- [ ] Database migrations included
- [ ] Environment variables updated
- [ ] Configuration changes documented

---
*Auto-generated by gh-actions.sh*
EOF
)
    
    if gh pr create --title "$pr_title" --body "$pr_body" --base main --head "$BRANCH_NAME"; then
        log_success "Pull request created successfully"
        
        # Get PR number and show details
        local pr_number=$(gh pr list --head "$BRANCH_NAME" --json number --jq '.[0].number')
        log_info "PR Number: #$pr_number"
        
        # Automatically request reviews (if configured)
        if [[ -f ".github/CODEOWNERS" ]]; then
            log_info "Requesting reviews from code owners..."
            gh pr edit "$pr_number" --add-reviewer "@albeorla" 2>/dev/null || true
        fi
        
        # Add labels based on branch name
        local labels=""
        case "$BRANCH_NAME" in
            feature/*) labels="enhancement" ;;
            fix/*|bugfix/*) labels="bug" ;;
            docs/*) labels="documentation" ;;
            refactor/*) labels="refactor" ;;
            test/*) labels="testing" ;;
        esac
        
        if [[ -n "$labels" ]]; then
            gh pr edit "$pr_number" --add-label "$labels" 2>/dev/null || true
            log_info "Labels added: $labels"
        fi
        
    else
        log_error "Failed to create pull request"
        return 1
    fi
}

show_pr_status() {
    if [[ -n "$PR_NUMBER" ]]; then
        log "📊 Showing PR #$PR_NUMBER status..."
        
        if [[ "$JSON_OUTPUT" == true ]]; then
            gh pr view "$PR_NUMBER" --json number,title,state,author,assignees,reviewDecision,statusCheckRollup,mergeable
        else
            gh pr view "$PR_NUMBER"
            
            echo
            log "🔍 Detailed CI Status:"
            
            # Get status checks
            local status_checks=$(gh pr view "$PR_NUMBER" --json statusCheckRollup --jq '.statusCheckRollup[]')
            
            if [[ -n "$status_checks" ]]; then
                echo "$status_checks" | while IFS= read -r check; do
                    local context=$(echo "$check" | jq -r '.context // .name')
                    local state=$(echo "$check" | jq -r '.state // .conclusion')
                    local description=$(echo "$check" | jq -r '.description // ""')
                    
                    local status_icon="❓"
                    case "$state" in
                        "SUCCESS"|"success") status_icon="✅" ;;
                        "FAILURE"|"failure") status_icon="❌" ;;
                        "PENDING"|"pending") status_icon="🔄" ;;
                        "ERROR"|"error") status_icon="💥" ;;
                    esac
                    
                    printf "  %s %-30s %s\n" "$status_icon" "$context" "$description"
                done
            else
                log_info "No status checks found"
            fi
        fi
        
    else
        log "📋 Showing all open PRs..."
        
        if [[ "$JSON_OUTPUT" == true ]]; then
            gh pr list --json number,title,author,headRefName,createdAt,statusCheckRollup
        else
            gh pr list --limit 10
            
            if [[ "$VERBOSE_MODE" == true ]]; then
                echo
                log "🔍 PR Health Summary:"
                
                local total_prs=$(gh pr list --json number --jq 'length')
                local draft_prs=$(gh pr list --json isDraft --jq '[.[] | select(.isDraft)] | length')
                local ready_prs=$((total_prs - draft_prs))
                
                echo "  Total PRs: $total_prs"
                echo "  Ready for review: $ready_prs"
                echo "  Draft PRs: $draft_prs"
            fi
        fi
    fi
}

merge_pull_request() {
    if [[ -z "$PR_NUMBER" ]]; then
        log_error "PR number must be specified with --pr-number"
        return 1
    fi
    
    log "🔀 Merging PR #$PR_NUMBER..."
    
    # Check PR status first
    local pr_state=$(gh pr view "$PR_NUMBER" --json state --jq '.state')
    local mergeable=$(gh pr view "$PR_NUMBER" --json mergeable --jq '.mergeable')
    
    if [[ "$pr_state" != "OPEN" ]]; then
        log_error "PR #$PR_NUMBER is not open (current state: $pr_state)"
        return 1
    fi
    
    if [[ "$mergeable" == "CONFLICTING" ]]; then
        log_error "PR #$PR_NUMBER has merge conflicts"
        log_info "Resolve conflicts first with: gh pr checkout $PR_NUMBER"
        return 1
    fi
    
    # Check status checks
    local failed_checks=$(gh pr view "$PR_NUMBER" --json statusCheckRollup --jq '[.statusCheckRollup[] | select(.state == "FAILURE" or .conclusion == "failure")] | length')
    
    if [[ $failed_checks -gt 0 ]]; then
        log_warning "PR #$PR_NUMBER has $failed_checks failed status checks"
        read -p "Merge anyway? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Merge cancelled"
            return 1
        fi
    fi
    
    # Perform merge
    local merge_method="merge"  # Can be: merge, squash, rebase
    
    if gh pr merge "$PR_NUMBER" --"$merge_method" --delete-branch; then
        log_success "PR #$PR_NUMBER merged successfully"
        log_info "Branch deleted automatically"
        
        # Post-merge actions
        if [[ "$VERBOSE_MODE" == true ]]; then
            log "📊 Post-merge status:"
            git fetch origin
            git checkout main
            git pull origin main
            log_success "Local main branch updated"
        fi
    else
        log_error "Failed to merge PR #$PR_NUMBER"
        return 1
    fi
}

list_pull_requests() {
    log "📋 Listing pull requests..."
    
    if [[ "$JSON_OUTPUT" == true ]]; then
        gh pr list --json number,title,author,headRefName,state,createdAt,updatedAt
    else
        echo
        echo "Open Pull Requests"
        echo "=================="
        gh pr list --limit 20
        
        if [[ "$VERBOSE_MODE" == true ]]; then
            echo
            echo "Recent Closed PRs"
            echo "================="
            gh pr list --state closed --limit 5
        fi
    fi
}

# ==============================================================================
# CI STATUS AND HEALTH MONITORING
# ==============================================================================

check_ci_status() {
    log "🔍 Checking CI status..."
    
    if [[ -n "$PR_NUMBER" ]]; then
        # Check specific PR status
        log_info "Checking PR #$PR_NUMBER CI status"
        
        local pr_data=$(gh pr view "$PR_NUMBER" --json statusCheckRollup,mergeable,reviewDecision)
        local mergeable=$(echo "$pr_data" | jq -r '.mergeable')
        local review_decision=$(echo "$pr_data" | jq -r '.reviewDecision')
        
        echo
        echo "PR Health Check"
        echo "==============="
        echo "Mergeable: $mergeable"
        echo "Review Decision: ${review_decision:-"Pending"}"
        
        # Status checks details
        local status_checks=$(echo "$pr_data" | jq -c '.statusCheckRollup[]?')
        
        if [[ -n "$status_checks" ]]; then
            echo
            echo "Status Checks:"
            echo "$status_checks" | while IFS= read -r check; do
                local name=$(echo "$check" | jq -r '.name // .context')
                local state=$(echo "$check" | jq -r '.conclusion // .state')
                local started=$(echo "$check" | jq -r '.startedAt // ""')
                local completed=$(echo "$check" | jq -r '.completedAt // ""')
                
                local status_icon="❓"
                case "$state" in
                    "SUCCESS"|"success") status_icon="✅" ;;
                    "FAILURE"|"failure") status_icon="❌" ;;
                    "PENDING"|"pending"|"in_progress") status_icon="🔄" ;;
                    "CANCELLED"|"cancelled") status_icon="⏹️" ;;
                esac
                
                printf "  %s %-40s %s\n" "$status_icon" "$name" "$state"
                
                if [[ "$VERBOSE_MODE" == true ]] && [[ -n "$started" ]]; then
                    echo "    Started: $started"
                    [[ -n "$completed" ]] && echo "    Completed: $completed"
                fi
            done
        else
            echo "  No status checks found"
        fi
        
    else
        # Check overall repository CI health
        log_info "Checking overall CI health for branch: $BRANCH_NAME"
        
        # Get recent workflow runs
        local recent_runs=$(gh run list --branch "$BRANCH_NAME" --limit 10 --json status,conclusion,workflowName,createdAt)
        local total_runs=$(echo "$recent_runs" | jq 'length')
        local successful_runs=$(echo "$recent_runs" | jq '[.[] | select(.conclusion == "success")] | length')
        local failed_runs=$(echo "$recent_runs" | jq '[.[] | select(.conclusion == "failure")] | length')
        local in_progress=$(echo "$recent_runs" | jq '[.[] | select(.status == "in_progress")] | length')
        
        echo
        echo "CI Health Summary (Last 10 runs on $BRANCH_NAME)"
        echo "================================================"
        echo "Total runs: $total_runs"
        echo "Successful: $successful_runs"
        echo "Failed: $failed_runs"
        echo "In progress: $in_progress"
        
        if [[ $total_runs -gt 0 ]]; then
            local success_rate=$(( (successful_runs * 100) / total_runs ))
            echo "Success rate: ${success_rate}%"
            
            if [[ $success_rate -lt 80 ]]; then
                log_warning "Low success rate detected"
            else
                log_success "Good CI health"
            fi
        fi
        
        # Show currently running workflows
        if [[ $in_progress -gt 0 ]]; then
            echo
            echo "Currently Running:"
            echo "$recent_runs" | jq -r '.[] | select(.status == "in_progress") | "  🔄 \(.workflowName)"'
        fi
        
        # Show recent failures
        if [[ $failed_runs -gt 0 ]] && [[ "$VERBOSE_MODE" == true ]]; then
            echo
            echo "Recent Failures:"
            echo "$recent_runs" | jq -r '.[] | select(.conclusion == "failure") | "  ❌ \(.workflowName) (\(.createdAt | split("T")[0]))"'
        fi
    fi
}

# ==============================================================================
# DEPLOYMENT MANAGEMENT
# ==============================================================================

manage_deployment() {
    local action="${1:-status}"
    
    case "$action" in
        status)
            show_deployment_status
            ;;
        trigger)
            trigger_deployment
            ;;
        history)
            show_deployment_history
            ;;
        environments)
            list_environments
            ;;
        *)
            log_error "Unknown deployment action: $action"
            log_info "Available actions: status, trigger, history, environments"
            return 1
            ;;
    esac
}

show_deployment_status() {
    log "🚀 Checking deployment status..."
    
    if [[ -n "$ENVIRONMENT" ]]; then
        log_info "Environment: $ENVIRONMENT"
        
        # Get deployments for specific environment
        local deployments=$(gh api repos/:owner/:repo/deployments --jq ".[] | select(.environment == \"$ENVIRONMENT\") | {id, sha, ref, environment, created_at}" | head -5)
        
        if [[ -n "$deployments" ]]; then
            echo
            echo "Recent Deployments to $ENVIRONMENT:"
            echo "$deployments" | jq -r '"  \(.id): \(.ref) (\(.created_at | split("T")[0]))"'
        else
            log_info "No deployments found for environment: $ENVIRONMENT"
        fi
    else
        # Show all recent deployments
        local all_deployments=$(gh api repos/:owner/:repo/deployments --jq '.[] | {id, sha, ref, environment, created_at}' | head -10)
        
        if [[ -n "$all_deployments" ]]; then
            echo
            echo "Recent Deployments (All Environments):"
            echo "$all_deployments" | jq -r '"  \(.environment): \(.ref) (\(.created_at | split("T")[0]))"'
        else
            log_info "No deployments found"
        fi
    fi
}

trigger_deployment() {
    if [[ -z "$ENVIRONMENT" ]]; then
        log_error "Environment must be specified with --environment"
        return 1
    fi
    
    log "🚀 Triggering deployment to $ENVIRONMENT..."
    
    # Check if deployment workflow exists
    local deploy_workflow=""
    if [[ -f ".github/workflows/deploy.yml" ]]; then
        deploy_workflow="deploy.yml"
    elif [[ -f ".github/workflows/cd.yml" ]]; then
        deploy_workflow="cd.yml"
    else
        log_warning "No deployment workflow found"
        log_info "Looking for workflow with 'deploy' in the name..."
        deploy_workflow=$(gh workflow list --json name,path | jq -r '.[] | select(.name | contains("deploy") or contains("Deploy")) | .path | split("/")[-1]' | head -1)
    fi
    
    if [[ -n "$deploy_workflow" ]]; then
        log_info "Using workflow: $deploy_workflow"
        
        # Trigger deployment
        if gh workflow run "$deploy_workflow" --ref "$BRANCH_NAME" --field environment="$ENVIRONMENT"; then
            log_success "Deployment triggered for $ENVIRONMENT"
            
            # Monitor deployment
            sleep 5
            log_info "Recent workflow runs:"
            gh run list --workflow="$deploy_workflow" --limit 3
        else
            log_error "Failed to trigger deployment"
            return 1
        fi
    else
        log_error "No suitable deployment workflow found"
        log_info "Available workflows:"
        gh workflow list
        return 1
    fi
}

# ==============================================================================
# REPOSITORY METRICS AND ANALYTICS
# ==============================================================================

show_metrics() {
    log "📊 Generating repository metrics..."
    
    if [[ "$JSON_OUTPUT" == true ]]; then
        local metrics=$(cat << EOF
{
  "timestamp": "$(date -Iseconds)",
  "repository": "$(gh repo view --json nameWithOwner --jq '.nameWithOwner')",
  "branch": "$BRANCH_NAME",
  "workflows": $(gh workflow list --json name,id,state),
  "recent_runs": $(gh run list --limit 20 --json id,status,conclusion,workflowName,createdAt),
  "pull_requests": $(gh pr list --json number,title,state,author,createdAt),
  "issues": $(gh issue list --limit 10 --json number,title,state,author,createdAt)
}
EOF
)
        echo "$metrics" | jq '.'
    else
        echo
        echo "Repository Metrics Dashboard"
        echo "==========================="
        echo "Repository: $(gh repo view --json nameWithOwner --jq '.nameWithOwner')"
        echo "Current Branch: $BRANCH_NAME"
        echo "Generated: $(date)"
        
        # Workflow metrics
        echo
        echo "🔄 Workflow Health:"
        local total_workflows=$(gh workflow list --json id | jq 'length')
        local active_workflows=$(gh workflow list --json state | jq '[.[] | select(.state == "active")] | length')
        echo "  Total workflows: $total_workflows"
        echo "  Active workflows: $active_workflows"
        
        # CI performance metrics
        echo
        echo "📈 CI Performance (Last 20 runs):"
        local runs_data=$(gh run list --limit 20 --json status,conclusion,workflowName,createdAt)
        local total_runs=$(echo "$runs_data" | jq 'length')
        local successful_runs=$(echo "$runs_data" | jq '[.[] | select(.conclusion == "success")] | length')
        local failed_runs=$(echo "$runs_data" | jq '[.[] | select(.conclusion == "failure")] | length')
        
        echo "  Total runs: $total_runs"
        echo "  Success rate: $(( (successful_runs * 100) / total_runs ))%"
        echo "  Failed runs: $failed_runs"
        
        # PR metrics
        echo
        echo "🔀 Pull Request Activity:"
        local open_prs=$(gh pr list --json number | jq 'length')
        local total_prs=$(gh pr list --state all --limit 100 --json number | jq 'length')
        echo "  Open PRs: $open_prs"
        echo "  Total PRs (last 100): $total_prs"
        
        # Issue metrics
        echo
        echo "🐛 Issue Tracking:"
        local open_issues=$(gh issue list --json number | jq 'length')
        echo "  Open issues: $open_issues"
        
        if [[ "$VERBOSE_MODE" == true ]]; then
            echo
            echo "🏆 Top Performing Workflows:"
            echo "$runs_data" | jq -r '[.[] | select(.conclusion == "success")] | group_by(.workflowName) | map({workflow: .[0].workflowName, count: length}) | sort_by(.count) | reverse | .[:5][] | "  \(.workflow): \(.count) successes"'
            
            echo
            echo "⚠️ Workflows Needing Attention:"
            echo "$runs_data" | jq -r '[.[] | select(.conclusion == "failure")] | group_by(.workflowName) | map({workflow: .[0].workflowName, count: length}) | sort_by(.count) | reverse | .[:3][] | "  \(.workflow): \(.count) failures"'
        fi
    fi
}

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================

main() {
    local command=""
    local subcommand=""
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            pr|status|deploy|issues|releases|notifications|secrets|environments|webhooks|metrics)
                command="$1"
                shift
                # Check for subcommand
                if [[ $# -gt 0 ]] && [[ ! "$1" =~ ^-- ]]; then
                    subcommand="$1"
                    shift
                fi
                ;;
            --pr-number)
                PR_NUMBER="$2"
                shift 2
                ;;
            --branch)
                BRANCH_NAME="$2"
                shift 2
                ;;
            --environment)
                ENVIRONMENT="$2"
                shift 2
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
        command="status"
    fi
    
    # Print header (unless JSON output)
    if [[ "$JSON_OUTPUT" != true ]]; then
        cat << EOF

╔══════════════════════════════════════════════════════════════════════╗
║                    GITHUB ACTIONS INTEGRATION                       ║
║                                                                      ║
║  Comprehensive GitHub Actions automation and management             ║
║  $(date)                                    ║
╚══════════════════════════════════════════════════════════════════════╝

EOF
    fi
    
    # Setup
    cd "$PROJECT_ROOT"
    setup_logging
    check_prerequisites
    
    # Execute command
    case "$command" in
        pr)
            pr_operations "$subcommand"
            ;;
        status)
            check_ci_status
            ;;
        deploy)
            manage_deployment "$subcommand"
            ;;
        metrics)
            show_metrics
            ;;
        issues|releases|notifications|secrets|environments|webhooks)
            log_warning "Command '$command' not yet implemented"
            log_info "Available commands: pr, status, deploy, metrics"
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "$@"