import { api } from '@/lib/api/client';
import { CAREERS_FALLBACK, type CareersContent, type CareerRole } from '@/content/careers';

/**
 * Careers content, edited in the admin console and read here.
 *
 * The console writes a single `careers.content` platform setting; this reads it
 * back through a public endpoint. Deliberately not a Prisma model: a startup's
 * open roles are a short list that changes by hand a few times a year, and a
 * production schema migration is a poor trade for that.
 */

/** Anything the API returns is untrusted shape until it has been through here. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function parseRole(value: unknown, index: number): CareerRole | null {
  if (!isRecord(value)) return null;
  const title = asString(value.title).trim();
  if (!title) return null;
  return {
    id: asString(value.id).trim() || `role-${index}`,
    title,
    team: asString(value.team, 'Team').trim(),
    location: asString(value.location, 'Remote (India)').trim() as CareerRole['location'],
    type: asString(value.type, 'Full-time').trim() as CareerRole['type'],
    summary: asString(value.summary).trim(),
    responsibilities: asStringList(value.responsibilities),
    applyUrl: asString(value.applyUrl).trim(),
    closesAt: typeof value.closesAt === 'string' && value.closesAt ? value.closesAt : null,
    status: value.status === 'closed' ? 'closed' : 'open',
    draft: value.draft === true,
  };
}

function parseContent(value: unknown): CareersContent | null {
  if (!isRecord(value)) return null;
  const roles = Array.isArray(value.roles)
    ? value.roles.map(parseRole).filter((r): r is CareerRole => r !== null)
    : [];

  // A payload with no usable roles and no headline is not worth preferring over
  // the built-in copy — it is almost always an empty setting, not an intent.
  const headline = asString(value.headline).trim();
  if (!headline && roles.length === 0) return null;

  const pitch = Array.isArray(value.pitch)
    ? value.pitch
        .filter(isRecord)
        .map((item) => ({ title: asString(item.title).trim(), body: asString(item.body).trim() }))
        .filter((item) => item.title || item.body)
    : [];

  const empty = isRecord(value.emptyState) ? value.emptyState : {};

  return {
    eyebrow: asString(value.eyebrow, CAREERS_FALLBACK.eyebrow).trim(),
    headline: headline || CAREERS_FALLBACK.headline,
    standfirst: asString(value.standfirst, CAREERS_FALLBACK.standfirst).trim(),
    pitch: pitch.length > 0 ? pitch : CAREERS_FALLBACK.pitch,
    roles,
    emptyState: {
      title: asString(empty.title, CAREERS_FALLBACK.emptyState.title).trim(),
      body: asString(empty.body, CAREERS_FALLBACK.emptyState.body).trim(),
    },
  };
}

export const careersService = {
  /**
   * Never throws. The landing site and the backend deploy separately, so this
   * page has to render on its own — an unreachable API or an unwritten setting
   * falls back to the copy in content/careers.ts rather than a broken page or
   * an error boundary.
   */
  async content(): Promise<CareersContent> {
    try {
      const raw = await api.get<unknown>('/public/careers', { anonymous: true });
      return parseContent(raw) ?? CAREERS_FALLBACK;
    } catch {
      return CAREERS_FALLBACK;
    }
  },
};
