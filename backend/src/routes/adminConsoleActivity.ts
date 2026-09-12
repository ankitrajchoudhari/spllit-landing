import { Router, Response } from 'express';

import prisma from '../utils/prisma.js';
import { identify } from '../middleware/identity.js';
import {
  AdminRequest,
  requireConsoleAdmin,
  requirePermission,
} from '../middleware/adminConsole.js';
import { ok, fail } from '../utils/respond.js';

/**
 * Where and when people actually use Spllit.
 *
 * Three questions a founder asks and the console could not answer:
 *
 *   - **Who is here now?** Recency buckets off `lastSeen`.
 *   - **Where do journeys start and end?** Ranked by the place *label* people
 *     picked, not by coordinates. "Velachery — 42 pickups" is a sentence
 *     somebody can act on; a cluster centroid at 12.98,80.22 is not.
 *   - **When do they travel?** A day-of-week by hour-of-day grid. This is the
 *     one that genuinely wants a heat map, because the shape *is* the answer —
 *     a campus has two spikes a day and a different weekend, and a table of 168
 *     numbers hides that while a grid shows it at a glance.
 *
 * ## Why labels rather than a coordinate heat map
 *
 * A geographic density map needs a basemap to be readable, and a grid of
 * lat/lng cells with nothing underneath is a picture of noise. The app already
 * stores the human label for every origin and destination, and those labels are
 * what people would say out loud. Spatial clustering can come later, on a real
 * map, if the labels stop being enough.
 */

const router = Router();

router.use(identify, requireConsoleAdmin);

/** How far back the "where" and "when" views look, in days. */
const WINDOW_DAYS = 30;
/** Most places listed. Beyond this it is a long tail, not a ranking. */
const TOP_PLACES = 12;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** IST. Every campus this serves is in one timezone; see the note in email.ts. */
const TZ = 'Asia/Kolkata';

/**
 * Day-of-week (0 = Monday) and hour, in IST.
 *
 * Computed with Intl rather than `getDay()`/`getHours()`, which would answer in
 * the *server's* zone — UTC on Cloud Run. That shifts every point back by five
 * and a half hours, which quietly moves the morning peak into the small hours
 * and makes the whole grid wrong in a way that still looks plausible.
 */
function istSlot(at: Date): { day: number; hour: number } | null {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ,
      weekday: 'short',
      hour: 'numeric',
      hour12: false,
    }).formatToParts(at);

    const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? NaN);
    const index = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(weekday);

    if (index < 0 || Number.isNaN(hour)) return null;
    // Intl can render midnight as 24 in some locales.
    return { day: index, hour: hour % 24 };
  } catch {
    return null;
  }
}

/** Counts a label, ignoring blanks and normalising case and spacing. */
function tally(into: Map<string, number>, label?: string | null): void {
  const key = (label ?? '').trim();
  if (key.length < 2) return;
  const existing = into.get(key) ?? 0;
  into.set(key, existing + 1);
}

function rank(counts: Map<string, number>, limit = TOP_PLACES) {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

/**
 * GET /api/admin-console/activity
 *
 * One call rather than three. Every panel on the page wants a slice of the same
 * 30-day window, and three endpoints would mean three scans of the same rows
 * and three chances for the panels to disagree about which window they mean.
 */
router.get('/activity', requirePermission('analytics.view'), async (_req: AdminRequest, res: Response) => {
  try {
    const now = Date.now();
    const since = new Date(now - WINDOW_DAYS * DAY);

    const [liveNow, lastHour, today, thisWeek, onboarded] = await Promise.all([
      // "On their phone right now" — lastSeen is written on authenticated
      // requests, so a five-minute window is the closest honest answer to
      // "currently using it" without a presence service.
      prisma.user.count({ where: { lastSeen: { gte: new Date(now - 5 * MINUTE) } } }),
      prisma.user.count({ where: { lastSeen: { gte: new Date(now - HOUR) } } }),
      prisma.user.count({ where: { lastSeen: { gte: new Date(now - DAY) } } }),
      prisma.user.count({ where: { lastSeen: { gte: new Date(now - 7 * DAY) } } }),
      prisma.user.count({ where: { onboarded: true } }),
    ]);

    const [rides, squads] = await Promise.all([
      prisma.ride.findMany({
        where: { createdAt: { gte: since } },
        select: { origin: true, destination: true, departureTime: true, createdAt: true },
        // Bounded: this is a ranking, and an unbounded scan of a growing
        // collection is how a console page becomes the slowest thing in the app.
        take: 5000,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.squad.findMany({
        where: { createdAt: { gte: since } },
        select: { destination: true, meetingPoint: true, meetingAt: true, createdAt: true },
        take: 5000,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const origins = new Map<string, number>();
    const destinations = new Map<string, number>();

    /** 7 days × 24 hours, row-major from Monday. */
    const grid: number[][] = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
    let plotted = 0;

    for (const ride of rides) {
      tally(origins, ride.origin);
      tally(destinations, ride.destination);
      // When they meant to travel, not when they happened to open the app.
      const slot = istSlot(ride.departureTime ?? ride.createdAt);
      if (slot) {
        grid[slot.day][slot.hour] += 1;
        plotted += 1;
      }
    }

    for (const squad of squads) {
      const destination = squad.destination as { label?: string } | null;
      const meeting = squad.meetingPoint as { label?: string } | null;
      tally(destinations, destination?.label);
      tally(origins, meeting?.label);

      const slot = istSlot(squad.meetingAt ?? squad.createdAt);
      if (slot) {
        grid[slot.day][slot.hour] += 1;
        plotted += 1;
      }
    }

    return ok(res, {
      windowDays: WINDOW_DAYS,
      live: { now: liveNow, lastHour, today, thisWeek, onboarded },
      places: {
        origins: rank(origins),
        destinations: rank(destinations),
      },
      when: {
        grid,
        plotted,
        /** The busiest single cell, so the client can scale intensity. */
        peak: grid.reduce((max, row) => Math.max(max, ...row), 0),
      },
      sampled: {
        rides: rides.length,
        squads: squads.length,
      },
    });
  } catch (error) {
    console.error('[admin-console/activity]', error);
    return fail(res, 500, 'Failed to load activity');
  }
});

export default router;
