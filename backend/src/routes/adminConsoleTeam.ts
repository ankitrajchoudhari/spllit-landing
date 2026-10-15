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
  TEAM_SETTING_KEY,
  readTeamContent,
  teamContentSchema,
  writeTeamContent,
} from '../services/teamContent.js';
import { MAX_IMAGE_BYTES, uploadImage } from '../services/mediaUpload.js';

/**
 * Admin console — Team.
 *
 * The same shape as the blog router, and gated on the same settings.view /
 * settings.edit permissions: no new role matrix for a list of names.
 */

interface UploadedFile {
  buffer: Buffer;
  originalname?: string;
}

const router = Router();

router.use(identify, requireConsoleAdmin);

/** In memory, then straight to the bucket — Cloud Run disks do not persist. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
});

/** GET /team — everyone, hidden included, for the editor. Null on first run. */
router.get('/team', requirePermission('settings.view'), async (_req: AdminRequest, res: Response) => {
  try {
    const content = await readTeamContent();
    return ok(res, { content, published: content !== null });
  } catch (error) {
    console.error('[console/team:get]', error);
    return fail(res, 500, 'Failed to load the team');
  }
});

/** PUT /team — replace the whole list. */
router.put('/team', requirePermission('settings.edit'), async (req: AdminRequest, res: Response) => {
  const admin = req.admin!;
  try {
    const parsed = teamContentSchema.safeParse(req.body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return fail(res, 400, first ? `${first.path.join('.')}: ${first.message}` : 'Invalid content');
    }

    const ids = new Set<string>();
    for (const member of parsed.data.members) {
      if (ids.has(member.id)) return fail(res, 400, 'Two people share one id');
      ids.add(member.id);
    }

    const before = await readTeamContent();
    const saved = await writeTeamContent(parsed.data, admin.userId);
    invalidateSettingsCache();

    const count = (content: typeof saved | null, status: 'active' | 'exited') =>
      content?.members.filter((m) => m.status === status && !m.hidden).length ?? 0;

    await audit.record(
      admin,
      {
        action: 'settings.update',
        targetType: 'setting',
        targetId: TEAM_SETTING_KEY,
        targetLabel: 'Team',
        before: { active: count(before, 'active'), exited: count(before, 'exited') },
        after: { active: count(saved, 'active'), exited: count(saved, 'exited') },
      },
      req,
    );

    void revalidateLandingAbout();

    return ok(res, { content: saved });
  } catch (error) {
    console.error('[console/team:put]', error);
    return fail(res, 500, 'Failed to save the team');
  }
});

/** POST /team/image — a photo, uploaded on its own and handed back as a URL. */
router.post(
  '/team/image',
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
          targetId: TEAM_SETTING_KEY,
          targetLabel: 'Team photo uploaded',
          after: { url: result.url, bytes: result.bytes },
        },
        req,
      );

      return ok(res, result);
    } catch (error) {
      console.error('[console/team:image]', error);
      return fail(res, 500, 'Failed to upload the photo');
    }
  },
);

/**
 * Ask the landing site to drop its cached /about, then load it once so the
 * next visitor gets the new page. Same shape as the blog version, for the same
 * reason: the warming fetch must be a separate request made after the
 * revalidate call has returned.
 */
async function revalidateLandingAbout(): Promise<void> {
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
      body: JSON.stringify({ reason: 'team.content' }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn('[team] landing revalidation refused', res.status);
      return;
    }
    await fetch(`${base}/about`, { signal: AbortSignal.timeout(10000) }).catch(() => undefined);
  } catch (error) {
    console.warn('[team] landing revalidation failed', error);
  }
}

export default router;
