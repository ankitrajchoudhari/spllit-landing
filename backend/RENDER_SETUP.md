# Render Deployment Guide for Spllit Backend

## Prerequisites

1. A Render account (https://render.com)
2. A PostgreSQL database (can be created on Render or use external like Supabase)
3. Your repository pushed to GitHub/GitLab

## Quick Setup Steps

### 1. Create PostgreSQL Database (if not already created)

1. Go to Render Dashboard: https://dashboard.render.com
2. Click "New +" → "PostgreSQL"
3. Name: `spllit-database`
4. Choose your plan (Free tier available)
5. Click "Create Database"
6. **Copy the Internal Database URL** (PostgreSQL Connection String)

### 2. Configure Your Web Service

Your service is already created. Go to:
https://dashboard.render.com/web/srv-d6o6nji4d50c73fdl27g

#### A. Environment Variables

Go to "Environment" tab and add these variables:

**Required:**
```
NODE_ENV=production
PORT=10000
DATABASE_URL=<your-postgresql-connection-string>
JWT_SECRET=<generate-a-random-secret-key>
JWT_REFRESH_SECRET=<generate-another-random-secret-key>
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=https://spllit.app
```

**Optional (add if you have these services):**
```
GOOGLE_MAPS_API_KEY=<your-google-maps-key>
TWILIO_ACCOUNT_SID=<your-twilio-sid>
TWILIO_AUTH_TOKEN=<your-twilio-token>
TWILIO_PHONE_NUMBER=<your-twilio-number>
SENDGRID_API_KEY=<your-sendgrid-key>
SENDGRID_FROM_EMAIL=noreply@spllit.app
```

**Generate Secrets:**
Run these commands in terminal to generate secure secrets:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

#### B. Build & Deploy Settings

Go to "Settings" tab:

1. **Build Command:**
   ```
   npm install && npx prisma generate && npm run build
   ```

2. **Start Command:**
   ```
   npx prisma migrate deploy && npm start
   ```

3. **Root Directory:** `backend` (if deploying from monorepo root)
   - If repository root IS the backend folder, leave empty

4. **Node Version:** 20 (or latest LTS)

5. **Health Check Path:** `/health`

#### C. Dockerfile (Optional but Recommended)

Render can auto-detect the Dockerfile. To use it:
1. In "Settings" tab
2. Under "Docker Command", leave it empty (will use CMD from Dockerfile)
3. Render will automatically detect and use the Dockerfile

### 3. Deploy

1. Click "Manual Deploy" → "Deploy latest commit"
2. Or connect to GitHub and enable "Auto-Deploy"
3. Monitor the logs during deployment

### 4. Update Frontend to Use Render Backend

Update your frontend environment variables:

**.env or Vercel Environment Variables:**
```
VITE_API_URL=https://srv-d6o6nji4d50c73fdl27g.onrender.com
VITE_SOCKET_URL=https://srv-d6o6nji4d50c73fdl27g.onrender.com
```

Update CORS origins in backend if needed (already configured for spllit.app domains).

## Troubleshooting

### Build Fails

- Check that all dependencies are in package.json
- Ensure Prisma schema is valid: `npx prisma validate`
- Check build logs for specific errors

### Database Connection Issues

- Verify DATABASE_URL is correct
- Ensure database is running
- Check if IP is whitelisted (for external DBs)
- For Render Postgres, use **Internal Database URL**

### 502 Bad Gateway

- Server might be taking too long to start
- Check if PORT environment variable is set to 10000
- Check start command is correct
- Review application logs

### Migrations Failing

- Run migrations manually:
  ```bash
  npx prisma migrate deploy
  ```
- Or use Render Shell to debug:
  1. Go to service page
  2. Click "Shell" tab
  3. Run migration commands

## Post-Deployment

### Test Your API

1. **Health Check:**
   ```bash
   curl https://srv-d6o6nji4d50c73fdl27g.onrender.com/health
   ```
   Should return: `{"status":"ok","timestamp":"..."}`

2. **Test Socket.IO:**
   Use a WebSocket client or your frontend to test real-time features

### Monitor

- Check "Logs" tab for application logs
- Check "Metrics" tab for performance data
- Set up alerts in "Settings" → "Alerts"

### Upgrade Plan (if needed)

Free tier spins down after 15 minutes of inactivity:
- Consider upgrading to "Starter" plan ($7/mo) for:
  - No spin-down
  - Better performance
  - More resources

## Security Checklist

- ✅ JWT secrets are strong and random
- ✅ DATABASE_URL is not exposed in code
- ✅ NODE_ENV set to 'production'
- ✅ API keys stored as environment variables
- ✅ CORS configured for your domains only

## Useful Commands

**View Logs:**
```bash
# Via Render Dashboard > Logs tab
```

**Shell Access:**
```bash
# Via Render Dashboard > Shell tab
```

**Force Redeploy:**
```bash
# Via Render Dashboard > Manual Deploy > Clear build cache & deploy
```

## Getting Your Service URL

Your backend URL is:
```
https://srv-d6o6nji4d50c73fdl27g.onrender.com
```

Use this URL in your frontend configuration.

## Support

- Render Docs: https://render.com/docs
- Render Community: https://community.render.com
- Prisma Docs: https://www.prisma.io/docs

---

**Current Deployment:**
- Service: srv-d6o6nji4d50c73fdl27g
- Deploy: dep-d6o6nki4d50c73fdl39g
- Dashboard: https://dashboard.render.com/web/srv-d6o6nji4d50c73fdl27g
