#!/bin/bash

# ==============================================================================
# Full Stack Test Script - Docker + Database + E2E
# ==============================================================================
# Comprehensive test that starts all services and runs full test suite
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')] $*${NC}"
}

log_success() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')] ✅ $*${NC}"
}

log_error() {
    echo -e "${RED}[$(date '+%H:%M:%S')] ❌ $*${NC}"
}

cleanup() {
    log "🧹 Cleaning up services..."
    docker compose down --remove-orphans >/dev/null 2>&1 || true
}

trap cleanup EXIT

echo
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                    FULL STACK TEST SUITE                            ║"
echo "║                                                                      ║"
echo "║  Complete validation: Docker + Database + E2E + Phase 2 Scripts     ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo

cd "$PROJECT_ROOT"

# Check if Docker is running
log "🔍 Checking Docker availability..."
if ! docker info >/dev/null 2>&1; then
    log_error "Docker is not running"
    echo "  Please start Docker Desktop and try again"
    echo "  Or run: ./scripts/validate-phase2.sh for tests without Docker"
    exit 1
fi
log_success "Docker is running"

# Start services
log "🚀 Starting Docker services..."
if docker compose up -d db; then
    log_success "Database service started"
else
    log_error "Failed to start database"
    exit 1
fi

# Wait for database
log "⏳ Waiting for database to be ready..."
timeout=60
while ! docker compose exec db pg_isready -U postgres >/dev/null 2>&1; do
    sleep 1
    timeout=$((timeout - 1))
    if [[ $timeout -le 0 ]]; then
        log_error "Database failed to start within 60s"
        exit 1
    fi
done
log_success "Database is ready"

# Run Phase 2 validation
log "🔍 Running Phase 2 validation..."
if ./scripts/validate-phase2.sh; then
    log_success "Phase 2 validation passed"
else
    log_error "Phase 2 validation failed"
    exit 1
fi

# Run E2E auth setup test
log "🎭 Testing E2E authentication setup..."
if yarn test:e2e e2e/auth.setup.ts --reporter=list --timeout=30000; then
    log_success "E2E auth setup passed"
else
    log_error "E2E auth setup failed"
    exit 1
fi

log_success "🎉 Full stack test suite completed successfully!"