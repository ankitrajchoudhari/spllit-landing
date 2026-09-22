import { Router, Request, Response } from 'express';

import prisma from '../utils/prisma.js';
import { ok, fail, boundingBox, parseCoords } from '../utils/respond.js';
import { publicView, readCareersContent } from '../services/careers.js';
import crypto from 'node:crypto';
import { z } from 'zod';
import { emailApplicationReceived } from '../services/email.js';

const router = Router();

/**
 * Pre-auth endpoints for the landing page.
 *
 * PRIVACY BOUNDARY: nothing returned here identifies a user, a ride or a squad.
 * Positions are snapped to a coarse grid and reported as aggregate counts per
 * cell, so a logged-out visitor learns "there is activity in this area" and
 * nothing more. Do not add identifying fields to these responses.
 */

/** ~0.0025° ≈ 250 m. Coarse enough that a cell never points at one person. */
const GRID = 0.0025;

/** Cells with fewer than this many entities are dropped entirely. */
const MIN_CELL_COUNT = 1;

function snap(value: number): number {
  return Math.round(value / GRID) * GRID;
}

router.get('/map-preview', async (req: Request, res: Response) => {
  try {
    const coords = parseCoords(req.query);
    const box = coords ? boundingBox(coords.lat, coords.lng, 25) : null;
    const now = new Date();

    const [rides, squads, events] = await Promise.all([
      prisma.ride.findMany({
        where: {
          status: { in: ['requested', 'accepted', 'arriving', 'in_progress'] },
          departureTime: { gte: new Date(now.getTime() - 60 * 60 * 1000) },
          originLat: { not: null },
          originLng: { not: null },
          ...(box
            ? {
                originLat: { gte: box.minLat, lte: box.maxLat, not: null },
                originLng: { gte: box.minLng, lte: box.maxLng, not: null },
              }
            : {}),
        },
        select: { originLat: true, originLng: true },
        take: 400,
      }),
      prisma.squad.findMany({
        where: {
          isActive: true,
          visibility: 'public',
          lat: { not: null },
          lng: { not: null },
          ...(box
            ? {
                lat: { gte: box.minLat, lte: box.maxLat, not: null },
                lng: { gte: box.minLng, lte: box.maxLng, not: null },
              }
            : {}),
        },
        select: { lat: true, lng: true },
        take: 400,
      }),
      prisma.event.findMany({
        where: { status: 'published', startsAt: { gte: now } },
        select: { venue: true },
        take: 400,
      }),
    ]);

    const cells = new Map<string, { kind: string; lat: number; lng: number; count: number }>();

    const add = (kind: string, lat: number | null, lng: number | null) => {
      if (lat === null || lng === null) return;
      const sLat = snap(lat);
      const sLng = snap(lng);
      const key = `${kind}:${sLat.toFixed(4)}:${sLng.toFixed(4)}`;
      const existing = cells.get(key);
      if (existing) existing.count += 1;
      else cells.set(key, { kind, lat: sLat, lng: sLng, count: 1 });
    };

    for (const ride of rides) add('ride', ride.originLat, ride.originLng);
    for (const squad of squads) add('squad', squad.lat, squad.lng);
    for (const event of events) {
      if (box) {
        const { lat, lng } = event.venue;
        if (lat < box.minLat || lat > box.maxLat || lng < box.minLng || lng > box.maxLng) {
          continue;
        }
      }
      add('event', event.venue.lat, event.venue.lng);
    }

    const markers = [...cells.entries()]
      .filter(([, cell]) => cell.count >= MIN_CELL_COUNT)
      .map(([key, cell]) => ({
        id: key,
        kind: cell.kind,
        position: [cell.lng, cell.lat],
        count: cell.count,
      }));

    return ok(res, markers);
  } catch (error) {
    console.error('[public/map-preview]', error);
    return fail(res, 500, 'Failed to load preview');
  }
});

/**
 * Careers page content.
 *
 * Anonymous by construction: this is marketing copy and a list of open roles,
 * nothing about a user. Drafts are stripped here rather than on the client, so
 * an unpublished role never crosses the wire.
 *
 * A 404 is a normal answer. The setting does not exist until somebody saves it
 * in the console, and the site falls back to its built-in copy — so an empty
 * store must not read as a server error.
 */
