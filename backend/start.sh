#!/bin/bash
set -e

echo "🔍 Checking environment..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set!"
  echo "Please set DATABASE_URL in Render Dashboard → Environment tab"
  echo "Format: mongodb+srv://USER:PASSWORD@cluster.mongodb.net/DATABASE"
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

echo "📦 Syncing Prisma schema with MongoDB..."
npx prisma db push 2>&1 || {
  echo "❌ Prisma db push failed!"
  echo "This could mean:"
  echo "  1. Database is not accessible"
  echo "  2. DATABASE_URL is incorrect"
  echo "  3. MongoDB cluster is not reachable"
  echo ""
  echo "DATABASE_URL format should be:"
  echo "mongodb+srv://USER:PASSWORD@cluster.mongodb.net/DATABASE"
  exit 1
}

echo "✅ Database schema synced successfully"

echo "🚀 Starting server..."
node dist/server.js
