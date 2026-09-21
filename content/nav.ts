import {
  Home,
  Map,
  Car,
  Users,
  CalendarDays,
  KeyRound,
  Receipt,
  ShoppingBag,
  MessageCircle,
  CircleUser,
  MailOpen,
  LayoutDashboard,
  Route,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Phase 2/3 surfaces — present in the IA now, routed to a waitlist page. */
  comingSoon?: boolean;
  /**
   * Shown in the dock on a phone.
   *
   * The full dock is thirteen targets wide, which on a 360px screen becomes a
   * horizontally scrolling strip of unlabelled icons — navigation you have to
   * navigate. Only the surfaces someone opens mid-journey are kept; everything
   * else stays reachable from the account menu and from links in the pages
   * themselves.
   */
  essential?: boolean;
}

/**
 * Primary destinations, in dock order.
 */
// Communities are built on the backend but withheld from the IA for now —
// see the note in lib/services/communities.ts before re-adding the entry.
export const PRIMARY_NAV: NavItem[] = [
  { href: '/home', label: 'Home', icon: Home, essential: true },
  { href: '/map', label: 'Map', icon: Map, essential: true },
  { href: '/rides', label: 'Rides', icon: Car, essential: true },
  { href: '/squads', label: 'Group Rides', icon: Users, essential: true },
  { href: '/events', label: 'Events', icon: CalendarDays },
  { href: '/chat', label: 'Chat', icon: MessageCircle, essential: true },
];

/**
 * Phase 2 surfaces. They stay in the dock rather than disappearing with the
 * sidebar — the routes exist and are the only way in — but render dimmed so
 * the shipped surfaces still read as the primary set.
 */
export const SOON_NAV: NavItem[] = [
  { href: '/rentals', label: 'Rentals', icon: KeyRound, comingSoon: true },
  { href: '/bills', label: 'Bills', icon: Receipt, comingSoon: true },
  { href: '/marketplace', label: 'Marketplace', icon: ShoppingBag, comingSoon: true },
];

/**
 * The dock: the app's only navigation at every breakpoint.
 *
 * Destinations only. Create is rendered separately at the far end, because it
 * is an action rather than a place — and because a mid-row position was not
 * stable: the trailing group grows by one for admins, so "the middle" moved
 * depending on who you were, and the button was never actually centred for
 * anyone.
 */
export const DOCK_NAV: NavItem[] = [
  ...PRIMARY_NAV,
  { href: '/rides/invites', label: 'Invites', icon: MailOpen },
  { href: '/profile', label: 'Profile', icon: CircleUser },
];

export const COMING_SOON_COPY = {
  rentals: {
    title: 'Rentals',
    tagline: 'Borrow what you need, from people near you.',
    description:
      'Bikes, cameras, projectors, a spare room for the weekend — list what you own, rent what you need, all inside your campus network.',
    bullets: [
      'List an item in under a minute',
      'Deposit held until the item comes back',
      'Pickup handled through Ride Together',
    ],
  },
  bills: {
    title: 'Bill Splitting',
    tagline: 'Settle up without the group-chat maths.',
    description:
      'Split a ride, a dinner, a rental or a trip. Spllit tracks who owes what across every service and nets it down to one payment.',
    bullets: [
      'Auto-split rides you already shared',
      'Running balance per person, not per bill',
      'One settle-up payment instead of six',
    ],
  },
  marketplace: {
    title: 'Marketplace',
    tagline: 'Buy and sell inside your campus.',
    description:
      'Textbooks, cycles, furniture, tickets. Listings from verified students at your college, with pickup and payment handled in-app.',
    bullets: [
      'Verified students only',
      'Meet at a safe, mapped pickup point',
      'Pay through Spllit, not a stranger UPI',
    ],
  },
} as const;

/**
 * Host mode's dock. A driver's job is a different job: they publish trips and
 * watch for riders rather than browsing squads and events, so showing them the
 * rider surfaces would be noise. Guest-side items are deliberately absent —
 * the mode switch in the top bar is the way back.
 */
export const HOST_DOCK_NAV: NavItem[] = [
  { href: '/host', label: 'Dashboard', icon: LayoutDashboard, essential: true },
  { href: '/host/trips', label: 'My trips', icon: Route, essential: true },
  { href: '/host/vehicles', label: 'Vehicles', icon: Car, essential: true },
  { href: '/host/wallet', label: 'Wallet', icon: Wallet },
  { href: '/chat', label: 'Chat', icon: MessageCircle, essential: true },
  { href: '/profile', label: 'Profile', icon: CircleUser },
];
