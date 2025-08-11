#!/bin/bash

# ==============================================================================
# GitHub Workflows Management Script
# ==============================================================================
# This script provides comprehensive management of GitHub Actions workflows
# through the GitHub CLI, enabling monitoring, triggering, and analysis of
# CI/CD pipeline runs directly from the command line.
#
# Usage:
#   ./scripts/gh-workflows.sh [command] [options]
#
# Commands:
#   list          List all workflows
#   status        Show workflow run status
#   trigger       Trigger workflow manually
#   logs          View workflow logs
#   cancel        Cancel running workflows
#   rerun         Rerun failed workflows
#   watch         Watch workflow runs in real-time
#   analyze       Analyze workflow performance
#   compare       Compare workflow runs
#   summary       Generate workflow summary report
#
# Options:
#   --workflow    Specify workflow file name
#   --branch      Specify branch name
#   --limit       Limit number of results
#   --verbose     Enable verbose logging
#   --json        Output in JSON format
#   --help        Show this help message
#
# Examples:
#   ./scripts/gh-workflows.sh list
#   ./scripts/gh-workflows.sh status --workflow=ci.yml --limit=5
#   ./scripts/gh-workflows.sh trigger --workflow=ci.yml --branch=main
#   ./scripts/gh-workflows.sh watch --verbose
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
WORKFLOW_FILE=""
BRANCH_NAME=""
LIMIT=10
VERBOSE_MODE=false
JSON_OUTPUT=false
WATCH_INTERVAL=30

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
GitHub Workflows Management Script

USAGE:
    ./scripts/gh-workflows.sh [COMMAND] [OPTIONS]

COMMANDS:
    list          List all workflows and their status
    status        Show detailed workflow run status
    trigger       Trigger workflow manually
    logs          View and follow workflow logs
    cancel        Cancel running workflows
    rerun         Rerun failed workflows
    watch         Watch workflow runs in real-time
    analyze       Analyze workflow performance metrics
    compare       Compare workflow runs between branches/commits
    summary       Generate comprehensive workflow summary report

OPTIONS:
    --workflow    Specify workflow file name (e.g., ci.yml)
    --branch      Specify branch name (default: current branch)
    --limit       Limit number of results (default: 10)
    --verbose     Enable verbose logging
    --json        Output in JSON format
    --help        Show this help message

EXAMPLES:
    ./scripts/gh-workflows.sh list --verbose
    ./scripts/gh-workflows.sh status --workflow=ci.yml --limit=5
    ./scripts/gh-workflows.sh trigger --workflow=ci.yml --branch=main
    ./scripts/gh-workflows.sh logs --workflow=ci.yml
    ./scripts/gh-workflows.sh watch --verbose
    ./scripts/gh-workflows.sh analyze --workflow=ci.yml --limit=20
    ./scripts/gh-workflows.sh summary --json

WORKFLOW MONITORING:
    - Real-time status updates
    - Performance metrics analysis
    - Failed run identification
    - Resource usage tracking
    - Success rate calculations

INTEGRATION:
    - Works with all GitHub Actions workflows
    - Supports parallel workflow execution
    - Integrates with PR status checks
    - Compatible with workflow dispatch events
EOF
}

check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if gh CLI is installed
    if ! command -v gh >/dev/null 2>&1; then
        log_error "GitHub CLI (gh) is not installed. Please install it first."
        log_info "Install with: brew install gh"
        exit 1
    fi
    
    # Check if authenticated
    if ! gh auth status >/dev/null 2>&1; then
        log_error "GitHub CLI not authenticated. Please authenticate first."
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
# WORKFLOW LISTING AND STATUS
# ==============================================================================

list_workflows() {
    log "📋 Listing GitHub workflows..."
    
    if [[ "$JSON_OUTPUT" == true ]]; then
        gh workflow list --json name,id,state,created_at,updated_at
    else
        echo
        echo "GitHub Workflows"
        echo "================"
        
        gh workflow list --limit 50 | while IFS=$'\t' read -r name state id; do
            local status_icon="❓"
            case "$state" in
                "active")   status_icon="✅" ;;
                "disabled") status_icon="⏸️" ;;
                "deleted")  status_icon="❌" ;;
            esac
            
            printf "%-50s %s %s\n" "$name" "$status_icon" "$state"
        done
        
        echo
        log_info "Use --verbose for detailed information"
    fi
    
    if [[ "$VERBOSE_MODE" == true ]]; then
        echo
        log "📊 Workflow run statistics:"
        
        local total_runs=$(gh run list --limit 100 --json status | jq '[.[] | .status] | length')
        local successful_runs=$(gh run list --limit 100 --json status | jq '[.[] | select(.status == "completed")] | length')
        local failed_runs=$(gh run list --limit 100 --json status | jq '[.[] | select(.status == "failed")] | length')
        local in_progress=$(gh run list --limit 100 --json status | jq '[.[] | select(.status == "in_progress")] | length')
        
        echo "  Total runs (last 100): $total_runs"
        echo "  Successful: $successful_runs"
        echo "  Failed: $failed_runs"
        echo "  In progress: $in_progress"
        
        if [[ $total_runs -gt 0 ]]; then
            local success_rate=$(( (successful_runs * 100) / total_runs ))
            echo "  Success rate: ${success_rate}%"
        fi
    fi
}

