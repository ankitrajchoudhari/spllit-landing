import type { MetadataRoute } from 'next';

import { SITE } from '@/content/site';

/**
 * Crawl rules.
 *
 * Everything behind a login is disallowed — not because it is secret (the API
 * enforces that), but because a crawler following those links only ever
 * collects redirects to /auth, which wastes crawl budget that should be going
 * to the pages that can actually rank.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/home',
          '/map',
          '/chat',
          '/squads',
          '/rides',
          '/events',
          '/profile',
          '/notifications',
          '/host',
          '/invite',
          '/search',
          '/location',
          '/auth',
          '/api/',
        ],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
