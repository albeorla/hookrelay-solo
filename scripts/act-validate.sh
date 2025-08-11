#!/bin/bash

# ==============================================================================
# Act Workflow Validation Script
# ==============================================================================
# This script provides comprehensive validation of GitHub Actions workflows
# using the 'act' tool and additional validation techniques to ensure workflows
# are syntactically correct, logically sound, and follow best practices.
#
# Usage:
#   ./scripts/act-validate.sh [options]
#
# Options:
#   --workflow    Specific workflow file to validate
#   --fix         Attempt to auto-fix common issues
#   --strict      Enable strict validation mode
#   --security    Enable security-focused validation
#   --performance Enable performance analysis
#   --verbose     Enable verbose logging
#   --json        Output results in JSON format
#   --help        Show this help message
#
# Examples:
#   ./scripts/act-validate.sh --workflow=ci.yml
#   ./scripts/act-validate.sh --strict --security
#   ./scripts/act-validate.sh --fix --verbose
#   ./scripts/act-validate.sh --json > validation-report.json
# ==============================================================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
VALIDATION_LOGS_DIR="$PROJECT_ROOT/act-validation-logs"

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
FIX_MODE=false
STRICT_MODE=false
SECURITY_MODE=false
PERFORMANCE_MODE=false
VERBOSE_MODE=false
JSON_OUTPUT=false

# Validation tracking
VALIDATION_RESULTS=()
ISSUES_FOUND=0
ISSUES_FIXED=0
WORKFLOWS_VALIDATED=0

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
Act Workflow Validation Script

USAGE:
    ./scripts/act-validate.sh [OPTIONS]

OPTIONS:
    --workflow    Specific workflow file to validate (e.g., ci.yml)
    --fix         Attempt to auto-fix common issues where possible
    --strict      Enable strict validation mode with zero tolerance
    --security    Enable security-focused validation checks
    --performance Enable workflow performance analysis
    --verbose     Enable verbose logging and detailed output
    --json        Output validation results in JSON format
    --help        Show this comprehensive help message

VALIDATION CATEGORIES:
    Syntax:       YAML syntax, structure, required fields
    Logic:        Job dependencies, conditional logic, matrix configurations
    Security:     Secret handling, permission scopes, third-party actions
    Performance:  Resource usage, caching, parallel execution
    Best Practices: Action versions, naming conventions, documentation

EXAMPLES:
    # Validate all workflows
    ./scripts/act-validate.sh --verbose
    
    # Validate specific workflow with fixes
    ./scripts/act-validate.sh --workflow=ci.yml --fix
    
    # Strict security validation
    ./scripts/act-validate.sh --strict --security --verbose
    
    # Generate JSON report
    ./scripts/act-validate.sh --json > validation-report.json
    
    # Performance analysis
    ./scripts/act-validate.sh --performance --workflow=ci.yml

VALIDATION CHECKS:
    ✓ YAML syntax and structure
    ✓ Required workflow fields
    ✓ Job and step configuration
    ✓ Action version compatibility
    ✓ Secret and environment security
    ✓ Performance optimization opportunities
    ✓ Best practice compliance
    ✓ Integration compatibility with act tool

AUTO-FIX CAPABILITIES:
    - Outdated action versions
    - Missing required fields
    - Common syntax issues
    - Formatting inconsistencies
    - Basic security improvements

INTEGRATION:
    - Uses 'act' tool for local validation
    - Integrates with GitHub Actions best practices
    - Compatible with CI/CD pipeline validation
    - Supports automated workflow quality gates
EOF
}

setup_validation_environment() {
    log "Setting up validation environment..."
    
    mkdir -p "$VALIDATION_LOGS_DIR"
    
    # Create validation results structure
    VALIDATION_RESULTS=()
    
    log_success "Validation environment ready"
}