show_workflow_status() {
    log "📊 Showing workflow status..."
    
    local workflow_filter=""
    if [[ -n "$WORKFLOW_FILE" ]]; then
        workflow_filter="--workflow=$WORKFLOW_FILE"
    fi
    
    if [[ "$JSON_OUTPUT" == true ]]; then
        gh run list $workflow_filter --limit "$LIMIT" --json id,status,conclusion,workflowName,headBranch,event,createdAt,updatedAt
    else
        echo
        echo "Recent Workflow Runs"
        echo "==================="
        
        gh run list $workflow_filter --limit "$LIMIT" | while IFS=$'\t' read -r status name number branch event id created; do
            local status_icon="❓"
            local status_color="$NC"
            
            case "$status" in
                "completed")
                    status_icon="✅"
                    status_color="$GREEN"
                    ;;
                "failed")
                    status_icon="❌" 
                    status_color="$RED"
                    ;;
                "in_progress")
                    status_icon="🔄"
                    status_color="$YELLOW"
                    ;;
                "queued")
                    status_icon="⏳"
                    status_color="$BLUE"
                    ;;
                "cancelled")
                    status_icon="⏹️"
                    status_color="$PURPLE"
                    ;;
            esac
            
            printf "${status_color}%-12s${NC} %-30s %s %-15s %-10s %s\n" \
                "$status_icon $status" "$name" "#$number" "$branch" "$event" "$created"
        done
        
        echo
        log_info "Use 'logs' command to view run details"
    fi
    
    if [[ "$VERBOSE_MODE" == true ]]; then
        echo
        log "🔍 Detailed analysis:"
        
        # Show failed runs with details
        local failed_runs=$(gh run list $workflow_filter --limit "$LIMIT" --json status,conclusion,workflowName,id | jq -r '.[] | select(.status == "completed" and .conclusion == "failure") | "\(.id) \(.workflowName)"')
        
        if [[ -n "$failed_runs" ]]; then
            echo
            log_warning "Recent failed runs:"
            echo "$failed_runs" | while read -r run_id workflow_name; do
                echo "  - $workflow_name (ID: $run_id)"
            done
        fi
        
        # Show in-progress runs
        local active_runs=$(gh run list $workflow_filter --limit "$LIMIT" --json status,workflowName,id | jq -r '.[] | select(.status == "in_progress") | "\(.id) \(.workflowName)"')
        
        if [[ -n "$active_runs" ]]; then
            echo
            log_info "Currently running:"
            echo "$active_runs" | while read -r run_id workflow_name; do
                echo "  - $workflow_name (ID: $run_id)"
            done
        fi
    fi
}

# ==============================================================================
# WORKFLOW TRIGGERING
# ==============================================================================

trigger_workflow() {
    if [[ -z "$WORKFLOW_FILE" ]]; then
        log_error "Workflow file must be specified with --workflow option"
        return 1
    fi
    
    log "🚀 Triggering workflow: $WORKFLOW_FILE"
    
    local dispatch_inputs=""
    if [[ -f ".github/workflows/$WORKFLOW_FILE" ]]; then
        # Check if workflow has dispatch inputs
        if grep -q "workflow_dispatch:" ".github/workflows/$WORKFLOW_FILE"; then
            log_verbose "Workflow supports manual dispatch"
            
            # Extract input definitions (basic parsing)
            local inputs=$(grep -A 20 "workflow_dispatch:" ".github/workflows/$WORKFLOW_FILE" | grep -E "^\s+\w+:" | head -5)
            if [[ -n "$inputs" ]]; then
                log_info "Available inputs:"
                echo "$inputs" | sed 's/^/  /'
                echo
                log_warning "Manual input configuration not implemented yet"
                log_info "Triggering with default values..."
            fi
        fi
    fi
    
    if gh workflow run "$WORKFLOW_FILE" --ref "$BRANCH_NAME"; then
        log_success "Workflow triggered successfully"
        log_info "Branch: $BRANCH_NAME"
        log_info "Workflow: $WORKFLOW_FILE"
        
        # Wait a moment and show the run
        sleep 3
        log "📊 Latest run status:"
        gh run list --workflow="$WORKFLOW_FILE" --limit 1
    else
        log_error "Failed to trigger workflow"
        return 1
    fi
}

