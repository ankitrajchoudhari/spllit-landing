import { PrismaClient } from '@prisma/client';

const base = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

/**
 * Publishes an admin-console event for a write that just succeeded.
 *
 * Imported lazily, on purpose. `services/adminEvents.ts` imports this module's
 * default export, so a static import here would close a cycle; deferring it to
 * call time means the module is fully initialised before it is ever reached.
 *
 * Every failure is swallowed. This runs after a user's write has already
 * committed, and a metrics problem must never turn a successful signup into a
 * failed request — see the header of adminEvents.ts.
 */
function observe(build: () => import('../services/adminEvents.js').AdminEventInput): void {
  void (async () => {
    try {
      const { publish } = await import('../services/adminEvents.js');
      publish(build());
    } catch (error) {
      console.error('[prisma/observe]', error);
    }
  })();
}

/** Trims a label so a feed headline cannot be a paragraph. */
function short(value: unknown, max = 60): string {
  const text = String(value ?? '').trim();
  return text.length > max ? `${text.slice(0, max)}…` : text || 'Untitled';
}

/**
 * The Prisma client, extended to observe the writes the console reports on.
 *
 * This is deliberately the *only* instrumentation point for Phase 3. The
 * alternative was an emit inside each of ~15 route handlers, which means
 * editing files the live user-facing app depends on, and means every future
 * write path silently going unreported until somebody remembers to add one.
 *
 * Each handler runs `query(args)` first and only reports once it has resolved,
 * so nothing is ever announced that did not actually commit. None of them
 * awaits the reporting.
 *
 * Note the models absent from this list: `metricCounter`, `metricRollup` and
 * `activityEvent` are what the reporting itself writes, and observing them
 * would have each event trigger another.
 */
const prisma = base.$extends({
  query: {
    user: {
      async create({ args, query }) {
        const result = await query(args);
        observe(() => ({
          type: 'USER_CREATED',
          title: `${short(result.name)} joined Spllit`,
          subtitle: result.college ? short(result.college) : null,
          entityType: 'user',
          entityId: result.id,
          href: `/users/${result.id}`,
        }));
        return result;
      },
    },

    ride: {
      async create({ args, query }) {
        const result = await query(args);
        observe(() => ({
          type: 'RIDE_CREATED',
          title: `Ride to ${short(result.destination, 40)}`,
          subtitle: `from ${short(result.origin, 40)}`,
          entityType: 'ride',
          entityId: result.id,
          href: `/rides/${result.id}`,
        }));
        return result;
      },
    },

    match: {
      async create({ args, query }) {
        const result = await query(args);
        observe(() => ({
          type: 'MATCH_CREATED',
          title: 'Ride match created',
          subtitle: `initiated by ${short(result.initiatedBy, 20)}`,
          entityType: 'ride',
          entityId: result.rideId,
          href: `/rides/${result.rideId}`,
        }));
        return result;
      },
    },

    squad: {
      async create({ args, query }) {
        const result = await query(args);
        observe(() => ({
          type: 'SQUAD_CREATED',
          title: `Squad "${short(result.name, 40)}" created`,
          subtitle: result.college ? short(result.college) : null,
          entityType: 'squad',
          entityId: result.id,
          href: `/squads/${result.id}`,
        }));
        return result;
      },
    },

    squadMember: {
      async create({ args, query }) {
        const result = await query(args);
        observe(() => ({
          type: 'SQUAD_MEMBER_JOINED',
          title: 'Someone joined a squad',
          subtitle: `as ${short(result.role, 20)}`,
          entityType: 'squad',
          entityId: result.squadId,
          href: `/squads/${result.squadId}`,
        }));
        return result;
      },
    },

    event: {
      async create({ args, query }) {
        const result = await query(args);
        observe(() => ({
          type: 'EVENT_CREATED',
          title: `Event "${short(result.title, 40)}" created`,
          subtitle: result.college ? short(result.college) : null,
          entityType: 'event',
          entityId: result.id,
          href: `/events/${result.id}`,
        }));
        return result;
      },
    },

    community: {
      async create({ args, query }) {
        const result = await query(args);
        observe(() => ({
          type: 'COMMUNITY_CREATED',
          title: `Community "${short(result.name, 40)}" created`,
          subtitle: `/${short(result.slug, 30)}`,
          entityType: 'community',
          entityId: result.id,
          href: `/communities/${result.id}`,
        }));
        return result;
      },
    },

    threadMessage: {
      async create({ args, query }) {
        const result = await query(args);
        // Counted, never listed, and the content is never carried — see
        // NOT_ON_FEED in adminEvents.ts.
        observe(() => ({
          type: 'MESSAGE_SENT',
          title: 'Message sent',
          entityType: 'thread',
          entityId: result.threadId,
        }));
        return result;
      },
    },

    notification: {
      async create({ args, query }) {
        const result = await query(args);
        observe(() => ({
          type: 'NOTIFICATION_SENT',
          title: 'Notification sent',
          entityType: 'user',
          entityId: result.userId,
        }));
        return result;
      },
    },

    emergency: {
      async create({ args, query }) {
        const result = await query(args);
        observe(() => ({
          type: 'EMERGENCY_RAISED',
          title: `SOS raised: ${short(result.emergencyType, 30)}`,
          subtitle: short(result.message, 60),
          entityType: 'emergency',
          entityId: result.id,
          href: '/moderation',
          // The one event that should look different on the feed at a glance.
          severity: 'danger',
        }));
        return result;
      },
    },
  },
});

// Graceful shutdown. Bound to the base client: `$disconnect` belongs to the
// underlying connection, not to the extension wrapping it.
process.on('beforeExit', async () => {
  await base.$disconnect();
});

export default prisma;
