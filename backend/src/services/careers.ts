import { z } from 'zod';

import prisma from '../utils/prisma.js';

/**
 * Careers page content.
 *
 * Stored as one JSON platform setting rather than a table. A startup's open
 * roles are a short list edited by hand a few times a year — a Prisma model and
 * the production migration that comes with it would be a poor trade for that,
 * and the setting store already has console plumbing, auditing and caching.
 *
 * Nothing here computes whether a role is open. That is derived from `closesAt`
 * at render time by whoever is displaying it, so a role closes on its date
 * whether or not anybody has opened the console that week.
 */

export const CAREERS_SETTING_KEY = 'careers.content';

const LOCATIONS = ['Chennai', 'Jaipur', 'Remote (India)', 'Hybrid'] as const;
const TYPES = ['Full-time', 'Part-time', 'Internship', 'Contract'] as const;

/**
 * `applyUrl` is a plain trimmed string rather than z.string().url() so that a
 * mailto: passes as well as a form link. Both are real destinations for an
 * Apply button — some roles are better collected by email than by form — and
 * z.string().url() would reject the mailto.
 *
 * Empty is still allowed at this level because drafts and closed roles do not
 * need one; the superRefine below is what requires it for anything published
 * and open.
 */
const roleSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'id must be lowercase letters, numbers and hyphens'),
  title: z.string().trim().min(2).max(120),
  team: z.string().trim().min(2).max(60),
  location: z.enum(LOCATIONS),
  type: z.enum(TYPES),
  summary: z.string().trim().max(600).default(''),
  responsibilities: z.array(z.string().trim().min(1).max(300)).max(12).default([]),
  applyUrl: z
    .string()
    .trim()
    .max(600)
    .refine((v) => v === '' || /^(https?:\/\/|mailto:)/i.test(v), {
      message: 'applyUrl must be empty, an http(s) link, or a mailto: address'
    })
    .default(''),
  /** ISO date; null means open until closed by hand. */
  closesAt: z.string().datetime().nullable().default(null),
  /** Explicit close from the console; wins over closesAt. */
  status: z.enum(['open', 'closed']).default('open'),
  draft: z.boolean().default(false)
});

const baseCareersSchema = z.object({
  eyebrow: z.string().trim().max(60).default('Careers'),
  headline: z.string().trim().min(2).max(160),
  standfirst: z.string().trim().max(800).default(''),
  pitch: z
    .array(z.object({ title: z.string().trim().max(120), body: z.string().trim().max(600) }))
    .max(6)
    .default([]),
  roles: z.array(roleSchema).max(60).default([]),
  emptyState: z
    .object({ title: z.string().trim().max(160), body: z.string().trim().max(600) })
    .default({ title: 'No open roles right now.', body: '' })
});

/**
 * A published, open role has to have an apply link.
 *
 * The public page shows one Apply button per open role and nothing else — no
 * "coming soon" state, because a card badged OPEN whose button does nothing
 * contradicts itself. That only holds if the link is guaranteed, so it is
 * enforced here rather than left as a convention. Draft and closed roles are
 * exempt: a draft is not on the site, and a closed one shows as expired.
 */
export const careersContentSchema = baseCareersSchema.superRefine((content, ctx) => {
  content.roles.forEach((role, index) => {
    const open = (role.status ?? 'open') === 'open';
    if (!role.draft && open && !role.applyUrl.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['roles', index, 'applyUrl'],
        message: `"${role.title || role.id}" is published and open, so it needs an apply link. Add the form URL, or set the role to draft or closed.`
      });
    }
  });
});

export type CareersContent = z.infer<typeof careersContentSchema>;
export type CareerRole = z.infer<typeof roleSchema>;

/** Duplicate ids would collide as anchors and React keys on the public page. */
export function findDuplicateRoleIds(roles: { id?: string }[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const role of roles) {
    if (!role.id) continue;
    if (seen.has(role.id)) dupes.add(role.id);
    seen.add(role.id);
  }
  return [...dupes];
}

/** Raw stored content, or null when it has never been written. */
export async function readCareersContent(): Promise<CareersContent | null> {
  const row = await prisma.platformSetting.findUnique({
    where: { key: CAREERS_SETTING_KEY },
    select: { value: true }
  });
  if (!row) return null;

  const parsed = careersContentSchema.safeParse(row.value);
  if (!parsed.success) {
    // Stored content that no longer parses is a bug worth seeing, but it must
    // not take the public page down with it.
    console.error('[careers/read] stored content failed validation', parsed.error.flatten());
    return null;
  }
  return parsed.data;
}

/** What the public endpoint may return: drafts stripped, nothing else changed. */
export function publicView(content: CareersContent): CareersContent {
  return { ...content, roles: content.roles.filter((role) => !role.draft) };
}

export async function writeCareersContent(
  content: CareersContent,
  updatedBy: string | null
): Promise<CareersContent> {
  await prisma.platformSetting.upsert({
    where: { key: CAREERS_SETTING_KEY },
    create: {
      key: CAREERS_SETTING_KEY,
      category: 'general',
      label: 'Careers page content',
      description: 'Roles and copy shown on spllit.app/careers. Edited in the console.',
      valueType: 'json',
      value: content,
      updatedBy
    },
    update: { value: content, updatedBy }
  });
  return content;
}