# ==============================================================================
# WORKFLOW LOGS AND MONITORING
# ==============================================================================

view_workflow_logs() {
    log "📋 Viewing workflow logs..."
    
    local workflow_filter=""
    if [[ -n "$WORKFLOW_FILE" ]]; then
        workflow_filter="--workflow=$WORKFLOW_FILE"
    fi
    
    # Get the latest run ID
    local run_id=$(gh run list $workflow_filter --limit 1 --json id --jq '.[0].id')
    
    if [[ -z "$run_id" ]]; then
        log_error "No workflow runs found"
        return 1
    fi
    
    log_info "Showing logs for run ID: $run_id"
    
    if [[ "$VERBOSE_MODE" == true ]]; then
        # Show detailed logs with job breakdown
        gh run view "$run_id" --log
    else
        # Show concise logs
        gh run view "$run_id" --log --verbose=false
    fi
}

watch_workflows() {
    log "👀 Watching workflows in real-time..."
    log_info "Press Ctrl+C to stop watching"
    log_info "Update interval: ${WATCH_INTERVAL}s"
    
    local workflow_filter=""
    if [[ -n "$WORKFLOW_FILE" ]]; then
        workflow_filter="--workflow=$WORKFLOW_FILE"
    fi
    
    while true; do
        clear
        echo "GitHub Workflows Status - $(date)"
        echo "========================================"
        
        # Show in-progress runs
        local active_runs=$(gh run list $workflow_filter --limit 5 --json status,workflowName,id,createdAt | jq -r '.[] | select(.status == "in_progress" or .status == "queued") | "\(.status) \(.workflowName) \(.id) \(.createdAt)"')
        
        if [[ -n "$active_runs" ]]; then
            echo
            echo "🔄 Active Runs:"
            echo "$active_runs" | while read -r status name run_id created; do
                printf "  %-12s %-30s %s\n" "$status" "$name" "#$run_id"
            done
        else
            echo
            echo "✅ No active runs"
        fi
        
        # Show recent completed runs
        echo
        echo "📊 Recent Completed Runs:"
        gh run list $workflow_filter --limit 3 | head -3
        
        if [[ "$VERBOSE_MODE" == true ]]; then
            echo
            echo "💾 System Status:"
            echo "  Current time: $(date)"
            echo "  Watching: ${WORKFLOW_FILE:-"all workflows"}"
            echo "  Branch: $BRANCH_NAME"
        fi
        
        sleep "$WATCH_INTERVAL"
    done
}

# ==============================================================================
# WORKFLOW ANALYSIS
# ==============================================================================

