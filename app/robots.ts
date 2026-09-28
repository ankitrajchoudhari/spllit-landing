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
/**
 * Pages behind a login, kept out of every crawler rather than just Google.
 *
 * One list so an answer engine cannot be pointed at something a search
 * engine is not — the reason to name the AI crawlers at all is to be
 * explicit about what they may read, which is worth nothing if the
 * boundaries differ.
 */
const PRIVATE = [
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
];

/**
 * The crawlers behind answer engines.
 *
 * All of these are already covered by the wildcard rule, so naming them
 * changes no behaviour. It states the position: this site wants to be read
 * and quoted by them, which is the whole point of publishing /llms.txt. An
 * operator checking whether we object finds an answer rather than an
 * absence, and absence is what several of them treat as a soft no.
 */
const ANSWER_ENGINES = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'PerplexityBot',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
];
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: PRIVATE,
      },
      ...ANSWER_ENGINES.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: PRIVATE,
      })),
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
