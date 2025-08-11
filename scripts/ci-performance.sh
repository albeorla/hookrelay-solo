#!/bin/bash

# ==============================================================================
# CI Performance Benchmark Script
# ==============================================================================
# This script measures and analyzes the performance characteristics of the CI
# pipeline components, providing insights for optimization and regression detection.
#
# Usage:
#   ./scripts/ci-performance.sh [options]
#
# Options:
#   --full        Run complete performance suite (default)
#   --quick       Run quick performance checks only
#   --baseline    Create performance baseline for comparison
#   --compare     Compare against existing baseline
#   --profile     Enable detailed profiling
#   --export      Export results to CSV/JSON
#   --verbose     Enable verbose logging
#   --help        Show this help message
#
# Examples:
#   ./scripts/ci-performance.sh --baseline
#   ./scripts/ci-performance.sh --compare
#   ./scripts/ci-performance.sh --profile --export
# ==============================================================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
PERF_DIR="$PROJECT_ROOT/ci-performance"
RESULTS_DIR="$PERF_DIR/results"
BASELINES_DIR="$PERF_DIR/baselines"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default options
FULL_SUITE=true
QUICK_MODE=false
BASELINE_MODE=false
COMPARE_MODE=false
PROFILE_MODE=false
EXPORT_MODE=false
VERBOSE_MODE=false

# Performance tracking
declare -A PERF_RESULTS
declare -A BASELINE_RESULTS
TOTAL_START_TIME=0
TOTAL_DURATION=0

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

log_perf() {
    echo -e "${PURPLE}[$(date '+%H:%M:%S')] 📊 $*${NC}"
}

show_help() {
    cat << EOF
CI Performance Benchmark Script

USAGE:
    ./scripts/ci-performance.sh [OPTIONS]

OPTIONS:
    --full        Run complete performance suite (default)
    --quick       Run quick performance checks only
    --baseline    Create performance baseline for comparison
    --compare     Compare against existing baseline
    --profile     Enable detailed profiling
    --export      Export results to CSV/JSON
    --verbose     Enable verbose logging
    --help        Show this help message

BENCHMARK CATEGORIES:
    Code Quality:  TypeScript, ESLint, Prettier performance
    Build System:  Compilation, bundling, optimization times
    Testing:       Unit test, E2E test execution times
    Docker:        Container build and startup performance
    Database:      Schema operations and query performance

EXAMPLES:
    ./scripts/ci-performance.sh --baseline
    ./scripts/ci-performance.sh --compare --verbose
    ./scripts/ci-performance.sh --profile --export

OUTPUT FILES:
    Results:    $RESULTS_DIR/
    Baselines:  $BASELINES_DIR/
    Exports:    $PERF_DIR/exports/
EOF
}

# ==============================================================================
# SETUP FUNCTIONS
# ==============================================================================

setup_directories() {
    log "Setting up performance directories..."
    
    mkdir -p "$PERF_DIR"
    mkdir -p "$RESULTS_DIR"
    mkdir -p "$BASELINES_DIR"
    mkdir -p "$PERF_DIR/exports"
    mkdir -p "$PERF_DIR/profiles"
    
    log_success "Directories created"
}

get_system_info() {
    log "Collecting system information..."
    
    local sys_info_file="$RESULTS_DIR/system-info-$TIMESTAMP.json"
    
    cat > "$sys_info_file" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "hostname": "$(hostname)",
  "os": "$(uname -s)",
  "os_version": "$(uname -r)",
  "architecture": "$(uname -m)",
  "cpu_cores": $(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo "unknown"),
  "memory_gb": $(free -g 2>/dev/null | awk '/^Mem:/{print $2}' || echo "unknown"),
  "docker_version": "$(docker --version 2>/dev/null || echo "not available")",
  "node_version": "$(node --version 2>/dev/null || echo "not available")",
  "yarn_version": "$(yarn --version 2>/dev/null || echo "not available")"
}
EOF
    
    if [[ "$VERBOSE_MODE" == true ]]; then
        log_info "System info saved to: $sys_info_file"
        cat "$sys_info_file"
    fi
}

# ==============================================================================
# PERFORMANCE MEASUREMENT FUNCTIONS
# ==============================================================================

