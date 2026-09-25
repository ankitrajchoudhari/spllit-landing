import type { MetadataRoute } from 'next';

import { PUBLIC_ROUTES, SITE } from '@/content/site';
import { allPosts } from '@/content/blog';

/**
 * Generated, not hand-written.
 *
 * The previous public/sitemap.xml was a static file left over from the old
 * marketing site: it advertised /about and /features, neither of which existed,
 * so every crawl hit 404s from a document that is supposed to be the site's own
 * statement of what it has. Generating it means it cannot drift again.
 *
 * Authenticated and dynamic routes are deliberately absent — /squads/[id] is
 * behind a login, so listing it invites crawlers to collect redirects.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    ...PUBLIC_ROUTES.map((route) => ({
      url: `${SITE.url}${route.path}`,
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...allPosts().map((post) => ({
      url: `${SITE.url}/blog/${post.slug}`,
      lastModified: new Date(post.updatedAt ?? post.publishedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
