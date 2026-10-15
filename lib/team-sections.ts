import type { ProfileLink, TeamMember } from '../content/about.ts';

/**
 * Console team data → the four rows /about renders.
 *
 * Pure and dependency-free, like place-dedupe: it has a right answer over a
 * fixed input, and that is worth checking without a network. Untrusted shape
 * in, only https links and named people out.
 */

export type TeamSections = {
  founders: TeamMember[];
  core: TeamMember[];
  interns: TeamMember[];
  alumni: TeamMember[];
};

type Group = 'founder' | 'core' | 'intern';

const GROUP_LABEL: Record<Group, string> = {
  founder: 'Founder',
  core: 'Core team',
  intern: 'Intern',
};

/** Console field → the label and icon the card already knows. */
const LINK_FIELDS: [string, ProfileLink['label']][] = [
  ['linkedin', 'LinkedIn'],
  ['instagram', 'Instagram'],
  ['x', 'X'],
  ['github', 'GitHub'],
  ['website', 'Website'],
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Only https links leave here; anything else is dropped rather than linked. */
function parseLinks(value: unknown): ProfileLink[] {
  if (!isRecord(value)) return [];
  return LINK_FIELDS.flatMap(([field, label]) => {
    const href = asString(value[field]);
    return /^https:\/\//i.test(href) ? [{ label, href }] : [];
  });
}

export function parseMember(
  value: unknown,
): { member: TeamMember; group: Group; exited: boolean } | null {
  if (!isRecord(value) || value.hidden === true) return null;
  const name = asString(value.name);
  const role = asString(value.role);
  if (!name) return null;

  const group: Group = value.group === 'founder' || value.group === 'intern' ? value.group : 'core';
  const exited = value.status === 'exited';
  const photo = asString(value.photo);
  const bio = asString(value.bio);

  return {
    group,
    exited,
    member: {
      name,
      // An alumnus is labelled by what they were: "Former intern".
      role: exited ? `Former ${GROUP_LABEL[group].toLowerCase()}` : role || GROUP_LABEL[group],
      ...(bio && { bio }),
      ...(photo && (/^https:\/\//i.test(photo) || photo.startsWith('/')) && { photo }),
      links: parseLinks(value.links),
    },
  };
}

/**
 * Null when there is nothing usable, which the caller treats as "fall back to
 * the built-in list" rather than "show an empty team".
 */
export function toSections(data: unknown): TeamSections | null {
  if (!isRecord(data) || !Array.isArray(data.members)) return null;
  const parsed = data.members
    .map(parseMember)
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  if (parsed.length === 0) return null;

  const active = parsed.filter((entry) => !entry.exited);
  return {
    founders: active.filter((e) => e.group === 'founder').map((e) => e.member),
    core: active.filter((e) => e.group === 'core').map((e) => e.member),
    interns: active.filter((e) => e.group === 'intern').map((e) => e.member),
    alumni: parsed.filter((e) => e.exited).map((e) => e.member),
  };
}