measure_command() {
    local test_name="$1"
    local command="$2"
    local runs="${3:-3}"
    
    log_perf "Measuring: $test_name (${runs} runs)"
    
    local times=()
    local total_time=0
    local success_count=0
    
    for ((i=1; i<=runs; i++)); do
        if [[ "$VERBOSE_MODE" == true ]]; then
            log_info "Run $i/$runs: $test_name"
        fi
        
        local start_time=$(date +%s.%N)
        
        if eval "$command" >/dev/null 2>&1; then
            local end_time=$(date +%s.%N)
            local duration=$(echo "$end_time - $start_time" | bc -l)
            times+=("$duration")
            total_time=$(echo "$total_time + $duration" | bc -l)
            success_count=$((success_count + 1))
            
            if [[ "$VERBOSE_MODE" == true ]]; then
                log_info "Run $i completed in ${duration}s"
            fi
        else
            log_warning "Run $i failed for $test_name"
        fi
    done
    
    if [[ $success_count -gt 0 ]]; then
        local avg_time=$(echo "scale=3; $total_time / $success_count" | bc -l)
        local min_time=$(printf '%s\n' "${times[@]}" | sort -n | head -1)
        local max_time=$(printf '%s\n' "${times[@]}" | sort -n | tail -1)
        
        PERF_RESULTS["${test_name}_avg"]="$avg_time"
        PERF_RESULTS["${test_name}_min"]="$min_time"
        PERF_RESULTS["${test_name}_max"]="$max_time"
        PERF_RESULTS["${test_name}_runs"]="$success_count"
        
        log_perf "$test_name: avg=${avg_time}s, min=${min_time}s, max=${max_time}s"
        return 0
    else
        log_error "$test_name: All runs failed"
        return 1
    fi
}

# ==============================================================================
# CODE QUALITY BENCHMARKS
# ==============================================================================

benchmark_code_quality() {
    log "🔍 Benchmarking code quality tools..."
    
    cd "$PROJECT_ROOT"
    
    # Ensure dependencies are installed
    yarn install --frozen-lockfile --prefer-offline >/dev/null 2>&1
    
    # TypeScript compilation
    measure_command "typescript_check" "yarn typecheck" 3
    
    # ESLint analysis
    measure_command "eslint_check" "yarn lint" 3
    
    # Prettier formatting
    measure_command "prettier_check" "yarn format:check" 3
    
    # Combined quality check
    measure_command "quality_combined" "yarn typecheck && yarn lint && yarn format:check" 2
    
    log_success "Code quality benchmarks completed"
}

# ==============================================================================
# BUILD SYSTEM BENCHMARKS
# ==============================================================================

benchmark_build_system() {
    log "🏗️ Benchmarking build system..."
    
    cd "$PROJECT_ROOT"
    
    # Clean build (no cache)
    log_perf "Measuring clean build performance..."
    rm -rf .next 2>/dev/null || true
    measure_command "build_clean" "yarn build" 2
    
    # Incremental build (with cache)
    log_perf "Measuring incremental build performance..."
    touch src/app/page.tsx  # Trigger minimal change
    measure_command "build_incremental" "yarn build" 3
    
    # Development server startup
    measure_command "dev_startup" "timeout 30s yarn dev || true" 2
    
    # Bundle size analysis
    if [[ -d ".next" ]]; then
        local bundle_size=$(du -sh .next | cut -f1)
        PERF_RESULTS["bundle_size"]="$bundle_size"
        log_perf "Bundle size: $bundle_size"
    fi
    
    log_success "Build system benchmarks completed"
}

# ==============================================================================
# DATABASE BENCHMARKS
# ==============================================================================

benchmark_database() {
    log "🗄️ Benchmarking database operations..."
    
    cd "$PROJECT_ROOT"
    
    # Database schema operations
    measure_command "prisma_generate" "yarn prisma generate" 3
    measure_command "prisma_db_push" "yarn prisma db push --force-reset" 2
    
    # Seed data operations
    if [[ -f "prisma/seed.ts" ]] || [[ -f "prisma/seed.js" ]]; then
        measure_command "prisma_seed" "yarn prisma db seed" 2
    fi
    
    log_success "Database benchmarks completed"
}

# ==============================================================================
# DOCKER BENCHMARKS
# ==============================================================================

