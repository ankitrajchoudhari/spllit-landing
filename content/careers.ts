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
 * Fallback content.
 *
 * What renders when the API cannot be reached, and per field whenever the
 * console leaves one blank. The copy is real; `roles` is deliberately empty.
 *
 * It used to hold three examples so the page was not bare on first deploy.
 * That made any failure to reach the API put three fabricated openings on a
 * live page, which is worse than an empty board: an applicant spends real
 * effort on a job that does not exist. Roles come from the console or not
 * at all, and an empty board says so honestly.
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
  roles: [],
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
 * Deliberately not conditioned on `applyUrl`: a role that is published and open
 * is required to have one, so only a close turns applicants away.
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
