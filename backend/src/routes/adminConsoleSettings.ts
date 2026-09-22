import { Router, Response } from 'express';

import prisma from '../utils/prisma.js';
import { broadcastEmail } from '../services/broadcastEmail.js';
import { campaignSenderConfigured } from '../services/email.js';
import {
  AUDIENCES,
  MAX_NAMED_RECIPIENTS,
  audienceWhere,
  type Audience,
} from '../services/audience.js';
import { identify } from '../middleware/identity.js';
import {
  AdminRequest,
  requireConsoleAdmin,
  requirePermission,
} from '../middleware/adminConsole.js';
import { ok, fail } from '../utils/respond.js';
import { str } from '../utils/adminQuery.js';
import * as audit from '../services/auditLog.js';
import { notify } from '../services/notifications.js';
import { getBounded, invalidateSettingsCache } from '../services/platformSettings.js';
import { datasetFor, explore, publicSchema } from '../services/explorer.js';
import {
  CAREERS_SETTING_KEY,
  careersContentSchema,
  findDuplicateRoleIds,
  readCareersContent,
  writeCareersContent,
} from '../services/careers.js';

/**
 * Admin console — settings, broadcasts and exports.
 *
 * The three surfaces that change something outside the console itself: a
 * setting every user's app reads, a notification that lands on their phone, and
 * a file of their data leaving the building. Each one is gated, confirmed and
 * audited, and each is deliberately harder to do by accident than the read-only
 * pages are.
 */

const router = Router();

router.use(identify, requireConsoleAdmin);

// ---------------------------------------------------------------------------
// Careers page content
//
// Lives here rather than in its own router because it is a platform setting
// like any other — one JSON blob the public site reads — and it is gated on the
// same settings.view / settings.edit permissions.
// ---------------------------------------------------------------------------

/** GET /careers — current content, including drafts, for the editor. */
router.get(
  '/careers',
  requirePermission('settings.view'),
  async (_req: AdminRequest, res: Response) => {
    try {
      const content = await readCareersContent();
      // Null is a normal first-run answer, not an error; the console opens an
      // empty editor rather than showing a failure the first time it is used.
      return ok(res, { content, published: content !== null });
    } catch (error) {
      console.error('[console/careers:get]', error);
      return fail(res, 500, 'Failed to load careers content');
    }
  }
);

/** PUT /careers — replace the whole document. */
router.put(
  '/careers',
  requirePermission('settings.edit'),
  async (req: AdminRequest, res: Response) => {
    const admin = req.admin!;
    try {
      const parsed = careersContentSchema.safeParse(req.body);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        return fail(
          res,
          400,
          first ? `${first.path.join('.')}: ${first.message}` : 'Invalid careers content'
        );
      }

      const duplicates = findDuplicateRoleIds(parsed.data.roles);
      if (duplicates.length > 0) {
        // Ids are anchors and React keys on the public page, so a duplicate is
        // a broken link rather than a cosmetic problem.
        return fail(res, 400, `Duplicate role ids: ${duplicates.join(', ')}`);
      }

      const before = await readCareersContent();
      const saved = await writeCareersContent(parsed.data, admin.userId);
      invalidateSettingsCache();

      await audit.record(
        admin,
        {
          action: 'settings.update',
          targetType: 'setting',
          targetId: CAREERS_SETTING_KEY,
          targetLabel: 'Careers page content',
          before: before ? { roles: before.roles.length } : null,
          after: {
            roles: saved.roles.length,
            open: saved.roles.filter((r) => !r.draft).length
          }
        },
        req
      );

      return ok(res, { content: saved, published: true });
    } catch (error) {
      console.error('[console/careers:put]', error);
      return fail(res, 500, 'Failed to save careers content');
    }
  }
);

// ---------------------------------------------------------------------------
// Platform settings
// ---------------------------------------------------------------------------

