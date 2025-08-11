#!/bin/bash

# ==============================================================================
# CI Cleanup and Reset Script
# ==============================================================================
# This script provides comprehensive cleanup and reset functionality for the CI
# testing environment, ensuring clean states for accurate testing and development.
#
# Usage:
#   ./scripts/ci-cleanup.sh [options]
#
# Options:
#   --all         Clean everything (containers, volumes, images, cache, logs)
#   --containers  Clean containers and networks only
#   --volumes     Clean Docker volumes only
#   --images      Clean Docker images only
#   --cache       Clean build and test caches only
#   --logs        Clean log files only
#   --soft        Soft cleanup (preserve important data)
#   --force       Force cleanup without confirmation prompts
#   --dry-run     Show what would be cleaned without executing
#   --verbose     Enable verbose logging
#   --help        Show this help message
#
# Examples:
#   ./scripts/ci-cleanup.sh --all --force
#   ./scripts/ci-cleanup.sh --cache --logs
#   ./scripts/ci-cleanup.sh --dry-run --verbose
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
CLEAN_ALL=false
CLEAN_CONTAINERS=false
CLEAN_VOLUMES=false
CLEAN_IMAGES=false
CLEAN_CACHE=false
CLEAN_LOGS=false
SOFT_CLEANUP=false
FORCE_MODE=false
DRY_RUN=false
VERBOSE_MODE=false

# Cleanup statistics
CONTAINERS_REMOVED=0
VOLUMES_REMOVED=0
IMAGES_REMOVED=0
FILES_REMOVED=0
SPACE_FREED=0

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
CI Cleanup and Reset Script

USAGE:
    ./scripts/ci-cleanup.sh [OPTIONS]

OPTIONS:
    --all         Clean everything (containers, volumes, images, cache, logs)
    --containers  Clean containers and networks only
    --volumes     Clean Docker volumes only
    --images      Clean Docker images only
    --cache       Clean build and test caches only
    --logs        Clean log files only
    --soft        Soft cleanup (preserve important data)
    --force       Force cleanup without confirmation prompts
    --dry-run     Show what would be cleaned without executing
    --verbose     Enable verbose logging
    --help        Show this help message

CLEANUP CATEGORIES:
    Containers:   Stop and remove all CI-related containers
    Volumes:      Remove Docker volumes for databases and caches
    Images:       Remove built Docker images
    Cache:        Clean build caches, node_modules, .next, etc.
    Logs:         Remove log files and test results

SAFETY FEATURES:
    - Confirmation prompts (unless --force)
    - Dry-run mode to preview actions
    - Soft cleanup to preserve critical data
    - Detailed logging of all operations

EXAMPLES:
    ./scripts/ci-cleanup.sh --all --force
    ./scripts/ci-cleanup.sh --cache --logs --verbose
    ./scripts/ci-cleanup.sh --dry-run --all

PRESERVED DATA (soft cleanup):
    - Source code files
    - Configuration files
    - Environment files
    - Git repository data
    - Important documentation
EOF
}

confirm_action() {
    local message="$1"
    
    if [[ "$FORCE_MODE" == true ]]; then
        log_info "Force mode: $message"
        return 0
    fi
    
    echo -e "${YELLOW}⚠️  $message${NC}"
    read -p "Do you want to continue? [y/N] " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        return 0
    else
        log_info "Operation cancelled by user"
        return 1
    fi
}

execute_command() {
    local description="$1"
    local command="$2"
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY RUN] Would execute: $description"
        log_verbose "[DRY RUN] Command: $command"
        return 0
    fi
    
    log_verbose "Executing: $description"
    log_verbose "Command: $command"
    
    if eval "$command" 2>/dev/null; then
        log_success "$description"
        return 0
    else
        log_warning "$description (some items may not exist)"
        return 1
    fi
}

get_disk_usage() {
    if command -v du >/dev/null 2>&1; then
        du -sh "$PROJECT_ROOT" 2>/dev/null | cut -f1 || echo "unknown"
    else
        echo "unknown"
    fi
}

