import { z } from 'zod';

import prisma from '../utils/prisma.js';

/**
 * Blog & News posts written from the admin console.
 *
 * Stored as one JSON platform setting, the same way careers content is, and
 * for the same reason: a handful of posts edited a few times a term does not
 * justify a table and a production migration. The console owns this list; the
 * posts compiled into the landing site stay where they are and are merged in
 * at render time, so nothing published before this existed disappears.
 *
 * Bodies are plain paragraphs rather than HTML or markdown. Accepting markup
 * from a form and putting it on a public page is an XSS surface bought to save
 * an author pressing Enter twice, and neither a parser nor a sanitiser is worth
 * owning for that.
 */

export const BLOG_SETTING_KEY = 'blog.content';

/** A guide that should hold up next term, or something that happened on a date. */
export const postKindSchema = z.enum(['Blog', 'News']);

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const blogPostSchema = z.object({
  /**
   * The public URL segment. Validated rather than trusted: it is interpolated
   * into a path, and a slug with a slash in it would quietly point somewhere
   * else entirely.
   */
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(slugPattern, 'Use lowercase letters, numbers and hyphens only'),
  title: z.string().trim().min(1, 'Every post needs a headline').max(200),
  kind: postKindSchema,
  /** One or two sentences. Shown on the card and under the headline. */
  summary: z.string().trim().min(1, 'Every post needs a summary').max(400),
  /** The post itself. One string; blank lines separate paragraphs. */
  body: z.string().trim().max(40_000),
  /**
   * Absolute URL. Uploaded images land in the media bucket, but a link to
   * anywhere is allowed — an image hosted elsewhere is not our problem to
   * solve, and refusing it would only make somebody paste it into the body.
   */
  image: z
    .string()
    .trim()
    .max(600)
    .refine((value) => value === '' || /^https?:\/\//i.test(value), {
      message: 'An image link must start with http:// or https://',
    })
    .default(''),
  imageAlt: z.string().trim().max(300).default(''),
  /** ISO date. Drives ordering and the dateline. */
  publishedAt: z.string().trim().min(1),
  /** Written but not on the site. The console shows it; visitors do not. */
  draft: z.boolean().default(false),
});

export const blogContentSchema = z.object({
  posts: z.array(blogPostSchema).max(200),
});

export type BlogPostInput = z.infer<typeof blogPostSchema>;
export type BlogContent = z.infer<typeof blogContentSchema>;

/** Two posts cannot share a slug: it is the URL, so one would shadow the other. */
export function findDuplicateSlugs(posts: { slug?: string }[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const post of posts) {
    const slug = (post.slug ?? '').trim();
    if (!slug) continue;
    if (seen.has(slug)) duplicates.add(slug);
    seen.add(slug);
  }
  return [...duplicates];
}

export async function readBlogContent(): Promise<BlogContent | null> {
  const row = await prisma.platformSetting.findUnique({
    where: { key: BLOG_SETTING_KEY },
  });
  if (!row) return null;

  const parsed = blogContentSchema.safeParse(row.value);
  // A setting that no longer matches the schema is treated as absent rather
  // than thrown: the public page has to render either way.
  return parsed.success ? parsed.data : null;
}

/** Drafts never leave the console. */
export function publicView(content: BlogContent | null): BlogContent {
  if (!content) return { posts: [] };
  return { posts: content.posts.filter((post) => !post.draft) };
}

export async function writeBlogContent(
  content: BlogContent,
  updatedBy: string,
): Promise<BlogContent> {
  await prisma.platformSetting.upsert({
    where: { key: BLOG_SETTING_KEY },
    create: {
      key: BLOG_SETTING_KEY,
      category: 'general',
      label: 'Blog & News posts',
      description: 'Posts shown on spllit.app/blog. Edited in the console.',
      valueType: 'json',
      value: content,
      updatedBy,
    },
    update: { value: content, updatedBy },
  });
  return content;
}
