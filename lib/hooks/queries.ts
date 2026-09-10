'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';

import { STALE } from '@/lib/query/provider';
import { ridesService, type RideQuery, type CreateRideInput } from '@/lib/services/rides';
import { squadsService, type SquadQuery, type CreateSquadInput } from '@/lib/services/squads';
import { eventsService, type EventQuery } from '@/lib/services/events';
import { communitiesService } from '@/lib/services/communities';
import { chatService } from '@/lib/services/chat';
import { notificationsService } from '@/lib/services/notifications';
import { usersService, type OnboardingInput } from '@/lib/services/users';
import { searchService } from '@/lib/services/search';
import { waitlistService } from '@/lib/services/waitlist';
import { draftSquadFromText, fetchAiStatus } from '@/lib/services/ai';
import type {
  ComingSoonService,
  LngLat,
  RideStatus,
  SearchTab,
  SpllitEvent,
  User,
} from '@/types';

/** Every query key in the app lives here so invalidation is never guesswork. */
export const qk = {
  me: ['me'] as const,
  user: (id: string) => ['user', id] as const,
  rides: (q: RideQuery) => ['rides', q] as const,
  ride: (id: string) => ['ride', id] as const,
  myRides: ['rides', 'mine'] as const,
  squads: (q: SquadQuery) => ['squads', q] as const,
  squad: (id: string) => ['squad', id] as const,
  mySquads: ['squads', 'mine'] as const,
  events: (q: EventQuery) => ['events', q] as const,
  event: (id: string) => ['event', id] as const,
  communities: (college?: string) => ['communities', college ?? null] as const,
  myCommunities: ['communities', 'mine'] as const,
  community: (id: string) => ['community', id] as const,
  channelMessages: (id: string) => ['channel', id, 'messages'] as const,
  threads: ['chat', 'threads'] as const,
  thread: (id: string) => ['chat', 'thread', id] as const,
  threadMessages: (id: string) => ['chat', 'thread', id, 'messages'] as const,
  notifications: ['notifications'] as const,
  unreadCount: ['notifications', 'unread'] as const,
  leaderboard: ['leaderboard'] as const,
  nearbyPeople: (center: LngLat) => ['people', 'nearby', center] as const,
  search: (q: string, tab?: SearchTab) => ['search', q, tab ?? 'all'] as const,
  waitlist: (service: ComingSoonService) => ['waitlist', service] as const,
  aiStatus: ['ai', 'status'] as const,
};

// --- Profile --------------------------------------------------------------

export function useUser(id: string | null) {
  return useQuery({
    queryKey: qk.user(id ?? ''),
    queryFn: () => usersService.byId(id as string),
    enabled: Boolean(id),
    staleTime: STALE.long,
  });
}

/** College standings. Slow-moving, so it is cached hard. */
export function useLeaderboard(enabled = true) {
  return useQuery({
    queryKey: qk.leaderboard,
    queryFn: () => usersService.leaderboard(10),
    enabled,
    staleTime: STALE.long,
  });
}

export function useCompleteOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: OnboardingInput) => usersService.completeOnboarding(input),
    onSuccess: (user) => {
      qc.setQueryData(qk.me, user);
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof usersService.update>[0]) =>
      usersService.update(input),
    onSuccess: (user: User) => {
      qc.setQueryData(qk.me, user);
      qc.setQueryData(qk.user(user.id), user);
    },
  });
}

// --- Rides ----------------------------------------------------------------

export function useRides(query: RideQuery = {}, enabled = true) {
  return useQuery({
    queryKey: qk.rides(query),
    queryFn: () => ridesService.list(query),
    // Ride lists move quickly — short staleness, but still cached so tab
    // switches are instant.
    staleTime: STALE.short,
    enabled,
  });
}

export function useRide(id: string | null) {
  return useQuery({
    queryKey: qk.ride(id ?? ''),
    queryFn: () => ridesService.byId(id as string),
    enabled: Boolean(id),
    staleTime: STALE.short,
  });
}

export function useMyRides() {
  return useQuery({
    queryKey: qk.myRides,
    queryFn: () => ridesService.mine(),
    staleTime: STALE.short,
  });
}

export function useCreateRide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRideInput) => ridesService.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['rides'] });
    },
  });
}

export function useRideTransition(rideId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ to, reason }: { to: RideStatus; reason?: string }) =>
      ridesService.transition(rideId, to, reason),
    onSuccess: (ride) => {
      qc.setQueryData(qk.ride(rideId), ride);
      void qc.invalidateQueries({ queryKey: ['rides'] });
    },
  });
}

