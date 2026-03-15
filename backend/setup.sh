#!/bin/bash

# Spllit Backend Setup Script
# This script will help you set up the backend server

set -e

echo "🚀 Spllit Backend Setup"
echo "======================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${YELLOW}⚠️  Please run this script from the backend directory${NC}"
    echo "cd backend && ./setup.sh"
    exit 1
fi

echo -e "${BLUE}Step 1: Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${BLUE}Step 2: Creating .env file...${NC}"
    cp .env.example .env
    
    # Generate JWT secrets
    JWT_SECRET=$(openssl rand -base64 32)
    JWT_REFRESH_SECRET=$(openssl rand -base64 32)
    
    # Update .env with generated secrets
    sed -i "s|your_super_secret_jwt_key_change_this_in_production|$JWT_SECRET|g" .env
    sed -i "s|your_super_secret_refresh_key_change_this_in_production|$JWT_REFRESH_SECRET|g" .env
    
    echo -e "${GREEN}✅ .env file created with auto-generated JWT secrets${NC}"
    echo -e "${YELLOW}⚠️  You still need to update DATABASE_URL in .env${NC}"
    echo ""
else
    echo -e "${GREEN}✅ .env file already exists${NC}"
    echo ""
fi

# Check if DATABASE_URL still contains a placeholder
if grep -q "<db_password>\|<username>\|<cluster>\|<dbname>" .env; then
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}⚠️  DATABASE SETUP REQUIRED${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Choose your database option:"
    echo ""
    echo "Option A: MongoDB Atlas (Recommended)"
    echo "  1. Go to: https://www.mongodb.com/atlas"
    echo "  2. Create a free shared cluster"
    echo "  3. Create DB user + allow network access"
    echo "  4. Copy the SRV connection string"
    echo "  5. Update DATABASE_URL in .env file"
    echo ""
    echo "Option B: Local MongoDB"
    echo "  Run: sudo apt install mongodb"
    echo "  Start service and create database 'spllit'"
    echo "  Update: DATABASE_URL=\"mongodb://localhost:27017/spllit\""
    echo ""
    echo -e "${BLUE}After setting DATABASE_URL, run:${NC}"
    echo "  npm run prisma:generate"
    echo "  npx prisma db push"
    echo ""
    exit 0
fi

echo -e "${BLUE}Step 3: Generating Prisma Client...${NC}"
npm run prisma:generate
echo -e "${GREEN}✅ Prisma Client generated${NC}"
echo ""

echo -e "${BLUE}Step 4: Syncing database schema...${NC}"
npx prisma db push
echo -e "${GREEN}✅ Database schema synced${NC}"
echo ""

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}To start the development server:${NC}"
echo "  npm run dev"
echo ""
echo -e "${BLUE}The server will run on:${NC}"
echo "  http://localhost:3001"
echo ""
echo -e "${BLUE}Optional: Open Prisma Studio to view/edit data:${NC}"
echo "  npm run prisma:studio"
echo ""
echo -e "${BLUE}Test the API:${NC}"
echo "  curl http://localhost:3001/health"
echo ""
