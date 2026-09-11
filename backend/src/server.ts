import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
// For /health, which pings the database rather than only reporting that the
// process is up — see the endpoint for why that distinction cost a deploy.
import prisma from './utils/prisma.js';
import authRoutes from './routes/auth.js';
import rideRoutes from './routes/rides.js';
import matchRoutes from './routes/matches.js';
import userRoutes from './routes/users.js';
import adminRoutes from './routes/admin.js';
import emergencyRoutes from './routes/emergency.js';
import announcementRoutes from './routes/announcements.js';
import subadminRoutes from './routes/subadmin.js';
import earlyAccessRoutes from './routes/earlyAccess.js';
import automationRoutes from './routes/automation.js';
import usersPlatformRoutes from './routes/usersPlatform.js';
import hostRoutes from './routes/host.js';
import tripsRoutes from './routes/trips.js';
import ridesPlatformRoutes from './routes/ridesPlatform.js';
import chatRoutes from './routes/chat.js';
import communityRoutes from './routes/communities.js';
import searchRoutes from './routes/search.js';
import pickupRoutes from './routes/pickup.js';
import adminPlatformRoutes from './routes/adminPlatform.js';
import adminConsoleRoutes from './routes/adminConsole.js';
import adminConsoleOpsRoutes from './routes/adminConsoleOps.js';
import adminConsoleSettingsRoutes from './routes/adminConsoleSettings.js';
import squadRoutes from './routes/squads.js';
import squadPaymentRoutes from './routes/squadPayments.js';
import squadMemberRoutes from './routes/squadsMembers.js';
import eventRoutes from './routes/events.js';
import notificationRoutes from './routes/notifications.js';
import maintenanceRoutes from './routes/maintenance.js';
import emailWebhookRoutes from './routes/emailWebhooks.js';
import waitlistRoutes from './routes/waitlist.js';
import publicDataRoutes from './routes/publicData.js';
import aiRoutes from './routes/ai.js';
import { setupSocketHandlers } from './services/socket.js';
import { setupLiveHandlers } from './services/live.js';
import { setupAdminNamespace } from './services/adminSocket.js';
import { perfMiddleware } from './middleware/perf.js';
import { rateLimit } from './middleware/rateLimit.js';

dotenv.config();

/**
 * CORS allowlist.
 *
 * Driven by FRONTEND_URL so a domain change is a config change, not a code
 * change. Vercel preview deployments get a fresh subdomain per commit, so
 * *.vercel.app is matched by suffix rather than enumerated.
 */
const allowedOrigins = [
  'http://localhost:3000',
  'https://spllit.app',
  'https://www.spllit.app',
  // Admin console. Runs on its own origin, so without this every console
  // request fails preflight before it reaches an auth check.
  'https://admin.spllit.app',
  'http://localhost:3100',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL.replace(/\/$/, '')] : []),
  ...(process.env.ADMIN_URL ? [process.env.ADMIN_URL.replace(/\/$/, '')] : []),
];

function isAllowedOrigin(origin?: string): boolean {
  // No Origin header: same-origin, curl, or a native app.
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  // Vercel preview deployments.
  return origin.endsWith('.vercel.app');
}

const app: Express = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['*']
  }
});

