import prisma from '../utils/prisma.js';

/**
 * The one place that decides whether a message may be sent.
 *
 * Every rule that could stop an email lives here rather than at the call sites,
 * because the failure mode of scattering them is that the newest message type
 * is the one that forgot the suppression check — and a single message to an
 * address that reported spam costs more than the message was worth.
 *
 * The checks run cheapest-first and stop at the first refusal. Each returns a
 * reason, which is logged and never shown to anyone: "we did not email you"
 * is not a thing a user needs an explanation of, and the reasons name other
 * people's mailbox behaviour.
 */

/** Message categories. Adding one means adding it here and nowhere else. */
export const EMAIL_CATEGORIES = {
  /** Somebody asked to join your squad. */
  JOIN_REQUEST: 'join-request',
  /** Your request was accepted. */
  REQUEST_ACCEPTED: 'request-accepted',
  /** Sent once, when an account is first created. */
  WELCOME: 'welcome',
} as const;

export type EmailCategory = (typeof EMAIL_CATEGORIES)[keyof typeof EMAIL_CATEGORIES];

/**
 * Categories that ignore quiet hours.
 *
 * "Your request was accepted" is the answer to something the person asked for
 * and went to sleep wondering about; holding it until morning is worse than
 * delivering it at 1am, and mail does not buzz a phone the way a push does.
 * A welcome message is the opposite — it can wait, and arriving seconds after
 * signup at 3am reads as automated.
 */
const IGNORES_QUIET_HOURS: readonly string[] = [EMAIL_CATEGORIES.REQUEST_ACCEPTED];

/** Categories a person may switch off. Transactional answers are not optional. */
export const OPTIONAL_CATEGORIES: readonly string[] = [
  EMAIL_CATEGORIES.JOIN_REQUEST,
  EMAIL_CATEGORIES.WELCOME,
];

export const QUIET_HOURS = { START: 22, END: 7 } as const;

/** Used when a person has not told us where they are. */
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/**
 * How long after emailing somebody about a squad we stay quiet about it.
 *
 * This is the batching rule, and it is a cool-off rather than a digest queue on
 * purpose. A digest has to be flushed by something, and the only scheduler here
 * runs daily — so "five requests become one email" would also mean "the first
 * request waits up to a day", which is worse than the problem. Instead the
 * first request mails immediately and the next few are silent: the leader opens
 * the email already sent and sees every pending request on the page, because
 * the page lists them all anyway.
 */
export const JOIN_REQUEST_COOLOFF_MINUTES = 30;

/** Nobody receives more than this from Spllit in an hour, whatever the reason. */
export const MAX_EMAILS_PER_HOUR = 6;

export type PolicyRefusal =
  | 'no-address'
  | 'unverified'
  | 'synthetic-address'
  | 'suppressed'
  | 'category-off'
  | 'quiet-hours'
  | 'cooling-off'
  | 'hourly-cap';

export interface PolicyResult {
  allowed: boolean;
  reason?: PolicyRefusal;
  email?: string;
  name?: string;
}

/**
 * Addresses Firebase invents for phone-only accounts.
 *
 * `.local` is not a real top-level domain, so every one of these is a
 * guaranteed hard bounce. None is currently marked verified, which is the only
 * reason this has not already happened — but that is a property of the current
 * data rather than of the code, and one write away from changing.
 */
function isSyntheticAddress(email: string): boolean {
  return email.endsWith('@firebase.local') || email.endsWith('.local');
}

/** True when local time at `timezone` falls inside the quiet window. */
export function isQuietHour(now: Date, timezone: string): boolean {
  let hour: number;
  try {
    hour = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false,
      }).format(now),
    );
  } catch {
    // An unknown zone must not silence somebody's mail forever. Treat it as
    // daytime and let the other rules decide.
    return false;
  }

  if (Number.isNaN(hour)) return false;
  // The window wraps midnight, so it is a union rather than a range.
  return hour >= QUIET_HOURS.START || hour < QUIET_HOURS.END;
}

/**
 * Whether this message may go to this person, right now.
 *
 * `scopeId` narrows the cool-off — a squad id, so a busy squad does not silence
 * a different one.
 */
