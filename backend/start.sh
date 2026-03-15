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
npx prisma db push 2>&1 && echo "✅ Database schema synced successfully" || {
  echo "⚠️  Prisma db push failed - server will start anyway."
  echo "   MongoDB creates collections automatically on first write."
  echo "   Common cause: IP not whitelisted in MongoDB Atlas Network Access."
  echo "   Fix: Atlas Dashboard → Network Access → Add 0.0.0.0/0"
}

echo "🚀 Starting server..."
node dist/server.js