export function useJoinRide(rideId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (seats: number = 1) => ridesService.join(rideId, seats),
    onSuccess: (ride) => {
      qc.setQueryData(qk.ride(rideId), ride);
      void qc.invalidateQueries({ queryKey: ['rides'] });
    },
  });
}

// --- Squads ---------------------------------------------------------------

export function useSquads(query: SquadQuery = {}, enabled = true) {
  return useQuery({
    queryKey: qk.squads(query),
    queryFn: () => squadsService.nearby(query),
    staleTime: STALE.medium,
    enabled,
  });
}

export function useMySquads() {
  return useQuery({
    queryKey: qk.mySquads,
    queryFn: () => squadsService.mine(),
    staleTime: STALE.medium,
  });
}

export function useSquad(id: string | null) {
  return useQuery({
    queryKey: qk.squad(id ?? ''),
    queryFn: () => squadsService.byId(id as string),
    enabled: Boolean(id),
    staleTime: STALE.short,
  });
}

export function useCreateSquad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSquadInput) => squadsService.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['squads'] });
    },
  });
}

/**
 * Requests to join. Deliberately *not* optimistic: joining now queues a request
 * for the leader rather than admitting anyone, so predicting a member count or
 * a role here would show people a membership they do not have yet.
 */
export function useJoinSquad(squadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => squadsService.join(squadId),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.squad(squadId) });
      void qc.invalidateQueries({ queryKey: qk.mySquads });
    },
  });
}

/**
 * Leaves a squad. Invalidates rather than mutating the cache in place: leaving
 * can hand leadership to someone else server-side, so the squad that comes back
 * is not simply the old one minus a member.
 */
export function useLeaveSquad(squadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => squadsService.leave(squadId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.squad(squadId) });
      void qc.invalidateQueries({ queryKey: qk.mySquads });
      void qc.invalidateQueries({ queryKey: ['squads'] });
    },
  });
}

/**
 * Withdraws a pending join request.
 *
 * Invalidates the same set as leaving: a withdrawn request changes both your
 * own squad list and what discovery is willing to offer you again.
 */
export function useWithdrawRequest(squadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => squadsService.withdraw(squadId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.squad(squadId) });
      void qc.invalidateQueries({ queryKey: qk.mySquads });
      void qc.invalidateQueries({ queryKey: ['squads'] });
    },
  });
}

/** Ends a squad. Invalidates everything squad-shaped: ending one frees the
 *  viewer to create or join another, which changes the whole page. */
export function useEndSquad(squadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: 'completed' | 'cancelled') => squadsService.setStatus(squadId, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.squad(squadId) });
      void qc.invalidateQueries({ queryKey: qk.mySquads });
      void qc.invalidateQueries({ queryKey: ['squads'] });
    },
  });
}

export function useSetMeetingPoint(squadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { lat: number; lng: number; label?: string; meetingAt?: string }) =>
      squadsService.setMeetingPoint(
        squadId,
        { lat: input.lat, lng: input.lng, label: input.label },
        input.meetingAt,
      ),
    onSuccess: (squad) => qc.setQueryData(qk.squad(squadId), squad),
  });
}

// --- Events ---------------------------------------------------------------

export function useEvents(query: EventQuery = {}, enabled = true) {
  return useQuery({
    queryKey: qk.events(query),
    queryFn: () => eventsService.feed(query),
    staleTime: STALE.medium,
    enabled,
  });
}

export function useEvent(id: string | null) {
  return useQuery({
    queryKey: qk.event(id ?? ''),
    queryFn: () => eventsService.byId(id as string),
    enabled: Boolean(id),
    staleTime: STALE.short,
  });
}

export function useAttendEvent(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: 'going' | 'interested' | 'cancelled' = 'going') =>
      eventsService.attend(eventId, status),
    onMutate: async (status) => {
      await qc.cancelQueries({ queryKey: qk.event(eventId) });
      const previous = qc.getQueryData<SpllitEvent>(qk.event(eventId));
      if (previous) {
        const going = status === 'going';
        qc.setQueryData<SpllitEvent>(qk.event(eventId), {
          ...previous,
          viewerAttending: going,
          attendeeCount: Math.max(0, previous.attendeeCount + (going ? 1 : -1)),
        });
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.event(eventId), ctx.previous);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.event(eventId) }),
  });
}

// --- Communities ----------------------------------------------------------

export function useCommunities(college?: string) {
  return useQuery({
    queryKey: qk.communities(college),
    queryFn: () => communitiesService.discover({ college }),
    staleTime: STALE.long,
  });
}

export function useMyCommunities() {
  return useQuery({
    queryKey: qk.myCommunities,
    queryFn: () => communitiesService.mine(),
    staleTime: STALE.long,
  });
}

