import { NextFunction, Request, Response } from 'express';

const DEFAULT_SLOW_MS = 500;

const timedRoutePrefixes = [
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/google',
  '/api/admin/stats',
  '/api/admin/announcements',
  '/api/announcements'
];

const shouldTimeRoute = (path: string) => timedRoutePrefixes.some((prefix) => path.startsWith(prefix));

export function perfMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!shouldTimeRoute(req.path)) {
    next();
    return;
  }

  const startedAt = process.hrtime.bigint();
  const slowMs = Number(process.env.PERF_LOG_SLOW_MS || DEFAULT_SLOW_MS);

  res.on('finish', () => {
    const endedAt = process.hrtime.bigint();
    const durationMs = Number(endedAt - startedAt) / 1_000_000;
    const summary = `${req.method} ${req.originalUrl} -> ${res.statusCode} in ${durationMs.toFixed(1)}ms`;

    if (durationMs >= slowMs) {
      console.warn(`[PERF:SLOW] ${summary}`);
      return;
    }

    if (process.env.PERF_LOG_VERBOSE === 'true') {
      console.log(`[PERF] ${summary}`);
    }
  });

  next();
}