// Middleware
const corsOptions = {
  origin: (origin: any, callback: any) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['*'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  optionsSuccessStatus: 200,
  preflightContinue: false
};

/**
 * Security headers.
 *
 * Written by hand rather than pulling in helmet: this is an API that serves
 * JSON, so most of helmet's surface (CSP for HTML, HSTS preload lists) either
 * does not apply or belongs at the edge. These five are the ones that matter
 * for a JSON endpoint.
 */
app.disable('x-powered-by'); // Was advertising "Express" on every response.

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // An API response has no reason to be framed by anyone.
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  if (process.env.NODE_ENV === 'production') {
    // Only in production: sending HSTS over plain http on localhost would pin
    // the browser to https for a host that does not serve it.
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

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

/**
 * Delivery webhooks from Resend.
 *
 * Mounted *before* express.json, and that ordering is load-bearing: the Svix
 * signature covers the exact bytes sent, and a body already parsed into an
 * object cannot be turned back into them — JSON.parse followed by
 * JSON.stringify does not round-trip key order or number formatting. The route
 * takes a raw Buffer and parses the JSON itself.
 *
 * Outside /api because it is an integration endpoint called by one known third
 * party, not part of the app's own surface.
 */
app.use('/webhooks', express.raw({ type: 'application/json', limit: '256kb' }), emailWebhookRoutes);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(perfMiddleware);

/**
 * Rate limiting.
 *
 * Two tiers, because the budgets protect different things. The global limiter
 * stops one client saturating the single container; the auth limiter is far
 * tighter because those endpoints mint credentials, and 600 guesses in a
 * quarter hour is a working brute-force attempt even though it is unremarkable
 * browsing traffic.
 *
 * Mounted after the body parsers so a rejected request is not also parsed, and
 * before the routers so nothing slips past.
 */
app.use(
  rateLimit({ name: 'global', windowMs: 60_000, max: 300 }),
);

app.use(
  '/api/auth',
  rateLimit({
    name: 'auth',
    windowMs: 15 * 60_000,
    max: 20,
    message: 'Too many sign-in attempts. Wait a few minutes and try again.',
  }),
);

// Account creation is cheap to request and expensive to clean up.
app.use(
  '/api/users/me/bootstrap',
  rateLimit({ name: 'bootstrap', windowMs: 15 * 60_000, max: 30 }),
);

/**
 * Model calls are metered by a third party and billed by the token, so one
 * caller in a loop spends real money and, worse, exhausts an account-wide
 * per-minute allowance that every other user is sharing.
 *
 * Ten a minute is generous for the thing it guards — a person describing a trip
 * in a sentence — and low enough that a stuck client cannot drain the budget.
 * This is the per-caller half; the account-wide half lives in
 * `services/sarvam.ts`, because no per-IP limiter can see the total.
 */
app.use(
  '/api/ai',
  rateLimit({
    name: 'ai',
    windowMs: 60_000,
    max: 10,
    message: 'Give it a moment before trying that again.',
  }),
);

/**
 * Admin console limits.
 *
 * The console is authenticated, so this is not about anonymous abuse — it is
 * about a stolen session or a buggy client. An admin token is the most
 * privileged credential in the system, and the endpoints below are the ones
 * where a loop does real damage: exports read thousands of rows, broadcasts
 * reach real phones, and analytics runs aggregations across whole collections.
 *
 * Mounted before the routers so a rejected request never reaches a handler,
 * and ordered narrowest-first: Express runs every matching prefix, so the
 * general console limit applies on top of the specific ones.
 */
app.use(
  '/api/admin-console/export',
  rateLimit({
    name: 'admin-export',
    windowMs: 60_000,
    max: 5,
    message: 'Too many exports. Wait a minute before running another.',
  }),
);

app.use(
  '/api/admin-console/broadcast',
  rateLimit({
    name: 'admin-broadcast',
    windowMs: 15 * 60_000,
    max: 5,
    // Deliberately tighter than everything else. A broadcast cannot be
    // recalled, so the cost of a runaway loop here is measured in people's
    // notification trays rather than in database load.
    message: 'Too many broadcasts. This is rate limited on purpose.',
  }),
);

app.use(
  ['/api/admin-console/analytics', '/api/admin-console/explore'],
  rateLimit({
    name: 'admin-analytics',
    windowMs: 60_000,
    max: 30,
    message: 'Too many analytics queries. Give it a moment.',
  }),
);

app.use(
  '/api/admin-console',
  rateLimit({
    name: 'admin-console',
    windowMs: 60_000,
    max: 240,
    message: 'Too many console requests. Give it a moment.',
  }),
);

// Health check
/**
 * Liveness: the process is up and serving. Deliberately touches nothing.
 *
 * Kept dependency-free so the wiring suite can prove the whole routing table
 * without a database, which is the property that makes that suite runnable in
 * CI at all. Readiness is a separate endpoint below.
 */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Readiness: can this revision actually do its job?
 *
 * Split from /health because the two questions have different answers and only
 * one of them belongs in a deploy gate. A deploy carrying a broken DATABASE_URL
 * rolled out green precisely because the gate polled liveness: the process had
 * started, so it answered 200, while every authenticated request was failing on
 * a database it could not reach. The workflow polls this instead.
 *
 * The ping is `$runCommandRaw({ ping: 1 })` — Mongo's own no-op. It reads no
 * collection, so it cannot be slow because of data volume, and it proves what a
 * real query would: the connection string parses, the credentials are accepted,
 * and a server answers.
 *
 * Raced against a timeout because the failure being caught is an unreachable
 * server. A health check that hangs is worse than one that fails — the gate
 * would sit there until the job's own timeout instead of reporting quickly.
 */
app.get('/health/ready', async (_req, res) => {
  const timestamp = new Date().toISOString();

  try {
    await Promise.race([
      prisma.$runCommandRaw({ ping: 1 }),
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error('database ping timed out')), 4000),
      ),
    ]);
  } catch (error) {
    console.error('[health/ready] database unreachable:', error);
    return res.status(503).json({ status: 'degraded', database: 'unreachable', timestamp });
  }

  return res.json({ status: 'ok', database: 'ok', timestamp });
});

