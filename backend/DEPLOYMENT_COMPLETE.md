# 🚀 Render Backend - Complete Setup Guide

## ✅ What's Been Done

Your backend is ready for Render deployment! Here's what was configured:

### Files Created:
1. ✅ `Dockerfile` - Optimized Docker configuration
2. ✅ `render.yaml` - Infrastructure as Code configuration
3. ✅ `.env.render` - Pre-configured environment variables with generated JWT secrets
4. ✅ `deploy-to-render.sh` - Automated deployment helper script
5. ✅ `test-render-deployment.sh` - Deployment testing script
6. ✅ `RENDER_SETUP.md` - Detailed deployment guide
7. ✅ `RENDER_QUICK_REFERENCE.md` - Quick reference card
8. ✅ `FRONTEND_RENDER_CONFIG.md` - Frontend configuration guide

### Configuration Complete:
- ✅ JWT secrets generated (unique and secure)
- ✅ Build and start commands configured
- ✅ Health check endpoint ready
- ✅ CORS configured for your domains
- ✅ Dockerfile optimized for Node.js 20
- ✅ Prisma migrations ready to run

---

## 🎯 Quick Start (5 Minutes)

### Step 1: Go to Your Render Dashboard

**Click here:** https://dashboard.render.com/web/srv-d6o6nji4d50c73fdl27g

### Step 2: Add Environment Variables

1. Click the **"Environment"** tab
2. Click **"Add Environment Variable"**
3. **Copy and paste each variable from the output below:**

```bash
# View your generated environment variables:
cat backend/.env.render
```

**Your Generated Secrets:**
- JWT_SECRET: `efa24c692faacef560c717571db26175dab6ceaaed75a71c6d3cd726bc6b7abc1754190b11f00a6115b951c77e0e47bb25b682439b1f34a1fe3423cae052e766`
- JWT_REFRESH_SECRET: `bce63f6b7dfa283dd01b6b13b1ac8bf019109c7228dd0ae704514fdbb5420335e2c4bbe7bb39be8f48daf29f563d1d35b4ae5aa7a52e848ccabe766e786721a8`

**⚠️ IMPORTANT:** You MUST add `DATABASE_URL` with your PostgreSQL connection string!

### Step 3: Configure Build Settings

Click the **"Settings"** tab and verify:

**Build Command:**
```
npm install && npx prisma generate && npm run build
```

**Start Command:**
```
npx prisma migrate deploy && npm start
```

**Health Check Path:**
```
/health
```

### Step 4: Deploy!

1. Go to **"Manual Deploy"** tab
2. Click **"Deploy latest commit"**
3. Wait 2-5 minutes for deployment
4. Watch logs for success message

### Step 5: Test Your Deployment

Run this command to test:
```bash
cd backend && ./test-render-deployment.sh
```

Or manually:
```bash
curl https://srv-d6o6nji4d50c73fdl27g.onrender.com/health
```

Expected response:
```json
{"status":"ok","timestamp":"2026-03-10T..."}
```

### Step 6: Update Frontend

Add these to your frontend environment variables:

**For Vercel:**
- Go to: https://vercel.com/dashboard
- Project → Settings → Environment Variables
- Add:
  ```
  VITE_API_URL = https://srv-d6o6nji4d50c73fdl27g.onrender.com/api
  VITE_SOCKET_URL = https://srv-d6o6nji4d50c73fdl27g.onrender.com
  ```

**For Local Development:**
- Create `.env` in project root:
  ```env
  VITE_API_URL=https://srv-d6o6nji4d50c73fdl27g.onrender.com/api
  VITE_SOCKET_URL=https://srv-d6o6nji4d50c73fdl27g.onrender.com
  ```

---

## 🗄️ Database Setup

You need a PostgreSQL database! Choose one:

### Option A: Render PostgreSQL (Recommended)

1. Go to: https://dashboard.render.com
2. Click **"New +"** → **"PostgreSQL"**
3. Name: `spllit-database`
4. Region: Same as backend (Oregon recommended)
5. Plan: **Free** (or Starter $7/mo for production)
6. Click **"Create Database"**
7. **Copy "Internal Database URL"** (NOT External)
8. Go back to your backend service
9. Add it as `DATABASE_URL` environment variable

### Option B: Supabase (Free, Popular)

1. Go to: https://supabase.com
2. Create new project
3. Go to Settings → Database
4. Copy "Connection string" (URI format)
5. Format: `postgresql://postgres:[YOUR-PASSWORD]@[HOST]:5432/postgres`
6. Add as `DATABASE_URL` in Render

### Option C: Railway, Neon, etc.

Any PostgreSQL provider works! Just add the connection string as `DATABASE_URL`.

---

## ✅ Deployment Checklist

Use this to ensure everything is configured:

### Environment Variables (Render Dashboard → Environment)
- [ ] `NODE_ENV` = `production`
- [ ] `PORT` = `10000`
- [ ] `DATABASE_URL` = (your PostgreSQL URL)
- [ ] `JWT_SECRET` = (from .env.render)
- [ ] `JWT_REFRESH_SECRET` = (from .env.render)
- [ ] `JWT_EXPIRES_IN` = `1h`
- [ ] `JWT_REFRESH_EXPIRES_IN` = `7d`
- [ ] `FRONTEND_URL` = `https://spllit.app`