/** GET /settings — everything, grouped by category on the client. */
router.get(
  '/settings',
  requirePermission('settings.view'),
  async (_req: AdminRequest, res: Response) => {
    try {
      const rows = await prisma.platformSetting.findMany({
        orderBy: [{ category: 'asc' }, { key: 'asc' }],
      });
      return ok(res, { rows });
    } catch (error) {
      console.error('[admin-console/settings]', error);
      return fail(res, 500, 'Failed to load settings');
    }
  },
);

/**
 * PATCH /settings/:key — { value, reason }
 *
 * `requiresConfirmation` travels with the setting rather than living in the UI,
 * so a dangerous switch cannot become a one-click toggle by being rendered
 * somewhere new. When it is set, the reason is mandatory here too — not only in
 * the dialog that asks for it.
 */
router.patch(
  '/settings/:key',
  requirePermission('settings.edit'),
  async (req: AdminRequest, res: Response) => {
    try {
      const admin = req.admin!;
      const key = str(req.params.key);
      const reason = str(req.body?.reason);

      const existing = await prisma.platformSetting.findUnique({ where: { key } });
      if (!existing) return fail(res, 404, 'Setting not found');

      if (req.body?.value === undefined) {
        return fail(res, 400, 'A value is required.');
      }

      if (existing.requiresConfirmation && reason.length < 4) {
        return fail(res, 400, 'This setting requires a reason for the audit log.');
      }

      // Validated against the setting's declared type rather than accepted as
      // whatever JSON arrived: a boolean flag silently becoming the string
      // "false" is truthy everywhere it is read.
      const value = req.body.value;
      const actual = Array.isArray(value) ? 'json' : typeof value;
      const expected = existing.valueType;

      const typeOk =
        (expected === 'string' && actual === 'string') ||
        (expected === 'number' && actual === 'number' && Number.isFinite(value)) ||
        (expected === 'boolean' && actual === 'boolean') ||
        expected === 'json';

      if (!typeOk) {
        return fail(res, 400, `This setting expects a ${expected}, but received a ${actual}.`);
      }

      const updated = await audit.recorded(
        admin,
        {
          action: 'setting.change',
          targetType: 'setting',
          targetId: existing.id,
          targetLabel: key,
          ...audit.diff(
            { value: existing.value as unknown },
            { value: value as unknown },
          ),
          reason: reason || null,
        },
        req,
        () =>
          prisma.platformSetting.update({
            where: { key },
            data: { value, updatedBy: admin.userId },
          }),
      );

      // Dropped immediately rather than waiting for the 30s TTL: the admin who
      // just changed a setting is the one most likely to check whether it took.
      invalidateSettingsCache();

      return ok(res, updated);
    } catch (error) {
      console.error('[admin-console/settings/:key]', error);
      return fail(res, 500, 'Failed to update setting');
    }
  },
);

// ---------------------------------------------------------------------------
// Broadcast
// ---------------------------------------------------------------------------

/**
 * Hard ceiling on one broadcast.
 *
 * Not a pagination limit — a safety one. Every recipient is a row written and a
 * push attempted, and a mistyped audience that reached the entire user base
 * cannot be recalled once it is on people's phones.
 */
const BROADCAST_CAP_DEFAULT = 5000;

/**
 * Read from settings, clamped in code.
 *
 * The clamp is what keeps this safe to expose: an admin can tune the ceiling
 * from the console, but a mistyped 5000000 cannot become the number the send
 * loop uses. The bounds live here, where the form cannot reach them.
 */
async function broadcastCap(): Promise<number> {
  return getBounded('notifications.broadcast_cap', BROADCAST_CAP_DEFAULT, 1, 20_000);
}


/**
 * The recipient ids on the request, cleaned.
 *
 * Deduplicated and capped here rather than trusted: the console sends what the
 * operator picked, and a list is the one audience a client can make arbitrarily
 * large by hand.
 */
function namedRecipients(body: unknown): string[] {
  const raw = (body as { userIds?: unknown } | undefined)?.userIds;
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((id) => String(id)).filter(Boolean))].slice(
    0,
    MAX_NAMED_RECIPIENTS,
  );
}

