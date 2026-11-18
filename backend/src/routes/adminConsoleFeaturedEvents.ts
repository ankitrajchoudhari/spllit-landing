import { Router, Response } from 'express';
import multer from 'multer';

import { identify } from '../middleware/identity.js';
import {
  AdminRequest,
  requireConsoleAdmin,
  requirePermission,
} from '../middleware/adminConsole.js';
import { ok, fail } from '../utils/respond.js';
import * as audit from '../services/auditLog.js';
import { invalidateSettingsCache } from '../services/platformSettings.js';
import {
  FEATURED_EVENTS_KEY,
  featuredEventsSchema,
  readFeaturedEvents,
  writeFeaturedEvents,
} from '../services/featuredEvents.js';
import { MAX_IMAGE_BYTES, uploadImage } from '../services/mediaUpload.js';

/**
 * Admin console — events featured on the home page.
 *
 * Same shape as the team and blog routers, on the same settings.view /
 * settings.edit permissions. Not to be confused with /events in the console,
 * which moderates events users create inside the app.
 */

interface UploadedFile {
  buffer: Buffer;
  originalname?: string;
}

const router = Router();

router.use(identify, requireConsoleAdmin);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
});

/** GET /featured-events — all of them, hidden and finished included. */
router.get(
  '/featured-events',
  requirePermission('settings.view'),
  async (_req: AdminRequest, res: Response) => {
    try {
      const content = await readFeaturedEvents();
      return ok(res, { content });
    } catch (error) {
      console.error('[console/featured-events:get]', error);
      return fail(res, 500, 'Failed to load featured events');
    }
  },
);

/** PUT /featured-events — replace the whole list. */
router.put(
  '/featured-events',
  requirePermission('settings.edit'),
  async (req: AdminRequest, res: Response) => {
    const admin = req.admin!;
    try {
      const parsed = featuredEventsSchema.safeParse(req.body);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        return fail(res, 400, first ? `${first.path.join('.')}: ${first.message}` : 'Invalid content');
      }

      const before = await readFeaturedEvents();
      const saved = await writeFeaturedEvents(parsed.data, admin.userId);
      invalidateSettingsCache();

      await audit.record(
        admin,
        {
          action: 'settings.update',
          targetType: 'setting',
          targetId: FEATURED_EVENTS_KEY,
          targetLabel: 'Featured events',
          before: { events: before?.events.length ?? 0 },
          after: { events: saved.events.length },
        },
        req,
      );

      void revalidateLandingHome();

      return ok(res, { content: saved });
    } catch (error) {
      console.error('[console/featured-events:put]', error);
      return fail(res, 500, 'Failed to save featured events');
    }
  },
);

/** POST /featured-events/image — a poster, uploaded on its own. */
router.post(
  '/featured-events/image',
  requirePermission('settings.edit'),
  upload.single('file'),
  async (req: AdminRequest, res: Response) => {
    try {
      const { file } = req as AdminRequest & { file?: UploadedFile };
      if (!file) return fail(res, 400, 'No file was sent');

      const result = await uploadImage(file.buffer);
      if (result.error) return fail(res, 400, result.error);

      await audit.record(
        req.admin!,
        {
          action: 'settings.update',
          targetType: 'setting',
          targetId: FEATURED_EVENTS_KEY,
          targetLabel: 'Event poster uploaded',
          after: { url: result.url, bytes: result.bytes },
        },
        req,
      );

      return ok(res, result);
    } catch (error) {
      console.error('[console/featured-events:image]', error);
      return fail(res, 500, 'Failed to upload the poster');
    }
  },
);

/** Ask the landing site to rebuild its home page, then load it once. */
async function revalidateLandingHome(): Promise<void> {
  const secret = process.env.LANDING_REVALIDATE_SECRET?.trim();
  if (!secret) return;

  const base = (process.env.FRONTEND_URL?.trim() || 'https://spllit.app').replace(/\/$/, '');

  try {
    const res = await fetch(`${base}/api/revalidate`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-spllit-revalidate-secret': secret,
      },
      body: JSON.stringify({ reason: 'home.events' }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn('[featured-events] landing revalidation refused', res.status);
      return;
    }
    await fetch(`${base}/`, { signal: AbortSignal.timeout(10000) }).catch(() => undefined);
  } catch (error) {
    console.warn('[featured-events] landing revalidation failed', error);
  }
}

export default router;
