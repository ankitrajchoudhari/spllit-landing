import { NextFunction, Request, Response } from 'express';

import { clientIpOf } from '../utils/clientIp.js';

/**
 * Rate limiting and credential-stuffing defence.
 *
 * In-process on purpose, not Redis: the Socket.IO container is pinned to a
 * single instance (see DEPLOY.md), so one process sees all traffic and a shared
 * store would add a dependency for no extra coverage today.
 *
 * The trade-offs are real and worth stating rather than discovering later:
 *   - counters reset on deploy and restart,
 *   - they do not survive horizontal scaling.
 * If the container is ever scaled past one instance this must move to a shared
 * store, otherwise the effective limit multiplies by the instance count.
 */

interface Bucket {
  count: number;
  /** Epoch ms when the window rolls over. */
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Cheap sweep so a long-running process does not accumulate a bucket per IP
 * seen since boot. Runs on write rather than on a timer — no interval to leak,
 * and the work is proportional to traffic rather than to wall-clock time.
 */
let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Client identity for limiting — the right-most untrusted forwarded hop, see
 * utils/clientIp.ts. This read the left-most, which the client writes, so a
 * spoofed X-Forwarded-For bypassed every limit. The account lockout below
 * still keys on the account, as a second line.
 */
function clientKey(req: Request): string {
  return clientIpOf(req) ?? 'unknown';
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** Distinguishes buckets so one limiter cannot exhaust another's budget. */
  name: string;
  message?: string;
  /** Return true to let a request past without spending budget. */
  skip?: (req: Request) => boolean;
}

export function rateLimit({ windowMs, max, name, message, skip }: RateLimitOptions) {
  return function rateLimiter(req: Request, res: Response, next: NextFunction): void {
    /**
     * Lets a limiter apply to some requests on a path and not others.
     *
     * The broadcast limiter is the reason this exists: five sends per quarter
     * hour is right for "notify everyone" and absurd for "tell these two
     * students their ride is cancelled". The budget should follow how many
     * people a request reaches, and a limiter keyed only on the path cannot
     * see that — the caller can.
     */
    if (skip?.(req)) {
      next();
      return;
    }

    const now = Date.now();
    sweep(now);

    const key = `${name}:${clientKey(req)}`;
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    existing.count += 1;

    if (existing.count > max) {
      const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        success: false,
        message: message ?? 'Too many requests. Try again shortly.',
      });
      return;
    }

    next();
  };
}

/**
 * Failed-credential tracking, keyed on the account rather than the caller.
 *
 * IP limiting alone does not stop credential stuffing: an attacker with a proxy
 * pool gets a fresh budget per address, while the victim's account is attacked
 * from all of them. Counting per account closes that, at the cost of letting
 * someone lock a known account out on purpose — which is why the lock is short
 * and automatic rather than sticky and manual.
 */
const failures = new Map<string, Bucket>();

const LOCK_THRESHOLD = 5;
const LOCK_WINDOW_MS = 15 * 60_000;

function accountKey(identifier: string): string {
  return identifier.trim().toLowerCase();
}

/** True when the account is currently locked out. */
export function isLockedOut(identifier: string): boolean {
  const entry = failures.get(accountKey(identifier));
  if (!entry) return false;
  if (entry.resetAt <= Date.now()) {
    failures.delete(accountKey(identifier));
    return false;
  }
  return entry.count >= LOCK_THRESHOLD;
}

/** Records a failed attempt. Call on every rejected credential, not on 404s. */
export function recordFailure(identifier: string): void {
  const key = accountKey(identifier);
  const now = Date.now();
  const entry = failures.get(key);

  if (!entry || entry.resetAt <= now) {
    failures.set(key, { count: 1, resetAt: now + LOCK_WINDOW_MS });
    return;
  }

  entry.count += 1;
  // Each failure re-arms the window, so a slow drip cannot outlast the lock.
  entry.resetAt = now + LOCK_WINDOW_MS;
}

/** Clears the counter after a genuine sign-in. */
export function clearFailures(identifier: string): void {
  failures.delete(accountKey(identifier));
}

/** Minutes remaining, for logging. Never sent to the client — see below. */
export function lockoutMinutesRemaining(identifier: string): number {
  const entry = failures.get(accountKey(identifier));
  if (!entry) return 0;
  return Math.max(0, Math.ceil((entry.resetAt - Date.now()) / 60_000));
}