export function useCommunity(id: string | null) {
  return useQuery({
    queryKey: qk.community(id ?? ''),
    queryFn: () => communitiesService.byId(id as string),
    enabled: Boolean(id),
    staleTime: STALE.medium,
  });
}

export function useChannelMessages(channelId: string | null) {
  return useQuery({
    queryKey: qk.channelMessages(channelId ?? ''),
    queryFn: () => communitiesService.messages(channelId as string),
    enabled: Boolean(channelId),
    staleTime: STALE.none,
  });
}

// --- Chat -----------------------------------------------------------------

export function useThreads(enabled = true) {
  return useQuery({
    queryKey: qk.threads,
    queryFn: () => chatService.threads(),
    staleTime: STALE.short,
    // The dock renders before sign-in resolves; asking then is a guaranteed 401.
    enabled,
  });
}

export function useThread(id: string | null) {
  return useQuery({
    queryKey: qk.thread(id ?? ''),
    queryFn: () => chatService.thread(id as string),
    enabled: Boolean(id),
    staleTime: STALE.medium,
  });
}

export function useThreadMessages(threadId: string | null) {
  return useQuery({
    queryKey: qk.threadMessages(threadId ?? ''),
    queryFn: () => chatService.messages(threadId as string),
    enabled: Boolean(threadId),
    staleTime: STALE.none,
  });
}

// --- Notifications --------------------------------------------------------

export function useNotifications() {
  return useQuery({
    queryKey: qk.notifications,
    queryFn: () => notificationsService.list(),
    staleTime: STALE.short,
  });
}

export function useUnreadCount(enabled = true) {
  return useQuery({
    queryKey: qk.unreadCount,
    queryFn: () => notificationsService.unreadCount(),
    staleTime: STALE.short,
    enabled,
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsService.markAllRead(),
    onSuccess: () => {
      qc.setQueryData(qk.unreadCount, { count: 0 });
      void qc.invalidateQueries({ queryKey: qk.notifications });
    },
  });
}

// --- People / search ------------------------------------------------------

export function useNearbyPeople(center: LngLat | null, radiusKm = 5) {
  return useQuery({
    queryKey: qk.nearbyPeople(center ?? [0, 0]),
    queryFn: () => usersService.nearby(center as LngLat, radiusKm),
    enabled: Boolean(center),
    staleTime: STALE.short,
  });
}

export function useSearch(
  query: string,
  tab?: SearchTab,
  near?: LngLat,
  options?: Partial<UseQueryOptions>,
) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: qk.search(trimmed, tab),
    queryFn: () => (tab ? searchService.tab(trimmed, tab, near) : searchService.all(trimmed, near)),
    // Two characters is the shortest query worth a round trip.
    enabled: trimmed.length >= 2 && options?.enabled !== false,
    staleTime: STALE.medium,
  });
}

// --- Waitlist -------------------------------------------------------------

export function useWaitlistStatus(service: ComingSoonService) {
  return useQuery({
    queryKey: qk.waitlist(service),
    queryFn: () => waitlistService.status(service),
    staleTime: STALE.long,
  });
}

export function useJoinWaitlist(service: ComingSoonService) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, note }: { email: string; note?: string }) =>
      waitlistService.join(service, email, note),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.waitlist(service) }),
  });
}

// --- AI -------------------------------------------------------------------

/**
 * Whether the server has a model configured.
 *
 * Cached hard, because the answer changes when the API is redeployed and never
 * between two renders. The point is to hide the "describe your trip" box
 * entirely where it cannot work, rather than to offer an input that accepts a
 * sentence and always answers that it did not understand.
 */
export function useAiStatus() {
  return useQuery({
    queryKey: qk.aiStatus,
    queryFn: fetchAiStatus,
    staleTime: STALE.long,
    /**
     * One attempt. A retry here costs the user two round trips before the form
     * they actually came for finishes settling, to decide whether to show an
     * optional shortcut — so a failure is simply read as "not available".
     */
    retry: false,
  });
}

/**
 * Turns a typed sentence into a proposed draft.
 *
 * A mutation rather than a query even though it reads nothing: it fires when
 * the user presses a button, it must not re-run on focus or reconnect, and it
 * costs a metered model call every time it does. Those are mutation semantics
 * regardless of what the endpoint does to the database — which here is nothing.
 */
export function useDraftSquadFromText() {
  return useMutation({
    mutationFn: (input: {
      text: string;
      near?: [number, number] | null;
      signal?: AbortSignal;
    }) => draftSquadFromText(input),
  });
}
