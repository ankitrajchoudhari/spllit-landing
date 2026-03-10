# Frontend Configuration for Render Backend

## Update Environment Variables

Your backend is now deployed at:
```
https://srv-d6o6nji4d50c73fdl27g.onrender.com
```

### For Local Development

Create/update `.env` in the root directory:

```env
# Backend API 
VITE_API_URL=https://srv-d6o6nji4d50c73fdl27g.onrender.com/api
VITE_SOCKET_URL=https://srv-d6o6nji4d50c73fdl27g.onrender.com

# Optional: Keep local backend for development
# VITE_API_URL=http://localhost:3001/api
# VITE_SOCKET_URL=http://localhost:3001
```

### For Vercel Deployment

1. Go to Vercel Dashboard
2. Select your project (spllit-landing)
3. Go to Settings → Environment Variables
4. Add/Update these variables for **Production, Preview, and Development**:

```
VITE_API_URL = https://srv-d6o6nji4d50c73fdl27g.onrender.com/api
VITE_SOCKET_URL = https://srv-d6o6nji4d50c73fdl27g.onrender.com
```

5. Redeploy:
   - Go to Deployments tab
   - Click "..." on latest deployment → Redeploy

### Verify Frontend Configuration

Check your frontend code uses these environment variables:

**API Service (src/services/):**
```javascript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
```

**Socket.IO Connection:**
```javascript
import { io } from 'socket.io-client';

const socket = io(import.meta.env.VITE_SOCKET_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling']
});
```

## Test the Connection

### 1. Test API Health

Open browser console and run:
```javascript
fetch('https://srv-d6o6nji4d50c73fdl27g.onrender.com/health')
  .then(r => r.json())
  .then(console.log);
```

Expected: `{status: 'ok', timestamp: '...'}`

### 2. Test CORS

```javascript
fetch('https://srv-d6o6nji4d50c73fdl27g.onrender.com/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ email: 'test@test.com', password: 'test' })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

### 3. Test WebSocket

```javascript
import { io } from 'socket.io-client';

const testSocket = io('https://srv-d6o6nji4d50c73fdl27g.onrender.com');

testSocket.on('connect', () => {
  console.log('✅ Socket.IO connected!');
  console.log('Socket ID:', testSocket.id);
});

testSocket.on('connect_error', (error) => {
  console.error('❌ Socket.IO connection error:', error);
});
```

## Common Frontend Issues

### Issue: API requests timeout

**Cause:** Render free tier spins down after inactivity
**Solution:** 
- Wait 30-60 seconds for cold start
- Consider upgrading to paid tier
- Implement retry logic in frontend

```javascript
const fetchWithRetry = async (url, options, retries = 3) => {
  try {
    const response = await fetch(url, options);
    return response;
  } catch (error) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 2000));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
};
```

### Issue: CORS errors

**Cause:** Backend not configured for your domain
**Solution:** Backend already configured for:
- `http://localhost:5173`
- `http://localhost:3000`
- `https://spllit.app`
- `https://www.spllit.app`
- `*.vercel.app`

If using different domain, update backend `src/server.ts` CORS config.

### Issue: WebSocket connection fails

**Symptoms:** Real-time features not working
**Solutions:**
1. Ensure `transports: ['websocket', 'polling']` is set
2. Check browser console for connection errors
3. Verify SOCKET_URL is correct
4. Check if backend WebSocket port is open

### Issue: 401 Unauthorized

**Cause:** Credentials not being sent
**Solution:** Ensure `credentials: 'include'` in fetch options and axios config:

```javascript
// Fetch
fetch(url, {
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' }
});

// Axios
axios.defaults.withCredentials = true;
```

## Environment-Specific Setup

### Development
```env
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
```

### Staging/Preview
```env
VITE_API_URL=https://srv-d6o6nji4d50c73fdl27g.onrender.com/api
VITE_SOCKET_URL=https://srv-d6o6nji4d50c73fdl27g.onrender.com
```

### Production
```env
VITE_API_URL=https://srv-d6o6nji4d50c73fdl27g.onrender.com/api
VITE_SOCKET_URL=https://srv-d6o6nji4d50c73fdl27g.onrender.com
```

## Update Commands

### Local Development
```bash
# Create .env file
cat > .env << EOF
VITE_API_URL=https://srv-d6o6nji4d50c73fdl27g.onrender.com/api
VITE_SOCKET_URL=https://srv-d6o6nji4d50c73fdl27g.onrender.com
EOF

# Restart dev server
npm run dev
```

### Vercel (via CLI)
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Set environment variables
vercel env add VITE_API_URL production
# Enter: https://srv-d6o6nji4d50c73fdl27g.onrender.com/api

vercel env add VITE_SOCKET_URL production
# Enter: https://srv-d6o6nji4d50c73fdl27g.onrender.com

# Redeploy
vercel --prod
```

## Monitoring

### Check API Status
```bash
curl https://srv-d6o6nji4d50c73fdl27g.onrender.com/health
```

### Monitor Response Times
Use browser DevTools → Network tab:
- API calls should respond in < 500ms (warm)
- First call after idle may take 30-60s (cold start)

### Socket.IO Events
```javascript
socket.on('connect', () => console.log('Connected'));
socket.on('disconnect', () => console.log('Disconnected'));
socket.on('reconnect', () => console.log('Reconnected'));
socket.on('error', (e) => console.error('Socket error:', e));
```

---

**Backend URL:** https://srv-d6o6nji4d50c73fdl27g.onrender.com
**Last Updated:** March 10, 2026
