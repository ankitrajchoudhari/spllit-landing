import type { Metadata, Viewport } from 'next';
import { Inter, Poppins } from 'next/font/google';

import './globals.css';
import { Providers } from '@/app/providers';
import { StructuredData } from '@/components/shared/structured-data';
import { SITE } from '@/content/site';
import { CookieConsent } from '@/components/shared/cookie-consent';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    /**
     * The brand name leads. For an entity query like "spllit" Google weighs the
     * title heavily, and a title that opens with a tagline buries the one word
     * anybody is actually typing.
     */
    default: `${SITE.name} — Campus Ride Sharing & Travel Group Rides for Students`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  /**
   * Not a ranking factor since 2009, and Google ignores it. Kept short and
   * honest because Bing and several AI crawlers still read it.
   */
  keywords: [
    'Spllit',
    'campus ride sharing',
    'student carpool India',
    'travel group ride',
    'split cab fare',
    'college rideshare',
    'IIT Madras rides',
  ],
  authors: [{ name: SITE.name, url: SITE.url }],
  creator: SITE.name,
  publisher: SITE.name,
  manifest: '/manifest.json',
  /**
   * A square mark, not the wordmark.
   *
   * Both logo files are 666x375 landscape lockups. Google requires a square
   * favicon and drops one that is not, which is why results were showing a
   * globe — and at 16px a wordmark reading "Spllit — Connect. Spllit. Save."
   * is illegible anyway. icon-512.png is the S lifted out of that artwork,
   * centred on its own background colour; the source files are untouched.
   */
  icons: {
    icon: [{ url: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
    apple: [{ url: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
  },
  // Self-referencing canonical: stops ?ref= invite links being indexed as
  // separate pages competing with the real one.
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    locale: SITE.locale,
    url: SITE.url,
    title: `${SITE.name} — Campus Ride Sharing & Travel Group Rides`,
    description: SITE.description,
    /**
     * The real dimensions. This claimed 1200x630 and the file is 666x375, so
     * every scraper was told a size it then did not get — which is how a card
     * ends up letterboxed or rejected. Below the 1200x630 most platforms want,
     * but stating it honestly beats a number that is simply false.
     */
    images: [
      { url: '/logo-full.png', width: 666, height: 375, alt: `${SITE.name} — ${SITE.tagline}` },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE.name} — Campus Ride Sharing & Travel Group Rides`,
    description: SITE.description,
    images: ['/logo-full.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // Lets Google show full-length snippets and large image previews, which
      // is what makes a result look like a real brand rather than a stub.
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
  category: 'travel',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#121212' },
  ],
  width: 'device-width',
  initialScale: 1,
  // The map and bottom sheets need the full viewport on mobile browsers.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased">
        {/* In the initial HTML on purpose — the crawlers this exists for do
            not execute JavaScript. */}
        <StructuredData />
        <Providers>
          {children}
          {/* Root-level: the banner must also appear on the public pages, which
              are outside the authenticated shell. */}
          <CookieConsent />
        </Providers>
      </body>
    </html>
  );
}
