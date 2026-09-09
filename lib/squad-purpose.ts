import type { SquadType } from '@/types';

/**
 * Squad purposes offered by the create flow, in the order they are shown.
 *
 * `study` and `hostel` are deliberately absent: they predate the
 * destination-first redesign and still exist on old records, but nothing new
 * should be created with them.
 */
export const SQUAD_PURPOSES: ReadonlyArray<{ value: SquadType; label: string; icon: string }> = [
  { value: 'exam', label: 'Exam', icon: '🎓' },
  { value: 'college', label: 'College', icon: '🏫' },
  { value: 'office', label: 'Office', icon: '💼' },
  { value: 'travel', label: 'Travel', icon: '✈️' },
  { value: 'event', label: 'Event', icon: '🎉' },
  { value: 'shopping', label: 'Shopping', icon: '🛍️' },
  { value: 'concert', label: 'Concert', icon: '🎵' },
  { value: 'sports', label: 'Sports', icon: '⚽' },
  { value: 'general', label: 'Other', icon: '✨' },
];

const LABELS: Record<SquadType, string> = {
  exam: 'Exam',
  college: 'College',
  office: 'Office',
  shopping: 'Shopping',
  travel: 'Travel',
  event: 'Event',
  concert: 'Concert',
  sports: 'Sports',
  general: 'Other',
  // Legacy values, still rendered on squads created before the redesign.
  study: 'Study',
  hostel: 'Hostel',
};

export function purposeLabel(type: SquadType): string {
  return LABELS[type] ?? 'Other';
}

const ICONS: Record<SquadType, string> = {
  exam: '🎓',
  college: '🏫',
  office: '💼',
  shopping: '🛍️',
  travel: '✈️',
  event: '🎉',
  concert: '🎵',
  sports: '⚽',
  general: '✨',
  // Legacy values still stored on older squads.
  study: '📚',
  hostel: '🏠',
};

/**
 * Emoji for a purpose. Decorative everywhere it is used — always paired with
 * the label and marked aria-hidden, because an emoji alone is not a word.
 */
export function purposeIcon(type: SquadType): string {
  return ICONS[type] ?? '✨';
}

/**
 * The shortest name that still identifies the place.
 *
 * Mapbox puts the distinctive part first, so the segment before the first comma
 * is the useful one — but that alone was not enough. A POI comes back as
 * "Near Fortune Tower Maitreya Vihar Chandrasekharpur", which is one comma-free
 * segment, and the old 34-character cap turned it into "Near Fortune Tower
 * Maitreya Vihar Ch…" and then appended " exam run". The result was neither
 * short nor accurate.
 *
 * So the segment is also trimmed at both ends: leading positional filler that
 * Mapbox adds and never identifies anything, and trailing locality words that
 * repeat what the address line already says. Truncation stays as the last
 * resort rather than the only tool.
 */
const LEADING_FILLER = /^(near|opposite|opp\.?|behind|beside|next to)\s+/i;

/** Kept to four words: enough for "Fortune Tower Metro Station", no more. */
const MAX_NAME_WORDS = 4;
const MAX_NAME_CHARS = 28;

export function shortPlaceName(label: string): string {
  const head = (label.split(',')[0] ?? label).trim();
  if (!head) return '';

  const stripped = head.replace(LEADING_FILLER, '').trim() || head;

  const words = stripped.split(/\s+/);
  const clipped = words.length > MAX_NAME_WORDS ? words.slice(0, MAX_NAME_WORDS).join(' ') : stripped;

  return clipped.length > MAX_NAME_CHARS
    ? `${clipped.slice(0, MAX_NAME_CHARS - 1).trimEnd()}…`
    : clipped;
}

/**
 * The name a squad gets before the leader touches it.
 *
 * Built from destination and purpose because that is what a squad *is* — the
 * previous flow asked for a name first, which produced "Friday studio session"
 * and told nobody where it was going. The leader can still overwrite it; this
 * only has to be a good enough default that most people never do.
 */
/**
 * Purposes that read naturally as "<Place> <Purpose> Squad".
 *
 * The rest fall through to "Trip to <Place>", because forcing every purpose
 * into one template produced things like "Fortune Tower Travel Squad", which
 * says the same thing twice. Anything not listed is a plain trip.
 */
const SQUAD_SUFFIX: Partial<Record<SquadType, string>> = {
  exam: 'Exam',
  college: 'College',
  office: 'Office',
  event: 'Event',
  concert: 'Concert',
  sports: 'Sports',
};

export function suggestSquadName(destinationLabel: string, purpose: SquadType): string {
  const place = shortPlaceName(destinationLabel);
  if (!place) return '';

  const suffix = SQUAD_SUFFIX[purpose];
  return suffix ? `${place} ${suffix} Squad` : `Trip to ${place}`;
}

/**
 * Whether a squad is still happening.
 *
 * The server has two live statuses — `active` before the meeting time and
 * `in_progress` after it — and comparing to `'active'` alone silently treats a
 * squad that has merely started as one that has ended. That is wrong everywhere
 * it appears: location sharing would stop, the leader's End Squad button would
 * vanish, and the one-squad-at-a-time rule would let them start a second.
 *
 * Mirrors LIVE_SQUAD_STATUSES in backend/src/services/squads.ts, which is the
 * copy that decides.
 */
export function isSquadLive(status: string | null | undefined): boolean {
  return status === 'active' || status === 'in_progress';
}
