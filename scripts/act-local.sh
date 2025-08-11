#!/bin/bash

# ==============================================================================
# Act Local GitHub Actions Execution Script
# ==============================================================================
# This script provides comprehensive local execution of GitHub Actions workflows
# using the 'act' tool, enabling testing and validation of CI/CD pipelines
# without pushing to GitHub.
#
# Usage:
#   ./scripts/act-local.sh [command] [options]
#
# Commands:
#   run           Run workflows locally
#   list          List available workflows and jobs
#   validate      Validate workflow syntax and structure
#   dry-run       Perform dry run without execution
#   events        Test different GitHub events
#   secrets       Manage local secrets for testing
#   debug         Debug workflow execution
#
# Options:
#   --workflow    Specific workflow file to run
#   --job         Specific job to run
#   --event       GitHub event to simulate (push, pull_request, etc.)
#   --platform    Docker platform to use
#   --secrets     Secrets file path
#   --verbose     Enable verbose logging
#   --help        Show this help message
#
# Examples:
#   ./scripts/act-local.sh run --workflow=ci.yml
#   ./scripts/act-local.sh run --event=pull_request
#   ./scripts/act-local.sh validate --workflow=ci.yml
#   ./scripts/act-local.sh dry-run --verbose
# ==============================================================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
ACT_LOGS_DIR="$PROJECT_ROOT/act-logs"
ACT_CACHE_DIR="$PROJECT_ROOT/.act-cache"

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
JOB_NAME=""
EVENT_TYPE="push"
PLATFORM="ubuntu-latest=ghcr.io/catthehacker/ubuntu:act-latest"
SECRETS_FILE=""
VERBOSE_MODE=false
DRY_RUN=false

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
Act Local GitHub Actions Execution Script

USAGE:
    ./scripts/act-local.sh [COMMAND] [OPTIONS]

COMMANDS:
    run           Run GitHub Actions workflows locally
    list          List all available workflows and jobs
    validate      Validate workflow syntax and configuration
    dry-run       Perform dry run to see what would be executed
    events        Test workflows with different GitHub events
    secrets       Manage and test local secrets configuration
    debug         Run workflows with debugging enabled

OPTIONS:
    --workflow    Specific workflow file to run (e.g., ci.yml)
    --job         Specific job within workflow to run
    --event       GitHub event to simulate (push, pull_request, workflow_dispatch)
    --platform    Docker platform specification for runners
    --secrets     Path to secrets file (.env format)
    --verbose     Enable verbose logging and detailed output
    --help        Show this comprehensive help message

EXAMPLES:
    # Run entire CI workflow locally
    ./scripts/act-local.sh run --workflow=ci.yml --verbose
    
    # Run specific job from workflow
    ./scripts/act-local.sh run --workflow=ci.yml --job=quality
    
    # Simulate pull request event
    ./scripts/act-local.sh run --event=pull_request --workflow=ci.yml
    
    # Validate all workflows
    ./scripts/act-local.sh validate
    
    # Dry run to see execution plan
    ./scripts/act-local.sh dry-run --workflow=ci.yml
    
    # Debug workflow execution
    ./scripts/act-local.sh debug --workflow=ci.yml --job=e2e

GITHUB EVENTS SUPPORTED:
    - push (default)
    - pull_request
    - workflow_dispatch
    - schedule
    - release
    - issues

PLATFORM OPTIONS:
    - ubuntu-latest (default)
    - ubuntu-20.04
    - ubuntu-18.04
    - windows-latest
    - macos-latest

FEATURES:
    - Local workflow execution without GitHub
    - Multiple event type simulation
    - Job-specific execution
    - Secrets management for testing
    - Docker container optimization
    - Comprehensive logging and debugging
    - Workflow validation and syntax checking

REQUIREMENTS:
    - act tool installed (brew install act)
    - Docker running
    - GitHub Actions workflows in .github/workflows/
EOF
}

setup_directories() {
    log "Setting up act directories..."
    
    mkdir -p "$ACT_LOGS_DIR"
    mkdir -p "$ACT_CACHE_DIR"
    mkdir -p "$PROJECT_ROOT/.act"
    
    log_success "Directories created"
}