// API Routes
app.use('/api/auth', authRoutes);
// Platform ride routes mount first so /nearby, /mine and /:id/transition match
// before the legacy router's /:id handlers.
app.use('/api/rides', ridesPlatformRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/matches', matchRoutes);
// Platform user routes mount first: their specific paths (/me/profile,
// /username-available, /nearby) must match before the legacy router's /:id.
app.use('/api/host', hostRoutes);
app.use('/api/trips', tripsRoutes);
app.use('/api/users', usersPlatformRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/subadmin', subadminRoutes);
app.use('/api/early-access', earlyAccessRoutes);
app.use('/api/automation', automationRoutes);

// Phase 1 platform routes (web app). These use the { success, data } envelope
// and the dual-scheme identity middleware; the legacy routes above keep their
// existing shapes so mobile clients are unaffected.
// Specific squad paths (join-by-code, members, position, progress) must be
// matched before squadRoutes' `/:id` catch-all, so this router is mounted first.
// Mounted first: /:id/payment must match before the squad router's /:id.
app.use('/api/squads', squadPaymentRoutes);
app.use('/api/squads', squadMemberRoutes);
app.use('/api/squads', squadRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/notifications', notificationRoutes);
// Called by Cloud Scheduler, not by the app. Gated on MAINTENANCE_KEY and
// 404s without it, so it does not exist until it is deliberately configured.
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/public', publicDataRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/pickup', pickupRoutes);
app.use('/api/admin-panel', adminPlatformRoutes);
// Admin console (admin.spllit.app). A separate namespace from /api/admin-panel
// above, which the in-app admin page still calls — its shapes must not change.
app.use('/api/admin-console', adminConsoleRoutes);
// Operational surfaces (rides, squads, events, communities, search). Same
// mount path, non-overlapping prefixes, so ordering between the two is not
// load bearing.
app.use('/api/admin-console', adminConsoleOpsRoutes);
app.use('/api/admin-console', adminConsoleSettingsRoutes);
app.use('/api/ai', aiRoutes);

// Setup Socket.IO handlers
setupSocketHandlers(io);
// Live/ephemeral layer: positions, presence, room fan-out.
setupLiveHandlers(io);
// Admin console realtime. Its own namespace, not a room on the default one:
// that namespace carries every user's positions and chat, and admin fan-out
// must not be one stray broadcast away from reaching it.
setupAdminNamespace(io);

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
const isRender = Boolean(process.env.RENDER || process.env.RENDER_EXTERNAL_URL || process.env.RENDER_SERVICE_ID);
const PORT = Number(isRender ? 10000 : (process.env.PORT || 3001));

/**
 * Tests import this module for the wired `app` and bind their own ephemeral
 * port; binding 3001 as a side effect of the import would make the suite fail
 * whenever a dev server is already running.
 */
if (process.env.SPLLIT_NO_LISTEN !== '1') {
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Socket.IO enabled`);
    console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
  });
}

export { io, app, httpServer };