export async function mayEmail(params: {
  userId: string;
  category: EmailCategory;
  scopeId?: string;
  now?: Date;
}): Promise<PolicyResult> {
  const now = params.now ?? new Date();

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { email: true, name: true, emailVerified: true },
  });

  if (!user?.email) return { allowed: false, reason: 'no-address' };
  if (!user.emailVerified) return { allowed: false, reason: 'unverified' };
  if (isSyntheticAddress(user.email)) return { allowed: false, reason: 'synthetic-address' };

  const address = user.email.toLowerCase();

  // Checked before preferences: a complaint is the receiving side's decision
  // and outranks anything the account holder has configured.
  const suppressed = await prisma.emailSuppression.findUnique({
    where: { email: address },
    select: { id: true },
  });
  if (suppressed) return { allowed: false, reason: 'suppressed' };

  const prefs = await prisma.notificationPref.findUnique({
    where: { userId: params.userId },
    select: { emailOff: true, quietHours: true, timezone: true },
  });

  if (
    prefs?.emailOff?.includes(params.category) &&
    OPTIONAL_CATEGORIES.includes(params.category)
  ) {
    return { allowed: false, reason: 'category-off' };
  }

  if (
    !IGNORES_QUIET_HOURS.includes(params.category) &&
    (prefs?.quietHours ?? true) &&
    isQuietHour(now, prefs?.timezone || DEFAULT_TIMEZONE)
  ) {
    return { allowed: false, reason: 'quiet-hours' };
  }

  if (params.category === EMAIL_CATEGORIES.JOIN_REQUEST) {
    const since = new Date(now.getTime() - JOIN_REQUEST_COOLOFF_MINUTES * 60_000);
    const recent = await prisma.emailSendLog.findFirst({
      where: {
        userId: params.userId,
        category: params.category,
        scopeId: params.scopeId ?? null,
        sentAt: { gte: since },
      },
      select: { id: true },
    });
    if (recent) return { allowed: false, reason: 'cooling-off' };
  }

  const hourAgo = new Date(now.getTime() - 3600_000);
  const sentThisHour = await prisma.emailSendLog.count({
    where: { userId: params.userId, sentAt: { gte: hourAgo } },
  });
  if (sentThisHour >= MAX_EMAILS_PER_HOUR) return { allowed: false, reason: 'hourly-cap' };

  return { allowed: true, email: user.email, name: user.name };
}

/**
 * Records that a message went out, which is what the cool-off and the cap read.
 *
 * Written after a successful send only. Logging an attempt that failed would
 * let a broken mail provider silence somebody for an hour.
 */
export async function recordEmailSent(params: {
  userId: string;
  category: EmailCategory;
  scopeId?: string;
}): Promise<void> {
  try {
    await prisma.emailSendLog.create({
      data: {
        userId: params.userId,
        category: params.category,
        scopeId: params.scopeId ?? null,
      },
    });
  } catch (error) {
    // A missing log entry costs at most one duplicate email later. Failing the
    // send over it would cost the message itself.
    console.error('[email] could not record send', error);
  }
}

/** Adds an address to the suppression list. Idempotent. */
export async function suppressAddress(
  email: string,
  reason: 'bounce' | 'complaint' | 'unsubscribe' | 'manual',
  detail?: string,
): Promise<void> {
  const address = email.trim().toLowerCase();
  if (!address) return;

  await prisma.emailSuppression.upsert({
    where: { email: address },
    // Not overwritten: the first reason is the true one, and a later bounce on
    // an address that already complained does not change what happened.
    update: {},
    create: { email: address, reason, detail: detail?.slice(0, 500) ?? null },
  });

  console.log(`[email] suppressed an address (${reason})`);
}

/** Drops send-log rows older than the longest window that reads them. */
export async function sweepEmailSendLog(now: Date = new Date()): Promise<number> {
  // Two hours covers the one-hour cap and the 30-minute cool-off with room to
  // spare. Nothing reads further back, so nothing older is worth keeping.
  const cutoff = new Date(now.getTime() - 2 * 3600_000);
  const { count } = await prisma.emailSendLog.deleteMany({ where: { sentAt: { lt: cutoff } } });
  return count;
}