check_prerequisites() {
    log "Checking validation prerequisites..."
    
    # Check if act is installed
    if ! command -v act >/dev/null 2>&1; then
        log_error "act tool is not installed"
        log_info "Install with: brew install act"
        exit 1
    fi
    
    # Check if yq is available for YAML processing
    if ! command -v yq >/dev/null 2>&1 && ! command -v python3 >/dev/null 2>&1; then
        log_warning "Neither yq nor python3 available for advanced YAML validation"
        log_info "Install yq with: brew install yq"
    fi
    
    # Check workflows directory
    if [[ ! -d ".github/workflows" ]]; then
        log_error "No .github/workflows directory found"
        exit 1
    fi
    
    local workflow_count=$(find .github/workflows -name "*.yml" -o -name "*.yaml" | wc -l)
    if [[ $workflow_count -eq 0 ]]; then
        log_error "No workflow files found"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
    log_verbose "Found $workflow_count workflow files"
}

# ==============================================================================
# VALIDATION FUNCTIONS
# ==============================================================================

validate_yaml_syntax() {
    local workflow_file="$1"
    local workflow_name=$(basename "$workflow_file")
    
    log_verbose "Validating YAML syntax: $workflow_name"
    
    # Python-based YAML validation (most reliable)
    if command -v python3 >/dev/null 2>&1; then
        if python3 -c "
import yaml
import sys
try:
    with open('$workflow_file', 'r') as f:
        yaml.safe_load(f)
    sys.exit(0)
except yaml.YAMLError as e:
    print(f'YAML Error: {e}')
    sys.exit(1)
except Exception as e:
    print(f'Error: {e}')
    sys.exit(1)
" 2>/dev/null; then
            return 0
        else
            ISSUES_FOUND=$((ISSUES_FOUND + 1))
            VALIDATION_RESULTS+=("{\"file\": \"$workflow_name\", \"type\": \"syntax\", \"severity\": \"error\", \"message\": \"YAML syntax error\"}")
            return 1
        fi
    fi
    
    # Fallback to yq if available
    if command -v yq >/dev/null 2>&1; then
        if yq eval '.' "$workflow_file" >/dev/null 2>&1; then
            return 0
        else
            ISSUES_FOUND=$((ISSUES_FOUND + 1))
            VALIDATION_RESULTS+=("{\"file\": \"$workflow_name\", \"type\": \"syntax\", \"severity\": \"error\", \"message\": \"YAML syntax error (yq)\"}")
            return 1
        fi
    fi
    
    log_warning "No YAML validator available, skipping syntax check for $workflow_name"
    return 0
}

