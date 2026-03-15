# 🎯 Final Steps - Connect Your Backend to Render

## Current Status

✅ Backend code is ready  
✅ Render service exists  
✅ Configuration files created  
✅ JWT secrets generated  
⚠️ Service is deployed but needs configuration

Your Render service is responding but returns 404 because it needs:
1. Environment variables configured
2. Latest code with proper build settings

---

## Step-by-Step: Complete the Connection

### Phase 1: Push Code to GitHub (5 minutes)

Your Render service is probably connected to a GitHub repository. Let's make sure your latest code is there.

```bash
# Check your Git status
git status

# Add new files
git add .

# Commit changes
git commit -m "Add Render deployment configuration"

# Push to GitHub
git push origin main
```

**If you need to set up Git:**
```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Backend with Render configuration"

# Add remote (replace with your GitHub repo URL)
git remote add origin https://github.com/yourusername/spllit-landing.git

# Push
git push -u origin main
```

---

### Phase 2: Configure Render Service (5 minutes)

**Go to:** https://dashboard.render.com/web/srv-d6o6nji4d50c73fdl27g

#### 2.1: Set Repository (if needed)

1. Click **"Settings"** tab
2. Under "Source Repository", ensure it's connected to your GitHub repo
3. If not connected:
   - Click "Connect Repository"
   - Authorize GitHub
   - Select your repository
   - Branch: `main`
   - Root Directory: `backend` (if monorepo) or leave empty

#### 2.2: Configure Build Settings

Still in **Settings** tab:

**Build Command:**
```
npm install && npx prisma generate && npm run build
```

**Start Command:**
```
chmod +x start.sh && ./start.sh
```

**Root Directory:**
- If repository root contains backend code: leave empty
- If monorepo (backend is in a folder): enter `backend`

**Health Check Path:**
```
/health
```

Click **"Save Changes"**

#### 2.3: Add Environment Variables

Click **"Environment"** tab

**Method 1: Add One by One**
Click "Add Environment Variable" for each:

```
NODE_ENV = production
PORT = 10000
JWT_SECRET = efa24c692faacef560c717571db26175dab6ceaaed75a71c6d3cd726bc6b7abc1754190b11f00a6115b951c77e0e47bb25b682439b1f34a1fe3423cae052e766
JWT_REFRESH_SECRET = bce63f6b7dfa283dd01b6b13b1ac8bf019109c7228dd0ae704514fdbb5420335e2c4bbe7bb39be8f48daf29f563d1d35b4ae5aa7a52e848ccabe766e786721a8
JWT_EXPIRES_IN = 1h
JWT_REFRESH_EXPIRES_IN = 7d
FRONTEND_URL = https://spllit.app
```

**⚠️ CRITICAL:** Add DATABASE_URL
```
DATABASE_URL = <Your MongoDB connection string>
```

**Method 2: Use .env file**
1. Click "Add from .env"
2. Copy contents from `backend/.env.render`
3. Paste and import
4. **Remember to replace** `<REPLACE_WITH_YOUR_MONGODB_URL>` with your actual database URL

---

### Phase 3: Set Up Database (10 minutes)

You need a MongoDB database. Choose one option:

#### Option A: MongoDB Atlas (Recommended)

1. Go to https://www.mongodb.com/atlas
2. Create a free shared cluster
3. Create DB user + password
4. Add network access (Render egress / temporary 0.0.0.0/0 for testing)
5. Click Connect → Drivers and copy SRV URI
6. Format: `mongodb+srv://user:password@cluster.mongodb.net/spllit`
7. Go back to your backend service
8. Environment tab → Edit `DATABASE_URL`
9. Paste the MongoDB URL
10. Save

**Why Internal URL?**
- Free for internal Render services
- Faster connection
- More secure

#### Option B: Other MongoDB Host

1. Get MongoDB URI from provider
2. Ensure user/password and database name are present
3. Format: `mongodb://user:password@host:27017/spllit` or SRV URI
4. Add to Render as `DATABASE_URL`

#### Option C: Railway, etc.

Any MongoDB provider works! Get connection string in this format:
```
mongodb+srv://username:password@cluster.mongodb.net/database
```

---

### Phase 4: Deploy! (2-5 minutes)

1. After adding all environment variables
2. Go to **"Manual Deploy"** tab (or it may auto-deploy)
3. Click **"Deploy latest commit"**
4. Watch the logs:
   - Installing dependencies ✅
   - Generating Prisma Client ✅
   - Building TypeScript ✅
   - Syncing Prisma schema ✅
   - Starting server ✅
   - Health check passed ✅

**Look for these success messages:**
```
==> Deploying...
==> Build successful!
==> Starting service...
🚀 Server running on port 10000
📡 Socket.IO enabled
==> Health check passed
==> Deploy live at https://srv-d6o6nji4d50c73fdl27g.onrender.com
```

---

### Phase 5: Test Deployment (2 minutes)

#### Test 1: Health Check

```bash
curl https://srv-d6o6nji4d50c73fdl27g.onrender.com/health
```

**Expected:**
```json
{"status":"ok","timestamp":"2026-03-10T19:30:00.000Z"}
```

#### Test 2: Run Full Test Suite

```bash
cd backend
./test-render-deployment.sh
```