# ==============================================================================
# DOCKER CLEANUP FUNCTIONS
# ==============================================================================

cleanup_containers() {
    log "🐳 Cleaning up Docker containers..."
    
    # Stop all running containers for this project
    local containers=$(docker ps -q --filter "label=com.docker.compose.project" 2>/dev/null || true)
    if [[ -n "$containers" ]]; then
        execute_command "Stop running containers" "docker stop $containers"
        CONTAINERS_REMOVED=$((CONTAINERS_REMOVED + $(echo "$containers" | wc -w)))
    fi
    
    # Remove containers from docker-compose files
    local compose_files=("docker-compose.yml" "docker-compose.ci.yml" "docker-compose.test-matrix.yml")
    
    for compose_file in "${compose_files[@]}"; do
        if [[ -f "$PROJECT_ROOT/$compose_file" ]]; then
            log_verbose "Cleaning containers from $compose_file"
            execute_command "Remove containers from $compose_file" \
                "cd '$PROJECT_ROOT' && docker-compose -f '$compose_file' down --remove-orphans"
        fi
    done
    
    # Remove dangling containers
    local dangling=$(docker ps -aq --filter "status=exited" 2>/dev/null || true)
    if [[ -n "$dangling" ]]; then
        execute_command "Remove exited containers" "docker rm $dangling"
        CONTAINERS_REMOVED=$((CONTAINERS_REMOVED + $(echo "$dangling" | wc -w)))
    fi
    
    # Clean networks
    execute_command "Remove unused networks" "docker network prune -f"
    
    log_success "Container cleanup completed"
}

cleanup_volumes() {
    log "💾 Cleaning up Docker volumes..."
    
    # List project-related volumes
    local project_volumes=$(docker volume ls -q --filter "name=test_" --filter "name=ci_" --filter "name=matrix_" 2>/dev/null || true)
    
    if [[ -n "$project_volumes" ]]; then
        if confirm_action "This will remove Docker volumes containing database data and caches."; then
            execute_command "Remove project volumes" "docker volume rm $project_volumes"
            VOLUMES_REMOVED=$((VOLUMES_REMOVED + $(echo "$project_volumes" | wc -w)))
        fi
    else
        log_info "No project volumes found"
    fi
    
    # Clean dangling volumes
    execute_command "Remove dangling volumes" "docker volume prune -f"
    
    log_success "Volume cleanup completed"
}

cleanup_images() {
    log "🖼️ Cleaning up Docker images..."
    
    # Remove project-specific images
    local project_images=$(docker images -q "*ci-*" "*test-*" "*matrix-*" 2>/dev/null || true)
    if [[ -n "$project_images" ]]; then
        execute_command "Remove project images" "docker rmi $project_images"
        IMAGES_REMOVED=$((IMAGES_REMOVED + $(echo "$project_images" | wc -w)))
    fi
    
    # Remove dangling images
    execute_command "Remove dangling images" "docker image prune -f"
    
    # Remove unused images (if not soft cleanup)
    if [[ "$SOFT_CLEANUP" != true ]]; then
        if confirm_action "Remove all unused Docker images (may affect other projects)?"; then
            execute_command "Remove unused images" "docker image prune -a -f"
        fi
    fi
    
    log_success "Image cleanup completed"
}

# ==============================================================================
# FILESYSTEM CLEANUP FUNCTIONS
# ==============================================================================

