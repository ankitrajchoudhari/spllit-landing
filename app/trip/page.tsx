import type { Metadata } from 'next';
import { Caveat, IBM_Plex_Mono, Instrument_Serif } from 'next/font/google';

import { LandingNav } from '@/components/landing/landing-nav';
import { ParallaxFooter } from '@/components/landing/parallax-footer';
import {
  TripCities,
  TripClose,
  TripEmptySeats,
  TripExplore,
  TripFamily,
  TripHero,
  TripHowItWorks,
  TripOneScreen,
  TripOperators,
  TripPlaces,
  TripSentence,
  TripStays,
} from '@/components/spllit-trip/sections';
import { SITE } from '@/content/site';

/**
 * The serif is this page's alone — postcards and travel posters, not the app.
 * Loaded here rather than in the root layout so no other page pays for it.
 */
const serif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});

/** Handwriting for the scrapbook captions under the city photos. */
const hand = Caveat({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-hand',
  display: 'swap',
});

/** Ticket print: fares, codes, dates. */
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Spllit Trip — You pick the place, we find the people',
  description:
    'Say where you want to go. Spllit Trip finds the people going, forms the group, fills the villa and splits the cost — before anyone books.',
  alternates: { canonical: '/trip' },
  openGraph: {
    title: `Spllit Trip · ${SITE.name}`,
    description:
      'Turn “someday, Goa” into a real group, a real plan and a fair split — before anyone books a thing.',
    url: `${SITE.url}/trip`,
  },
};

/**
 * Spllit Trip — marketing page for the travel vertical.
 *
 * Public and static. The product is in early access, so the page makes the
 * case and collects sign-ups; nothing on it reads live data.
 */
export default function TripPage() {
  return (
    <div
      className={`${serif.variable} ${mono.variable} ${hand.variable} trip-paper min-h-dvh overflow-x-clip`}
    >
      <div className="mx-auto w-full max-w-[1360px]">
        <LandingNav />
      </div>

      <main>
        <TripHero />
        <TripPlaces />
        <TripCities />
        <TripHowItWorks />
        <TripOneScreen />
        <TripEmptySeats />
        <TripStays />
        <TripExplore />
        <TripSentence />
        <TripOperators />
        <TripFamily />
        <TripClose />
      </main>

      <ParallaxFooter />
    </div>
  );
}
