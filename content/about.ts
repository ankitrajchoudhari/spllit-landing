/**
 * Facts behind /about: the people, the company record and the route so far.
 *
 * Everything here is a public claim that someone outside the company is
 * expected to check — Google for Startups declined an application because the
 * site did not show founder and team information "verifiable via active,
 * third-party public links". So every person carries links to profiles that
 * exist, and every milestone links to where it was announced.
 *
 * Empty means unknown, not "fill in later": the page drops an empty field
 * rather than rendering a placeholder, because placeholder text on a live page
 * is itself one of the reasons that application lists for declining.
 */

export type ProfileLink = {
  label: 'LinkedIn' | 'GitHub' | 'X' | 'Instagram' | 'Website';
  href: string;
};

export type TeamMember = {
  name: string;
  role: string;
  /** One or two sentences, in plain third person — not a CV. Optional: no
   * bio is better than one written for somebody without asking them. */
  bio?: string;
  /** Served from /public. Without one the card shows initials. */
  photo?: string;
  links: ProfileLink[];
};

export const TEAM: TeamMember[] = [
  {
    name: 'Ankit Raj Choudhari',
    role: 'Founder',
    bio: 'Started Spllit after watching classmates leave campus for the same places in separate autos. Builds the product and runs the company.',
    links: [],
  },
  {
    name: 'Sanjh Verma',
    role: 'Core team',
    links: [{ label: 'LinkedIn', href: 'https://www.linkedin.com/in/sanjh-verma01/' }],
  },
  {
    name: 'Saurav Kumar',
    role: 'Core team',
    links: [{ label: 'LinkedIn', href: 'https://www.linkedin.com/in/saurav-kumar-a22169352/' }],
  },
];

/** People who have worked on Spllit and moved on, listed by name and link. */
export const ALUMNI: TeamMember[] = [
  {
    name: 'Mayank Jain',
    role: 'Former intern',
    links: [{ label: 'LinkedIn', href: 'https://www.linkedin.com/in/mayank-jain-2511mj/' }],
  },
];

/**
 * The registered company. Each field renders only when it holds a value.
 */
export const COMPANY = {
  /** As printed on the Udyam certificate. A registered enterprise, not a
   * private limited company — do not describe it as one. */
  legalName: 'Spllit (Udyam-registered micro enterprise)',
  /** Shown because "MSME registered" is claimed; checkable on udyamregistration.gov.in. */
  udyam: 'UDYAM-TN-02-0452037',
  /** City only. The certificate's street address is a home address. */
  registeredCity: 'Chennai, Tamil Nadu',
  founded: 'November 2025',
  incubator: 'VELS Innovation Council',
  grievanceOfficer: 'Ankit Raj Choudhari',
} as const;

export type MilestoneStatus = 'done' | 'now' | 'next';

export type Milestone = {
  /** Shown as written: "2025", "Mar 2026". */
  when: string;
  title: string;
  body: string;
  status: MilestoneStatus;
  /** Where it was announced, so the claim can be checked. */
  href?: string;
};

/**
 * Oldest first. The page draws them as stops on one line, so the order is the
 * route.
 */
export const MILESTONES: Milestone[] = [
  {
    when: '2025',
    title: 'The problem, at IIT Madras',
    body: 'The same exam centres, the same airport runs, the same station — and everybody in a separate auto paying full fare, because finding each other was harder than paying.',
    status: 'done',
  },
  {
    when: 'Nov 2025',
    title: 'Registered as a business in Chennai',
    body: 'Spllit began trading as a micro enterprise in the services sector. Its Udyam (MSME) registration followed in February 2026.',
    status: 'done',
  },
  {
    when: 'Jan 2026',
    title: 'Building the product',
    body: 'Not a cab company — a coordination layer. Who is going your way, where to meet, and what the share is before anyone sets off.',
    status: 'done',
  },
  {
    when: 'Mar 2026',
    title: 'Incubated at the VELS Innovation Council',
    body: 'Taken in through the campus E-Cell. The first students to use Spllit were on that campus, and the first things that broke broke there.',
    status: 'done',
    href: '/blog/incubated-at-vels-nvidia-inception-sarvam',
  },
  {
    when: 'Jun 2026',
    title: 'Selected for NVIDIA Inception',
    body: 'Compute and technical access for the hard part underneath: deciding who should share a cab, and who should not because the detour costs more than the split saves.',
    status: 'done',
    href: '/blog/selected-for-nvidia-inception',
  },
  {
    when: 'Jul 2026',
    title: 'Joined the Sarvam AI startup programme',
    body: 'Working on the language side, because nobody posts a ride in clean English — they write it in Hinglish, Tamil and hostel shorthand.',
    status: 'done',
    href: '/blog/selected-for-sarvam-startup-programme',
  },
  {
    when: 'Sep 2026',
    title: 'Hiring opened',
    body: 'Roles open and close from our own console, and applying happens on spllit.app.',
    status: 'done',
    href: '/careers',
  },
  {
    when: 'Sep 2026',
    title: 'In testing in Chennai and Jaipur',
    body: 'Two cities rather than ten. A ride-splitting product is only as good as its density, so a third waits until the first two stop surprising us.',
    status: 'now',
    href: '/blog/two-cities-in-testing',
  },
  {
    when: 'Next',
    title: 'Spllit Trip',
    body: 'You pick the place. Spllit finds the people going, forms the group and splits the stay before anyone books.',
    status: 'next',
    href: '/trip',
  },
];
