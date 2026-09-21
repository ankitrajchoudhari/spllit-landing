import { Star, Users, MapPin, ArrowLeft, Send } from 'lucide-react';

/**
 * The four screens shown in the landing-page phone carousel.
 *
 * These are drawn, not photographed. The component previously pointed at four
 * PNGs on a third-party Cloudinary account — and they were screenshots of
 * Behance, Notion, One and Reddit, i.e. other companies' apps. That account
 * has since locked hotlinking and every one of the four now answers 401, which
 * is why the phones on the landing page render as empty dark rectangles.
 *
 * Rendering them as markup fixes the cause rather than the symptom:
 *   - nothing to 401. No external host sits between a visitor and the hero.
 *   - it is Spllit's own product on screen, not somebody else's trademark.
 *   - they are sharp at every DPI, and they follow the site's own theme
 *     because they are built from the same tokens as the real app.
 *
 * They are illustrations of real surfaces, deliberately simplified — at 240px
 * wide, honest-sized body text is unreadable, so each screen keeps only the
 * few labels that carry meaning and lets shape stand in for the rest.
 *
 * Only solid token classes are used here. Tailwind's opacity modifiers on a
 * design token silently generate *no rule at all* in this
 * project: the tokens are whole colour values (`--brand: #00c853`) rather than
 * the channel triplets an `<alpha-value>` config needs, so the utility has
 * nothing to compose an alpha into. An earlier draft of this file used them
 * and the avatars rendered as invisible circles. Where a tint is wanted, use
 * the `-muted` token that already exists for it.
 */

/** Shared chrome: the screen background and a status bar. */
function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col bg-canvas text-ink">
      <div className="flex shrink-0 items-center justify-between px-4 pb-1 pt-2.5">
        <span className="text-[9px] font-semibold tracking-tight">9:41</span>
        <span className="flex items-center gap-[3px]" aria-hidden>
          <span className="h-[6px] w-[3px] rounded-[1px] bg-line-strong" />
          <span className="h-[8px] w-[3px] rounded-[1px] bg-ink-subtle" />
          <span className="h-[10px] w-[3px] rounded-[1px] bg-ink" />
          <span className="ml-1 h-[8px] w-[14px] rounded-[2px] border border-line-strong p-[1.5px]">
            <span className="block h-full w-2/3 rounded-[1px] bg-ink" />
          </span>
        </span>
      </div>
      {children}
    </div>
  );
}

function Avatar({ className = '' }: { className?: string }) {
  return <span className={`block rounded-full ${className}`} />;
}

/** Screen 1 — nearby rides on the map, the app's home surface. */
export function NearbyRidesScreen() {
  return (
    <Screen>
      <div className="relative flex-1 overflow-hidden bg-surface-sunken">
        {/* Street grid. A plain flat fill reads as a loading state, not a map.
            Opacity here is an SVG presentation attribute, not a Tailwind
            modifier, so it does apply. */}
        <svg className="absolute inset-0 h-full w-full text-ink" aria-hidden>
          <defs>
            <pattern id="mock-streets" width="34" height="34" patternUnits="userSpaceOnUse">
              <path d="M34 0H0v34" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.13" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#mock-streets)" />
          {/* One thicker arterial road, so the grid reads as a city. */}
          <path
            d="M-10 118 C 60 96, 96 150, 190 120"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.14"
            strokeWidth="9"
          />
        </svg>

        {/* The matched route. */}
        <svg
          className="absolute inset-0 h-full w-full"
          aria-hidden
          viewBox="0 0 240 300"
          preserveAspectRatio="none"
        >
          <path
            d="M52 196 C 84 150, 120 168, 158 96"
            fill="none"
            className="stroke-brand"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="1 9"
          />
        </svg>

        <span className="absolute left-[20%] top-[63%] h-3 w-3 -translate-x-1/2 rounded-full border-2 border-canvas bg-ink shadow-soft" />
        <span className="absolute left-[66%] top-[31%] h-4 w-4 -translate-x-1/2 rounded-full border-2 border-canvas bg-brand shadow-soft" />

        <div className="absolute left-3 right-3 top-3 flex items-center gap-2 rounded-full bg-surface px-3 py-2 shadow-soft">
          <MapPin className="h-3 w-3 shrink-0 text-brand" />
          <span className="text-[9px] font-medium text-ink-muted">Rides near IIT Madras</span>
        </div>
      </div>

      {/* Bottom sheet — the ride the map is pointing at. */}
      <div className="shrink-0 rounded-t-[18px] bg-surface px-3.5 pb-4 pt-3 shadow-float">
        <span className="mx-auto mb-3 block h-1 w-8 rounded-full bg-line-strong" />
        <div className="flex items-start gap-2.5">
          <Avatar className="h-8 w-8 shrink-0 bg-brand-muted" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-semibold leading-tight">Chennai Airport</p>
            <p className="mt-0.5 text-[8.5px] text-ink-subtle">Today · 4:30 PM · 3 seats</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold leading-none text-brand">₹180</p>
            <p className="mt-1 text-[8px] text-ink-subtle">per seat</p>
          </div>
        </div>
        <div className="mt-3 h-7 rounded-full bg-ink" />
      </div>
    </Screen>
  );
}

