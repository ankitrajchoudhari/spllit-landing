import { api } from '@/lib/api/client';
import { ALUMNI, TEAM } from '@/content/about';
import { toSections, type TeamSections } from '@/lib/team-sections';

/**
 * The people on /about: edited in the admin console, with the list compiled
 * into content/about.ts as the fallback when the console has never been saved
 * or the API cannot be reached. The page renders either way.
 *
 * Someone marked exited is not removed — they move to the alumni row, shown
 * faded, under "Former <group>". A person who just disappears from the page
 * reads to anyone checking as somebody who was never there.
 */

function fromCompiled(): TeamSections {
  const [founder, ...rest] = TEAM;
  return {
    founders: founder ? [founder] : [],
    core: rest,
    interns: [],
    alumni: ALUMNI,
  };
}

export type { TeamSections };

export const teamService = {
  /** Never throws: an unreachable API means the built-in list, not an error. */
  async sections(): Promise<TeamSections> {
    try {
      return (
        toSections(await api.get<unknown>('/public/team', { anonymous: true })) ?? fromCompiled()
      );
    } catch {
      return fromCompiled();
    }
  },
};