router.get('/careers', async (_req: Request, res: Response) => {
  try {
    const content = await readCareersContent();
    if (!content) return fail(res, 404, 'Careers content has not been published yet');
    return ok(res, publicView(content));
  } catch (error) {
    console.error('[public/careers]', error);
    return fail(res, 500, 'Failed to load careers content');
  }
});

/**
 * Confirmation email for a careers application.
 *
 * Called by an Apps Script bound to the Google Form's onFormSubmit trigger,
 * because a form hosted by Google tells this server nothing on its own. It is
 * on the public router only in the sense of being unauthenticated by a user
 * session — it is not open. An endpoint that emails an arbitrary address on
 * request is a spam relay, so:
 *
 *  - It does nothing at all unless CAREERS_WEBHOOK_SECRET is set, and returns
 *    503 rather than pretending to have worked.
 *  - The secret is compared in constant time, so the comparison cannot be used
 *    to guess it a byte at a time.
 *  - The role must exist and be one we published. An attacker who somehow had
 *    the secret still could not use this to send arbitrary text.
 *  - The body is fixed. Nothing the caller sends is rendered into the email
 *    except the applicant's own name, and the role title comes from our own
 *    stored content rather than from the request.
 */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which would itself leak the
  // length, so pad to a common size first.
  const len = Math.max(a.length, b.length);
  const pa = Buffer.alloc(len);
  const pb = Buffer.alloc(len);
  a.copy(pa);
  b.copy(pb);
  return crypto.timingSafeEqual(pa, pb) && a.length === b.length;
}

const applicationSchema = z.object({
  email: z.string().trim().email().max(320),
  name: z.string().trim().max(120).optional(),
  /** Matches the role id shown in the console. */
  roleId: z.string().trim().min(1).max(80),
  /** The form's own response id, so a retry cannot send a second email. */
  submissionId: z.string().trim().min(1).max(200)
});

router.post('/careers/application', async (req: Request, res: Response) => {
  try {
    const expected = process.env.CAREERS_WEBHOOK_SECRET?.trim();
    if (!expected) {
      return fail(res, 503, 'Careers application webhook is not configured');
    }

    const provided = String(req.headers['x-spllit-careers-secret'] ?? '');
    if (!provided || !secretMatches(provided, expected)) {
      return fail(res, 401, 'Invalid webhook secret');
    }

    const parsed = applicationSchema.safeParse(req.body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return fail(res, 400, first ? `${first.path.join('.')}: ${first.message}` : 'Invalid payload');
    }

    const content = await readCareersContent();
    const role = content?.roles.find((r) => r.id === parsed.data.roleId && !r.draft);
    if (!role) {
      // Named roles only. This is what stops the endpoint being a way to send
      // mail about anything at all.
      return fail(res, 404, `No published role with id "${parsed.data.roleId}"`);
    }

    const sent = await emailApplicationReceived({
      to: parsed.data.email,
      name: parsed.data.name,
      roleTitle: role.title,
      submissionId: parsed.data.submissionId
    });

    // 202 either way: the form has already taken the application, and telling
    // Apps Script the send failed would make it retry a submission that was
    // never at risk. A failed send is logged here, not pushed back to Google.
    if (!sent) console.error('[public/careers/application] email not sent', { roleId: role.id });
    return ok(res, { received: true, emailed: sent }, 202);
  } catch (error) {
    console.error('[public/careers/application]', error);
    return fail(res, 500, 'Failed to record the application');
  }
});

/**
 * Real counters for the landing page. The client omits the social-proof line
 * entirely when these are zero — no invented numbers anywhere.
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [activeRides, activeSquads, upcomingEvents, colleges] = await Promise.all([
      prisma.ride.count({
        where: {
          status: { in: ['requested', 'accepted', 'arriving', 'in_progress'] },
          departureTime: { gte: now },
        },
      }),
      prisma.squad.count({ where: { isActive: true } }),
      prisma.event.count({
        where: { status: 'published', startsAt: { gte: now, lte: weekOut } },
      }),
      prisma.user
        .findMany({ distinct: ['college'], select: { college: true } })
        .then((rows) => rows.filter((r) => r.college?.trim()).length),
    ]);

    return ok(res, { activeRides, activeSquads, upcomingEvents, colleges });
  } catch (error) {
    console.error('[public/stats]', error);
    return fail(res, 500, 'Failed to load stats');
  }
});

export default router;