/** Screen 2 — a single ride, the decision surface. */
export function RideDetailScreen() {
  return (
    <Screen>
      <div className="flex items-center gap-2 px-3.5 pb-2 pt-1">
        <ArrowLeft className="h-3 w-3 text-ink-subtle" />
        <span className="text-[10px] font-semibold">Ride details</span>
      </div>

      <div className="flex-1 space-y-2.5 px-3.5">
        {/* Route timeline. */}
        <div className="rounded-[14px] border border-line bg-surface p-3">
          <div className="flex gap-2.5">
            <div className="flex flex-col items-center pt-1">
              <span className="h-2 w-2 rounded-full border-[1.5px] border-ink" />
              <span className="my-0.5 h-7 w-[1.5px] bg-line-strong" />
              <span className="h-2 w-2 rounded-full bg-brand" />
            </div>
            <div className="flex-1 space-y-3.5">
              <div>
                <p className="text-[9.5px] font-semibold leading-none">IIT Madras</p>
                <p className="mt-1 text-[8px] text-ink-subtle">Main Gate</p>
              </div>
              <div>
                <p className="text-[9.5px] font-semibold leading-none">Chennai Airport</p>
                <p className="mt-1 text-[8px] text-ink-subtle">Terminal 1</p>
              </div>
            </div>
          </div>
        </div>

        {/* Driver. */}
        <div className="flex items-center gap-2.5 rounded-[14px] border border-line bg-surface p-2.5">
          <Avatar className="h-7 w-7 shrink-0 bg-accent-muted" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[9.5px] font-semibold leading-none">Ananya R.</p>
            <p className="mt-1 flex items-center gap-1 text-[8px] text-ink-subtle">
              <Star className="h-2 w-2 fill-current text-brand" />
              4.9 · 32 rides
            </p>
          </div>
          <span className="rounded-full bg-brand-muted px-2 py-1 text-[7.5px] font-semibold text-brand">
            VERIFIED
          </span>
        </div>

        <div className="flex items-center justify-between rounded-[14px] bg-surface-sunken px-3 py-2.5">
          <span className="text-[8.5px] text-ink-muted">Your share</span>
          <span className="text-[12px] font-bold text-ink">₹180</span>
        </div>
      </div>

      <div className="shrink-0 px-3.5 pb-4 pt-2">
        <div className="flex h-8 items-center justify-center rounded-full bg-brand">
          <span className="text-[9.5px] font-semibold text-brand-fg">Request seat</span>
        </div>
      </div>
    </Screen>
  );
}

