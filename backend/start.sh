#!/bin/bash
set -e

# Load local environment files for development before validating required vars.
if [ -f ".env" ]; then
  set -a
  . ".env"
  set +a
fi

if [ -f ".env.local" ]; then
  set -a
  . ".env.local"
  set +a
fi

echo "🔍 Checking environment..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set!"
  echo "Set DATABASE_URL in backend/.env for local development or in your host environment for deployment"
  echo "Format: mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<dbname>"
  exit 1
fi

echo "✅ DATABASE_URL is set"

if [[ "$DATABASE_URL" != mongodb://* && "$DATABASE_URL" != mongodb+srv://* ]]; then
  echo "❌ ERROR: DATABASE_URL is invalid for MongoDB"
  echo "Current value must start with mongodb:// or mongodb+srv://"
  echo "Example: mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<dbname>"
  exit 1
fi

echo "✅ DATABASE_URL uses MongoDB protocol"

# Check if JWT_SECRET is set
if [ -z "$JWT_SECRET" ]; then
  echo "❌ ERROR: JWT_SECRET environment variable is not set!"
  echo "Set JWT_SECRET in backend/.env for local development or in your host environment for deployment"
  exit 1
fi

echo "✅ JWT_SECRET is set"

if [ -z "$RENDER" ]; then
  echo "📦 Syncing Prisma schema with MongoDB (best-effort)..."
  # Add short timeout so we don't block startup for long if Atlas is unreachable
  PRISMA_DB_URL="$DATABASE_URL"
  if [[ "$DATABASE_URL" != *"serverSelectionTimeoutMS"* ]]; then
    PRISMA_DB_URL="${DATABASE_URL}&serverSelectionTimeoutMS=5000&connectTimeoutMS=5000"
  fi
  PRISMA_LOG_FILE="$(mktemp)"
  if DATABASE_URL="$PRISMA_DB_URL" npx prisma db push --skip-generate >"$PRISMA_LOG_FILE" 2>&1; then
    echo "✅ Database schema synced successfully"
  else
    echo "⚠️  Prisma db push failed - server will start anyway."
    echo "   MongoDB creates collections automatically on first write."
    echo "   Common cause: invalid DB credentials, Atlas IP rules, or paused cluster."
    echo "   Showing last Prisma logs:"
    tail -n 20 "$PRISMA_LOG_FILE"
  fi
  rm -f "$PRISMA_LOG_FILE"
else
  echo "🚀 Skipping Prisma db push on Render for faster startup"
fi

echo "🚀 Starting server..."
export PORT="${PORT:-10000}"
node dist/server.js
