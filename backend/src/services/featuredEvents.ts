import { z } from 'zod';

import prisma from '../utils/prisma.js';

/**
 * Events featured on the spllit.app home page, edited from the admin console.
 *
 * One JSON platform setting, like the team, the blog and careers: a handful of
 * campus events a term is no reason for a table and a migration. The home page
 * shows the next one that has not finished; when none is left it falls back to
 * its built-in events section, so an empty list is a normal state.
 *
 * Times are stored as ISO strings with an explicit offset. The console writes
 * them in IST, and keeping the offset means nobody has to guess later which
 * clock "18:00" was on.
 */

export const FEATURED_EVENTS_KEY = 'home.events';

const isoWithOffset = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)) && /([+-]\d{2}:\d{2}|Z)$/.test(value), {
    message: 'Must be a date and time with a timezone',
  });

const httpsUrl = z
  .string()
  .trim()
  .max(600)
  .refine((value) => value === '' || /^https:\/\//i.test(value), {
    message: 'Must be an https:// link',
  })
  .default('');

export const featuredEventSchema = z
  .object({
    id: z.string().trim().min(1).max(64),
    title: z.string().trim().min(1, 'Every event needs a title').max(90),
    /** Three or four lines on the page. Plain text, never markup. */
    summary: z.string().trim().min(1, 'Every event needs a description').max(320),
    /** The poster, portrait. Uploaded to the media bucket or any https link. */
    poster: httpsUrl,
    posterAlt: z.string().trim().max(200).default(''),
    /** "Anna University". */
    venue: z.string().trim().min(1, 'Every event needs a venue').max(80),
    /** "Guindy, Chennai" — the line under the venue. */
    area: z.string().trim().max(80).default(''),
    /** Optional. Without it the site searches Google Maps for venue + area. */
    mapUrl: httpsUrl,
    startsAt: isoWithOffset,
    endsAt: isoWithOffset,
    /** The Google Form. Required: an event card with no way in is a flyer. */
    registerUrl: z
      .string()
      .trim()
      .max(600)
      .refine((value) => /^https:\/\//i.test(value), {
        message: 'The registration link must start with https://',
      }),
    /**
     * auto: open until the start. open: until the end (walk-ins). closed:
     * closed now, whatever the time — full, or called off.
     */
    registration: z.enum(['auto', 'open', 'closed']).default('auto'),
    /** In the console but not on the site. */
    hidden: z.boolean().default(false),
  })
  .refine((event) => Date.parse(event.endsAt) > Date.parse(event.startsAt), {
    message: 'An event has to end after it starts',
    path: ['endsAt'],
  });

export const featuredEventsSchema = z.object({
  events: z.array(featuredEventSchema).max(40),
});

export type FeaturedEvent = z.infer<typeof featuredEventSchema>;
export type FeaturedEvents = z.infer<typeof featuredEventsSchema>;

export async function readFeaturedEvents(): Promise<FeaturedEvents | null> {
  const row = await prisma.platformSetting.findUnique({ where: { key: FEATURED_EVENTS_KEY } });
  if (!row) return null;
  const parsed = featuredEventsSchema.safeParse(row.value);
  return parsed.success ? parsed.data : null;
}

/**
 * A finished event stays on the home page, marked closed, for this long when
 * nothing newer is coming. Keep in step with ENDED_SHOWN_FOR_MS on the site.
 */
const ENDED_SHOWN_FOR_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * What the home page may show: not hidden, not long over, soonest first.
 *
 * The page decides what is current from its own clock — it is cached, and an
 * event can start or end between rebuilds — so recently finished events are
 * sent too, for it to show as closed when nothing else is left.
 */
export function featuredEventsPublicView(
  content: FeaturedEvents,
  now = Date.now(),
): FeaturedEvents {
  return {
    events: content.events
      .filter((event) => !event.hidden && Date.parse(event.endsAt) > now - ENDED_SHOWN_FOR_MS)
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)),
  };
}

export async function writeFeaturedEvents(
  content: FeaturedEvents,
  updatedBy: string,
): Promise<FeaturedEvents> {
  await prisma.platformSetting.upsert({
    where: { key: FEATURED_EVENTS_KEY },
    create: {
      key: FEATURED_EVENTS_KEY,
      category: 'general',
      label: 'Featured events',
      description: 'Events featured on the spllit.app home page. Edited in the console.',
      valueType: 'json',
      value: content,
      updatedBy,
    },
    update: { value: content, updatedBy },
  });
  return content;
}