/** Screen 3 — a travel squad, the product's distinctive surface. */
export function SquadScreen() {
  return (
    <Screen>
      <div className="flex-1 space-y-2.5 px-3.5 pt-1">
        <div>
          <p className="font-display text-[13px] font-bold leading-tight">Pondicherry</p>
          <p className="mt-1 text-[8.5px] text-ink-subtle">Sat 14 Dec · 2 nights</p>
        </div>

        <div className="rounded-[14px] border border-line bg-surface p-3">
          <div className="flex items-center gap-1.5">
            <Users className="h-2.5 w-2.5 text-ink-muted" />
            <span className="text-[8.5px] font-medium text-ink-muted">4 of 6 joined</span>
          </div>
          <div className="mt-2.5 flex -space-x-1.5">
            <Avatar className="h-6 w-6 border-2 border-surface bg-brand" />
            <Avatar className="h-6 w-6 border-2 border-surface bg-accent" />
            <Avatar className="h-6 w-6 border-2 border-surface bg-surface-sunken" />
            <Avatar className="h-6 w-6 border-2 border-surface bg-brand-muted" />
            <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-surface-sunken text-[7.5px] font-semibold text-ink-subtle">
              +2
            </span>
          </div>
          {/* Fill bar — 4 of 6. */}
          <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-surface-sunken">
            <span className="block h-full w-2/3 rounded-full bg-brand" />
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-[14px] bg-brand-muted p-2.5">
          <MapPin className="mt-px h-2.5 w-2.5 shrink-0 text-brand" />
          <div>
            <p className="text-[8.5px] font-semibold leading-none text-ink">Meeting point</p>
            <p className="mt-1 text-[8px] leading-snug text-ink-muted">Taramani gate · 6:00 AM</p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-[14px] bg-surface-sunken px-3 py-2.5">
          <span className="text-[8.5px] text-ink-muted">Split per person</span>
          <span className="text-[12px] font-bold">₹640</span>
        </div>
      </div>

      <div className="shrink-0 px-3.5 pb-4 pt-2">
        <div className="flex h-8 items-center justify-center rounded-full bg-ink">
          <span className="text-[9.5px] font-semibold text-canvas">Join group ride</span>
        </div>
      </div>
    </Screen>
  );
}

/** Screen 4 — the squad conversation. */
export function ChatScreen() {
  return (
    <Screen>
      <div className="flex items-center gap-2 border-b border-line px-3.5 pb-2 pt-1">
        <ArrowLeft className="h-3 w-3 shrink-0 text-ink-subtle" />
        <Avatar className="h-5 w-5 shrink-0 bg-brand-muted" />
        <div className="min-w-0">
          <p className="truncate text-[9.5px] font-semibold leading-none">Pondicherry group ride</p>
          <p className="mt-0.5 text-[7.5px] text-ink-subtle">6 members</p>
        </div>
      </div>

      <div className="flex-1 space-y-2 px-3 pt-3">
        <div className="flex justify-start">
          <div className="max-w-[78%] rounded-[12px] rounded-bl-[4px] bg-surface-sunken px-2.5 py-1.5">
            <p className="text-[8.5px] leading-snug text-ink">Cab booked — leaving 6 sharp 🚗</p>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="max-w-[78%] rounded-[12px] rounded-br-[4px] bg-brand px-2.5 py-1.5">
            <p className="text-[8.5px] leading-snug text-brand-fg">Sent my ₹640, all done</p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[78%] rounded-[12px] rounded-bl-[4px] bg-surface-sunken px-2.5 py-1.5">
            <p className="text-[8.5px] leading-snug text-ink">Same. See you at the gate!</p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="rounded-[12px] rounded-bl-[4px] bg-surface-sunken px-3 py-2">
            <span className="flex items-center gap-1" aria-hidden>
              <span className="h-1 w-1 rounded-full bg-ink-subtle" />
              <span className="h-1 w-1 rounded-full bg-line-strong" />
              <span className="h-1 w-1 rounded-full bg-line" />
            </span>
          </div>
        </div>
      </div>

      <div className="shrink-0 px-3 pb-4 pt-2">
        <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-2">
          <span className="flex-1 text-[8.5px] text-ink-subtle">Message</span>
          <Send className="h-2.5 w-2.5 text-brand" />
        </div>
      </div>
    </Screen>
  );
}
