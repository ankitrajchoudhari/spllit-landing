# Render Backend Configuration - Quick Reference

## 🚀 Your Render Service

**Service URL:** `https://srv-d6o6nji4d50c73fdl27g.onrender.com`
**Dashboard:** https://dashboard.render.com/web/srv-d6o6nji4d50c73fdl27g
**Service ID:** srv-d6o6nji4d50c73fdl27g

---

## ✅ Deployment Checklist

### Step 1: Configure Environment Variables

Go to: Dashboard → Environment tab

Add these variables (from `.env.render` file):

- [x] `NODE_ENV` = `production`
- [x] `PORT` = `10000`
- [ ] `DATABASE_URL` = `<your-mongodb-connection-string>`
- [x] `JWT_SECRET` = (generated in .env.render file)
- [x] `JWT_REFRESH_SECRET` = (generated in .env.render file)
- [x] `JWT_EXPIRES_IN` = `1h`
- [x] `JWT_REFRESH_EXPIRES_IN` = `7d`
- [x] `FRONTEND_URL` = `https://spllit.app`

**Optional (if you have these services):**
- [ ] `GOOGLE_MAPS_API_KEY`
- [ ] `TWILIO_ACCOUNT_SID`
- [ ] `TWILIO_AUTH_TOKEN`
- [ ] `TWILIO_PHONE_NUMBER`
- [ ] `SENDGRID_API_KEY`
- [ ] `SENDGRID_FROM_EMAIL`

### Step 2: Verify Build Settings

Go to: Dashboard → Settings tab

**Build Command:**
```
npm install && npx prisma generate && npm run build
```

**Start Command:**
```
chmod +x start.sh && ./start.sh
```

**Health Check Path:**
```
/health
```

**Auto-Deploy:** Enabled (recommended)

### Step 3: Deploy

1. Click "Manual Deploy" → "Deploy latest commit"
2. Watch the logs for any errors
3. Wait for "Live" status (green)

### Step 4: Test Deployment

**Health Check:**
```bash
curl https://srv-d6o6nji4d50c73fdl27g.onrender.com/health
```

Expected response:
```json
{"status":"ok","timestamp":"2026-03-10T..."}
```

### Step 5: Update Frontend

**If using Vercel:**
1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Add/Update:
   - `VITE_API_URL` = `https://srv-d6o6nji4d50c73fdl27g.onrender.com/api`
   - `VITE_SOCKET_URL` = `https://srv-d6o6nji4d50c73fdl27g.onrender.com`
3. Redeploy frontend

**If using local .env:**
```env
VITE_API_URL=https://srv-d6o6nji4d50c73fdl27g.onrender.com/api
VITE_SOCKET_URL=https://srv-d6o6nji4d50c73fdl27g.onrender.com
```

---

## 🔧 Common Issues

### Issue: Build fails with Prisma error
**Solution:** Ensure DATABASE_URL is set in environment variables

### Issue: 502 Bad Gateway
**Solution:** Check logs. Server might be taking too long to start. Verify PORT=10000

### Issue: Database connection failed
**Solution:** 
- Verify DATABASE_URL is correct
- Ensure URL starts with `mongodb://` or `mongodb+srv://`
- Ensure database is running

### Issue: CORS errors in frontend
**Solution:** Backend already configured for spllit.app domains. Verify FRONTEND_URL is set.

---

## 📊 Database Setup

### Option 1: MongoDB Atlas (Recommended)

1. Go to Render Dashboard
2. Create a cluster and database user
3. Add network access for Render
4. Copy **MongoDB SRV URL**
5. Paste into backend Environment Variables as `DATABASE_URL`

### Option 2: Any MongoDB-compatible host

1. Get your MongoDB connection string
2. Format: `mongodb+srv://user:password@cluster.mongodb.net/dbname`
3. Add to Environment Variables as `DATABASE_URL`
4. Ensure IP whitelisting allows Render's IPs

---

## 📝 API Endpoints

Once deployed, your API will be available at:

- Health: `GET /health`
- Auth: `POST /api/auth/register`, `POST /api/auth/login`
- Rides: `GET /api/rides`, `POST /api/rides`
- Matches: `GET /api/matches`
- Users: `GET /api/users/profile`
- Admin: `POST /api/admin/*`
- Emergency: `POST /api/emergency`
- Subadmin: `GET /api/subadmin/*`

**WebSocket (Socket.IO):** Available at base URL

---

## 🎯 Performance Tips

### Free Tier Limitations
- Spins down after 15 min of inactivity
- First request after spin-down takes 30-60 seconds
- 750 hours/month free

### Upgrade to Starter ($7/month) for:
- No spin-down
- Better CPU/memory
- Faster response times
- Background jobs

### Optimizations
- Enable build cache (Settings → Advanced)
- Use Docker for faster builds
- Monitor logs for slow queries
- Add database indexes (already configured in Prisma)

---

## 🔐 Security Notes

✅ **Completed:**
- JWT secrets are randomly generated
- Environment variables are secure
- CORS configured for specific domains
- Database connection encrypted
- Health check endpoint public (no sensitive data)

⚠️ **Important:**
- Never commit .env files
- Keep DATABASE_URL secret
- Rotate JWT secrets periodically
- Use HTTPS only in production

---

## 📞 Support

**Render Support:**
- Docs: https://render.com/docs
- Community: https://community.render.com
- Status: https://status.render.com

**Spllit Backend:**
- Using: Node.js 20, Express, Socket.IO, Prisma
- Database: PostgreSQL

---

## 🔄 Redeployment

**Automatic (recommended):**
- Push to GitHub main branch
- Render auto-deploys

**Manual:**
- Dashboard → Manual Deploy → Deploy latest commit

**Force rebuild:**
- Dashboard → Manual Deploy → Clear build cache & deploy

---

**Last Updated:** March 10, 2026
**Service Status:** ⚙️ Pending Configuration