### Build Settings (Render Dashboard → Settings)
- [ ] Build Command: `npm install && npx prisma generate && npm run build`
- [ ] Start Command: `npx prisma migrate deploy && npm start`
- [ ] Health Check Path: `/health`
- [ ] Auto-Deploy: Enabled

### Deployment
- [ ] Manual deploy triggered
- [ ] Build successful (green checkmark)
- [ ] Service shows "Live" status
- [ ] Health check returns 200 OK

### Testing
- [ ] `curl https://srv-d6o6nji4d50c73fdl27g.onrender.com/health` works
- [ ] API endpoint responds
- [ ] Frontend can connect

### Frontend Update
- [ ] Environment variables updated
- [ ] Frontend redeployed
- [ ] Can login/register from frontend

---

## 🔧 Troubleshooting

### Build Failed

**Error: Cannot find module 'prisma'**
```
Solution: Ensure package.json has prisma in devDependencies
```

**Error: Prisma schema not found**
```
Solution: Ensure prisma/schema.prisma exists in your repo
```

### Deployment Failed / 502 Error

**Server not responding:**
1. Check Render logs for errors
2. Verify `PORT=10000` is set
3. Ensure DATABASE_URL is configured
4. Check if database is accessible

**Database connection failed:**
1. Verify DATABASE_URL format is correct
2. If using Render Postgres, use "Internal Database URL"
3. Ensure database is running
4. Check region compatibility

### CORS Errors

**Already configured for:**
- `http://localhost:5173` (local dev)
- `https://spllit.app` (production)
- `*.vercel.app` (preview deployments)

**To add more domains:**
Edit `backend/src/server.ts` and add to CORS origins array.

### First Request Slow (Free Tier)

**This is normal!** Free tier spins down after 15 minutes of inactivity.

**Solutions:**
- First request takes 30-60 seconds (cold start)
- Upgrade to Starter plan ($7/mo) for always-on
- Implement retry logic in frontend
- Use a keep-alive service (e.g., cron-job.org)

---

## 📊 Your Service Information

**Service URL:** `https://srv-d6o6nji4d50c73fdl27g.onrender.com`
**Service ID:** `srv-d6o6nji4d50c73fdl27g`
**Dashboard:** https://dashboard.render.com/web/srv-d6o6nji4d50c73fdl27g

**API Endpoints:**
- Health: `GET /health`
- Auth: `POST /api/auth/register`, `POST /api/auth/login`
- Rides: `POST /api/rides`, `GET /api/rides`
- Matches: `GET /api/matches`
- Users: `GET /api/users/profile`
- Admin: Various admin endpoints
- Socket.IO: WebSocket real-time connection

---

## 🎯 Next Steps After Deployment

1. **Test All Features:**
   - Authentication (login/register)
   - Ride creation
   - Match finding
   - Real-time updates (Socket.IO)
   - Admin functions

2. **Monitor Performance:**
   - Check Render Dashboard → Metrics
   - Review logs regularly
   - Set up alerts in Settings

3. **Security:**
   - Ensure all secrets are random and secure
   - Never commit `.env.render` file
   - Rotate JWT secrets periodically
   - Use HTTPS only (Render does this automatically)

4. **Optimization:**
   - Add database indexes (already in Prisma schema)
   - Monitor slow queries
   - Consider upgrading to paid tier for better performance
   - Enable build caching in Render

5. **Scaling:**
   - Free tier: 750 hours/month, spins down after inactivity
   - Starter ($7/mo): Always-on, better resources
   - Standard+: Auto-scaling, better CPU/RAM

---

## 📚 Documentation

- **RENDER_SETUP.md** - Detailed deployment guide
- **RENDER_QUICK_REFERENCE.md** - Quick reference for common tasks
- **FRONTEND_RENDER_CONFIG.md** - Frontend configuration guide
- **.env.render** - Your environment variables (don't commit!)

---

## 🆘 Need Help?

### Render Support:
- Docs: https://render.com/docs
- Community: https://community.render.com
- Status: https://status.render.com

### Common Commands:

**View deployment status:**
```bash
# In Render Dashboard → Logs tab
```

**Test health endpoint:**
```bash
curl https://srv-d6o6nji4d50c73fdl27g.onrender.com/health
```

**Run tests:**
```bash
cd backend && ./test-render-deployment.sh
```

**Regenerate secrets:**
```bash
cd backend && ./generate-secrets.sh
```

**View environment variables:**
```bash
cat backend/.env.render
```

---

## ✨ Success Indicators

Your backend is successfully deployed if:

- ✅ Health endpoint returns `{"status":"ok"}`
- ✅ Build and deploy logs show no errors
- ✅ Service status shows "Live" in dashboard
- ✅ Frontend can connect and authenticate
- ✅ Socket.IO connection works
- ✅ Database operations work (create user, ride, etc.)

---

**Deployment prepared by:** GitHub Copilot
**Date:** March 10, 2026
**Status:** ⚙️ Ready for deployment

**🚀 You're all set! Good luck with your deployment!**
