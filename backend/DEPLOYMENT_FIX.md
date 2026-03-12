# 🔧 Render Deployment Fix - Exit Status 1

## Problem
Your deployment was failing with "Exited with status 1 while running your code" after a successful build.

## Root Cause
The start command `npx prisma migrate deploy && npm start` fails when:
1. **DATABASE_URL is not set** in Render environment variables
2. Database is not accessible
3. Prisma migrations fail silently

## Solution Applied

### 1. Created `start.sh` Script
A robust startup script that:
- ✅ Validates required environment variables
- ✅ Provides clear error messages
- ✅ Checks DATABASE_URL and JWT_SECRET before starting
- ✅ Runs migrations with proper error handling
- ✅ Starts the server

### 2. Updated `render.yaml`
Changed start command from:
```bash
npx prisma migrate deploy && npm start
```

To:
```bash
chmod +x start.sh && ./start.sh
```

## How to Fix in Render Dashboard

### Step 1: Check Environment Variables

Go to your Render service → **Environment** tab:

**Required variables:**
```
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-key-here
NODE_ENV=production
PORT=10000
FRONTEND_URL=https://spllit.app
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
```

**Generate secrets if you don't have them:**
```bash
# Run these in terminal to generate secure secrets:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Step 2: Set Up PostgreSQL Database

If you haven't created a database yet:

1. In Render Dashboard, click **New +** → **PostgreSQL**
2. Name: `spllit-database`
3. Select plan (Free tier is fine for testing)
4. Click **Create Database**
5. **Copy the Internal Database URL**
6. Go back to your web service → Environment → Add `DATABASE_URL` with the copied URL

### Step 3: Update Build Settings

Go to **Settings** tab:

**Root Directory:** `backend`
**Build Command:** `npm install && npx prisma generate && npm run build`
**Start Command:** `chmod +x start.sh && ./start.sh`

### Step 4: Deploy

1. Go to **Manual Deploy** tab
2. Click **Clear build cache & deploy**
3. Watch the logs - you should now see helpful error messages or successful startup

## Expected Output After Fix

### ✅ Successful deployment will show:
```
🔍 Checking environment...
✅ DATABASE_URL is set
✅ JWT_SECRET is set
📦 Running Prisma migrations...
✅ Migrations completed successfully
🚀 Starting server...
🚀 Server running on port 10000
📡 Socket.IO enabled
🌐 Frontend URL: https://spllit.app
==> Your service is live 🎉
```

### ❌ If DATABASE_URL is missing:
```
🔍 Checking environment...
❌ ERROR: DATABASE_URL environment variable is not set!
Please set DATABASE_URL in Render Dashboard → Environment tab
```

### ❌ If database connection fails:
```
🔍 Checking environment...
✅ DATABASE_URL is set
✅ JWT_SECRET is set
📦 Running Prisma migrations...
❌ Prisma migrations failed!
This could mean:
  1. Database is not accessible
  2. DATABASE_URL is incorrect
  3. Database doesn't exist
```

## Alternative: Update in Dashboard Only

If you prefer not to use the shell script, you can manually update the start command in Render Dashboard:

**Go to Settings → Start Command:**
```bash
npx prisma migrate deploy && npm start || (echo "❌ Startup failed! Check DATABASE_URL and environment variables" && exit 1)
```

But the shell script provides much better error diagnostics.

## Next Steps

1. **Push these changes to GitHub:**
   ```bash
   git add backend/start.sh backend/render.yaml backend/DEPLOYMENT_FIX.md
   git commit -m "fix: Add robust startup script for Render deployment"
   git push
   ```

2. **In Render Dashboard:**
   - Add all required environment variables (especially DATABASE_URL)
   - Clear build cache & deploy

3. **Verify deployment:**
   ```bash
   curl https://spllit-backend.onrender.com/health
   ```

## Still Having Issues?

Check the deployment logs for the specific error message. The new `start.sh` script will provide clear guidance on what's missing.

Common issues:
- ❌ **"DATABASE_URL is not set"** → Add it in Environment tab
- ❌ **"Connection refused"** → Database might be in a different region
- ❌ **"Authentication failed"** → Check DATABASE_URL credentials
- ❌ **"Database does not exist"** → Create the database first in Render