benchmark_docker() {
    log "🐳 Benchmarking Docker operations..."
    
    cd "$PROJECT_ROOT"
    
    # Docker build performance
    measure_command "docker_build" "docker build -t ci-perf-test ." 2
    
    # Docker Compose startup
    if [[ -f "docker-compose.yml" ]]; then
        measure_command "docker_compose_up" "docker-compose up -d db && docker-compose down" 2
    fi
    
    # Container startup time
    measure_command "container_startup" "docker run --rm ci-perf-test echo 'ready'" 3
    
    # Cleanup
    docker rmi ci-perf-test >/dev/null 2>&1 || true
    
    log_success "Docker benchmarks completed"
}

# ==============================================================================
# TESTING BENCHMARKS
# ==============================================================================

benchmark_testing() {
    log "🧪 Benchmarking testing performance..."
    
    cd "$PROJECT_ROOT"
    
    # E2E test performance (if available)
    if [[ -d "e2e" ]] && command -v docker-compose >/dev/null 2>&1; then
        log_perf "Measuring E2E test performance..."
        measure_command "e2e_tests" "timeout 300s docker-compose up --build --exit-code-from e2e e2e || true" 1
    fi
    
    # Unit test performance (when available)
    if yarn info jest >/dev/null 2>&1; then
        measure_command "unit_tests" "yarn test" 2
    fi
    
    log_success "Testing benchmarks completed"
}

# ==============================================================================
# PARALLEL PERFORMANCE BENCHMARKS
# ==============================================================================

benchmark_parallel_performance() {
    log "⚡ Benchmarking parallel execution..."
    
    cd "$PROJECT_ROOT"
    
    # Sequential execution
    measure_command "sequential_quality" "yarn typecheck && yarn lint && yarn format:check" 2
    
    # Parallel execution simulation
    measure_command "parallel_quality" "(yarn typecheck & yarn lint & yarn format:check &; wait)" 2
    
    # Calculate speedup
    if [[ -n "${PERF_RESULTS["sequential_quality_avg"]:-}" ]] && [[ -n "${PERF_RESULTS["parallel_quality_avg"]:-}" ]]; then
        local sequential="${PERF_RESULTS["sequential_quality_avg"]}"
        local parallel="${PERF_RESULTS["parallel_quality_avg"]}"
        local speedup=$(echo "scale=2; $sequential / $parallel" | bc -l)
        PERF_RESULTS["parallel_speedup"]="$speedup"
        log_perf "Parallel speedup: ${speedup}x"
    fi
    
    log_success "Parallel performance benchmarks completed"
}

# ==============================================================================
# BASELINE MANAGEMENT
# ==============================================================================

save_baseline() {
    log "💾 Saving performance baseline..."
    
    local baseline_file="$BASELINES_DIR/baseline-$TIMESTAMP.json"
    local latest_baseline="$BASELINES_DIR/latest.json"
    
    # Create baseline JSON
    cat > "$baseline_file" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "version": "$(git rev-parse HEAD 2>/dev/null || echo "unknown")",
  "system": {
    "os": "$(uname -s)",
    "arch": "$(uname -m)",
    "cores": $(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo "1")
  },
  "results": {
EOF
    
    local first=true
    for key in "${!PERF_RESULTS[@]}"; do
        if [[ "$first" == true ]]; then
            first=false
        else
            echo "," >> "$baseline_file"
        fi
        echo "    \"$key\": \"${PERF_RESULTS[$key]}\"" >> "$baseline_file"
    done
    
    cat >> "$baseline_file" << EOF
  }
}
EOF
    
    # Update latest baseline link
    cp "$baseline_file" "$latest_baseline"
    
    log_success "Baseline saved: $baseline_file"
}

