import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import rideRoutes from './routes/rides.js';
import matchRoutes from './routes/matches.js';
import userRoutes from './routes/users.js';
import adminRoutes from './routes/admin.js';
import emergencyRoutes from './routes/emergency.js';
import announcementRoutes from './routes/announcements.js';
import subadminRoutes from './routes/subadmin.js';
import earlyAccessRoutes from './routes/earlyAccess.js';
import { setupSocketHandlers } from './services/socket.js';

dotenv.config();

const app: Express = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://spllit.app',
      'https://www.spllit.app',
      'https://spllit-landing.vercel.app',
      'https://spllit-landing-git-main-25f3003058-afks-projects.vercel.app',
      /\.vercel\.app$/,
      /\.onrender\.com$/
    ],
    methods: ['GET', 'POST', 'PATCH'],
    credentials: true,
    allowedHeaders: ['*']
  }
});

// Middleware
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://spllit.app',
    'https://www.spllit.app',
    'https://spllit-landing.vercel.app',
    'https://spllit-landing-git-main-25f3003058-afks-projects.vercel.app',
    /\.vercel\.app$/,
    /\.onrender\.com$/
  ],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['*'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  optionsSuccessStatus: 200,
  preflightContinue: false
};

app.use(cors(corsOptions));

// Explicit OPTIONS handler before routes
app.options('*', cors(corsOptions));

// Custom middleware for auth routes
app.use('/api/auth', (req: any, res: any, next: any) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/subadmin', subadminRoutes);
app.use('/api/early-access', earlyAccessRoutes);

// Setup Socket.IO handlers
setupSocketHandlers(io);

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

// Start server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO enabled`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
});

export { io };
