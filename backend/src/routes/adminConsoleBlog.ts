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
  BLOG_SETTING_KEY,
  blogContentSchema,
  findDuplicateSlugs,
  readBlogContent,
  writeBlogContent,
} from '../services/blogContent.js';
import { MAX_IMAGE_BYTES, uploadImage } from '../services/mediaUpload.js';

/**
 * Admin console — Blog & News.
 *
 * Its own router rather than another block inside settings: this one carries a
 * file upload, which needs a body parser the rest of the console must not get.
 * Gated on the same settings.view / settings.edit permissions as careers, so
 * no new role matrix and nobody gains anything by this existing.
 */

/**
 * What multer puts on the request.
 *
 * Declared here rather than pulling in @types/multer for two fields: the
 * package is only used by this route and the CSV importer, and neither needs
 * the rest of the surface.
 */
interface UploadedFile {
  buffer: Buffer;
  originalname?: string;
}

const router = Router();

router.use(identify, requireConsoleAdmin);

/**
 * In memory, then straight out to the bucket.
 *
 * Nothing is written to disk: Cloud Run replaces instances between requests,
 * so a file on local disk is a file that may not be there when it is wanted.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
});

/** GET /blog — everything, drafts included, for the editor. */
router.get('/blog', requirePermission('settings.view'), async (_req: AdminRequest, res: Response) => {
  try {
    const content = await readBlogContent();
    // Null is a normal first run, not a failure: the console opens an empty
    // editor the first time somebody uses it.
    return ok(res, { content, published: content !== null });
  } catch (error) {
    console.error('[console/blog:get]', error);
    return fail(res, 500, 'Failed to load blog content');
  }
});

/** PUT /blog — replace the whole document. */
router.put('/blog', requirePermission('settings.edit'), async (req: AdminRequest, res: Response) => {
  const admin = req.admin!;
  try {
    const parsed = blogContentSchema.safeParse(req.body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return fail(res, 400, first ? `${first.path.join('.')}: ${first.message}` : 'Invalid content');
    }

    // The slug is the URL. Two posts sharing one means whichever loses is
    // unreachable, with nothing on the page to say why.
    const duplicates = findDuplicateSlugs(parsed.data.posts);
    if (duplicates.length > 0) {
      return fail(res, 400, `Two posts share the link "${duplicates.join(', ')}"`);
    }

    const before = await readBlogContent();
    const saved = await writeBlogContent(parsed.data, admin.userId);
    invalidateSettingsCache();

    await audit.record(
      admin,
      {
        action: 'settings.update',
        targetType: 'setting',
        targetId: BLOG_SETTING_KEY,
        targetLabel: 'Blog & News posts',
        before: { posts: before?.posts.length ?? 0 },
        after: { posts: saved.posts.length },
      },
      req,
    );

    // Not awaited: the save is done, and the site is correct within its own
    // refresh either way.
    void revalidateLandingBlog(saved.posts.filter((post) => !post.draft).map((post) => post.slug));

    return ok(res, { content: saved });
  } catch (error) {
    console.error('[console/blog:put]', error);
    return fail(res, 500, 'Failed to save blog content');
  }
});

/**
 * POST /blog/image — take a picture and hand back a URL.
 *
 * Deliberately separate from saving the post. An author picks a file long
 * before they are finished writing, and making the upload part of the save
 * would mean re-sending the image on every edit.
 */
router.post(
  '/blog/image',
  requirePermission('settings.edit'),
  upload.single('file'),
  async (req: AdminRequest, res: Response) => {
    try {
      // multer decorates the request; AdminRequest is not aware of it.
      const { file } = req as AdminRequest & { file?: UploadedFile };
      if (!file) return fail(res, 400, 'No file was sent');

      const result = await uploadImage(file.buffer);
      if (result.error) return fail(res, 400, result.error);

      await audit.record(
        req.admin!,
        {
          action: 'settings.update',
          targetType: 'setting',
          targetId: BLOG_SETTING_KEY,
          targetLabel: 'Blog image uploaded',
          after: { url: result.url, bytes: result.bytes },
        },
        req,
      );

      return ok(res, result);
    } catch (error) {
      console.error('[console/blog:image]', error);
      return fail(res, 500, 'Failed to upload the image');
    }
  },
);

/**
 * Ask the landing site to drop its cached blog pages, then rebuild them.
 *
 * Same shape and the same reasoning as the careers version: the expiry is
 * flushed when the revalidate call ends, so the warming fetches have to be
 * separate requests made afterwards or they are served the copy being thrown
 * away. Fire and forget — the site is correct within its own refresh regardless.
 */
async function revalidateLandingBlog(slugs: string[]): Promise<void> {
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
      body: JSON.stringify({ reason: 'blog.content', blogSlugs: slugs }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn('[blog] landing revalidation refused', res.status);
      return;
    }

    const warm = [
      `${base}/blog`,
      ...slugs.slice(0, 25).map((slug) => `${base}/blog/${encodeURIComponent(slug)}`),
    ];
    await Promise.allSettled(
      warm.map((url) => fetch(url, { signal: AbortSignal.timeout(10000) })),
    );
  } catch (error) {
    console.warn('[blog] landing revalidation failed', error);
  }
}

export default router;