analyze_workflows() {
    log "📊 Analyzing workflow performance..."
    
    local workflow_filter=""
    if [[ -n "$WORKFLOW_FILE" ]]; then
        workflow_filter="--workflow=$WORKFLOW_FILE"
    fi
    
    # Get workflow run data
    local runs_data=$(gh run list $workflow_filter --limit "$LIMIT" --json id,status,conclusion,workflowName,createdAt,updatedAt,runStartedAt)
    
    if [[ "$JSON_OUTPUT" == true ]]; then
        echo "$runs_data" | jq '.'
        return 0
    fi
    
    echo
    echo "Workflow Performance Analysis"
    echo "============================"
    
    # Calculate statistics
    local total_runs=$(echo "$runs_data" | jq 'length')
    local successful_runs=$(echo "$runs_data" | jq '[.[] | select(.conclusion == "success")] | length')
    local failed_runs=$(echo "$runs_data" | jq '[.[] | select(.conclusion == "failure")] | length')
    local cancelled_runs=$(echo "$runs_data" | jq '[.[] | select(.conclusion == "cancelled")] | length')
    
    echo
    echo "📈 Success Metrics (last $LIMIT runs):"
    echo "  Total runs: $total_runs"
    echo "  Successful: $successful_runs"
    echo "  Failed: $failed_runs"
    echo "  Cancelled: $cancelled_runs"
    
    if [[ $total_runs -gt 0 ]]; then
        local success_rate=$(( (successful_runs * 100) / total_runs ))
        local failure_rate=$(( (failed_runs * 100) / total_runs ))
        echo "  Success rate: ${success_rate}%"
        echo "  Failure rate: ${failure_rate}%"
    fi
    
    # Duration analysis (if timestamps available)
    echo
    echo "⏱️ Duration Analysis:"
    
    # Get completed runs with duration data
    local duration_data=$(echo "$runs_data" | jq -r '.[] | select(.status == "completed" and .runStartedAt != null and .updatedAt != null) | "\(.runStartedAt) \(.updatedAt)"' | head -10)
    
    if [[ -n "$duration_data" ]]; then
        local total_duration=0
        local run_count=0
        
        echo "$duration_data" | while read -r start_time end_time; do
            if command -v gdate >/dev/null 2>&1; then
                # macOS with GNU date
                local start_epoch=$(gdate -d "$start_time" +%s)
                local end_epoch=$(gdate -d "$end_time" +%s)
            elif date --version >/dev/null 2>&1; then
                # GNU date (Linux)
                local start_epoch=$(date -d "$start_time" +%s)
                local end_epoch=$(date -d "$end_time" +%s)
            else
                # BSD date (macOS default) - limited parsing
                log_verbose "Limited date parsing on this system"
                continue
            fi
            
            local duration=$((end_epoch - start_epoch))
            total_duration=$((total_duration + duration))
            run_count=$((run_count + 1))
            
            printf "  Run duration: %02d:%02d:%02d\n" $((duration/3600)) $(((duration%3600)/60)) $((duration%60))
        done
        
        if [[ $run_count -gt 0 ]]; then
            local avg_duration=$((total_duration / run_count))
            printf "  Average duration: %02d:%02d:%02d\n" $((avg_duration/3600)) $(((avg_duration%3600)/60)) $((avg_duration%60))
        fi
    else
        echo "  Duration data not available"
    fi
    
    # Failure analysis
    if [[ $failed_runs -gt 0 ]]; then
        echo
        echo "🔍 Failure Analysis:"
        echo "  Recent failures require investigation"
        log_info "Use 'logs' command to examine failed runs"
    fi
    
    # Trend analysis
    echo
    echo "📈 Trends (basic):"
    local recent_runs=$(echo "$runs_data" | jq '[.[0:5] | .[] | select(.conclusion == "success")] | length')
    local older_runs=$(echo "$runs_data" | jq '[.[5:10] | .[] | select(.conclusion == "success")] | length')
    
    if [[ $recent_runs -gt $older_runs ]]; then
        echo "  ✅ Success rate improving"
    elif [[ $recent_runs -lt $older_runs ]]; then
        echo "  ⚠️  Success rate declining"
    else
        echo "  📊 Success rate stable"
    fi
}

# ==============================================================================
# WORKFLOW MANAGEMENT ACTIONS
# ==============================================================================

cancel_workflows() {
    log "⏹️  Cancelling running workflows..."
    
    local workflow_filter=""
    if [[ -n "$WORKFLOW_FILE" ]]; then
        workflow_filter="--workflow=$WORKFLOW_FILE"
    fi
    
    # Get in-progress runs
    local active_runs=$(gh run list $workflow_filter --limit 10 --json id,status,workflowName | jq -r '.[] | select(.status == "in_progress" or .status == "queued") | "\(.id) \(.workflowName)"')
    
    if [[ -z "$active_runs" ]]; then
        log_info "No active workflows to cancel"
        return 0
    fi
    
    echo "Active workflows:"
    echo "$active_runs" | while read -r run_id workflow_name; do
        echo "  - $workflow_name (ID: $run_id)"
    done
    
    echo
    read -p "Cancel these workflows? [y/N] " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "$active_runs" | while read -r run_id workflow_name; do
            if gh run cancel "$run_id"; then
                log_success "Cancelled: $workflow_name (ID: $run_id)"
            else
                log_error "Failed to cancel: $workflow_name (ID: $run_id)"
            fi
        done
    else
        log_info "Cancellation aborted"
    fi
}

