import { api } from '@/lib/api/client';
import { CAREERS_COPY, type CareersContent, type CareerRole } from '@/content/careers';

/**
 * Careers content: fixed copy, live roles.
 *
 * The console writes a single `careers.content` platform setting. Only its
 * `roles` are read here — the page's words come from `content/careers.ts` and
 * are not editable from the console at all.
 *
 * That split is deliberate. Roles change weekly and must not need a deploy.
 * The headline does not, and making it editable bought nothing while costing a
 * live page that read "Testing" over a row of a's. So: words in the repo,
 * reviewed like any other change; roles in the console, live in half a minute.
 *
 * Deliberately not a Prisma model: a short list of openings edited a few times
 * a year is a poor trade for a production schema migration.
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

/**
 * A role with no title is dropped rather than rendered.
 *
 * The console can save one — it is a half-finished draft, not an error — but a
 * nameless card on the public page is no use to anybody reading it.
 */
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

function parseRoles(value: unknown): CareerRole[] {
  if (!isRecord(value) || !Array.isArray(value.roles)) return [];
  return value.roles.map(parseRole).filter((r): r is CareerRole => r !== null);
}

export const careersService = {
  /**
   * Never throws. The landing site and the backend deploy separately, so this
   * page has to render on its own — an unreachable API means no roles and an
   * empty board, which is honest, rather than an error boundary.
   */
  async roles(): Promise<CareerRole[]> {
    try {
      return parseRoles(await api.get<unknown>('/public/careers', { anonymous: true }));
    } catch {
      return [];
    }
  },

  /** The copy the page renders, with whatever roles are currently published. */
  async content(): Promise<CareersContent> {
    return { ...CAREERS_COPY, roles: await careersService.roles() };
  },

  /** One role by its public id, or null. Used by the apply page. */
  async role(id: string): Promise<CareerRole | null> {
    const roles = await careersService.roles();
    return roles.find((role) => role.id === id) ?? null;
  },
};
