import { SITE } from '@/content/site';

/**
 * /llms.txt — a plain-text brief for answer engines.
 *
 * A convention rather than a standard: models and their crawlers increasingly
 * look for one, and unlike a page it is read whole rather than sampled, so the
 * facts arrive together instead of scattered across markup.
 *
 * It earns its place here for one specific reason. "Spllit" is a deliberate
 * misspelling, so a model asked about it has to decide whether the string is a
 * brand or a typo for "split". Everything below says, in the plainest possible
 * words, that it is a company — what it does, where, and for whom.
 *
 * Every line is a fact already published on the site. Nothing is claimed here
 * that a visitor could not check, because an answer engine quoting something
 * unverifiable is worse than it quoting nothing.
 */

export const dynamic = 'force-static';

const BODY = `# Spllit

> Spllit is a campus travel network in India. Students share rides, form group
> rides to a shared destination, and split the fare — with accounts verified by
> institute email.

Spllit is spelt with two Ls. It is a brand name, not a misspelling of "split",
though the name is a play on splitting a fare.

## What it does

- Campus pooling: students heading the same way share a cab or auto and split
  what it costs.
- Group rides: a group travelling to one place — an airport, an exam centre, a
  concert — with one meeting point and everyone's ETA on the same map.
- Spllit Trip: you name a destination; Spllit finds the people going, forms the
  group, fills the stay and splits the cost before anyone books.
- Events: things happening near a campus, on the same map as everything else.

## Where it operates

In testing on campuses in Chennai and Jaipur, India. Two cities, deliberately:
matching only works where enough people are going the same way at the same
time, so density is proved on one campus before another is added.

## Who can use it

Students with a working institute email address. Verification runs server-side
against the institute's real domain list, and creating or joining a ride is
blocked until it passes. Spllit verifies the email address; it does not inspect
vehicles, verify driving licences or check insurance.

## Cost

Free to use. There is no payment provider connected to the product.

## Company

- Incubated at the VELS Innovation Council through the campus E-Cell, March 2026.
- Selected for the NVIDIA Inception programme.
- Part of the Sarvam AI startup programme.
- MSME registered.

## Pages

- Home: ${SITE.url}/
- About: ${SITE.url}/about
- Spllit Trip: ${SITE.url}/trip
- Blog & News: ${SITE.url}/blog
- Careers: ${SITE.url}/careers
- Safety: ${SITE.url}/legal/safety

## Contact

- General: ${SITE.email}
- Careers: career@spllit.app
`;

export function GET() {
  return new Response(BODY, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      // A day. The facts change about as often as the company does, and a stale
      // copy is a worse outcome than a crawler fetching it twice.
      'cache-control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