cleanup_cache() {
    log "🗂️ Cleaning up build and test caches..."
    
    cd "$PROJECT_ROOT"
    
    # Next.js build cache
    if [[ -d ".next" ]]; then
        execute_command "Remove Next.js build cache" "rm -rf .next"
        FILES_REMOVED=$((FILES_REMOVED + 1))
    fi
    
    # TypeScript build info
    execute_command "Remove TypeScript build info" "find . -name '*.tsbuildinfo' -delete"
    
    # ESLint cache
    if [[ -f ".eslintcache" ]]; then
        execute_command "Remove ESLint cache" "rm -f .eslintcache"
        FILES_REMOVED=$((FILES_REMOVED + 1))
    fi
    
    # Jest cache
    if [[ -d "node_modules/.cache/jest" ]]; then
        execute_command "Remove Jest cache" "rm -rf node_modules/.cache/jest"
        FILES_REMOVED=$((FILES_REMOVED + 1))
    fi
    
    # Yarn cache (global)
    if [[ "$SOFT_CLEANUP" != true ]]; then
        if confirm_action "Clean Yarn global cache (affects all projects)?"; then
            execute_command "Clean Yarn cache" "yarn cache clean"
        fi
    fi
    
    # Node modules (if not soft cleanup)
    if [[ "$SOFT_CLEANUP" != true ]]; then
        if [[ -d "node_modules" ]]; then
            if confirm_action "Remove node_modules directory?"; then
                execute_command "Remove node_modules" "rm -rf node_modules"
                FILES_REMOVED=$((FILES_REMOVED + 1))
            fi
        fi
    fi
    
    # Coverage reports
    if [[ -d "coverage" ]]; then
        execute_command "Remove coverage reports" "rm -rf coverage/*"
        FILES_REMOVED=$((FILES_REMOVED + 1))
    fi
    
    # Playwright reports
    if [[ -d "playwright-report" ]]; then
        execute_command "Remove Playwright reports" "rm -rf playwright-report/*"
        FILES_REMOVED=$((FILES_REMOVED + 1))
    fi
    
    # Test results
    if [[ -d "test-results" ]]; then
        execute_command "Remove test results" "rm -rf test-results/*"
        FILES_REMOVED=$((FILES_REMOVED + 1))
    fi
    
    log_success "Cache cleanup completed"
}

cleanup_logs() {
    log "📋 Cleaning up log files..."
    
    cd "$PROJECT_ROOT"
    
    # CI logs
    if [[ -d "ci-logs" ]]; then
        local log_count=$(find ci-logs -name "*.log" 2>/dev/null | wc -l)
        if [[ $log_count -gt 0 ]]; then
            execute_command "Remove CI log files" "rm -rf ci-logs/*.log"
            FILES_REMOVED=$((FILES_REMOVED + log_count))
        fi
    fi
    
    # Performance results (if not soft cleanup)
    if [[ "$SOFT_CLEANUP" != true ]] && [[ -d "ci-performance" ]]; then
        if confirm_action "Remove performance benchmark data?"; then
            execute_command "Remove performance results" "rm -rf ci-performance/results/*"
            execute_command "Remove performance exports" "rm -rf ci-performance/exports/*"
            FILES_REMOVED=$((FILES_REMOVED + 2))
        fi
    fi
    
    # System logs (macOS)
    if [[ "$(uname)" == "Darwin" ]] && [[ "$SOFT_CLEANUP" != true ]]; then
        execute_command "Clean system logs (macOS)" "sudo log collect --last 1d --output /tmp/system.logarchive && rm -f /tmp/system.logarchive" || true
    fi
    
    # Docker logs
    execute_command "Clean Docker logs" "docker system prune -f --volumes" || true
    
    log_success "Log cleanup completed"
}

# ==============================================================================
# SPECIALIZED CLEANUP FUNCTIONS
# ==============================================================================

cleanup_test_artifacts() {
    log "🧪 Cleaning up test artifacts..."
    
    cd "$PROJECT_ROOT"
    
    # Remove temporary test files
    execute_command "Remove temp test files" "find . -name '*.tmp' -o -name '*.temp' | head -100 | xargs rm -f" || true
    
    # Clean test databases (if not soft cleanup)
    if [[ "$SOFT_CLEANUP" != true ]]; then
        if command -v psql >/dev/null 2>&1; then
            execute_command "Drop test databases" "psql -c 'DROP DATABASE IF EXISTS test_db' 2>/dev/null" || true
        fi
    fi
    
    # Remove debug artifacts
    if [[ -d "e2e/debug" ]]; then
        execute_command "Remove E2E debug artifacts" "rm -rf e2e/debug/*"
        FILES_REMOVED=$((FILES_REMOVED + 1))
    fi
    
    log_success "Test artifact cleanup completed"
}

