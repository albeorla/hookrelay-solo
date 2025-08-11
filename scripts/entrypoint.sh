#!/bin/sh
set -e

echo "Starting in MODE: ${MODE:-production}"

if [ "$MODE" = "test" ]; then
  echo "Waiting for database to be ready..."
  # Extract host from DATABASE_URL or default to localhost for GitHub Actions
  DB_HOST=${DATABASE_URL#*@}  # Remove everything before @
  DB_HOST=${DB_HOST%%:*}      # Remove everything after first :
  DB_HOST=${DB_HOST:-localhost}  # Default to localhost if empty
  
  echo "Checking database connection to: $DB_HOST"
  until pg_isready -h "$DB_HOST" -p 5432 -q; do
    echo "Database is not ready yet. Waiting..."
    sleep 2
  done
  echo "Database is ready!"
  
  # Always ensure database is properly set up
  echo "Setting up database schema..."
  yarn prisma db push --skip-generate
  echo "Schema push completed successfully."
  
  echo "Seeding database (upsert mode handles duplicates)..."
  yarn prisma db seed
  echo "Database seeding completed successfully."
  
  # Verify seeding worked by checking if we have permissions
  echo "Verifying database seeding..."
  node -e "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    prisma.permission.count().then(count => {
      console.log('Found', count, 'permissions in database');
      if (count === 0) {
        console.error('ERROR: No permissions found - seeding failed!');
        process.exit(1);
      }
      return prisma.\$disconnect();
    }).catch(err => {
      console.error('Database verification failed:', err);
      process.exit(1);
    });
  "
  
  echo "Database setup completed and verified."
  
  echo "Running E2E tests..."
  if [ -n "$PLAYWRIGHT_SHARD" ]; then
    echo "Running E2E tests with sharding: $PLAYWRIGHT_SHARD"
    exec CI=true dotenv -e .env.test -- playwright test --reporter=dot --max-failures=1 --shard="$PLAYWRIGHT_SHARD"
  else
    echo "Running E2E tests without sharding"
    exec yarn test:e2e:ci
  fi
else
  echo "Starting Next.js in production mode..."
  exec yarn start
fi
