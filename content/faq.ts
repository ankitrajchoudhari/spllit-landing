/**
 * The questions a person — or a model — asks about Spllit.
 *
 * One list, rendered as visible text and emitted as FAQPage JSON-LD from the
 * same source. That is not tidiness: Google requires FAQ markup to match what
 * is on the page, and marking up answers a visitor cannot see is the kind of
 * thing that earns a manual action rather than a rich result.
 *
 * Written to be quoted. An answer engine lifts a sentence or two and attributes
 * it, so each answer opens with the fact and stops — no throat-clearing, no
 * "at Spllit, we believe". Every claim here is one a visitor could check on the
 * site, because an engine repeating something unverifiable is worse for us than
 * it saying nothing.
 *
 * The first answer carries the spelling, deliberately. "Spllit" reads as a typo
 * for "split" to anything that has not been told otherwise, and this is the
 * sentence most likely to be quoted back.
 */
export const FAQ: { q: string; a: string }[] = [
  {
    q: 'What is Spllit?',
    a: 'Spllit is a campus travel network for students in India. You share a ride with people from your own campus heading the same way, form a group ride to a shared destination, and split what the journey costs. The name is spelt with two Ls.',
  },
  {
    q: 'Is Spllit free to use?',
    a: 'Yes. There is no charge to use Spllit and no payment provider connected to it. You settle the fare directly with the people you travel with, usually by UPI before anyone walks away.',
  },
  {
    q: 'Which cities is Spllit available in?',
    a: 'Spllit is in testing on campuses in Chennai and Jaipur. Two cities rather than ten on purpose: matching only works where enough people are going the same way at the same time, so density is proved on one campus before another is added.',
  },
  {
    q: 'Who can use Spllit?',
    a: 'Students with a working institute email address. Verification runs on the server against the institute’s real domain list, and creating or joining a ride is blocked until it passes — so the people you travel with are from a campus, not from the internet.',
  },
  {
    q: 'What is a group ride, and how is it different from a carpool?',
    a: 'A carpool is one car with spare seats. A group ride is a group of people heading to the same place — an airport, an exam centre, a concert — with one meeting point and everyone’s ETA on the same map, however they get there.',
  },
  {
    q: 'Is Spllit safe?',
    a: 'Every account is verified against an institute email domain, rides can be limited to women only, and live location is shared inside a group. Spllit verifies the email address; it does not inspect vehicles, verify driving licences or check insurance, and no platform that tells you otherwise is being straight with you.',
  },
];