load_baseline() {
    local baseline_file="$BASELINES_DIR/latest.json"
    
    if [[ ! -f "$baseline_file" ]]; then
        log_warning "No baseline found. Run with --baseline first."
        return 1
    fi
    
    log "📖 Loading baseline for comparison..."
    
    # Parse baseline JSON (simple extraction)
    while IFS=': ' read -r key value; do
        if [[ "$key" =~ ^[[:space:]]*\"([^\"]+)\"$ ]]; then
            local clean_key="${BASH_REMATCH[1]}"
            local clean_value=$(echo "$value" | sed 's/[",]//g' | xargs)
            BASELINE_RESULTS["$clean_key"]="$clean_value"
        fi
    done < <(grep -E '"[^"]+": "[^"]*"' "$baseline_file")
    
    log_success "Baseline loaded from: $baseline_file"
    return 0
}

compare_with_baseline() {
    log "📊 Comparing performance with baseline..."
    
    if ! load_baseline; then
        return 1
    fi
    
    echo
    echo "Performance Comparison Report"
    echo "============================"
    printf "%-25s %12s %12s %12s %8s\n" "Metric" "Current" "Baseline" "Diff" "Change"
    echo "---------------------------------------------------------------------------------"
    
    for key in "${!PERF_RESULTS[@]}"; do
        if [[ "$key" =~ _avg$ ]]; then
            local current="${PERF_RESULTS[$key]}"
            local baseline="${BASELINE_RESULTS[$key]:-}"
            
            if [[ -n "$baseline" ]]; then
                local diff=$(echo "scale=3; $current - $baseline" | bc -l)
                local percent=$(echo "scale=1; ($diff / $baseline) * 100" | bc -l)
                
                local color=""
                local change_symbol=""
                if (( $(echo "$diff > 0" | bc -l) )); then
                    color="$RED"
                    change_symbol="↑"
                elif (( $(echo "$diff < 0" | bc -l) )); then
                    color="$GREEN"  
                    change_symbol="↓"
                else
                    color="$NC"
                    change_symbol="="
                fi
                
                local metric_name=$(echo "$key" | sed 's/_avg$//')
                printf "${color}%-25s %12.3fs %12.3fs %+12.3fs %7.1f%% %s${NC}\n" \
                    "$metric_name" "$current" "$baseline" "$diff" "$percent" "$change_symbol"
            fi
        fi
    done
    
    echo
}

# ==============================================================================
# EXPORT AND REPORTING
# ==============================================================================

export_results() {
    log "📤 Exporting performance results..."
    
    local export_dir="$PERF_DIR/exports"
    local csv_file="$export_dir/performance-$TIMESTAMP.csv"
    local json_file="$export_dir/performance-$TIMESTAMP.json"
    
    # Export CSV
    echo "metric,value,unit,timestamp" > "$csv_file"
    for key in "${!PERF_RESULTS[@]}"; do
        local unit="seconds"
        if [[ "$key" =~ size$ ]]; then
            unit="bytes"
        elif [[ "$key" =~ runs$ ]]; then
            unit="count"
        elif [[ "$key" =~ speedup$ ]]; then
            unit="ratio"
        fi
        echo "$key,${PERF_RESULTS[$key]},$unit,$(date -Iseconds)" >> "$csv_file"
    done
    
    # Export JSON
    cat > "$json_file" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo "unknown")",
  "total_duration": $TOTAL_DURATION,
  "results": {
EOF
    
    local first=true
    for key in "${!PERF_RESULTS[@]}"; do
        if [[ "$first" == true ]]; then
            first=false
        else
            echo "," >> "$json_file"
        fi
        echo "    \"$key\": \"${PERF_RESULTS[$key]}\"" >> "$json_file"
    done
    
    cat >> "$json_file" << EOF
  }
}
EOF
    
    log_success "Results exported:"
    log_info "CSV: $csv_file"
    log_info "JSON: $json_file"
}

