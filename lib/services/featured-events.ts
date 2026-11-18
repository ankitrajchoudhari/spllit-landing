import { api } from '@/lib/api/client';
import { parseEvents, type FeaturedEvent } from '@/lib/featured-event';

/**
 * Events featured on the home page, from the admin console.
 *
 * Never throws: an unreachable API means no featured event, and the home page
 * shows its built-in events row instead — the page renders either way.
 */
export const featuredEventsService = {
  async list(): Promise<FeaturedEvent[]> {
    try {
      return parseEvents(await api.get<unknown>('/public/featured-events', { anonymous: true }));
    } catch {
      return [];
    }
  },
};
