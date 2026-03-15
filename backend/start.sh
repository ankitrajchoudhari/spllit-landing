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

echo "📦 Syncing Prisma schema with MongoDB (non-fatal)..."
# Add short timeout so we don't block the deploy for 30 s if Atlas is unreachable
PRISMA_DB_URL="$DATABASE_URL"
if [[ "$DATABASE_URL" != *"serverSelectionTimeoutMS"* ]]; then
  PRISMA_DB_URL="${DATABASE_URL}&serverSelectionTimeoutMS=5000&connectTimeoutMS=5000"
fi
DATABASE_URL="$PRISMA_DB_URL" npx prisma db push 2>&1 && echo "✅ Database schema synced successfully" || {
  echo "⚠️  Prisma db push failed - server will start anyway."
  echo "   MongoDB creates collections automatically on first write."
  echo "   Common cause: Atlas IP not whitelisted OR cluster is paused."
  echo "   Fix 1: Atlas Dashboard → Network Access → Add IP 0.0.0.0/0"
  echo "   Fix 2: Atlas Dashboard → Resume cluster if it is paused"
  true
}

echo "🚀 Starting server..."
node dist/server.js
