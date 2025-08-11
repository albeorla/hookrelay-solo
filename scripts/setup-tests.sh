#!/usr/bin/env bash
# Setup script for running Playwright E2E tests
set -euo pipefail

# Default database URL used if none provided
DEFAULT_DB_URL="postgresql://postgres:password@localhost:5432/test_db"

# Use DATABASE_URL from environment or fallback
export DATABASE_URL="${DATABASE_URL:-$DEFAULT_DB_URL}"

# Start local database if running script without active DB
DB_PORT=$(echo "$DATABASE_URL" | awk -F':' '{print $4}' | awk -F'/' '{print $1}')
if ! nc -z localhost "$DB_PORT" >/dev/null 2>&1; then
  if [ -x "./start-database.sh" ]; then
    echo "Starting local PostgreSQL container on port $DB_PORT..."
    # create .env from example if it doesn't exist
    if [ ! -f .env ]; then
      echo "Creating .env from .env.example"
      cp .env.example .env
    fi
    ./start-database.sh
  else
    echo "Database is not running and start-database.sh not found."
    exit 1
  fi
fi

# Install node dependencies
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  yarn install --frozen-lockfile
fi

# Install Playwright browsers and dependencies
if ! npx playwright --version >/dev/null 2>&1; then
  echo "Installing Playwright browsers..."
  yarn playwright install --with-deps
else
  echo "Playwright already installed"
fi

# Generate Prisma client
echo "Generating Prisma client..."
yarn prisma generate

# Apply database schema and seed
echo "Applying database schema and seeding..."
yarn prisma db push
yarn prisma db seed

echo "Setup complete"