check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if act is installed
    if ! command -v act >/dev/null 2>&1; then
        log_error "act tool is not installed"
        log_info "Install with: brew install act"
        log_info "Or visit: https://github.com/nektos/act"
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running"
        log_info "Please start Docker Desktop"
        exit 1
    fi
    
    # Check if workflows directory exists
    if [[ ! -d ".github/workflows" ]]; then
        log_error "No .github/workflows directory found"
        log_info "This script must be run from a repository with GitHub Actions workflows"
        exit 1
    fi
    
    # List available workflows
    local workflow_count=$(find .github/workflows -name "*.yml" -o -name "*.yaml" | wc -l)
    if [[ $workflow_count -eq 0 ]]; then
        log_error "No workflow files found in .github/workflows/"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
    log_verbose "Found $workflow_count workflow files"
}

# ==============================================================================
# WORKFLOW LISTING AND INFORMATION
# ==============================================================================

list_workflows() {
    log "📋 Listing available workflows and jobs..."
    
    echo
    echo "Available GitHub Actions Workflows"
    echo "=================================="
    
    for workflow_file in .github/workflows/*.yml .github/workflows/*.yaml; do
        if [[ -f "$workflow_file" ]]; then
            local workflow_name=$(basename "$workflow_file")
            local workflow_display_name=$(grep "^name:" "$workflow_file" 2>/dev/null | sed 's/name: *//' | tr -d '"' || echo "")
            
            echo
            printf "📄 %-25s" "$workflow_name"
            if [[ -n "$workflow_display_name" ]]; then
                echo " ($workflow_display_name)"
            else
                echo
            fi
            
            # List jobs in workflow
            if [[ "$VERBOSE_MODE" == true ]]; then
                local jobs=$(grep -E "^  [a-zA-Z0-9_-]+:" "$workflow_file" | sed 's/://g' | sed 's/^  /    🔧 /' || echo "    No jobs found")
                echo "$jobs"
            fi
            
            # Show triggers
            local triggers=$(grep -A 5 "^on:" "$workflow_file" | grep -E "^  [a-zA-Z_]+" | sed 's/^  /    📡 /' || echo "    No triggers found")
            if [[ "$VERBOSE_MODE" == true ]]; then
                echo "  Triggers:"
                echo "$triggers"
            fi
        fi
    done
    
    echo
    log_info "Use --verbose to see jobs and triggers"
    log_info "Use 'act --list' to see what act can run"
    
    # Show act's view of workflows
    if [[ "$VERBOSE_MODE" == true ]]; then
        echo
        echo "Act Tool Analysis"
        echo "================="
        act --list 2>/dev/null || log_warning "Act failed to parse workflows"
    fi
}

# ==============================================================================
# WORKFLOW VALIDATION
# ==============================================================================

