import { z } from 'zod';

import prisma from '../utils/prisma.js';

/**
 * The people on spllit.app/about, edited from the admin console.
 *
 * One JSON platform setting, like careers and the blog, for the same reason: a
 * list of a dozen people changed a few times a term does not justify a table
 * and a production migration.
 *
 * Nobody is deleted when they leave. `status: 'exited'` moves them from the
 * team to the alumni row on the site, shown faded, because a former intern who
 * vanishes from the page reads to a reviewer as a person who was never there.
 */

export const TEAM_SETTING_KEY = 'team.content';

export const teamGroupSchema = z.enum(['founder', 'core', 'intern']);
export const teamStatusSchema = z.enum(['active', 'exited']);

/** A public profile link. Empty is allowed and means "none". */
const profileUrl = z
  .string()
  .trim()
  .max(400)
  .refine((value) => value === '' || /^https:\/\//i.test(value), {
    message: 'A profile link must start with https://',
  })
  .default('');

export const teamMemberSchema = z.object({
  /** Stable key for the editor; not shown anywhere. */
  id: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1, 'Every person needs a name').max(80),
  /** Their title, as it should read: "Founder", "Engineering", "Design intern". */
  role: z.string().trim().min(1, 'Every person needs a role').max(60),
  group: teamGroupSchema,
  status: teamStatusSchema.default('active'),
  /** A line or two. Plain text; rendered as text, never as markup. */
  bio: z.string().trim().max(280).default(''),
  /**
   * Absolute URL from the media bucket, or a path served by the site itself
   * (the founder's photo predates the console and lives in its /public).
   */
  photo: z
    .string()
    .trim()
    .max(600)
    .refine((value) => value === '' || /^https:\/\//i.test(value) || /^\/[\w./-]+$/.test(value), {
      message: 'A photo must be an https:// link or a /path on the site',
    })
    .default(''),
  links: z
    .object({
      linkedin: profileUrl,
      instagram: profileUrl,
      x: profileUrl,
      github: profileUrl,
      website: profileUrl,
    })
    .default({ linkedin: '', instagram: '', x: '', github: '', website: '' }),
  /** In the console but not on the site. */
  hidden: z.boolean().default(false),
});

export const teamContentSchema = z.object({
  members: z.array(teamMemberSchema).max(60),
});

export type TeamMemberInput = z.infer<typeof teamMemberSchema>;
export type TeamContent = z.infer<typeof teamContentSchema>;

export async function readTeamContent(): Promise<TeamContent | null> {
  const row = await prisma.platformSetting.findUnique({ where: { key: TEAM_SETTING_KEY } });
  if (!row) return null;
  const parsed = teamContentSchema.safeParse(row.value);
  // A stored value that no longer matches is treated as absent: the site falls
  // back to its built-in list rather than rendering nothing.
  return parsed.success ? parsed.data : null;
}

/** Hidden people never leave the console. */
export function teamPublicView(content: TeamContent): TeamContent {
  return { members: content.members.filter((member) => !member.hidden) };
}

export async function writeTeamContent(content: TeamContent, updatedBy: string): Promise<TeamContent> {
  await prisma.platformSetting.upsert({
    where: { key: TEAM_SETTING_KEY },
    create: {
      key: TEAM_SETTING_KEY,
      category: 'general',
      label: 'Team',
      description: 'People shown on spllit.app/about. Edited in the console.',
      valueType: 'json',
      value: content,
      updatedBy,
    },
    update: { value: content, updatedBy },
  });
  return content;
}
