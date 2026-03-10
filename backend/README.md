# Spllit Backend - Ride Matching & Real-Time Chat

Backend server for Spllit ride-matching platform with real-time chat, location sharing, and smart matching algorithm.

## 🚀 Deploy to Render

**Ready to deploy?** Your backend is fully configured for Render!

👉 **[Click here for complete deployment guide](./DEPLOYMENT_COMPLETE.md)**

**Quick Deploy:**
```bash
./deploy-to-render.sh  # Generates secrets and shows next steps
```

**Your Service:** https://dashboard.render.com/web/srv-d6o6nji4d50c73fdl27g

**Documentation:**
- [Complete Deployment Guide](./DEPLOYMENT_COMPLETE.md)
- [Quick Reference](./RENDER_QUICK_REFERENCE.md)
- [Detailed Setup](./RENDER_SETUP.md)
- [Frontend Configuration](../FRONTEND_RENDER_CONFIG.md)

---

## Features

✅ **JWT Authentication** - Secure user registration and login  
✅ **Ride Matching Algorithm** - Smart matching based on destination, time, and preferences  
✅ **Real-Time Chat** - Socket.IO powered messaging with typing indicators  
✅ **Location Sharing** - Live GPS tracking for matched users  
✅ **Online Status** - Real-time presence detection  
✅ **Privacy First** - Phone numbers are hashed, never shared  
✅ **PostgreSQL Database** - Scalable data storage with Prisma ORM  

## Tech Stack

- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL (Supabase recommended)
- **ORM:** Prisma
- **Real-time:** Socket.IO
- **Auth:** JWT with bcrypt
- **Validation:** Zod

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (or Supabase account)
- GitHub Student Developer Pack (recommended for free resources)

## Quick Start

### 1. Install Dependencies

\`\`\`bash
cd backend
npm install
\`\`\`

### 2. Set Up Database

**Option A: Using Supabase (Recommended)**

1. Sign up at [Supabase](https://supabase.com/github-students) with GitHub Student Pack
2. Create a new project
3. Go to Settings → Database → Connection String
4. Copy the connection string (transaction pooler)

**Option B: Local PostgreSQL**

\`\`\`bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Create database
sudo -u postgres createdb spllit_db
\`\`\`

### 3. Configure Environment

\`\`\`bash
# Copy example env file
cp .env.example .env

# Edit .env and update:
# - DATABASE_URL with your PostgreSQL/Supabase connection string
# - JWT_SECRET with a random secret (use: openssl rand -base64 32)
# - JWT_REFRESH_SECRET with another random secret
\`\`\`

### 4. Run Database Migrations

\`\`\`bash
npm run prisma:generate
npm run prisma:migrate
\`\`\`

### 5. Start Development Server

\`\`\`bash
npm run dev
\`\`\`

Server will start on http://localhost:3001

## API Endpoints

### Authentication

\`\`\`
POST   /api/auth/register    - Register new user
POST   /api/auth/login       - Login user
POST   /api/auth/refresh     - Refresh access token
\`\`\`

### Rides

\`\`\`
POST   /api/rides            - Create new ride
GET    /api/rides/search     - Search for matching rides
GET    /api/rides/my         - Get current user's rides
PUT    /api/rides/:id        - Update ride status
DELETE /api/rides/:id        - Delete ride
\`\`\`

### Matches

\`\`\`
POST   /api/matches          - Create a match
GET    /api/matches/my       - Get user's matches
GET    /api/matches/:id/messages - Get chat messages
PUT    /api/matches/:id/complete - Mark match as completed
\`\`\`

### Users

\`\`\`
GET    /api/users/me         - Get current user profile
PUT    /api/users/me         - Update profile
GET    /api/users/:id        - Get user profile by ID
\`\`\`

## Socket.IO Events

### Client → Server

\`\`\`javascript
// Join match rooms
socket.emit('join_matches', { matchIds: ['match_id_1', 'match_id_2'] });

// Send message
socket.emit('send_message', {
  matchId: 'match_id',
  content: 'Hello!',
  type: 'text'
});

// Typing indicator
socket.emit('typing', { matchId: 'match_id', isTyping: true });

// Share location
socket.emit('share_location', {
  matchId: 'match_id',
  latitude: 13.0827,
  longitude: 80.2707,
  accuracy: 10
});

// Stop sharing location
socket.emit('stop_location');

// Mark message as read
socket.emit('mark_read', { messageId: 'msg_id' });
\`\`\`

### Server → Client

\`\`\`javascript
// New message received
socket.on('new_message', (message) => { /* ... */ });

// User typing
socket.on('user_typing', ({ userId, isTyping }) => { /* ... */ });

// Location update
socket.on('location_update', ({ userId, latitude, longitude }) => { /* ... */ });

// User online/offline
socket.on('user_status', ({ userId, status }) => { /* ... */ });

// Message read
socket.on('message_read', ({ messageId, userId }) => { /* ... */ });

// New match created
socket.on('match_created_{userId}', ({ match }) => { /* ... */ });

// Error
socket.on('error', ({ message }) => { /* ... */ });
\`\`\`

## Database Schema

- **User** - User accounts with hashed credentials
- **Ride** - Ride creation and search data
- **Match** - Connections between users
- **Message** - Chat message history
- **Location** - Live location tracking data
- **Block** - User blocking for safety

## Matching Algorithm

The smart matching algorithm considers:

1. **Destination Proximity** - Within 2km radius (configurable)
2. **Time Window** - Within ±30 minutes (configurable)
3. **Gender Preference** - Matches based on user preferences
4. **College/Institute** - Same institution preferred
5. **Scoring** - Prioritizes by time difference, then distance

## Development

\`\`\`bash
# Run in development mode with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Open Prisma Studio (database GUI)
npm run prisma:studio
\`\`\`

## Deployment

### Railway (Recommended with GitHub Student Pack)

1. Install Railway CLI: \`npm i -g @railway/cli\`
2. Login: \`railway login\`
3. Initialize: \`railway init\`
4. Add PostgreSQL: \`railway add --plugin postgresql\`
5. Set environment variables in Railway dashboard
6. Deploy: \`railway up\`

### Render (Free Tier)

1. Create account at [Render](https://render.com)
2. Create new Web Service
3. Connect GitHub repository
4. Set build command: \`cd backend && npm install && npm run build\`
5. Set start command: \`cd backend && npm start\`
6. Add PostgreSQL database from dashboard
7. Set environment variables

## Environment Variables

\`\`\`env
PORT=3001
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=your_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=https://yourdomain.com
\`\`\`

## Security Best Practices

✅ Phone numbers are hashed before storage  
✅ Passwords hashed with bcrypt (10 rounds)  
✅ JWT tokens with expiration  
✅ CORS configured for specific origin  
✅ Input validation with Zod  
✅ SQL injection prevention via Prisma ORM  

## Troubleshooting

**Database connection error:**
- Check DATABASE_URL format
- Ensure database is accessible
- Verify credentials

**Socket.IO not connecting:**
- Check CORS settings
- Verify JWT token is being sent
- Check FRONTEND_URL environment variable

**Prisma errors:**
- Run \`npm run prisma:generate\` after schema changes
- Run \`npm run prisma:migrate\` to apply migrations

## Support

For issues or questions, check the main repository README or create an issue.

## License

ISC