cleanup_development_artifacts() {
    log "💻 Cleaning up development artifacts..."
    
    cd "$PROJECT_ROOT"
    
    # Remove editor temporary files
    execute_command "Remove editor temp files" "find . -name '.DS_Store' -o -name 'Thumbs.db' -o -name '.vscode/.browse.c_cpp.db*' | head -50 | xargs rm -f" || true
    
    # Clean IDE caches
    if [[ -d ".vscode" ]] && [[ "$SOFT_CLEANUP" != true ]]; then
        execute_command "Clean VS Code cache" "rm -rf .vscode/.browse.c_cpp.db*" || true
    fi
    
    # Remove temporary directories
    execute_command "Remove temp directories" "find . -name 'tmp' -type d -exec rm -rf {} + 2>/dev/null" || true
    
    log_success "Development artifact cleanup completed"
}

# ==============================================================================
# VERIFICATION AND REPORTING
# ==============================================================================

verify_cleanup() {
    log "🔍 Verifying cleanup results..."
    
    # Check for remaining containers
    local remaining_containers=$(docker ps -aq 2>/dev/null | wc -l)
    log_info "Remaining containers: $remaining_containers"
    
    # Check for remaining volumes
    local remaining_volumes=$(docker volume ls -q 2>/dev/null | wc -l)
    log_info "Remaining volumes: $remaining_volumes"
    
    # Check for remaining images
    local remaining_images=$(docker images -q 2>/dev/null | wc -l)
    log_info "Remaining images: $remaining_images"
    
    # Check disk usage
    local current_usage=$(get_disk_usage)
    log_info "Current disk usage: $current_usage"
    
    # Check for important files
    if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
        log_error "Critical file missing: package.json"
    fi
    
    if [[ ! -f "$PROJECT_ROOT/docker-compose.yml" ]]; then
        log_error "Critical file missing: docker-compose.yml"
    fi
    
    log_success "Cleanup verification completed"
}

generate_cleanup_report() {
    log "📊 Generating cleanup report..."
    
    local report_file="$PROJECT_ROOT/ci-cleanup-report-$TIMESTAMP.txt"
    
    cat > "$report_file" << EOF
CI Cleanup Report
================

Timestamp: $(date)
Cleanup Mode: $([ "$SOFT_CLEANUP" == true ] && echo "Soft" || echo "Full")
Dry Run: $DRY_RUN

Cleanup Statistics:
- Containers removed: $CONTAINERS_REMOVED
- Volumes removed: $VOLUMES_REMOVED  
- Images removed: $IMAGES_REMOVED
- Files/directories removed: $FILES_REMOVED

System Status:
- Docker containers: $(docker ps -q | wc -l) running
- Docker volumes: $(docker volume ls -q | wc -l) total
- Docker images: $(docker images -q | wc -l) total
- Disk usage: $(get_disk_usage)

Actions Performed:
$([ "$CLEAN_CONTAINERS" == true ] && echo "✓ Container cleanup" || echo "✗ Container cleanup")
$([ "$CLEAN_VOLUMES" == true ] && echo "✓ Volume cleanup" || echo "✗ Volume cleanup")
$([ "$CLEAN_IMAGES" == true ] && echo "✓ Image cleanup" || echo "✗ Image cleanup")
$([ "$CLEAN_CACHE" == true ] && echo "✓ Cache cleanup" || echo "✗ Cache cleanup")
$([ "$CLEAN_LOGS" == true ] && echo "✓ Log cleanup" || echo "✗ Log cleanup")

Generated by: ci-cleanup.sh
EOF
    
    if [[ "$DRY_RUN" != true ]]; then
        log_success "Cleanup report saved: $report_file"
    else
        log_info "Dry run report would be saved to: $report_file"
    fi
}

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================

