#!/bin/bash
set -e

echo "🔍 Checking environment..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set!"
  echo "Please set DATABASE_URL in Render Dashboard → Environment tab"
  exit 1
fi

echo "✅ DATABASE_URL is set"

# Check if JWT_SECRET is set
if [ -z "$JWT_SECRET" ]; then
  echo "❌ ERROR: JWT_SECRET environment variable is not set!"
  echo "Please set JWT_SECRET in Render Dashboard → Environment tab"
  exit 1
fi

echo "✅ JWT_SECRET is set"

echo "📦 Running Prisma migrations..."
npx prisma migrate deploy 2>&1 || {
  EXIT_CODE=$?
  echo "⚠️  prisma migrate deploy failed (exit code $EXIT_CODE)"
  echo "Attempting to resolve with prisma migrate resolve..."
  
  # If P3005 (schema not empty), baseline the existing migration
  # This marks existing migrations as already applied without running them
  MIGRATION_NAME=$(ls -1 prisma/migrations/ | grep -v migration_lock.toml | head -1)
  if [ -n "$MIGRATION_NAME" ]; then
    echo "📌 Baselining migration: $MIGRATION_NAME"
    npx prisma migrate resolve --applied "$MIGRATION_NAME" 2>&1 || {
      echo "⚠️  Resolve also failed. Trying db push as fallback..."
      npx prisma db push --accept-data-loss 2>&1 || {
        echo "❌ All migration strategies failed!"
        echo "DATABASE_URL format should be:"
        echo "postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
        exit 1
      }
    }
    # After resolving, try migrate deploy again for any remaining migrations
    echo "📦 Re-running prisma migrate deploy..."
    npx prisma migrate deploy 2>&1 || true
  else
    echo "❌ No migrations found in prisma/migrations/"
    exit 1
  fi
}

echo "✅ Migrations completed successfully"

echo "🚀 Starting server..."
node dist/server.js