generate_performance_report() {
    log "📋 Generating performance report..."
    
    local report_file="$RESULTS_DIR/performance-report-$TIMESTAMP.md"
    
    cat > "$report_file" << EOF
# CI Performance Benchmark Report

**Generated:** $(date)  
**Duration:** ${TOTAL_DURATION}s  
**Git Commit:** $(git rev-parse HEAD 2>/dev/null || echo "unknown")

## System Information

- **OS:** $(uname -s) $(uname -r)
- **Architecture:** $(uname -m)
- **CPU Cores:** $(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo "unknown")
- **Node.js:** $(node --version)
- **Docker:** $(docker --version | head -1)

## Performance Results

### Code Quality Tools
EOF
    
    # Add results to report
    for key in "${!PERF_RESULTS[@]}"; do
        if [[ "$key" =~ typescript.*_avg$ ]]; then
            echo "- **TypeScript Check:** ${PERF_RESULTS[$key]}s" >> "$report_file"
        elif [[ "$key" =~ eslint.*_avg$ ]]; then
            echo "- **ESLint Check:** ${PERF_RESULTS[$key]}s" >> "$report_file"
        elif [[ "$key" =~ prettier.*_avg$ ]]; then
            echo "- **Prettier Check:** ${PERF_RESULTS[$key]}s" >> "$report_file"
        fi
    done
    
    cat >> "$report_file" << EOF

### Build System
EOF
    
    for key in "${!PERF_RESULTS[@]}"; do
        if [[ "$key" =~ build.*_avg$ ]]; then
            echo "- **$(echo "$key" | sed 's/_avg$//' | tr '_' ' ' | sed 's/\b\w/\U&/g'):** ${PERF_RESULTS[$key]}s" >> "$report_file"
        fi
    done
    
    if [[ -n "${PERF_RESULTS["bundle_size"]:-}" ]]; then
        echo "- **Bundle Size:** ${PERF_RESULTS["bundle_size"]}" >> "$report_file"
    fi
    
    cat >> "$report_file" << EOF

### Performance Insights

$(if [[ -n "${PERF_RESULTS["parallel_speedup"]:-}" ]]; then
    echo "- **Parallel Speedup:** ${PERF_RESULTS["parallel_speedup"]}x improvement"
fi)

### Recommendations

$(if (( $(echo "${PERF_RESULTS["typescript_check_avg"]:-0} > 30" | bc -l) )); then
    echo "- ⚠️ TypeScript compilation is slow (>${PERF_RESULTS["typescript_check_avg"]}s). Consider incremental builds."
fi)
$(if (( $(echo "${PERF_RESULTS["eslint_check_avg"]:-0} > 60" | bc -l) )); then
    echo "- ⚠️ ESLint is slow (>${PERF_RESULTS["eslint_check_avg"]}s). Consider caching or rule optimization."
fi)

---
*Generated by ci-performance.sh*
EOF
    
    log_success "Report generated: $report_file"
}

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================

main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --full)
                FULL_SUITE=true
                QUICK_MODE=false
                shift
                ;;
            --quick)
                QUICK_MODE=true
                FULL_SUITE=false
                shift
                ;;
            --baseline)
                BASELINE_MODE=true
                shift
                ;;
            --compare)
                COMPARE_MODE=true
                shift
                ;;
            --profile)
                PROFILE_MODE=true
                shift
                ;;
            --export)
                EXPORT_MODE=true
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
    
    # Print header
    cat << EOF

╔══════════════════════════════════════════════════════════════════════╗
║                    CI PERFORMANCE BENCHMARKS                        ║
║                                                                      ║
║  Measure and analyze CI pipeline performance characteristics         ║
║  $(date)                                    ║
╚══════════════════════════════════════════════════════════════════════╝

EOF
    
    # Setup
    setup_directories
    get_system_info
    
    # Start total timer
    TOTAL_START_TIME=$(date +%s.%N)
    
    # Run benchmarks based on mode
    if [[ "$QUICK_MODE" == true ]]; then
        log "🚀 Running quick performance checks..."
        benchmark_code_quality
    else
        log "🔧 Running full performance suite..."
        benchmark_code_quality
        benchmark_build_system
        benchmark_database
        benchmark_docker
        benchmark_testing
        benchmark_parallel_performance
    fi
    
    # Calculate total duration
    local end_time=$(date +%s.%N)
    TOTAL_DURATION=$(echo "$end_time - $TOTAL_START_TIME" | bc -l)
    
    # Handle baseline and comparison
    if [[ "$BASELINE_MODE" == true ]]; then
        save_baseline
    fi
    
    if [[ "$COMPARE_MODE" == true ]]; then
        compare_with_baseline
    fi
    
    # Export results
    if [[ "$EXPORT_MODE" == true ]]; then
        export_results
    fi
    
    # Generate report
    generate_performance_report
    
    # Final summary
    log_success "Performance benchmarks completed in ${TOTAL_DURATION}s! 🎉"
    log_info "Results saved to: $RESULTS_DIR"
    
    if [[ "$BASELINE_MODE" == true ]]; then
        log_info "Baseline created for future comparisons"
    fi
    
    if [[ "$COMPARE_MODE" == true ]]; then
        log_info "Comparison completed - check output above"
    fi
}

# Execute main function with all arguments
main "$@"