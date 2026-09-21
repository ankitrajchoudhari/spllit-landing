/**
 * Canonical facts about the site, in one place.
 *
 * Metadata, the sitemap, robots and the JSON-LD graph all read from here — they
 * have to agree, and three hand-maintained copies of a URL is how a sitemap
 * ends up advertising pages that no longer exist.
 */

export const SITE = {
  name: 'Spllit',
  /** No trailing slash — every URL below concatenates onto it. */
  url: 'https://spllit.app',
  tagline: 'Move together. Live together.',
  /**
   * Under 160 characters so Google shows it whole, and it leads with the words
   * someone would actually search: campus, rides, students.
   */
  description:
    'Spllit is the campus travel network for Indian students. Share rides, form group rides to travel together, split the fare, and find events near your college.',
  email: 'spllittech@gmail.com',
  locale: 'en_IN',
  /** Founding institute — used in the Organization graph. */
  founded: '2025',
} as const;

/**
 * Profiles Google uses to tie the query "spllit" to this organisation.
 *
 * These go in the JSON-LD `sameAs` array, which is the single most useful thing
 * a small site can do for brand-name search: it tells the knowledge graph that
 * this domain and these profiles are one entity.
 */
export const SOCIALS = [
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/spllit_official/',
    handle: '@spllit_official',
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/company/spllit/',
    handle: 'Spllit',
  },
] as const;

/** Every static, indexable route. Dynamic and authenticated routes are excluded. */
export const PUBLIC_ROUTES: { path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly' }[] = [
  { path: '/', priority: 1.0, changeFrequency: 'daily' },
  { path: '/about', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/blog', priority: 0.8, changeFrequency: 'weekly' },
  /**
   * Safety is higher priority than the rest of the legal set on purpose: it is
   * the one people search for and read by choice ("is <platform> safe"), not
   * because a form made them tick a box.
   */
  { path: '/legal/safety', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/legal', priority: 0.4, changeFrequency: 'yearly' },
  { path: '/legal/terms', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/legal/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/legal/refunds', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/legal/cookies', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/legal/intellectual-property', priority: 0.2, changeFrequency: 'yearly' },
];
