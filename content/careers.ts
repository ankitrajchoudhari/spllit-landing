/**
 * Careers page content.
 *
 * This file is the shape *and* the fallback. The admin console writes the real
 * content to a platform setting (`careers.content`) which the public page reads
 * at request time; when that read fails or the setting has never been written,
 * the page renders what is here instead. That matters because the landing site
 * and the backend deploy separately — without a fallback, /careers would be an
 * empty page for anyone who visited between the two.
 *
 * Roles close on a date rather than being deleted. A closed role stays on the
 * page marked closed, because a job listing that silently disappears reads to
 * an applicant as though their application went nowhere.
 */

/**
 * Careers has its own inbox. support@ still handles anything wrong with the
 * site itself; an application or a question about a role goes here, so it is
 * not competing with password resets for attention.
 */
export const CAREERS_SUPPORT_EMAIL = 'career@spllit.app';

/** Where the work happens. Used as a filter, so keep the set small. */
export type RoleLocation = 'Chennai' | 'Jaipur' | 'Remote (India)' | 'Hybrid';

/** Commitment, not seniority. */
export type RoleType = 'Full-time' | 'Part-time' | 'Internship' | 'Contract';

export interface CareerRole {
  /** Stable slug — used as the React key and the anchor link. */
  id: string;
  title: string;
  /** Engineering, Design, Growth… free text so a new team needs no code change. */
  team: string;
  location: RoleLocation;
  type: RoleType;
  /** One or two sentences. Shown collapsed in the list. */
  summary: string;
  /** Bullets. Kept short — the long version belongs in the form. */
  responsibilities: string[];
  /**
   * The Google Form (or any URL) an applicant is sent to. Empty means the role
   * is listed but not yet accepting applications, and the card says so rather
   * than rendering a button that goes nowhere.
   */
  applyUrl: string;
  /**
   * ISO date. The role shows as closed from this date onward. Null means open
   * until somebody closes it by hand.
   */
  closesAt: string | null;
  /**
   * Set in the console. Closing by hand wins over the date, so a role can be
   * pulled the moment it is filled without having to backdate anything; leaving
   * it open still lets the date close it on schedule.
   */
  status?: 'open' | 'closed';
  /** Hidden from the public page entirely. Lets a role be drafted in the console. */
  draft?: boolean;
}

export interface CareersContent {
  /** Small line above the headline. */
  eyebrow: string;
  headline: string;
  standfirst: string;
  /** The pitch for joining this early. Three short blocks. */
  pitch: { title: string; body: string }[];
  roles: CareerRole[];
  /** Shown when every role is closed or there are none. */
  emptyState: { title: string; body: string };
}

/**
 * Seeded content.
 *
 * ⚠️ The roles below are examples so the page is not blank on first deploy.
 * Replace or remove them in the admin console before pointing anyone at this
 * page — a listed role nobody intends to fill wastes an applicant's time.
 *
 * Their apply links are mailto: on purpose. A placeholder form URL would be a
 * dead link on a live page, whereas an email reaches somebody; once real roles
 * are configured in the console with real form links, none of this renders.
 */
export const CAREERS_FALLBACK: CareersContent = {
  eyebrow: 'Careers',
  headline: 'Build the thing before it exists.',
  standfirst:
    'Spllit is early. Two cities in testing, a small team, and most of the product still unwritten. If you want a job with the edges already sanded off, this is not it.',
  pitch: [
    {
      title: 'You will own whole things',
      body: 'Not a ticket off a board. A surface — the map, the payments, the way a squad forms — from the first sketch to the version people complain about.',
    },
    {
      title: 'Small enough to see your dent',
      body: 'Everything you ship is in front of real students within the week. There is no layer between what you build and somebody using it on a Friday night.',
    },
    {
      title: 'We are still deciding things',
      body: 'Most of what Spllit will be has not been decided. Joining now means being in the room for that, not inheriting it.',
    },
  ],
  roles: [
    {
      id: 'founding-frontend-engineer',
      title: 'Founding Frontend Engineer',
      team: 'Engineering',
      location: 'Chennai',
      type: 'Full-time',
      summary:
        'Own the app people actually touch — the live map, the squad room, the flows that turn four strangers into one cab.',
      responsibilities: [
        'Build and ship product surfaces end to end in Next.js and TypeScript',
        'Work directly on the live map and realtime squad experience',
        'Set the frontend conventions the next five engineers will follow',
      ],
      applyUrl: 'mailto:career@spllit.app?subject=Application%3A%20Founding%20Frontend%20Engineer',
      closesAt: null,
      status: 'open',
    },
    {
      id: 'product-designer',
      title: 'Product Designer',
      team: 'Design',
      location: 'Remote (India)',
      type: 'Full-time',
      summary:
        'Decide what Spllit feels like. Money between friends is awkward; the design is most of what makes it not awkward.',
      responsibilities: [
        'Own flows end to end, from the problem to the shipped screens',
        'Keep one design language across the app, the console and this site',
        'Sit with real students using the product and change your mind often',
      ],
      applyUrl: 'mailto:career@spllit.app?subject=Application%3A%20Product%20Designer',
      closesAt: null,
      status: 'open',
    },
    {
      id: 'campus-growth-intern',
      title: 'Campus Growth Intern',
      team: 'Growth',
      location: 'Jaipur',
      type: 'Internship',
      summary:
        'Get Spllit working on one campus properly, then write down how you did it so the next campus is faster.',
      responsibilities: [
        'Run Spllit on your own campus and recruit the first hundred users',
        'Sit with people while they use it and report what actually broke',
        'Turn what worked into a playbook the next campus can follow',
      ],
      applyUrl: 'mailto:career@spllit.app?subject=Application%3A%20Campus%20Growth%20Intern',
      closesAt: null,
      status: 'open',
    },
  ],
  emptyState: {
    title: 'No open roles right now.',
    body: 'We hire in bursts and it is usually decided quickly. Send us what you would want to work on and we will keep it for the next burst.',
  },
};

/** A role's state on the page, derived from its closing date. */
export type RoleStatus = 'open' | 'closing-soon' | 'closed';

/**
 * Derived rather than stored, so a role closes on time whether or not anybody
 * has opened the admin console that week. `now` is injectable for tests.
 */
export function roleStatus(role: CareerRole, now: Date = new Date()): RoleStatus {
  // An explicit close in the console beats the calendar.
  if (role.status === 'closed') return 'closed';
  if (!role.closesAt) return 'open';
  const closes = new Date(role.closesAt);
  if (Number.isNaN(closes.getTime())) return 'open';
  if (now >= closes) return 'closed';
  const daysLeft = (closes.getTime() - now.getTime()) / 86_400_000;
  return daysLeft <= 7 ? 'closing-soon' : 'open';
}

/**
 * True when applications can be submitted at all.
 *
 * Deliberately not conditioned on `applyUrl`: an open role without a form link
 * still accepts applications, by email. Only a closed role turns them away.
 */
export function isAccepting(role: CareerRole, now: Date = new Date()): boolean {
  return roleStatus(role, now) !== 'closed';
}

/** Distinct values for the filter bar, in a stable order. */
export function facetsFor(roles: CareerRole[]) {
  const uniq = (values: string[]) => Array.from(new Set(values)).sort();
  return {
    teams: uniq(roles.map((r) => r.team)),
    locations: uniq(roles.map((r) => r.location)),
    types: uniq(roles.map((r) => r.type)),
  };
}
