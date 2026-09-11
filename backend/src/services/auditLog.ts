import prisma from '../utils/prisma.js';
import { AdminContext, clientIp } from '../middleware/adminConsole.js';
import type { AdminRequest } from '../middleware/adminConsole.js';

/**
 * The audit trail behind every privileged action in the console.
 *
 * Two rules shape this file:
 *
 * 1. A failed audit write must never fail the action it describes. Losing the
 *    ability to suspend an abusive account because a log insert timed out is
 *    strictly worse than a gap in the log, so `record` swallows its own errors
 *    and reports them to stderr.
 *
 * 2. Only changed fields are stored, never whole documents. Audit rows are
 *    kept far longer than the records they describe, and copying a user
 *    wholesale into one quietly turns the log into a second, permanent, copy
 *    of everyone's personal data.
 */

export type AuditTargetType =
  | 'user'
  | 'squad'
  | 'ride'
  | 'event'
  | 'community'
  | 'thread'
  | 'flag'
  | 'setting'
  | 'admin'
  | 'notification'
  | 'campaign'
  | 'export';

export interface AuditInput {
  action: string;
  targetType: AuditTargetType;
  targetId?: string | null;
  targetLabel?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
  success?: boolean;
  errorMessage?: string | null;
}

/** Values a log line should never carry, whatever a caller passes in. */
const REDACTED_KEYS = new Set([
  'password',
  'phoneHash',
  'fcmTokens',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
]);

/**
 * Keeps a diff small and free of credentials.
 *
 * Caps both the number of keys and the size of each value: `before`/`after` are
 * free-form JSON, and without a ceiling one careless caller passing a whole
 * document turns every row in this collection into a multi-kilobyte blob.
 *
 * Exported for tests. Redaction is a privacy guarantee rather than a detail —
 * an audit row is kept far longer than the record it describes, so a key
 * slipping through here persists long after the account it came from is gone.
 */
export function sanitise(
  input: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!input) return null;

  const out: Record<string, unknown> = {};
  let count = 0;

  for (const [key, value] of Object.entries(input)) {
    if (count >= 40) {
      out['…'] = 'truncated';
      break;
    }
    if (REDACTED_KEYS.has(key)) {
      out[key] = '[redacted]';
      count += 1;
      continue;
    }
    if (typeof value === 'string' && value.length > 500) {
      out[key] = `${value.slice(0, 500)}…`;
    } else {
      out[key] = value as never;
    }
    count += 1;
  }

  return out;
}

/**
 * Writes one audit row. Never throws.
 *
 * `admin` is passed explicitly rather than read off the request inside here so
 * that callers outside a request cycle — scheduled jobs, scripts — can log too.
 */
export async function record(
  admin: AdminContext,
  input: AuditInput,
  req?: AdminRequest,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: admin.userId,
        actorEmail: admin.email,
        actorRole: admin.role,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        targetLabel: input.targetLabel ?? null,
        before: (sanitise(input.before) ?? undefined) as never,
        after: (sanitise(input.after) ?? undefined) as never,
        reason: input.reason ?? null,
        success: input.success ?? true,
        errorMessage: input.errorMessage ?? null,
        ip: req ? clientIp(req) : null,
        userAgent: req ? String(req.headers['user-agent'] ?? '').slice(0, 300) || null : null,
      },
    });
  } catch (error) {
    // Deliberately swallowed — see the header comment. Logged loudly so a
    // persistently broken audit path is visible in Cloud Run rather than
    // silently leaving the trail empty.
    console.error('[auditLog/record] failed to write audit row', error);
  }

  /**
   * The console's realtime feed, from the one place every privileged mutation
   * already passes through.
   *
   * Emitted outside the try/catch above so an audit-write failure still
   * announces the action — an admin watching the feed should see what another
   * admin just did whether or not the row landed.
   *
   * Imported lazily to avoid a cycle: adminEvents reaches prisma, which is what
   * this module is built on.
   */
  try {
    const { publish } = await import('./adminEvents.js');
    publish({
      type: 'ADMIN_ACTION',
      title: `${admin.email} ran ${input.action}`,
      subtitle: input.targetLabel ?? null,
      entityType: 'admin',
      entityId: input.targetId ?? null,
      href: '/audit',
      severity: input.success === false ? 'warning' : 'info',
    });
  } catch (error) {
    console.error('[auditLog/record] failed to publish admin event', error);
  }
}

/**
 * Runs a privileged action and logs it either way.
 *
 * The failure row is the point. An attempt that threw is exactly what someone
 * reviewing the log later wants to see, and it only exists if the write happens
 * on the error path too.
 */
export async function recorded<T>(
  admin: AdminContext,
  input: AuditInput,
  req: AdminRequest | undefined,
  action: () => Promise<T>,
): Promise<T> {
  try {
    const result = await action();
    await record(admin, { ...input, success: true }, req);
    return result;
  } catch (error) {
    await record(
      admin,
      {
        ...input,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
      req,
    );
    throw error;
  }
}

/**
 * Only the fields that actually changed.
 *
 * Comparison is by JSON value, so a patch that sets a field to what it already
 * held does not produce a log row claiming something changed.
 */
export function diff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};

  for (const key of Object.keys(after)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changedBefore[key] = before[key];
      changedAfter[key] = after[key];
    }
  }

  return { before: changedBefore, after: changedAfter };
}
