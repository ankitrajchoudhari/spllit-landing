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
npx prisma migrate deploy || {
  echo "❌ Prisma migrations failed!"
  echo "This could mean:"
  echo "  1. Database is not accessible"
  echo "  2. DATABASE_URL is incorrect"
  echo "  3. Database doesn't exist"
  echo ""
  echo "DATABASE_URL format should be:"
  echo "postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
  exit 1
}

echo "✅ Migrations completed successfully"

echo "🚀 Starting server..."
node dist/server.js
