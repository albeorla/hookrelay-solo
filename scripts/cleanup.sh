#!/bin/bash

# Cleanup Script for albeorla-ts-starter
# Removes deprecated files, build artifacts, and temporary files
# before committing documentation consolidation changes

set -e

echo "🧹 Starting cleanup process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to safely remove file if it exists
remove_file() {
    local file_path="$1"
    local description="$2"
    
    if [ -f "$file_path" ]; then
        echo -e "${YELLOW}Removing:${NC} $description"
        rm "$file_path"
        echo -e "${GREEN}✓${NC} Removed: $file_path"
    else
        echo -e "${BLUE}ℹ${NC} File not found (already clean): $file_path"
    fi
}

# Function to safely remove directory if it exists
remove_directory() {
    local dir_path="$1"
    local description="$2"
    
    if [ -d "$dir_path" ]; then
        echo -e "${YELLOW}Removing:${NC} $description"
        rm -rf "$dir_path"
        echo -e "${GREEN}✓${NC} Removed: $dir_path"
    else
        echo -e "${BLUE}ℹ${NC} Directory not found (already clean): $dir_path"
    fi
}

echo ""
echo "📚 Cleaning up deprecated documentation files..."

# Remove deprecated documentation files that have been consolidated
remove_file "docs/development-guide.md" "Old development guide (replaced by docs/development.md)"
remove_file "docs/environment-setup.md" "Old environment setup guide (merged into docs/getting-started.md)"

echo ""
echo "🏗️ Cleaning up build artifacts and cache files..."

# Remove TypeScript build cache
remove_file "tsconfig.tsbuildinfo" "TypeScript build cache"

# Remove test reports and artifacts
remove_directory "playwright-report" "Playwright test reports"
remove_directory "test-results" "Playwright test results"
remove_directory "coverage" "Code coverage reports"

# Remove Next.js build cache if it exists (but keep .next for development)
remove_directory ".next/cache" "Next.js build cache"

echo ""
echo "🗂️ Cleaning up temporary files..."

# Remove common temporary files
remove_file ".DS_Store" "macOS system file"
remove_file "*.log" "Log files" 2>/dev/null || true
remove_file "npm-debug.log*" "NPM debug logs" 2>/dev/null || true
remove_file "yarn-debug.log*" "Yarn debug logs" 2>/dev/null || true
remove_file "yarn-error.log*" "Yarn error logs" 2>/dev/null || true

# Remove editor temporary files
find . -name "*.swp" -type f -delete 2>/dev/null || true
find . -name "*.swo" -type f -delete 2>/dev/null || true
find . -name "*~" -type f -delete 2>/dev/null || true

echo ""
echo "📋 Summary of cleanup actions:"
echo "• Removed deprecated documentation files"
echo "• Cleaned up build artifacts and cache files"
echo "• Removed temporary files and editor artifacts"
echo "• Cleaned up test reports and coverage data"

echo ""
echo -e "${GREEN}✅ Cleanup completed successfully!${NC}"
echo ""
echo "📝 Next steps:"
echo "1. Review changes with: git status"
echo "2. Commit documentation consolidation: git add . && git commit -m 'docs: consolidate documentation structure'"
echo "3. Continue with remaining documentation tasks"

# Optional: Show what's left in docs directory
echo ""
echo "📁 Remaining files in docs/ directory:"
ls -la docs/ 2>/dev/null || echo "No docs directory found"

echo ""
echo -e "${BLUE}ℹ${NC} Cleanup script completed. Ready for commit!"