validate_workflows() {
    log "🔍 Validating GitHub Actions workflows..."
    
    local validation_errors=0
    local workflows_checked=0
    
    for workflow_file in .github/workflows/*.yml .github/workflows/*.yaml; do
        if [[ -f "$workflow_file" ]]; then
            workflows_checked=$((workflows_checked + 1))
            local workflow_name=$(basename "$workflow_file")
            
            log_verbose "Validating: $workflow_name"
            
            # Basic YAML syntax check
            if ! python3 -c "import yaml; yaml.safe_load(open('$workflow_file'))" 2>/dev/null; then
                log_error "YAML syntax error in $workflow_name"
                validation_errors=$((validation_errors + 1))
                continue
            fi
            
            # Check for required fields
            local required_fields=("on" "jobs")
            for field in "${required_fields[@]}"; do
                if ! grep -q "^$field:" "$workflow_file"; then
                    log_error "Missing required field '$field' in $workflow_name"
                    validation_errors=$((validation_errors + 1))
                fi
            done
            
            # Check for common issues
            local issues=()
            
            # Check for outdated actions
            if grep -q "actions/checkout@v[12]" "$workflow_file"; then
                issues+=("Outdated checkout action version")
            fi
            
            if grep -q "actions/setup-node@v[12]" "$workflow_file"; then
                issues+=("Outdated setup-node action version")
            fi
            
            # Check for hardcoded secrets
            if grep -q "ghp_\|gho_" "$workflow_file"; then
                issues+=("Potential hardcoded GitHub token")
            fi
            
            # Check for missing needs dependencies
            local jobs_with_needs=$(grep -A 10 "^  [a-zA-Z0-9_-]+:" "$workflow_file" | grep "needs:" | wc -l)
            if [[ $jobs_with_needs -gt 0 ]]; then
                log_verbose "$workflow_name has job dependencies"
            fi
            
            # Report issues
            if [[ ${#issues[@]} -gt 0 ]]; then
                log_warning "$workflow_name has potential issues:"
                for issue in "${issues[@]}"; do
                    echo "    - $issue"
                done
                validation_errors=$((validation_errors + 1))
            else
                log_success "$workflow_name validation passed"
            fi
        fi
    done
    
    echo
    echo "Validation Summary"
    echo "=================="
    echo "Workflows checked: $workflows_checked"
    echo "Issues found: $validation_errors"
    
    if [[ $validation_errors -eq 0 ]]; then
        log_success "All workflows passed validation! 🎉"
        return 0
    else
        log_warning "$validation_errors workflow(s) have issues"
        return 1
    fi
}

# ==============================================================================
# LOCAL WORKFLOW EXECUTION
# ==============================================================================

run_workflow_local() {
    log "🚀 Running workflow locally with act..."
    
    # Prepare act command
    local act_cmd="act"
    local log_file="$ACT_LOGS_DIR/act-run-$TIMESTAMP.log"
    
    # Add event type
    act_cmd="$act_cmd $EVENT_TYPE"
    
    # Add workflow filter if specified
    if [[ -n "$WORKFLOW_FILE" ]]; then
        act_cmd="$act_cmd --workflows .github/workflows/$WORKFLOW_FILE"
    fi
    
    # Add job filter if specified
    if [[ -n "$JOB_NAME" ]]; then
        act_cmd="$act_cmd --job $JOB_NAME"
    fi
    
    # Add platform specification
    act_cmd="$act_cmd --platform $PLATFORM"
    
    # Add secrets file if specified
    if [[ -n "$SECRETS_FILE" ]] && [[ -f "$SECRETS_FILE" ]]; then
        act_cmd="$act_cmd --secret-file $SECRETS_FILE"
    fi
    
    # Add verbose flag if requested
    if [[ "$VERBOSE_MODE" == true ]]; then
        act_cmd="$act_cmd --verbose"
    fi
    
    # Add dry run flag if requested
    if [[ "$DRY_RUN" == true ]]; then
        act_cmd="$act_cmd --dry-run"
    fi
    
    # Environment variables for act
    export ACT_LOG_LEVEL="info"
    if [[ "$VERBOSE_MODE" == true ]]; then
        export ACT_LOG_LEVEL="debug"
    fi
    
    log_info "Command: $act_cmd"
    log_info "Event: $EVENT_TYPE"
    log_info "Platform: $PLATFORM"
    log_info "Log file: $log_file"
    
    if [[ -n "$WORKFLOW_FILE" ]]; then
        log_info "Workflow: $WORKFLOW_FILE"
    fi
    
    if [[ -n "$JOB_NAME" ]]; then
        log_info "Job: $JOB_NAME"
    fi
    
    # Create environment file for act
    local act_env_file="$PROJECT_ROOT/.act/.env"
    cat > "$act_env_file" << EOF
# Act environment variables
GITHUB_ACTOR=act-user
GITHUB_REPOSITORY=$USER/$(basename "$PROJECT_ROOT")
GITHUB_WORKSPACE=/github/workspace
GITHUB_SHA=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
GITHUB_REF=refs/heads/$(git branch --show-current 2>/dev/null || echo "main")
GITHUB_EVENT_NAME=$EVENT_TYPE
CI=true
NODE_ENV=test
EOF
    
    # Add project-specific environment variables
    if [[ -f ".env.test" ]]; then
        log_info "Loading .env.test for act execution"
        cat .env.test >> "$act_env_file"
    fi
    
    # Execute act command
    echo
    if [[ "$DRY_RUN" == true ]]; then
        log "🏃 Performing dry run..."
    else
        log "🏃 Executing workflow..."
    fi
    
    local start_time=$(date +%s)
    
    if eval "$act_cmd --env-file $act_env_file" 2>&1 | tee "$log_file"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        if [[ "$DRY_RUN" == true ]]; then
            log_success "Dry run completed successfully in ${duration}s"
        else
            log_success "Workflow execution completed successfully in ${duration}s"
        fi
        
        # Show summary
        echo
        log "📊 Execution Summary:"
        log_info "Duration: ${duration} seconds"
        log_info "Log file: $log_file"
        log_info "Environment file: $act_env_file"
        
        return 0
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log_error "Workflow execution failed after ${duration}s"
        log_info "Check log file for details: $log_file"
        
        # Show last few lines of log for immediate feedback
        if [[ -f "$log_file" ]]; then
            echo
            log "📋 Last 10 lines of execution log:"
            tail -10 "$log_file" | sed 's/^/  /'
        fi
        
        return 1
    fi
}

# ==============================================================================
# EVENT SIMULATION
# ==============================================================================

test_events() {
    log "🎭 Testing workflow with different GitHub events..."
    
    local events=("push" "pull_request" "workflow_dispatch" "schedule")
    local workflow_filter=""
    
    if [[ -n "$WORKFLOW_FILE" ]]; then
        workflow_filter="--workflows .github/workflows/$WORKFLOW_FILE"
    fi
    
    for event in "${events[@]}"; do
        echo
        log "🎯 Testing event: $event"
        
        # Check if workflow supports this event
        local workflows_supporting_event=()
        for workflow_file in .github/workflows/*.yml .github/workflows/*.yaml; do
            if [[ -f "$workflow_file" ]] && grep -q "^  $event:" "$workflow_file"; then
                workflows_supporting_event+=("$(basename "$workflow_file")")
            fi
        done
        
        if [[ ${#workflows_supporting_event[@]} -eq 0 ]]; then
            log_info "No workflows support the '$event' event"
            continue
        fi
        
        log_info "Workflows supporting '$event': ${workflows_supporting_event[*]}"
        
        # Run dry-run for this event
        local act_cmd="act $event $workflow_filter --dry-run --platform $PLATFORM"
        
        if eval "$act_cmd" >/dev/null 2>&1; then
            log_success "Event '$event' can be executed"
        else
            log_warning "Event '$event' may have issues"
        fi
    done
    
    echo
    log_info "Event testing completed"
    log_info "Use 'run --event=<event>' to execute specific events"
}

# ==============================================================================
# SECRETS MANAGEMENT
# ==============================================================================

manage_secrets() {
    log "🔐 Managing local secrets for act execution..."
    
    local secrets_file="$PROJECT_ROOT/.act/secrets.env"
    
    if [[ ! -f "$secrets_file" ]]; then
        log "Creating example secrets file..."
        
        cat > "$secrets_file" << EOF
# Local secrets for act execution
# Format: SECRET_NAME=secret_value

# Example GitHub token (use personal access token)
# GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Example Discord OAuth credentials
AUTH_DISCORD_ID=test-client-id
AUTH_DISCORD_SECRET=test-client-secret

# Example database credentials
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/test_db

# Example NextAuth secret
AUTH_SECRET=test-secret-for-local-act-execution

# Add your actual secrets here for local testing
EOF
        
        log_success "Created example secrets file: $secrets_file"
        log_info "Edit this file with your actual test secrets"
        log_warning "Never commit this file to version control"
        
        # Add to .gitignore if not present
        if ! grep -q ".act/secrets.env" .gitignore 2>/dev/null; then
            echo ".act/secrets.env" >> .gitignore
            log_info "Added secrets file to .gitignore"
        fi
    else
        log_info "Secrets file already exists: $secrets_file"
    fi
    
    # Show secrets (masked)
    if [[ "$VERBOSE_MODE" == true ]]; then
        echo
        log "🔍 Current secrets configuration:"
        
        while IFS='=' read -r key value; do
            if [[ -n "$key" ]] && [[ ! "$key" =~ ^# ]]; then
                local masked_value="${value:0:4}****"
                echo "  $key=$masked_value"
            fi
        done < "$secrets_file"
    fi
    
    # Validate secrets format
    if ! grep -q "=" "$secrets_file"; then
        log_warning "Secrets file appears to be empty or malformed"
        log_info "Expected format: SECRET_NAME=secret_value"
    fi
    
    SECRETS_FILE="$secrets_file"
    log_info "Use --secrets flag to specify this file when running workflows"
}

# ==============================================================================
# DEBUGGING SUPPORT
# ==============================================================================

debug_workflow() {
    log "🔍 Running workflow in debug mode..."
    
    # Enable debug mode
    VERBOSE_MODE=true
    
    # Create debug environment
    local debug_env_file="$PROJECT_ROOT/.act/debug.env"
    cat > "$debug_env_file" << EOF
# Debug environment for act
ACTIONS_STEP_DEBUG=true
ACTIONS_RUNNER_DEBUG=true
CI=true
DEBUG=*
NODE_ENV=test
LOG_LEVEL=debug
EOF
    
    # Prepare debug command
    local debug_cmd="act $EVENT_TYPE --verbose --platform $PLATFORM"
    
    if [[ -n "$WORKFLOW_FILE" ]]; then
        debug_cmd="$debug_cmd --workflows .github/workflows/$WORKFLOW_FILE"
    fi
    
    if [[ -n "$JOB_NAME" ]]; then
        debug_cmd="$debug_cmd --job $JOB_NAME"
    fi
    
    # Add environment files
    debug_cmd="$debug_cmd --env-file $debug_env_file"
    
    if [[ -n "$SECRETS_FILE" ]] && [[ -f "$SECRETS_FILE" ]]; then
        debug_cmd="$debug_cmd --secret-file $SECRETS_FILE"
    fi
    
    log_info "Debug command: $debug_cmd"
    log_info "Debug environment: $debug_env_file"
    
    # Execute with comprehensive logging
    local debug_log="$ACT_LOGS_DIR/debug-$TIMESTAMP.log"
    
    echo
    log "🏃 Starting debug execution..."
    
    if eval "$debug_cmd" 2>&1 | tee "$debug_log"; then
        log_success "Debug execution completed"
    else
        log_error "Debug execution failed"
        
        echo
        log "🔍 Debug information:"
        log_info "Debug log: $debug_log"
        log_info "Debug environment: $debug_env_file"
        
        # Show recent Docker containers for debugging
        if [[ "$VERBOSE_MODE" == true ]]; then
            echo
            log "🐳 Recent Docker containers:"
            docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" | head -10
        fi
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
            run|list|validate|dry-run|events|secrets|debug)
                command="$1"
                if [[ "$1" == "dry-run" ]]; then
                    DRY_RUN=true
                    command="run"
                fi
                shift
                ;;
            --workflow)
                WORKFLOW_FILE="$2"
                shift 2
                ;;
            --job)
                JOB_NAME="$2"
                shift 2
                ;;
            --event)
                EVENT_TYPE="$2"
                shift 2
                ;;
            --platform)
                PLATFORM="$2"
                shift 2
                ;;
            --secrets)
                SECRETS_FILE="$2"
                shift 2
                ;;
            --verbose)
                VERBOSE_MODE=true
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
        command="list"
    fi
    
    # Print header
    cat << EOF

╔══════════════════════════════════════════════════════════════════════╗
║                    ACT LOCAL GITHUB ACTIONS                         ║
║                                                                      ║
║  Run and test GitHub Actions workflows locally with act             ║
║  $(date)                                    ║
╚══════════════════════════════════════════════════════════════════════╝

EOF
    
    # Setup
    cd "$PROJECT_ROOT"
    setup_directories
    check_prerequisites
    
    # Execute command
    case "$command" in
        run)
            run_workflow_local
            ;;
        list)
            list_workflows
            ;;
        validate)
            validate_workflows
            ;;
        events)
            test_events
            ;;
        secrets)
            manage_secrets
            ;;
        debug)
            debug_workflow
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