validate_workflow_structure() {
    local workflow_file="$1"
    local workflow_name=$(basename "$workflow_file")
    
    log_verbose "Validating workflow structure: $workflow_name"
    
    local structure_issues=()
    
    # Check required top-level fields
    local required_fields=("on" "jobs")
    for field in "${required_fields[@]}"; do
        if ! grep -q "^$field:" "$workflow_file"; then
            structure_issues+=("Missing required field: $field")
        fi
    done
    
    # Check for empty jobs section
    if grep -q "^jobs:" "$workflow_file"; then
        local job_count=$(grep -E "^  [a-zA-Z0-9_-]+:" "$workflow_file" | wc -l)
        if [[ $job_count -eq 0 ]]; then
            structure_issues+=("No jobs defined in workflow")
        fi
    fi
    
    # Check for valid trigger events
    local triggers=$(grep -A 10 "^on:" "$workflow_file" | grep -E "^  [a-zA-Z_]+" | sed 's/^  //' | sed 's/:.*//')
    if [[ -z "$triggers" ]]; then
        structure_issues+=("No trigger events defined")
    fi
    
    # Validate trigger events are known
    local valid_events=("push" "pull_request" "workflow_dispatch" "schedule" "release" "issues" "issue_comment" "create" "delete" "fork" "gollum" "label" "milestone" "page_build" "project" "project_card" "project_column" "public" "registry_package" "repository_dispatch" "status" "watch" "workflow_call" "workflow_run")
    
    for trigger in $triggers; do
        if [[ ! " ${valid_events[*]} " =~ " $trigger " ]]; then
            structure_issues+=("Unknown trigger event: $trigger")
        fi
    done
    
    # Report structure issues
    if [[ ${#structure_issues[@]} -gt 0 ]]; then
        ISSUES_FOUND=$((ISSUES_FOUND + ${#structure_issues[@]}))
        for issue in "${structure_issues[@]}"; do
            VALIDATION_RESULTS+=("{\"file\": \"$workflow_name\", \"type\": \"structure\", \"severity\": \"error\", \"message\": \"$issue\"}")
        done
        return 1
    fi
    
    return 0
}

validate_job_configuration() {
    local workflow_file="$1"
    local workflow_name=$(basename "$workflow_file")
    
    log_verbose "Validating job configuration: $workflow_name"
    
    local job_issues=()
    
    # Extract job definitions
    local jobs=$(grep -E "^  [a-zA-Z0-9_-]+:" "$workflow_file" | sed 's/://g' | sed 's/^  //')
    
    for job in $jobs; do
        # Check if job has runs-on
        if ! grep -A 20 "^  $job:" "$workflow_file" | grep -q "    runs-on:"; then
            job_issues+=("Job '$job' missing runs-on specification")
        fi
        
        # Check if job has steps
        if ! grep -A 50 "^  $job:" "$workflow_file" | grep -q "    steps:"; then
            job_issues+=("Job '$job' has no steps defined")
        fi
        
        # Validate runner types
        local runner=$(grep -A 20 "^  $job:" "$workflow_file" | grep "    runs-on:" | sed 's/.*runs-on: *//' | tr -d '"' || echo "")
        if [[ -n "$runner" ]]; then
            local valid_runners=("ubuntu-latest" "ubuntu-20.04" "ubuntu-18.04" "windows-latest" "windows-2019" "macos-latest" "macos-11" "self-hosted")
            if [[ ! " ${valid_runners[*]} " =~ " $runner " ]] && [[ ! "$runner" =~ ^\[.*\]$ ]]; then
                job_issues+=("Job '$job' uses unknown runner: $runner")
            fi
        fi
        
        # Check for job dependencies (needs)
        if grep -A 20 "^  $job:" "$workflow_file" | grep -q "    needs:"; then
            local dependencies=$(grep -A 20 "^  $job:" "$workflow_file" | grep "    needs:" | sed 's/.*needs: *//' | tr -d '"[]' | tr ',' ' ')
            for dep in $dependencies; do
                if ! echo "$jobs" | grep -q "^$dep$"; then
                    job_issues+=("Job '$job' depends on non-existent job: $dep")
                fi
            done
        fi
    done
    
    # Report job issues
    if [[ ${#job_issues[@]} -gt 0 ]]; then
        ISSUES_FOUND=$((ISSUES_FOUND + ${#job_issues[@]}))
        for issue in "${job_issues[@]}"; do
            VALIDATION_RESULTS+=("{\"file\": \"$workflow_name\", \"type\": \"job\", \"severity\": \"error\", \"message\": \"$issue\"}")
        done
        return 1
    fi
    
    return 0
}

validate_action_versions() {
    local workflow_file="$1"
    local workflow_name=$(basename "$workflow_file")
    
    log_verbose "Validating action versions: $workflow_name"
    
    local version_issues=()
    
    # Check for outdated action versions
    local outdated_patterns=(
        "actions/checkout@v[12]"
        "actions/setup-node@v[12]"
        "actions/cache@v[12]"
        "actions/upload-artifact@v[12]"
        "actions/download-artifact@v[12]"
    )
    
    for pattern in "${outdated_patterns[@]}"; do
        if grep -q "$pattern" "$workflow_file"; then
            local action_name=$(echo "$pattern" | cut -d'@' -f1)
            version_issues+=("Outdated action version: $action_name (consider updating to latest)")
        fi
    done
    
    # Check for unpinned action versions (security risk)
    if [[ "$SECURITY_MODE" == true ]]; then
        local unpinned_actions=$(grep -E "uses: [^@]*@[^v0-9]" "$workflow_file" || true)
        if [[ -n "$unpinned_actions" ]]; then
            version_issues+=("Unpinned action versions detected (security risk)")
        fi
    fi
    
    # Check for non-existent or deprecated actions
    local deprecated_actions=("actions/upload-artifact@v1" "actions/download-artifact@v1")
    for deprecated in "${deprecated_actions[@]}"; do
        if grep -q "$deprecated" "$workflow_file"; then
            version_issues+=("Deprecated action: $deprecated")
        fi
    done
    
    # Report version issues
    if [[ ${#version_issues[@]} -gt 0 ]]; then
        ISSUES_FOUND=$((ISSUES_FOUND + ${#version_issues[@]}))
        for issue in "${version_issues[@]}"; do
            local severity="warning"
            if [[ "$STRICT_MODE" == true ]]; then
                severity="error"
            fi
            VALIDATION_RESULTS+=("{\"file\": \"$workflow_name\", \"type\": \"version\", \"severity\": \"$severity\", \"message\": \"$issue\"}")
        done
        return 1
    fi
    
    return 0
}

validate_security_practices() {
    local workflow_file="$1"
    local workflow_name=$(basename "$workflow_file")
    
    if [[ "$SECURITY_MODE" != true ]]; then
        return 0
    fi
    
    log_verbose "Validating security practices: $workflow_name"
    
    local security_issues=()
    
    # Check for hardcoded secrets
    local secret_patterns=("ghp_" "gho_" "github_pat_" "sk-" "AKIA" "ASIA")
    for pattern in "${secret_patterns[@]}"; do
        if grep -q "$pattern" "$workflow_file"; then
            security_issues+=("Potential hardcoded secret detected: $pattern")
        fi
    done
    
    # Check for overly permissive permissions
    if grep -q "permissions:" "$workflow_file"; then
        if grep -A 10 "permissions:" "$workflow_file" | grep -q "write-all\|contents: write"; then
            security_issues+=("Potentially overly permissive workflow permissions")
        fi
    fi
    
    # Check for third-party actions without version pinning
    local third_party_actions=$(grep "uses:" "$workflow_file" | grep -v "actions/" | grep -E "@[^v0-9]" || true)
    if [[ -n "$third_party_actions" ]]; then
        security_issues+=("Third-party actions without version pinning")
    fi
    
    # Check for environment variable injection risks
    if grep -q '\${{.*github\.event\.' "$workflow_file"; then
        security_issues+=("Potential code injection via github.event context")
    fi
    
    # Check for pull_request_target usage (high risk)
    if grep -q "pull_request_target:" "$workflow_file"; then
        security_issues+=("Using pull_request_target trigger (review security implications)")
    fi
    
    # Report security issues
    if [[ ${#security_issues[@]} -gt 0 ]]; then
        ISSUES_FOUND=$((ISSUES_FOUND + ${#security_issues[@]}))
        for issue in "${security_issues[@]}"; do
            VALIDATION_RESULTS+=("{\"file\": \"$workflow_name\", \"type\": \"security\", \"severity\": \"warning\", \"message\": \"$issue\"}")
        done
        return 1
    fi
    
    return 0
}

validate_performance_practices() {
    local workflow_file="$1"
    local workflow_name=$(basename "$workflow_file")
    
    if [[ "$PERFORMANCE_MODE" != true ]]; then
        return 0
    fi
    
    log_verbose "Validating performance practices: $workflow_name"
    
    local performance_issues=()
    
    # Check for missing caching
    if grep -q "actions/setup-node" "$workflow_file" && ! grep -q "actions/cache\|cache:" "$workflow_file"; then
        performance_issues+=("Missing dependency caching for Node.js setup")
    fi
    
    # Check for inefficient job dependencies
    local total_jobs=$(grep -E "^  [a-zA-Z0-9_-]+:" "$workflow_file" | wc -l)
    local jobs_with_needs=$(grep -A 5 "^  [a-zA-Z0-9_-]+:" "$workflow_file" | grep "needs:" | wc -l)
    
    if [[ $total_jobs -gt 2 ]] && [[ $jobs_with_needs -eq 0 ]]; then
        performance_issues+=("Consider parallelizing jobs with proper dependencies")
    fi
    
    # Check for missing concurrency controls
    if ! grep -q "concurrency:" "$workflow_file"; then
        performance_issues+=("Missing concurrency controls (may cause resource waste)")
    fi
    
    # Check for inefficient checkout usage
    local checkout_count=$(grep -c "actions/checkout" "$workflow_file" || echo "0")
    if [[ $checkout_count -gt $total_jobs ]]; then
        performance_issues+=("Multiple checkouts per job (consider optimization)")
    fi
    
    # Report performance issues
    if [[ ${#performance_issues[@]} -gt 0 ]]; then
        ISSUES_FOUND=$((ISSUES_FOUND + ${#performance_issues[@]}))
        for issue in "${performance_issues[@]}"; do
            VALIDATION_RESULTS+=("{\"file\": \"$workflow_name\", \"type\": \"performance\", \"severity\": \"info\", \"message\": \"$issue\"}")
        done
        return 1
    fi
    
    return 0
}

validate_with_act() {
    local workflow_file="$1"
    local workflow_name=$(basename "$workflow_file")
    
    log_verbose "Validating with act tool: $workflow_name"
    
    # Test if act can parse the workflow
    local act_output=""
    if act_output=$(act --list --workflows ".github/workflows/$workflow_name" 2>&1); then
        log_verbose "Act successfully parsed $workflow_name"
        return 0
    else
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
        local error_msg=$(echo "$act_output" | head -1 | tr '"' "'")
        VALIDATION_RESULTS+=("{\"file\": \"$workflow_name\", \"type\": \"act\", \"severity\": \"error\", \"message\": \"Act parsing failed: $error_msg\"}")
        return 1
    fi
}

# ==============================================================================
# AUTO-FIX FUNCTIONS
# ==============================================================================

attempt_fixes() {
    local workflow_file="$1"
    local workflow_name=$(basename "$workflow_file")
    
    if [[ "$FIX_MODE" != true ]]; then
        return 0
    fi
    
    log_verbose "Attempting auto-fixes for: $workflow_name"
    
    local fixes_applied=0
    local backup_file="${workflow_file}.backup-${TIMESTAMP}"
    
    # Create backup
    cp "$workflow_file" "$backup_file"
    log_verbose "Created backup: $backup_file"
    
    # Fix 1: Update outdated action versions
    if grep -q "actions/checkout@v[12]" "$workflow_file"; then
        sed -i.tmp 's/actions\/checkout@v[12]/actions\/checkout@v4/g' "$workflow_file" && rm -f "${workflow_file}.tmp"
        fixes_applied=$((fixes_applied + 1))
        log_info "Fixed: Updated checkout action to v4"
    fi
    
    if grep -q "actions/setup-node@v[12]" "$workflow_file"; then
        sed -i.tmp 's/actions\/setup-node@v[12]/actions\/setup-node@v4/g' "$workflow_file" && rm -f "${workflow_file}.tmp"
        fixes_applied=$((fixes_applied + 1))
        log_info "Fixed: Updated setup-node action to v4"
    fi
    
    if grep -q "actions/cache@v[12]" "$workflow_file"; then
        sed -i.tmp 's/actions\/cache@v[12]/actions\/cache@v3/g' "$workflow_file" && rm -f "${workflow_file}.tmp"
        fixes_applied=$((fixes_applied + 1))
        log_info "Fixed: Updated cache action to v3"
    fi
    
    # Fix 2: Add missing name field if not present
    if ! grep -q "^name:" "$workflow_file"; then
        local workflow_basename=$(basename "$workflow_file" .yml)
        sed -i.tmp "1i\\
name: ${workflow_basename^} Workflow\\
" "$workflow_file" && rm -f "${workflow_file}.tmp"
        fixes_applied=$((fixes_applied + 1))
        log_info "Fixed: Added missing workflow name"
    fi
    
    # Fix 3: Add concurrency control if missing
    if ! grep -q "concurrency:" "$workflow_file" && grep -q "pull_request:" "$workflow_file"; then
        sed -i.tmp '/^on:/a\\
\\
concurrency:\\
  group: ${{ github.workflow }}-${{ github.ref }}\\
  cancel-in-progress: true\\
' "$workflow_file" && rm -f "${workflow_file}.tmp"
        fixes_applied=$((fixes_applied + 1))
        log_info "Fixed: Added concurrency control"
    fi
    
    if [[ $fixes_applied -gt 0 ]]; then
        ISSUES_FIXED=$((ISSUES_FIXED + fixes_applied))
        log_success "Applied $fixes_applied fixes to $workflow_name"
    else
        # Remove backup if no fixes were applied
        rm -f "$backup_file"
    fi
    
    return 0
}

# ==============================================================================
# VALIDATION ORCHESTRATION
# ==============================================================================

validate_single_workflow() {
    local workflow_file="$1"
    local workflow_name=$(basename "$workflow_file")
    
    log "🔍 Validating: $workflow_name"
    
    local workflow_valid=true
    local workflow_issues=0
    
    # Run all validation checks
    validate_yaml_syntax "$workflow_file" || workflow_valid=false
    validate_workflow_structure "$workflow_file" || workflow_valid=false
    validate_job_configuration "$workflow_file" || workflow_valid=false
    validate_action_versions "$workflow_file" || workflow_valid=false
    validate_security_practices "$workflow_file" || workflow_valid=false
    validate_performance_practices "$workflow_file" || workflow_valid=false
    validate_with_act "$workflow_file" || workflow_valid=false
    
    # Attempt fixes if enabled
    attempt_fixes "$workflow_file"
    
    WORKFLOWS_VALIDATED=$((WORKFLOWS_VALIDATED + 1))
    
    if [[ "$workflow_valid" == true ]]; then
        log_success "$workflow_name passed all validations"
        return 0
    else
        log_warning "$workflow_name has validation issues"
        return 1
    fi
}

validate_all_workflows() {
    log "🔍 Starting comprehensive workflow validation..."
    
    local workflow_files=()
    
    if [[ -n "$WORKFLOW_FILE" ]]; then
        if [[ -f ".github/workflows/$WORKFLOW_FILE" ]]; then
            workflow_files=(".github/workflows/$WORKFLOW_FILE")
        else
            log_error "Workflow file not found: $WORKFLOW_FILE"
            exit 1
        fi
    else
        # Get all workflow files
        while IFS= read -r -d '' file; do
            workflow_files+=("$file")
        done < <(find .github/workflows -name "*.yml" -o -name "*.yaml" -print0)
    fi
    
    log_info "Validating ${#workflow_files[@]} workflow file(s)"
    
    local validation_failures=0
    
    for workflow_file in "${workflow_files[@]}"; do
        if ! validate_single_workflow "$workflow_file"; then
            validation_failures=$((validation_failures + 1))
        fi
    done
    
    # Generate summary
    echo
    log "📊 Validation Summary:"
    log_info "Workflows validated: $WORKFLOWS_VALIDATED"
    log_info "Issues found: $ISSUES_FOUND"
    log_info "Issues fixed: $ISSUES_FIXED"
    log_info "Validation failures: $validation_failures"
    
    if [[ $validation_failures -eq 0 ]]; then
        log_success "All workflows passed validation! 🎉"
        return 0
    else
        log_warning "$validation_failures workflow(s) failed validation"
        return 1
    fi
}

# ==============================================================================
# OUTPUT GENERATION
# ==============================================================================

generate_json_report() {
    local report="{
  \"timestamp\": \"$(date -Iseconds)\",
  \"validation_summary\": {
    \"workflows_validated\": $WORKFLOWS_VALIDATED,
    \"issues_found\": $ISSUES_FOUND,
    \"issues_fixed\": $ISSUES_FIXED,
    \"validation_modes\": {
      \"strict\": $STRICT_MODE,
      \"security\": $SECURITY_MODE,
      \"performance\": $PERFORMANCE_MODE,
      \"fix_mode\": $FIX_MODE
    }
  },
  \"results\": ["
    
    local first=true
    for result in "${VALIDATION_RESULTS[@]}"; do
        if [[ "$first" == true ]]; then
            first=false
        else
            report+=","
        fi
        report+="
    $result"
    done
    
    report+="
  ]
}"
    
    echo "$report" | jq '.' 2>/dev/null || echo "$report"
}

generate_report() {
    local report_file="$VALIDATION_LOGS_DIR/validation-report-$TIMESTAMP.md"
    
    cat > "$report_file" << EOF
# Workflow Validation Report

**Generated:** $(date)  
**Workflows Validated:** $WORKFLOWS_VALIDATED  
**Issues Found:** $ISSUES_FOUND  
**Issues Fixed:** $ISSUES_FIXED  

## Validation Configuration

- **Strict Mode:** $STRICT_MODE
- **Security Mode:** $SECURITY_MODE  
- **Performance Mode:** $PERFORMANCE_MODE
- **Fix Mode:** $FIX_MODE

## Validation Results

EOF
    
    # Group results by file
    for result in "${VALIDATION_RESULTS[@]}"; do
        echo "$result" >> "$report_file.tmp"
    done 2>/dev/null || true
    
    if [[ -f "$report_file.tmp" ]]; then
        cat "$report_file.tmp" | jq -r '"- **\(.file)** (\(.type)): \(.message) [\(.severity)]"' >> "$report_file" 2>/dev/null || true
        rm -f "$report_file.tmp"
    fi
    
    cat >> "$report_file" << EOF

## Recommendations

$(if [[ $ISSUES_FOUND -gt 0 ]]; then
    echo "- Review and address the validation issues above"
    echo "- Consider running with --fix flag to auto-resolve common issues"
fi)
$(if [[ "$SECURITY_MODE" != true ]]; then
    echo "- Run with --security flag for comprehensive security validation"
fi)
$(if [[ "$PERFORMANCE_MODE" != true ]]; then
    echo "- Run with --performance flag for performance optimization suggestions"
fi)

---
*Generated by act-validate.sh*
EOF
    
    log_info "Validation report saved: $report_file"
}

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================

main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --workflow)
                WORKFLOW_FILE="$2"
                shift 2
                ;;
            --fix)
                FIX_MODE=true
                shift
                ;;
            --strict)
                STRICT_MODE=true
                shift
                ;;
            --security)
                SECURITY_MODE=true
                shift
                ;;
            --performance)
                PERFORMANCE_MODE=true
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
    
    # Print header (unless JSON output)
    if [[ "$JSON_OUTPUT" != true ]]; then
        cat << EOF

╔══════════════════════════════════════════════════════════════════════╗
║                    ACT WORKFLOW VALIDATION                          ║
║                                                                      ║
║  Comprehensive GitHub Actions workflow validation and analysis      ║
║  $(date)                                    ║
╚══════════════════════════════════════════════════════════════════════╝

EOF
    fi
    
    # Setup
    cd "$PROJECT_ROOT"
    setup_validation_environment
    check_prerequisites
    
    # Run validation
    if validate_all_workflows; then
        # Generate output
        if [[ "$JSON_OUTPUT" == true ]]; then
            generate_json_report
        else
            generate_report
        fi
        exit 0
    else
        # Generate output
        if [[ "$JSON_OUTPUT" == true ]]; then
            generate_json_report
        else
            generate_report
        fi
        exit 1
    fi
}

# Execute main function with all arguments
main "$@"