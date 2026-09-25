import { api } from '@/lib/api/client';
import { allPosts as compiledPosts, type BlogPost } from '@/content/blog';

/**
 * Blog & News: posts written in the console, plus the ones compiled in.
 *
 * Two sources on purpose. The guides in content/blog.ts were written to rank
 * for things a student actually types, they go through review with the rest of
 * the code, and deleting them to move house would throw away the SEO they have
 * earned. Anything written in the console is added to them.
 *
 * The console wins a collision. If somebody publishes a post whose link
 * matches a compiled one, the intent is plainly to replace it, and the
 * alternative is an edit that appears to save and changes nothing.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/**
 * Paragraphs from one block of text.
 *
 * The console gives a textarea, so a paragraph break is a blank line. Single
 * newlines are left alone — somebody breaking a line to make it read better in
 * the box did not mean to start a paragraph.
 */
function toParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

/** ~200 words a minute, floored at one. Derived so it cannot drift from the text. */
function readingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

/**
 * Console shape to the shape the pages already render.
 *
 * Mapping here rather than teaching every component a second post type keeps
 * the templates unaware of where a post came from.
 */
function parsePost(value: unknown): BlogPost | null {
  if (!isRecord(value)) return null;

  const slug = asString(value.slug).trim();
  const title = asString(value.title).trim();
  // A post with no link or no headline cannot be rendered or reached. The
  // console will not save one; this is the belt on those braces.
  if (!slug || !title) return null;

  const body = asString(value.body);
  const summary = asString(value.summary).trim();

  return {
    slug,
    title,
    kind: value.kind === 'News' ? 'News' : 'Blog',
    description: summary.slice(0, 160),
    excerpt: summary,
    publishedAt: asString(value.publishedAt) || new Date().toISOString().slice(0, 10),
    readingMinutes: readingMinutes(`${summary} ${body}`),
    tags: [],
    image: asString(value.image).trim() || undefined,
    imageAlt: asString(value.imageAlt).trim() || undefined,
    /**
     * One untitled section holding the whole body.
     *
     * The compiled posts are structured as headed sections because they were
     * written that way. A console post is prose, and inventing headings for it
     * would put words on the page nobody wrote.
     */
    sections: [{ heading: '', paragraphs: toParagraphs(body) }],
  };
}

export const blogService = {
  /**
   * Never throws. The landing site and the backend deploy separately, so an
   * unreachable API means the compiled posts render on their own rather than
   * the page failing.
   */
  async posts(): Promise<BlogPost[]> {
    let fromConsole: BlogPost[] = [];
    try {
      const raw = await api.get<unknown>('/public/blog', { anonymous: true });
      if (isRecord(raw) && Array.isArray(raw.posts)) {
        fromConsole = raw.posts
          .map(parsePost)
          .filter((post): post is BlogPost => post !== null);
      }
    } catch {
      fromConsole = [];
    }

    const consoleSlugs = new Set(fromConsole.map((post) => post.slug));
    return [...fromConsole, ...compiledPosts().filter((post) => !consoleSlugs.has(post.slug))].sort(
      (a, b) => b.publishedAt.localeCompare(a.publishedAt),
    );
  },

  async post(slug: string): Promise<BlogPost | null> {
    const posts = await blogService.posts();
    return posts.find((post) => post.slug === slug) ?? null;
  },
};
