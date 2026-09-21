/**
 * Blog posts.
 *
 * Held in TypeScript rather than a CMS: there is no editorial workflow and no
 * second author, so a database would add an outage mode for content that
 * changes a few times a term. These render as static HTML, which is also what
 * makes them indexable without JavaScript.
 *
 * Each post targets a real query a student would type — "how to split cab fare
 * from IIT Madras", not "5 tips for travel". Generic listicles do not rank for
 * anything and do not help anyone.
 */

export interface BlogPost {
  slug: string;
  title: string;
  /** Meta description. Under 160 characters. */
  description: string;
  publishedAt: string;
  updatedAt?: string;
  /** Minutes, honestly estimated from length. */
  readingMinutes: number;
  tags: string[];
  /** Lead paragraph, shown on the index and used as the article summary. */
  excerpt: string;
  /** A section may be prose, a list, or both — a "when to use which" section is
   *  clearer as bullets alone than as a paragraph restating them. */
  sections: { heading: string; paragraphs?: string[]; bullets?: string[] }[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'how-to-split-cab-fare-with-classmates',
    title: 'How to split a cab fare with classmates without the group-chat argument',
    description:
      'A practical way to share cab costs between students — how to divide by distance, handle a late drop-off, and settle up without chasing anyone.',
    publishedAt: '2026-08-08',
    readingMinutes: 5,
    tags: ['fare splitting', 'cabs', 'campus life'],
    excerpt:
      'Four people share a cab, one gets down halfway, and the group chat spends the next two days arguing about ₹80. Here is a method that settles it before the ride starts.',
    sections: [
      {
        heading: 'Agree the split before you book, not after',
        paragraphs: [
          'Almost every fare argument happens because the split was never agreed. Someone assumes equal shares, someone else assumes distance-based, and both are reasonable — which is exactly why it has to be said out loud before the cab moves.',
          'Say it in one line in the group: "equal split" or "by distance". That single sentence prevents the entire argument.',
        ],
      },
      {
        heading: 'Equal split: when it is fair',
        paragraphs: [
          'Equal works when everyone travels roughly the same distance — a hostel-to-airport run where all four get down at the same terminal. It is the simplest to calculate and the easiest to settle.',
        ],
        bullets: [
          'Everyone boards and alights at the same points',
          'The detour for any one person is under about 10% of the trip',
          'Nobody is being dropped significantly earlier than the rest',
        ],
      },
      {
        heading: 'Distance split: when equal stops being fair',
        paragraphs: [
          'If one person gets down at Guindy and the rest continue to the airport, an equal split quietly overcharges the first person. The fix is to divide by the distance each person was actually in the car.',
          'The arithmetic is easier than it sounds. Take the total fare, divide by the total passenger-kilometres, and multiply by each person\'s kilometres. For a ₹600 fare where three people ride 20 km and one rides 8 km, the total is 68 passenger-km, so the short rider pays about ₹71 and the others about ₹176 each.',
        ],
      },
      {
        heading: 'Settle immediately, in one payment',
        paragraphs: [
          'The single biggest cause of unpaid shares is delay. One person pays the driver, everyone sends their share by UPI before they walk away, and the whole thing is closed. A share that survives until the next day usually survives until the next month.',
        ],
      },
      {
        heading: 'How Spllit handles it',
        paragraphs: [
          'On Spllit, the host sets a per-person share when posting the ride, so the number is visible before anyone joins. There is nothing to negotiate afterwards, because the price was part of the offer — the same way a bus fare is not renegotiated at the destination.',
        ],
      },
    ],
  },
  {
    slug: 'safe-campus-carpooling-checklist',
    title: 'A safety checklist for carpooling with students you have not met',
    description:
      'What to check before getting into a stranger\'s car on campus: verification, meeting points, sharing your trip, and when to walk away.',
    publishedAt: '2026-08-08',
    readingMinutes: 6,
    tags: ['safety', 'carpooling', 'students'],
    excerpt:
      'Sharing a ride with someone from your college is not the same as sharing one with a stranger from the internet — but it is not the same as travelling with a friend either. Here is the middle ground.',
    sections: [
      {
        heading: 'Check the account is actually from your campus',
        paragraphs: [
          'The single most useful signal is a verified institute email. Anyone can type a college name into a profile; proving control of an address on that college\'s domain is a different matter. On Spllit that check runs server-side against the institute\'s real domain list, and creating or joining a ride is blocked until it passes.',
        ],
      },
      {
        heading: 'Meet in a public, mapped place',
        paragraphs: [
          'Agree a meeting point that is lit, busy and easy to describe — a main gate, a metro entrance, a specific café. "Near the parking lot" is not a meeting point. A named place also means the group can see each other approaching rather than circling.',
        ],
        bullets: [
          'Pick somewhere you would be comfortable waiting alone for ten minutes',
          'Avoid basements and back entrances, however convenient',
          'If the meeting point changes at short notice, treat that as a reason to pause',
        ],
      },
      {
        heading: 'Tell one person outside the trip',
        paragraphs: [
          'Share the destination and expected arrival with somebody not travelling with you. This costs nothing and changes the situation entirely if anything goes wrong. Live location sharing inside a group ride does the same job for the group, but somebody outside the group should also know.',
        ],
      },
      {
        heading: 'You are allowed to leave',
        paragraphs: [
          'If the vehicle is not what was described, if there are more people than agreed, or if something simply feels wrong, you do not owe anyone the journey. The cost of an awkward cancellation is far lower than the alternative, and no reasonable host will hold it against you.',
        ],
      },
      {
        heading: 'What Spllit does and does not check',
        paragraphs: [
          'We verify that an account holds a working institute email address. We do not inspect vehicles, verify driving licences, or check insurance — and no platform that tells you otherwise is being straight with you. Treat every arrangement with the caution you would apply to travelling with someone you met through a college noticeboard.',
        ],
      },
    ],
  },
  {
    slug: 'what-is-a-travel-squad',
    title: 'What is a travel group ride, and when is it better than a carpool?',
    description:
      'Group Rides coordinate a group heading to the same place — exam centre, airport, concert — with one meeting point and everyone\'s ETA on one map.',
    publishedAt: '2026-08-08',
    readingMinutes: 4,
    tags: ['group rides', 'group travel', 'how it works'],
    excerpt:
      'A carpool is one car with spare seats. A group ride is a group of people going to the same place who have not worked out the transport yet. The difference matters more than it sounds.',
    sections: [
      {
        heading: 'A carpool starts with a car. A group ride starts with a destination.',
        paragraphs: [
          'If someone is already driving to the airport with three empty seats, that is a carpool: the vehicle exists, and the question is who fills it. If eleven people from the same batch have an exam at the same centre on Tuesday, there is no vehicle yet — and finding each other is the harder problem.',
          'Group Rides solve the second case. You name the destination, drop a meeting point, and people heading the same way ask to join.',
        ],
      },
      {
        heading: 'The meeting point is the whole feature',
        paragraphs: [
          'Groups do not fail because people cannot find a cab. They fail because eleven people are standing in four different places, each certain they are at "the main gate". A group ride has exactly one meeting point, pinned on a map, with each member\'s walking ETA visible to everyone.',
        ],
      },
      {
        heading: 'When to use which',
        bullets: [
          'Someone is already driving and has seats — post a ride',
          'A group needs to get somewhere and nobody has transport yet — start a group ride',
          'You are going alone and want to split a fare — search rides going your way',
        ],
      },
      {
        heading: 'Typical group rides',
        paragraphs: [
          'The most common ones are the least glamorous: exam centres, airport runs at 4am, and getting back from a concert when surge pricing has tripled. These are exactly the trips where travelling alone is most expensive and least safe.',
        ],
      },
    ],
  },
];

export function findPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}
