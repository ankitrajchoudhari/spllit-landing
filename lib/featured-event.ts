/**
 * The home page's featured event: which one to show, what state it is in, and
 * how to say when it is.
 *
 * Pure and dependency-free, like place-dedupe and team-sections: every answer
 * here depends only on the list and the clock, so it is tested with both
 * pinned rather than in a browser.
 *
 * The page is cached, so the server's idea of "now" is up to a few minutes old
 * by the time anyone sees it. The client calls `pickEvent` again with its own
 * clock every second; that is what moves a card from counting down to
 * happening now to gone, without waiting for a rebuild.
 */

export type FeaturedEvent = {
  id: string;
  title: string;
  summary: string;
  poster: string;
  posterAlt: string;
  venue: string;
  area: string;
  mapUrl: string;
  startsAt: string;
  endsAt: string;
  registerUrl: string;
  registration: Registration;
};

/** Set in the console. Anything unrecognised reads as auto. */
export type Registration = 'auto' | 'open' | 'closed';

/** Before the start, between start and end. After the end it is not shown. */
export type EventPhase = 'upcoming' | 'live' | 'ended';

/**
 * How long a finished event stays up, marked closed, when nothing newer is
 * coming. A new event replaces it at once; hiding it in the console does too.
 */
export const ENDED_SHOWN_FOR_MS = 30 * 24 * 60 * 60 * 1000;

/** Shown in IST whatever the visitor's own timezone, because the event is. */
export const EVENT_TIMEZONE = 'Asia/Kolkata';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function https(value: unknown): string {
  const url = str(value);
  return /^https:\/\//i.test(url) ? url : '';
}

/**
 * Untrusted API data → events that can be rendered. Anything without a title,
 * a venue, a readable start and end, or an https registration link is dropped:
 * a card with no way to register is a flyer, not an event.
 */
export function parseEvents(data: unknown): FeaturedEvent[] {
  if (!isRecord(data) || !Array.isArray(data.events)) return [];
  return data.events.flatMap((raw): FeaturedEvent[] => {
    if (!isRecord(raw)) return [];
    const event: FeaturedEvent = {
      id: str(raw.id),
      title: str(raw.title),
      summary: str(raw.summary),
      poster: https(raw.poster),
      posterAlt: str(raw.posterAlt),
      venue: str(raw.venue),
      area: str(raw.area),
      mapUrl: https(raw.mapUrl),
      startsAt: str(raw.startsAt),
      endsAt: str(raw.endsAt),
      registerUrl: https(raw.registerUrl),
      registration:
        raw.registration === 'open' || raw.registration === 'closed' ? raw.registration : 'auto',
    };
    const start = Date.parse(event.startsAt);
    const end = Date.parse(event.endsAt);
    if (!event.id || !event.title || !event.venue || !event.registerUrl) return [];
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return [];
    return [event];
  });
}

/**
 * The event to feature at `now`: one already happening first, otherwise the
 * soonest still to come. Null when everything has finished.
 */
export function pickEvent(
  events: FeaturedEvent[],
  now: number,
): { event: FeaturedEvent; phase: EventPhase } | null {
  const open = events
    .filter((event) => Date.parse(event.endsAt) > now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const live = open.find((event) => Date.parse(event.startsAt) <= now);
  if (live) return { event: live, phase: 'live' };
  const next = open[0];
  if (next) return { event: next, phase: 'upcoming' };

  // Nothing on or coming: keep the one that just finished up, marked over,
  // rather than the section going blank the minute it ends.
  const last = events
    .filter((event) => {
      const end = Date.parse(event.endsAt);
      return end <= now && now - end < ENDED_SHOWN_FOR_MS;
    })
    .sort((a, b) => Date.parse(b.endsAt) - Date.parse(a.endsAt))[0];
  return last ? { event: last, phase: 'ended' } : null;
}

/**
 * Whether Register should work right now. Auto closes at the start; open
 * stays open while the event runs; closed is closed regardless. Nothing is
 * open once the event is over — it is not shown by then anyway.
 */
export function registrationOpen(
  event: Pick<FeaturedEvent, 'registration'>,
  phase: EventPhase,
): boolean {
  if (phase === 'ended' || event.registration === 'closed') return false;
  if (event.registration === 'open') return true;
  return phase === 'upcoming';
}

/**
 * The ribbon across the poster: open while registration is, live while it is
 * running and registration has closed (CLOSED there would read as called
 * off), closed otherwise.
 */
export function ribbonFor(
  event: Pick<FeaturedEvent, 'registration'>,
  phase: EventPhase,
): 'open' | 'live' | 'closed' {
  if (registrationOpen(event, phase)) return 'open';
  return phase === 'live' ? 'live' : 'closed';
}

/**
 * The description as plain sentences. People paste it from wherever they
 * wrote it — a doc, WhatsApp, a README — and bring "# headings", "**bold**"
 * and blank lines with them; on the page those would show as literal symbols.
 * Strips the markers and joins the lines; the words are left alone.
 */
export function plainSummary(text: string): string {
  return text
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/, '')
        .replace(/(\*\*|__)(.+?)\1/g, '$2')
        .replace(/(\*|_)(\S(?:.*?\S)?)\1/g, '$2')
        .replace(/`([^`]+)`/g, '$1')
        .trim(),
    )
    .filter(Boolean)
    .map((line) => (/[.!?…:]$/.test(line) ? line : `${line}.`))
    .join(' ');
}

export type Countdown = { days: number; hours: number; minutes: number; seconds: number };

/** Whole units left until `target`; zeros once it has passed. */
export function countdown(target: number, now: number): Countdown {
  let left = Math.max(0, Math.floor((target - now) / 1000));
  const days = Math.floor(left / 86_400);
  left -= days * 86_400;
  const hours = Math.floor(left / 3_600);
  left -= hours * 3_600;
  const minutes = Math.floor(left / 60);
  return { days, hours, minutes, seconds: left - minutes * 60 };
}

/** The map button's target: the link given, or a Maps search for the place. */
export function mapsHref(event: Pick<FeaturedEvent, 'mapUrl' | 'venue' | 'area'>): string {
  if (event.mapUrl) return event.mapUrl;
  const query = [event.venue, event.area].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * "Sat, 22 Nov · 6:00 – 9:00 PM IST", or with both dates when it runs past
 * midnight. Always IST, and said so.
 */
export function formatWhen(event: Pick<FeaturedEvent, 'startsAt' | 'endsAt'>): string {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const day = new Intl.DateTimeFormat('en-IN', {
    timeZone: EVENT_TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const time = new Intl.DateTimeFormat('en-IN', {
    timeZone: EVENT_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const t = (d: Date) => time.format(d).toUpperCase();
  const sameDay = day.format(start) === day.format(end);
  return sameDay
    ? `${day.format(start)} · ${t(start)} – ${t(end)} IST`
    : `${day.format(start)}, ${t(start)} – ${day.format(end)}, ${t(end)} IST`;
}