**Expected:**
```
✅ Health check passed!
✅ CORS headers present!
✅ API endpoint responding!
```

#### Test 3: Test from Frontend

Open browser console on https://spllit.app:

```javascript
fetch('https://srv-d6o6nji4d50c73fdl27g.onrender.com/health')
  .then(r => r.json())
  .then(console.log);
```

---

### Phase 6: Update Frontend (5 minutes)

Your frontend needs to know about the new backend URL.

#### For Vercel Deployment:

1. Go to https://vercel.com/dashboard
2. Select your project (`spllit-landing`)
3. Settings → Environment Variables
4. Add these variables:

| Key | Value | Environments |
|-----|-------|--------------|
| `VITE_API_URL` | `https://srv-d6o6nji4d50c73fdl27g.onrender.com/api` | Production, Preview, Development |
| `VITE_SOCKET_URL` | `https://srv-d6o6nji4d50c73fdl27g.onrender.com` | Production, Preview, Development |

5. Go to Deployments tab
6. Click "..." on latest deployment → **"Redeploy"**
7. Select "Use existing Build Cache" → **"Redeploy"**

#### For Local Development:

Create `.env` file in project root:

```env
VITE_API_URL=https://srv-d6o6nji4d50c73fdl27g.onrender.com/api
VITE_SOCKET_URL=https://srv-d6o6nji4d50c73fdl27g.onrender.com
```

Then restart dev server:
```bash
npm run dev
```

---

## ✅ Verification Checklist

Go through this checklist to ensure everything works:

### Backend Deployment
- [ ] Health endpoint returns 200 OK
- [ ] Logs show no errors
- [ ] Service status is "Live" (green)
- [ ] Database connection working
- [ ] Migrations ran successfully

### Frontend Connection
- [ ] Frontend loads without CORS errors
- [ ] Can register new account
- [ ] Can login successfully
- [ ] Can create a ride
- [ ] Real-time features work (Socket.IO)

### Production Ready
- [ ] DATABASE_URL is using production database
- [ ] JWT_SECRET is strong and random
- [ ] All environment variables set
- [ ] HTTPS enabled (automatic on Render)
- [ ] Health checks passing

---

## 🐛 Troubleshooting

### "Build Failed" Error

**Check logs for specific error:**

1. **"Cannot find module 'X'"**
   - Solution: Add missing package to `package.json`
   - Run: `npm install X` then commit

2. **"Prisma schema not found"**
   - Ensure `prisma/schema.prisma` exists in repository
   - Check Root Directory setting is correct

3. **"DATABASE_URL not set"**
   - Add DATABASE_URL environment variable
   - Verify it's not empty

### "Deploy Failed" / 502 Bad Gateway

1. **Check environment variables:**
   - All required variables set?
   - DATABASE_URL correct format?
   - PORT set to 10000?

2. **Check start command:**
   - Should be: `npx prisma migrate deploy && npm start`
   - Not: `npm run dev` or other dev commands

3. **Check logs:**
   - Dashboard → Logs tab
   - Look for error messages
   - Common: "Cannot connect to database"

### Database Connection Failed

1. **Wrong DATABASE_URL format**
   ```
   ❌ Wrong: postgres://user:pass@host/db
   ✅ Right: postgresql://user:pass@host:5432/db
   ```

2. **Using External URL for Render DB**
   - Use Internal URL instead
   - Go to database → Connection Details → Internal

3. **Database not running**
   - Check database status in Render
   - Ensure it's in same region (for free tier)

### 404 Not Found

This means:
- Service is running
- But routes not working

**Solutions:**
1. Verify Root Directory setting
2. Check build created `dist/` folder
3. Ensure `main` field in package.json is correct: `"main": "dist/server.js"`
4. Check start command includes correct path

### Frontend Can't Connect

1. **CORS error:**
   - Backend should already allow your domains
   - Check backend logs for CORS errors
   - Verify FRONTEND_URL is set

2. **Wrong URL:**
   - Should be: `https://srv-d6o6nji4d50c73fdl27g.onrender.com`
   - Not: `http://...` or other URL

3. **Socket.IO not connecting:**
   - Check browser console
   - Ensure VITE_SOCKET_URL is set
   - Try polling fallback: `transports: ['polling', 'websocket']`

---

## 🎉 Success!

If everything above is checked, your backend is successfully deployed!

**Your backend is live at:**
```
https://srv-d6o6nji4d50c73fdl27g.onrender.com
```

**Next steps:**
1. Monitor performance in Render Dashboard
2. Set up monitoring alerts
3. Consider upgrading to paid tier for:
   - No cold starts
   - Better performance
   - More resources
4. Implement proper logging and error tracking

---

## 📞 Need Help?

**Created files for reference:**
- `DEPLOYMENT_COMPLETE.md` - This guide
- `RENDER_QUICK_REFERENCE.md` - Quick reference
- `RENDER_SETUP.md` - Detailed setup guide
- `.env.render` - Your environment variables

**Run diagnostic:**
```bash
cd backend && ./test-render-deployment.sh
```

**Render Support:**
- Docs: https://render.com/docs
- Community: https://community.render.com
- Status: https://status.render.com

---

**Setup prepared:** March 10, 2026  
**Your Service ID:** srv-d6o6nji4d50c73fdl27g  
**Status:** Ready to deploy 🚀
