import { api } from '@/lib/api/client';
import type {
  CompanionSearch,
  LngLat,
  Paginated,
  Ride,
  RideSearchResult,
  RideStatus,
  VehicleType,
} from '@/types';

export interface CorridorSearchQuery {
  /** Where the guest starts. */
  origin: LngLat;
  /** Where the guest is going. Both ends are required — the match is a corridor. */
  destination: LngLat;
  departAt?: string;
  windowMins?: number;
  /** How far off the host's route the guest may be, in metres. */
  corridorMetres?: number;
}

export interface CompanionQuery {
  /** Where the group is going. Matching is on this, not on origin. */
  destination: LngLat;
  destRadiusKm?: number;
  /** ISO timestamp. Defaults to now on the server. */
  departAt?: string;
  /** Half-width of the acceptable departure window, in minutes. */
  windowMins?: number;
  /** The caller's pickup point — drives distance sorting and online matches. */
  near?: LngLat | null;
}

export interface RideQuery {
  near?: LngLat;
  radiusKm?: number;
  destination?: string;
  /**
   * Where the guest is going. Given both this and `near`, the server keeps only
   * hosts whose route actually passes both points — without it the answer is
   * every ride that merely *starts* nearby, in whatever direction.
   */
  headingTo?: LngLat | null;
  after?: string;
  vehicleType?: VehicleType;
  cursor?: string;
  limit?: number;
}

export interface CreateRideInput {
  origin: string;
  originLat: number;
  originLng: number;
  destination: string;
  destLat: number;
  destLng: number;
  departureTime: string;
  vehicleType: VehicleType;
  seats: number;
  fare?: number;
  genderPref?: 'male' | 'female' | 'any';
  stops?: { lat: number; lng: number; label?: string }[];
}

export const ridesService = {
  list: (query: RideQuery = {}) =>
    api.get<Paginated<Ride>>('/rides/nearby', {
      query: {
        lng: query.near?.[0],
        lat: query.near?.[1],
        radiusKm: query.radiusKm,
        destLng: query.headingTo?.[0],
        destLat: query.headingTo?.[1],
        destination: query.destination,
        after: query.after,
        vehicleType: query.vehicleType,
        cursor: query.cursor,
        limit: query.limit ?? 20,
      },
    }),

  /**
   * "Find a ride": hosts whose route already passes the guest's pickup *and*
   * drop-off, in that order. Distinct from `list`, which only knows about
   * rides that start nearby and so misses every host who would drive past the
   * guest mid-trip.
   */
  /**
   * Counts per vehicle type, computed server-side over the whole matching set.
   *
   * Not derivable from `list`: that returns one capped page, and asking it for
   * a single vehicle type is what made every other row read 0. Pass a
   * destination to count only rides heading the same way — without one these
   * are just "starting near you", which is a different question.
   */
  availability: (query: {
    near: LngLat;
    destination?: LngLat | null;
    departAt?: string;
    windowMins?: number;
    radiusKm?: number;
  }) =>
    api.get<{
      counts: Record<string, number>;
      total: number;
      directional: boolean;
    }>('/rides/availability', {
      query: {
        lng: query.near[0],
        lat: query.near[1],
        destLng: query.destination?.[0],
        destLat: query.destination?.[1],
        departAt: query.departAt,
        windowMins: query.windowMins,
        radiusKm: query.radiusKm,
      },
    }),

  search: (query: CorridorSearchQuery) =>
    api.get<RideSearchResult>('/rides/search', {
      query: {
        originLng: query.origin[0],
        originLat: query.origin[1],
        destLng: query.destination[0],
        destLat: query.destination[1],
        departAt: query.departAt,
        windowMins: query.windowMins,
        corridorMetres: query.corridorMetres,
      },
    }),

  /** Squad search: people already heading to the same place around the same time. */
  companions: (query: CompanionQuery) =>
    api.get<CompanionSearch>('/rides/companions', {
      query: {
        destLng: query.destination[0],
        destLat: query.destination[1],
        destRadiusKm: query.destRadiusKm,
        departAt: query.departAt,
        windowMins: query.windowMins,
        lng: query.near?.[0],
        lat: query.near?.[1],
      },
    }),

  byId: (id: string) => api.get<Ride>(`/rides/${id}/detail`),

  mine: () => api.get<Ride[]>('/rides/mine'),

  create: (input: CreateRideInput) => api.post<Ride>('/rides', input),

  /**
   * Every status change goes through this one endpoint. The client never PATCHes
   * `status` directly — the server owns the state machine and rejects illegal
   * transitions (Section 5.5).
   */
  transition: (id: string, to: RideStatus, reason?: string) =>
    api.post<Ride>(`/rides/${id}/transition`, { to, reason }),

  join: (id: string, seats = 1) => api.post<Ride>(`/rides/${id}/join`, { seats }),

  leave: (id: string) => api.post<Ride>(`/rides/${id}/leave`),

  /**
   * Answering a request for a seat. Host only — the server re-checks that on
   * every call, so these are not the boundary, only the path to it.
   */
  requests: (id: string) => api.get<RideRequests>(`/rides/${id}/requests`),

  request: (id: string, matchId: string) =>
    api.get<RideRequestDetail>(`/rides/${id}/requests/${matchId}`),

  decide: (id: string, matchId: string, decision: 'approve' | 'reject') =>
    api.post<{ id: string; decision: string }>(`/rides/${id}/requests/${matchId}`, { decision }),
};

/** Somebody waiting on a host's answer. */
export interface RideRequest {
  id: string;
  askedAt: string;
  requester: {
    id: string;
    name: string;
    username?: string | null;
    profilePhoto?: string | null;
    college?: string | null;
    rating?: number | null;
  } | null;
}

export interface RideRequests {
  seatsLeft: number;
  requests: RideRequest[];
}

export interface RideRequestDetail {
  ride: { id: string; origin: string; destination: string; departureTime: string };
  matchId: string;
  seatsLeft: number;
  requester: RideRequest['requester'];
}