/**
 * POST /broadcast/preview — { audience, college }
 *
 * How many people a send would reach, before it is sent. The console requires
 * this before enabling the send button: "notify everyone" is a decision that
 * should be made against a number, not a guess.
 */
router.post(
  '/broadcast/preview',
  requirePermission('notifications.send'),
  async (req: AdminRequest, res: Response) => {
    try {
      const audience = str(req.body?.audience) as Audience;
      if (!AUDIENCES.includes(audience)) return fail(res, 400, 'Unknown audience.');

      const college = str(req.body?.college);
      if (audience === 'college' && !college) return fail(res, 400, 'A college is required.');

      const namedIds = namedRecipients(req.body);
      if (audience === 'users' && namedIds.length === 0) {
        return fail(res, 400, 'Pick at least one person.');
      }

      const [total, cap] = await Promise.all([
        prisma.user.count({ where: audienceWhere(audience, college, namedIds) }),
        broadcastCap(),
      ]);

      return ok(res, {
        audience,
        total,
        capped: total > cap,
        cap,
        willReach: Math.min(total, cap),
      });
    } catch (error) {
      console.error('[admin-console/broadcast/preview]', error);
      return fail(res, 500, 'Failed to size the audience');
    }
  },
);

/** POST /broadcast — { audience, college, title, body, href, reason } */
router.post(
  '/broadcast',
  requirePermission('notifications.send'),
  async (req: AdminRequest, res: Response) => {
    try {
      const admin = req.admin!;
      const audience = str(req.body?.audience) as Audience;
      const college = str(req.body?.college);
      const title = str(req.body?.title);
      const body = str(req.body?.body);
      const href = str(req.body?.href);
      const reason = str(req.body?.reason);

      if (!AUDIENCES.includes(audience)) return fail(res, 400, 'Unknown audience.');
      if (audience === 'college' && !college) return fail(res, 400, 'A college is required.');

      const namedIds = namedRecipients(req.body);
      if (audience === 'users' && namedIds.length === 0) {
        return fail(res, 400, 'Pick at least one person.');
      }

      if (title.length < 3 || body.length < 3) {
        return fail(res, 400, 'A title and a message are required.');
      }
      if (reason.length < 4) {
        return fail(res, 400, 'A reason is required — this reaches real people and cannot be undone.');
      }

      /**
       * Channels. Push is the default because that is what this screen has
       * always done; email is opt-in per send.
       *
       * Email goes out on the campaign sending domain, not the transactional
       * one — an announcement is the likeliest message to draw a complaint, and
       * that must never be able to stop "your request was accepted" arriving.
       * So it is refused, loudly, when that domain is not configured rather
       * than quietly falling back to the transactional sender.
       */
      const wantsEmail = req.body?.channels?.email === true;
      const wantsPush = req.body?.channels?.push !== false;

      if (!wantsEmail && !wantsPush) {
        return fail(res, 400, 'Choose at least one channel.');
      }
      if (wantsEmail && !campaignSenderConfigured()) {
        return fail(
          res,
          503,
          'Email sending is not configured. CAMPAIGN_EMAIL_FROM must point at a sending domain separate from transactional mail.',
          'campaigns-unconfigured',
        );
      }

      const recipients = await prisma.user.findMany({
        where: audienceWhere(audience, college, namedIds),
        select: { id: true },
        take: await broadcastCap(),
      });

      /**
       * Audited *before* sending, not after.
       *
       * A broadcast cannot be recalled. If the send half fails partway through,
       * the record of who ordered it and why must already exist — an audit row
       * written only on success would be missing for exactly the send that went
       * wrong.
       */
      await audit.record(
        admin,
        {
          action: 'notification.broadcast',
          targetType: 'notification',
          targetLabel: `${audience}${college ? `:${college}` : ''}`,
          after: {
            title,
            body,
            href: href || null,
            recipients: recipients.length,
            channels: [wantsPush ? 'push' : null, wantsEmail ? 'email' : null].filter(Boolean),
          },
          reason,
        },
        req,
      );

      // Chunked, so a large broadcast does not open thousands of concurrent
      // writes. Matches the existing /api/admin-panel/broadcast behaviour.
      const CHUNK = 100;
      let sent = 0;
      let failed = 0;

      if (wantsPush) {
        for (let i = 0; i < recipients.length; i += CHUNK) {
          const results = await Promise.allSettled(
            recipients.slice(i, i + CHUNK).map((user) =>
              notify({
                userId: user.id,
                type: 'event.created',
                title,
                body,
                ...(href ? { href } : {}),
              }),
            ),
          );

          for (const result of results) {
            if (result.status === 'fulfilled') sent += 1;
            else failed += 1;
          }
        }
      }

      /**
       * Email runs after push and reports separately, because the two have
       * genuinely different outcomes: a notification row is written for
       * everybody, while email is refused for anyone unverified, suppressed or
       * opted out. Reporting one number for both would hide that.
       */
      const email = wantsEmail
        ? await broadcastEmail({
            userIds: recipients.map((user) => user.id),
            subject: title,
            body,
          })
        : null;

      return ok(res, {
        sent,
        failed,
        audience,
        total: recipients.length,
        email,
      });
    } catch (error) {
      console.error('[admin-console/broadcast]', error);
      return fail(res, 500, 'Failed to send the broadcast');
    }
  },
);

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/**
 * What each dataset exposes.
 *
 * An explicit column list per dataset, not `SELECT *`. An export is the one
 * place data leaves the platform in bulk, and a field added to a model later
 * must not join the file automatically — `phoneHash`, `password` and
 * `fcmTokens` are precisely the fields a wildcard would have carried.
 */
