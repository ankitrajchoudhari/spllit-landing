import { SITE, SOCIALS } from '@/content/site';

/**
 * JSON-LD graph.
 *
 * This is the highest-leverage thing a small site can do for a brand-name
 * search. Typing "spllit" is an *entity* query, and Google answers those from
 * the knowledge graph rather than from page text — so the job is to state,
 * machine-readably, that this domain, this name and these social profiles are
 * one organisation. That is what `sameAs` is for.
 *
 * It also feeds AI answer engines: ChatGPT, Perplexity and Google's AI
 * Overviews read JSON-LD to decide what a site *is* before they summarise it.
 * A site with no structured data gets described from whatever prose the crawler
 * happened to scrape.
 *
 * Rendered as a script tag rather than through next/script: this must be in the
 * initial HTML, because crawlers that do not execute JavaScript are exactly the
 * ones it exists for.
 */
export function StructuredData() {
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE.url}/#organization`,
        name: SITE.name,
        alternateName: ['Spllit App', 'Spllit India'],
        url: SITE.url,
        logo: {
          '@type': 'ImageObject',
          url: `${SITE.url}/logo-full.png`,
        },
        email: SITE.email,
        foundingDate: SITE.founded,
        areaServed: { '@type': 'Country', name: 'India' },
        // The entity-linking signal. Each profile confirms the same brand.
        sameAs: SOCIALS.map((social) => social.href),
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          email: SITE.email,
          availableLanguage: ['English', 'Hindi', 'Tamil'],
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE.url}/#website`,
        url: SITE.url,
        name: SITE.name,
        description: SITE.description,
        publisher: { '@id': `${SITE.url}/#organization` },
        inLanguage: 'en-IN',
      },
      {
        /**
         * Describes the product itself. `SoftwareApplication` is what makes a
         * result eligible for the app-style rich card, and it is the type an
         * answer engine looks for when asked "what is Spllit".
         */
        '@type': 'SoftwareApplication',
        '@id': `${SITE.url}/#app`,
        name: SITE.name,
        applicationCategory: 'TravelApplication',
        operatingSystem: 'Web',
        url: SITE.url,
        description: SITE.description,
        publisher: { '@id': `${SITE.url}/#organization` },
        // Free is a fact, not a claim — there is no payment provider connected.
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'INR',
        },
        featureList: [
          'Share rides with verified students from your campus',
          'Form travel group rides with a shared meeting point',
          'Split cab and auto fares',
          'Live location and ETA for everyone in the group',
          'Find events near your college',
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // The content is built from constants above, not from user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}

/**
 * Per-article JSON-LD. Blog posts that carry this are eligible for article rich
 * results and are far more likely to be quoted by an answer engine, because the
 * headline, date and publisher are stated rather than inferred.
 */
export function ArticleStructuredData({
  title,
  description,
  slug,
  publishedAt,
  updatedAt,
}: {
  title: string;
  description: string;
  slug: string;
  publishedAt: string;
  updatedAt?: string;
}) {
  const graph = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    url: `${SITE.url}/blog/${slug}`,
    datePublished: publishedAt,
    dateModified: updatedAt ?? publishedAt,
    author: { '@type': 'Organization', name: SITE.name, url: SITE.url },
    publisher: { '@id': `${SITE.url}/#organization` },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE.url}/blog/${slug}` },
    inLanguage: 'en-IN',
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
