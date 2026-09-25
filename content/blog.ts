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

/**
 * A guide, or something that happened.
 *
 * Both live in one list because they share a URL space, a layout and a feed.
 * They are labelled differently because they are different promises: a guide
 * is meant to still be true next term, an announcement is dated the moment it
 * is published.
 */
export type PostKind = 'Blog' | 'News';

export interface BlogPost {
  slug: string;
  title: string;
  /** Defaults to Blog when absent, which is what the original posts are. */
  kind?: PostKind;
  /** Cover art from public/blog. Without one the card falls back to type. */
  image?: string;
  /** Describes the picture. Never repeats the title. */
  imageAlt?: string;
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
    image: '/blog/desk.png',
    imageAlt: 'A collage of hands typing, holding a clipboard and a folder',
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
    image: '/blog/binoculars.png',
    imageAlt: 'Hands holding binoculars against a yellow circle',
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
    image: '/blog/carpool.jpg',
    imageAlt: 'An illustration of two people sharing a car, seen through the windscreen',
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

/**
 * Announcements.
 *
 * ⚠️ Written here rather than by a founder. Every claim is already public on
 * spllit.app — the cities, the backers, the careers page — but the voice is not
 * yours. Read them before pointing anyone at /blog and rewrite whatever does
 * not sound like Spllit. Deleting an entry is enough to remove it.
 *
 * They sit in the same array as the guides so one list drives the index, the
 * sitemap and the "keep reading" rail.
 */
export const NEWS_POSTS: BlogPost[] = [
  {
    slug: 'selected-for-nvidia-inception',
    kind: 'News',
    image: '/backers/nvidia-inception.png',
    imageAlt: 'The NVIDIA Inception programme badge',
    title: 'Spllit has been selected for NVIDIA Inception',
    description:
      'Spllit is part of the NVIDIA Inception programme — a programme for early companies building on GPU compute. What it gives us, and what it does not.',
    publishedAt: '2026-06-12',
    readingMinutes: 2,
    tags: ['nvidia inception', 'programmes', 'company'],
    excerpt:
      'A programme for early companies building on GPU compute. Useful to be straight about what that means for a ride-splitting app, because it is not a badge that makes matching work.',
    sections: [
      {
        heading: 'What Inception actually is',
        paragraphs: [
          'NVIDIA Inception is a programme for early-stage companies doing work that needs GPU compute. It is not an investment and it is not an endorsement of the product — it is access: to compute, to technical people, and to the tooling that makes model work affordable at our size.',
        ],
      },
      {
        heading: 'Why a ride-splitting app needs any of that',
        paragraphs: [
          'The matching problem underneath Spllit is not a database query. Deciding that two people heading roughly the same way at roughly the same time should share a cab — and that a third should not, because the detour would cost them more than the split saves — is the part that gets harder as more people use it.',
          'Compute is what makes that tractable to work on rather than something to approximate and hope about.',
        ],
      },
      {
        heading: 'What it does not mean',
        paragraphs: [
          'It does not mean Spllit is an AI company, and it does not make the product good. A student in Chennai does not care what our matching runs on. They care whether somebody was actually going their way.',
        ],
      },
    ],
  },
  {
    slug: 'selected-for-sarvam-startup-programme',
    kind: 'News',
    image: '/backers/sarvam-logomark-dark.svg',
    imageAlt: 'The Sarvam wordmark',
    title: 'Spllit has joined the Sarvam AI startup programme',
    description:
      'Spllit is part of the Sarvam AI startup programme, working with them on the language side — which for a product used across Indian campuses is not a detail.',
    publishedAt: '2026-07-08',
    readingMinutes: 2,
    tags: ['sarvam', 'programmes', 'company'],
    excerpt:
      'Working with Sarvam on the language side. For a product used across Indian campuses, understanding how people actually write is not a nice-to-have.',
    sections: [
      {
        heading: 'Why language, specifically',
        paragraphs: [
          'People do not post a ride in clean English. They write ‘anyone going airport fri eve, can split’, and they write it in Hinglish, in Tamil, in Tanglish, and in whatever shorthand their hostel group uses.',
          'A product that only understands one of those is a product that works for some of a campus. Sarvam builds models for Indian languages, which is exactly the problem we have.',
        ],
      },
      {
        heading: 'What we are working on',
        bullets: [
          'Reading a free-text ride post and working out where, when and how many',
          'Handling the mix of languages a single sentence is often written in',
          'Not making somebody fill in six fields to say something they typed in eight words',
        ],
      },
      {
        heading: 'The honest version',
        paragraphs: [
          'This is early. The thing that matters is whether somebody can type how they normally type and still get matched, and we are not finished. Being in the programme is the start of that work rather than proof of it.',
        ],
      },
    ],
  },
  {
    slug: 'incubated-at-vels-nvidia-inception-sarvam',
    kind: 'News',
    image: '/backers/vels-innovation-council.png',
    imageAlt: 'The VELS Innovation Council crest',
    title: 'Spllit is incubated at the VELS Innovation Council',
    description:
      'Spllit was incubated at the VELS Innovation Council through the campus E-Cell in March 2026 — the campus the product was first tested on, and where the first things to break broke.',
    publishedAt: '2026-03-20',
    readingMinutes: 2,
    tags: ['incubation', 'programmes', 'company'],
    excerpt:
      'Where Spllit started: an incubator, a campus full of students to be wrong in front of, and the first version of a product nobody had used yet.',
    sections: [
      {
        heading: 'Incubated at VELS, March 2026',
        paragraphs: [
          'Spllit was taken into the VELS Innovation Council through the campus E-Cell in March 2026. That is where the company started and where a lot of the early testing still happens — the first students to use Spllit were on that campus, and the first things that broke broke there.',
          'An incubator is not funding and it is not validation. What it buys is room: a place to build, people to ask, and students within walking distance who will tell you when the product is annoying.',
        ],
      },
      {
        heading: 'NVIDIA Inception and Sarvam, after that',
        paragraphs: [
          'Since the incubation, Spllit has been selected for the NVIDIA Inception programme and the Sarvam AI startup programme. Both came after the product was already running on campus, which is the order we would have chosen.',
        ],
        bullets: [
          'VELS Innovation Council — the incubator, and the campus the product was first tested on',
          'E-Cell — the entrepreneurship cell that took Spllit into the council',
          'NVIDIA Inception — a programme for early companies building on GPU compute',
          'Sarvam AI startup programme — partners on the language and model side',
          'MSME — the government scheme Spllit is registered under',
        ],
      },
      {
        heading: 'What this does and does not mean',
        paragraphs: [
          'None of this makes a product good, and a logo on a landing page is not evidence that anything works. What it means is that Spllit has compute to build on, people to ask, and a campus to be wrong in front of.',
          'Whether the thing being built is any good is still decided by whether two students heading to the same airport actually end up in the same cab.',
        ],
      },
    ],
  },
  {
    slug: 'careers-page-is-open',
    kind: 'News',
    image: '/blog/press.png',
    imageAlt: 'Press conference microphones against a red circle',
    title: 'We are hiring, and an application now answers back',
    description:
      'Spllit has a careers page. Roles open and close from the admin console, applying happens on Spllit, and submitting sends a confirmation from career@spllit.app.',
    publishedAt: '2026-09-22',
    readingMinutes: 2,
    tags: ['hiring', 'product'],
    excerpt:
      'There is a careers page at spllit.app/careers, and applying to a role now sends you a confirmation instead of leaving you wondering whether the form went anywhere.',
    sections: [
      {
        heading: 'What is open is what is actually open',
        paragraphs: [
          'Roles are opened and closed from our admin console, so the board is never a list somebody forgot to take down. A closed role stays listed and marked closed rather than disappearing, because a listing that vanishes reads to an applicant as though their application went with it.',
        ],
      },
      {
        heading: 'Applying happens on Spllit',
        paragraphs: [
          'Pressing Apply opens the form on spllit.app under the title of the role, rather than throwing you into an unbranded tab with no way back. Submitting it sends a confirmation from career@spllit.app within a minute or so.',
          'That sounds minor. It is the difference between an application and a form you are not sure arrived.',
        ],
      },
      {
        heading: 'If nothing is open',
        paragraphs: [
          'Then nothing is open. We hire in bursts and it is usually decided quickly. There is an address on the page for telling us what you would want to work on.',
        ],
      },
    ],
  },
  {
    slug: 'two-cities-in-testing',
    kind: 'News',
    image: '/blog/testing.png',
    imageAlt: 'The word Testing written in chalk on a blackboard',
    title: 'Spllit is in testing in Chennai and Jaipur',
    description:
      'Why Spllit is live on campuses in two cities rather than ten, and what has to be true before a third one is worth adding.',
    publishedAt: '2026-09-18',
    readingMinutes: 3,
    tags: ['cities', 'testing'],
    excerpt:
      'Two cities, and no rush to the third. A ride-splitting product is only as good as its density, and one campus where matching works teaches more than ten where it almost does.',
    sections: [
      {
        heading: 'Density is the whole problem',
        paragraphs: [
          'Two people heading to the same airport at the same time is not a coincidence you can manufacture with a bigger map. It needs enough people in one place, going to enough of the same places, at enough of the same times.',
        ],
      },
      {
        heading: 'What we are watching',
        bullets: [
          'How long somebody will wait for a match before giving up',
          'Whether a group that forms actually travels together',
          'What people do when a match is close but not quite right',
        ],
      },
      {
        heading: 'When the third city makes sense',
        paragraphs: [
          'When those answers stop surprising us, adding a city becomes an execution problem rather than a research one. Until then it would mostly add noise.',
        ],
      },
    ],
  },
];

/** Guides and announcements together, newest first. */
export function allPosts(): BlogPost[] {
  return [...BLOG_POSTS, ...NEWS_POSTS].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  );
}

/** Absent means Blog — the original posts predate the field. */
export function postKind(post: BlogPost): PostKind {
  return post.kind ?? 'Blog';
}

/** Searches guides and announcements: they share one URL space. */
export function findPost(slug: string): BlogPost | undefined {
  return allPosts().find((post) => post.slug === slug);
}