const EXPORTS = {
  users: {
    permission: 'users.view',
    columns: ['id', 'name', 'username', 'email', 'college', 'onboarded', 'isActive', 'createdAt'],
    fetch: (take: number) =>
      prisma.user.findMany({
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          college: true,
          onboarded: true,
          isActive: true,
          createdAt: true,
        },
      }),
  },
  rides: {
    permission: 'content.view',
    columns: ['id', 'origin', 'destination', 'status', 'vehicleType', 'seats', 'departureTime', 'createdAt'],
    fetch: (take: number) =>
      prisma.ride.findMany({
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          origin: true,
          destination: true,
          status: true,
          vehicleType: true,
          seats: true,
          departureTime: true,
          createdAt: true,
        },
      }),
  },
  events: {
    permission: 'content.view',
    columns: ['id', 'title', 'category', 'college', 'status', 'attendeeCount', 'startsAt', 'createdAt'],
    fetch: (take: number) =>
      prisma.event.findMany({
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          category: true,
          college: true,
          status: true,
          attendeeCount: true,
          startsAt: true,
          createdAt: true,
        },
      }),
  },
  audit: {
    permission: 'audit.view',
    columns: ['id', 'actorEmail', 'actorRole', 'action', 'targetType', 'targetLabel', 'reason', 'success', 'createdAt'],
    fetch: (take: number) =>
      prisma.auditLog.findMany({
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          actorEmail: true,
          actorRole: true,
          action: true,
          targetType: true,
          targetLabel: true,
          reason: true,
          success: true,
          createdAt: true,
        },
      }),
  },
} as const;

type Dataset = keyof typeof EXPORTS;

/**
 * Row cap for a single export.
 *
 * The brief asks for background jobs beyond this, and Spllit has no job queue —
 * so rather than pretend, the export is capped and the response header says it
 * was truncated. A silently short file is the worst of the options.
 */
const EXPORT_CAP_DEFAULT = 10_000;

/** Same reasoning as the broadcast cap: tunable, but bounded in code. */
async function exportCap(): Promise<number> {
  return getBounded('exports.row_cap', EXPORT_CAP_DEFAULT, 100, 50_000);
}

