/**
 * Who a console message is aimed at.
 *
 * One definition, used by both send paths — in-app broadcasts
 * (routes/adminConsoleSettings.ts) and email campaigns (services/campaigns.ts).
 * They were separate, and the two drifted in exactly the way that matters: the
 * broadcast filter was corrected and the campaign one was not, so "everyone"
 * meant two different populations depending on which button an admin pressed.
 *
 * ## `isActive` is deliberately absent from every audience below
 *
 * It reads like a reachability flag and is not one. The Firebase bootstrap path
 * never checks it, so accounts marked inactive sign in and use Spllit normally —
 * 205 of 229 accounts carry `false`, eight of them used the app in the last
 * week, and no code path in this repository sets it. Whatever wrote it, it does
 * not describe whether somebody can be reached.
 *
 * Filtering on it meant "everyone onboarded" quietly meant 24 people out of 229,
 * and a send reporting success had reached a tenth of its audience. `onboarded`
 * is the meaningful filter and stays.
 *
 * If a real suspension concept is wanted later it needs a field that actually
 * gates sign-in, and then this is where it belongs. Reinstating this filter
 * before that exists would only restore a silent one-in-ten send.
 */

/** Every audience the console offers. Each maps to a `where` below. */
export const AUDIENCES = ['all', 'active', 'inactive', 'onboarding', 'college', 'users'] as const;

export type Audience = (typeof AUDIENCES)[number];

export function isAudience(value: unknown): value is Audience {
  return typeof value === 'string' && (AUDIENCES as readonly string[]).includes(value);
}

/** Most recipients one named-list send may have. */
export const MAX_NAMED_RECIPIENTS = 200;

/** Everything older than this is "lapsed". */
const ACTIVE_WINDOW_DAYS = 30;

export function audienceWhere(
  audience: Audience,
  college: string,
  userIds: string[] = [],
): Record<string, unknown> {
  const monthAgo = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 86_400_000);

  switch (audience) {
    /**
     * Named individuals, filtered on nothing but the list.
     *
     * Not even `onboarded`, which every case below applies: those narrow a
     * population, where somebody half-registered is noise. This is a list an
     * admin typed on purpose, and somebody stuck in onboarding is frequently
     * the exact person a console operator needs to reach. The picker badges the
     * unusual states, so it stays a choice rather than an accident.
     */
    case 'users':
      return { id: { in: userIds.slice(0, MAX_NAMED_RECIPIENTS) } };
    case 'active':
      return { onboarded: true, lastSeen: { gte: monthAgo } };
    case 'inactive':
      return { onboarded: true, lastSeen: { lt: monthAgo } };
    case 'onboarding':
      return { onboarded: false };
    case 'college':
      return { onboarded: true, college };
    default:
      return { onboarded: true };
  }
}

/** Human wording for an audience, for audit entries and confirmations. */
export function describeAudience(audience: Audience, college: string, named: number): string {
  switch (audience) {
    case 'users':
      return `${named} named ${named === 1 ? 'person' : 'people'}`;
    case 'active':
      return `active in the last ${ACTIVE_WINDOW_DAYS} days`;
    case 'inactive':
      return `not seen in ${ACTIVE_WINDOW_DAYS} days`;
    case 'onboarding':
      return 'still onboarding';
    case 'college':
      return college || 'one college';
    default:
      return 'everyone onboarded';
  }
}