rerun_workflows() {
    log "🔄 Rerunning failed workflows..."
    
    local workflow_filter=""
    if [[ -n "$WORKFLOW_FILE" ]]; then
        workflow_filter="--workflow=$WORKFLOW_FILE"
    fi
    
    # Get failed runs
    local failed_runs=$(gh run list $workflow_filter --limit 10 --json id,conclusion,workflowName | jq -r '.[] | select(.conclusion == "failure") | "\(.id) \(.workflowName)"')
    
    if [[ -z "$failed_runs" ]]; then
        log_info "No failed workflows to rerun"
        return 0
    fi
    
    echo "Failed workflows:"
    echo "$failed_runs" | while read -r run_id workflow_name; do
        echo "  - $workflow_name (ID: $run_id)"
    done
    
    echo
    read -p "Rerun these workflows? [y/N] " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "$failed_runs" | while read -r run_id workflow_name; do
            if gh run rerun "$run_id"; then
                log_success "Rerunning: $workflow_name (ID: $run_id)"
            else
                log_error "Failed to rerun: $workflow_name (ID: $run_id)"
            fi
        done
    else
        log_info "Rerun aborted"
    fi
}

# ==============================================================================
# REPORTING
# ==============================================================================

generate_summary() {
    log "📊 Generating workflow summary report..."
    
    local report_file="$PROJECT_ROOT/gh-workflow-summary-$TIMESTAMP.md"
    
    # Get comprehensive data
    local workflows_data=$(gh workflow list --json name,id,state,createdAt,updatedAt)
    local runs_data=$(gh run list --limit 50 --json id,status,conclusion,workflowName,headBranch,event,createdAt,updatedAt)
    
    if [[ "$JSON_OUTPUT" == true ]]; then
        cat > "$report_file" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "workflows": $workflows_data,
  "recent_runs": $runs_data
}
EOF
        echo "$report_file"
        return 0
    fi
    
    # Calculate statistics
    local total_workflows=$(echo "$workflows_data" | jq 'length')
    local active_workflows=$(echo "$workflows_data" | jq '[.[] | select(.state == "active")] | length')
    local total_runs=$(echo "$runs_data" | jq 'length')
    local successful_runs=$(echo "$runs_data" | jq '[.[] | select(.conclusion == "success")] | length')
    local failed_runs=$(echo "$runs_data" | jq '[.[] | select(.conclusion == "failure")] | length')
    
    cat > "$report_file" << EOF
# GitHub Workflows Summary Report

**Generated:** $(date)  
**Repository:** $(git config --get remote.origin.url)  
**Branch:** $(git branch --show-current)  

## Overview

- **Total Workflows:** $total_workflows
- **Active Workflows:** $active_workflows
- **Recent Runs Analyzed:** $total_runs

## Success Metrics (Last 50 Runs)

- **Successful Runs:** $successful_runs
- **Failed Runs:** $failed_runs
- **Success Rate:** $(( (successful_runs * 100) / total_runs ))%

## Active Workflows

$(echo "$workflows_data" | jq -r '.[] | select(.state == "active") | "- \(.name)"')

## Recent Activity

$(echo "$runs_data" | jq -r '.[0:10][] | "- \(.workflowName): \(.conclusion // .status) (\(.createdAt | split("T")[0]))"')

## Recommendations

$(if [[ $((failed_runs * 100 / total_runs)) -gt 10 ]]; then
    echo "- ⚠️ High failure rate detected (>10%). Review failing workflows."
fi)
$(if [[ $active_workflows -lt $total_workflows ]]; then
    echo "- 📝 Some workflows are disabled. Review workflow configuration."
fi)

---
*Generated by gh-workflows.sh*
EOF
    
    log_success "Summary report generated: $report_file"
    
    if [[ "$VERBOSE_MODE" == true ]]; then
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
            list|status|trigger|logs|cancel|rerun|watch|analyze|compare|summary)
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
            --limit)
                LIMIT="$2"
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
║                     GITHUB WORKFLOWS MANAGER                        ║
║                                                                      ║
║  Comprehensive GitHub Actions workflow management via CLI           ║
║  $(date)                                    ║
╚══════════════════════════════════════════════════════════════════════╝

EOF
    fi
    
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Prerequisites check
    check_prerequisites
    
    # Execute command
    case "$command" in
        list)
            list_workflows
            ;;
        status)
            show_workflow_status
            ;;
        trigger)
            trigger_workflow
            ;;
        logs)
            view_workflow_logs
            ;;
        cancel)
            cancel_workflows
            ;;
        rerun)
            rerun_workflows
            ;;
        watch)
            watch_workflows
            ;;
        analyze)
            analyze_workflows
            ;;
        summary)
            generate_summary
            ;;
        compare)
            log_warning "Compare functionality not yet implemented"
            log_info "Use 'analyze' for basic trend analysis"
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