/** RFC 4180: quote everything, double any inner quote. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const text = value instanceof Date ? value.toISOString() : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

/** GET /export/:dataset?format=csv|json */
router.get('/export/:dataset', async (req: AdminRequest, res: Response) => {
  try {
    const admin = req.admin!;
    const dataset = str(req.params.dataset) as Dataset;
    const spec = EXPORTS[dataset];

    if (!spec) return fail(res, 404, 'Unknown dataset.');

    // Two gates: the dataset's own permission, and the general right to export.
    // A Support user may read users in the console without being able to walk
    // out with a file of them.
    if (!admin.permissions.includes(spec.permission as never)) {
      return fail(res, 403, 'Your role cannot read this dataset.', 'permission_denied');
    }
    if (!admin.permissions.includes('exports.run')) {
      return fail(res, 403, 'Your role cannot run exports.', 'permission_denied');
    }

    const cap = await exportCap();
    const rows = (await spec.fetch(cap)) as Record<string, unknown>[];
    const truncated = rows.length === cap;

    await audit.record(
      admin,
      {
        action: 'export.run',
        targetType: 'export',
        targetLabel: dataset,
        after: { rows: rows.length, truncated },
      },
      req,
    );

    const stamp = new Date().toISOString().slice(0, 10);
    // Told, not hidden: a caller has to be able to know the file is partial.
    res.setHeader('X-Export-Truncated', String(truncated));
    res.setHeader('X-Export-Rows', String(rows.length));

    if (str(req.query.format) === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="spllit-${dataset}-${stamp}.json"`);
      return res.send(JSON.stringify({ dataset, rows, truncated }, null, 2));
    }

    const header = spec.columns.join(',');
    const body = rows
      .map((row) => spec.columns.map((column) => csvCell(row[column])).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="spllit-${dataset}-${stamp}.csv"`);
    return res.send(`${header}\n${body}`);
  } catch (error) {
    console.error('[admin-console/export]', error);
    return fail(res, 500, 'Export failed');
  }
});

// ---------------------------------------------------------------------------
// Data explorer
// ---------------------------------------------------------------------------

/**
 * GET /explore/schema
 *
 * The datasets and dimensions this admin may build a query from. Filtered by
 * their permissions, so the builder cannot offer a dataset the query endpoint
 * would then refuse — an option that always errors is worse than no option.
 */
router.get('/explore/schema', async (req: AdminRequest, res: Response) => {
  const admin = req.admin!;
  return ok(res, { datasets: publicSchema(admin.permissions) });
});

/**
 * GET /explore?dataset=&dimension=&days=&compare=
 *
 * The browser sends names and a range, never a query. Everything else is
 * resolved server-side against the whitelist in services/explorer.ts.
 */
router.get('/explore', async (req: AdminRequest, res: Response) => {
  try {
    const admin = req.admin!;
    const dataset = str(req.query.dataset);
    const dimension = str(req.query.dimension);

    const spec = datasetFor(dataset);
    if (!spec) return fail(res, 400, 'Unknown dataset.');

    // Checked here as well as in the schema listing: a client can call this
    // directly with any dataset name, and the listing is only a convenience.
    if (!admin.permissions.includes(spec.permission as never)) {
      return fail(res, 403, 'Your role cannot explore this dataset.', 'permission_denied');
    }

    const result = await explore({
      dataset,
      dimension,
      days: Number(req.query.days) || 30,
      compare: str(req.query.compare) === 'true',
    });

    return ok(res, result);
  } catch (error) {
    // A bad dataset or dimension throws from the service; both are the
    // caller's fault rather than a server fault, so they read as 400.
    const message = error instanceof Error ? error.message : 'Query failed';
    if (message.startsWith('Unknown')) return fail(res, 400, message);

    console.error('[admin-console/explore]', error);
    return fail(res, 500, 'Query failed');
  }
});

export default router;
