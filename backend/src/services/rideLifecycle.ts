/**
 * The ride state machine, in one place.
 *
 * This used to live inside routes/ridesPlatform.ts, which was the only thing
 * that needed it — the client never writes `status` directly, it POSTs an
 * intent to /transition and the server decides whether the move is legal.
 *
 * It moved here when a second caller appeared: services/staleSweep.ts cancels
 * rides whose departure passed months ago, and it must not be able to make a
 * transition a user could not. The alternative was a hand-copied list of
 * statuses in the sweep, which would agree with this machine right up until
 * somebody edited one of them — and the failure that produces is a background
 * job quietly rewriting rows in ways the app considers impossible.
 *
 * Pure data and one pure function. No imports, so anything may depend on it.
 */

/**
 *   requested → accepted → arriving → in_progress → completed
 *             ↘──────────┴──────────┘
 *                    cancelled
 */
export const TRANSITIONS: Record<string, string[]> = {
  requested: ['accepted', 'cancelled'],
  accepted: ['arriving', 'cancelled'],
  arriving: ['in_progress', 'cancelled'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
};

/**
 * Legacy rows use pending/matched. Normalise before checking the machine.
 *
 * Kept as a map rather than an if-chain so `statusesAllowing` below can walk it
 * — the aliases have to appear in any derived set, or a sweep built from that
 * set would silently skip every legacy row. Twelve of the twenty-one open rides
 * in production are `matched`, so that is the majority case, not an edge.
 */
export const LEGACY_ALIASES: Record<string, string> = {
  pending: 'requested',
  matched: 'accepted',
};

export function normaliseStatus(status: string): string {
  return LEGACY_ALIASES[status] ?? status;
}

/** Transitions only the host may perform. */
export const HOST_ONLY = new Set(['accepted', 'arriving', 'in_progress', 'completed']);

/**
 * Every stored status from which `to` is a legal move, aliases included.
 *
 * Derived rather than written down, so a change to TRANSITIONS reaches every
 * caller at once. `statusesAllowing('cancelled')` is what the stale sweep runs
 * on.
 */
export function statusesAllowing(to: string): string[] {
  const canonical = Object.keys(TRANSITIONS).filter((from) => TRANSITIONS[from].includes(to));
  const aliases = Object.keys(LEGACY_ALIASES).filter((alias) =>
    canonical.includes(LEGACY_ALIASES[alias]),
  );
  return [...canonical, ...aliases];
}