main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --all)
                CLEAN_ALL=true
                CLEAN_CONTAINERS=true
                CLEAN_VOLUMES=true
                CLEAN_IMAGES=true
                CLEAN_CACHE=true
                CLEAN_LOGS=true
                shift
                ;;
            --containers)
                CLEAN_CONTAINERS=true
                shift
                ;;
            --volumes)
                CLEAN_VOLUMES=true
                shift
                ;;
            --images)
                CLEAN_IMAGES=true
                shift
                ;;
            --cache)
                CLEAN_CACHE=true
                shift
                ;;
            --logs)
                CLEAN_LOGS=true
                shift
                ;;
            --soft)
                SOFT_CLEANUP=true
                shift
                ;;
            --force)
                FORCE_MODE=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
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
    
    # Default to soft cleanup if no specific options
    if [[ "$CLEAN_ALL" != true ]] && [[ "$CLEAN_CONTAINERS" != true ]] && \
       [[ "$CLEAN_VOLUMES" != true ]] && [[ "$CLEAN_IMAGES" != true ]] && \
       [[ "$CLEAN_CACHE" != true ]] && [[ "$CLEAN_LOGS" != true ]]; then
        CLEAN_CACHE=true
        CLEAN_LOGS=true
        SOFT_CLEANUP=true
    fi
    
    # Print header
    local mode_text="$([ "$DRY_RUN" == true ] && echo "DRY RUN - " || "")$([ "$SOFT_CLEANUP" == true ] && echo "SOFT " || "")CLEANUP"
    
    cat << EOF

╔══════════════════════════════════════════════════════════════════════╗
║                        CI CLEANUP & RESET                           ║
║                                                                      ║
║  $mode_text                                        ║
║  $(date)                                    ║
╚══════════════════════════════════════════════════════════════════════╝

EOF
    
    # Show what will be cleaned
    log "🗂️ Cleanup plan:"
    [[ "$CLEAN_CONTAINERS" == true ]] && log_info "- Docker containers and networks"
    [[ "$CLEAN_VOLUMES" == true ]] && log_info "- Docker volumes (databases, caches)"
    [[ "$CLEAN_IMAGES" == true ]] && log_info "- Docker images"
    [[ "$CLEAN_CACHE" == true ]] && log_info "- Build caches and temporary files"
    [[ "$CLEAN_LOGS" == true ]] && log_info "- Log files and reports"
    echo
    
    # Record initial disk usage
    local initial_usage=$(get_disk_usage)
    log_info "Initial disk usage: $initial_usage"
    
    # Confirm before proceeding (unless force mode)
    if [[ "$DRY_RUN" != true ]] && [[ "$FORCE_MODE" != true ]]; then
        if ! confirm_action "Proceed with cleanup?"; then
            exit 0
        fi
    fi
    
    # Execute cleanup operations
    [[ "$CLEAN_CONTAINERS" == true ]] && cleanup_containers
    [[ "$CLEAN_VOLUMES" == true ]] && cleanup_volumes
    [[ "$CLEAN_IMAGES" == true ]] && cleanup_images
    [[ "$CLEAN_CACHE" == true ]] && cleanup_cache
    [[ "$CLEAN_LOGS" == true ]] && cleanup_logs
    
    # Additional cleanup for full mode
    if [[ "$CLEAN_ALL" == true ]]; then
        cleanup_test_artifacts
        cleanup_development_artifacts
    fi
    
    # Verification and reporting
    if [[ "$DRY_RUN" != true ]]; then
        verify_cleanup
    fi
    
    generate_cleanup_report
    
    # Final summary
    local final_usage=$(get_disk_usage)
    
    if [[ "$DRY_RUN" == true ]]; then
        log_success "Dry run completed - no changes made! 🎉"
        log_info "Use without --dry-run to execute cleanup"
    else
        log_success "Cleanup completed successfully! 🎉"
        log_info "Containers removed: $CONTAINERS_REMOVED"
        log_info "Volumes removed: $VOLUMES_REMOVED"
        log_info "Images removed: $IMAGES_REMOVED"
        log_info "Files removed: $FILES_REMOVED"
        log_info "Disk usage: $initial_usage → $final_usage"
    fi
}

# Execute main function with all arguments
main "$@"