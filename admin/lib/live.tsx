'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';

import { config } from '@/lib/config';
import { currentIdToken } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';

/**
 * The console's live connection.
 *
 * Connects to the backend's `/admin` Socket.IO namespace, which refuses the
 * handshake outright for anyone without a console role — so an authenticated
 * socket here is proof of authorisation, not merely of identity.
 *
 * What this deliberately is *not*: a poll. The dashboard's figures are fetched
 * once and then moved by deltas that arrive as events. Nothing in here asks the
 * server for anything on a timer.
 */

export type LiveStatus =
  | 'connecting'
  | 'live'
  | 'reconnecting'
  /** Given up, or refused. Polling is the fallback from here. */
  | 'offline'
  /** No socket URL was configured at build time. */
  | 'disabled';

export interface ActivityItem {
  type: string;
  metric: string;
  title: string;
  subtitle: string | null;
  entityType: string | null;
  entityId: string | null;
  href: string | null;
  severity: 'info' | 'warning' | 'danger';
  createdAt: string;
}

interface LiveState {
  status: LiveStatus;
  /** Newest first. Capped — see the note on MAX_ITEMS. */
  activity: ActivityItem[];
  /**
   * How much a metric has moved since a given moment.
   *
   * A function over timestamped events rather than a running tally, and that
   * is deliberate. The dashboard refetches its real figures every 60 seconds,
   * and a tally would keep adding on top of a number that had already absorbed
   * those same events — every counter drifting upward the longer a tab stayed
   * open. Passing the moment the figures were fetched makes the delta exactly
   * "what has happened since", with nothing to reset and nothing to double
   * count.
   */
  deltaSince: (metric: string, since: number) => number;
  lastEventAt: number | null;
}

const LiveContext = createContext<LiveState | null>(null);

/**
 * How many feed items the page holds.
 *
 * A tab left open overnight would otherwise accumulate every event Spllit
 * produced in that time, in memory, to render forty of them.
 */
const MAX_ITEMS = 60;

/**
 * How many metric ticks to retain.
 *
 * Larger than the feed because ticks include the high-frequency events the
 * feed withholds, and a delta computed from a truncated log would silently
 * under-report a busy minute.
 */
const MAX_TICKS = 500;

/** How long a hidden tab keeps its socket before it is closed. */
const HIDDEN_GRACE_MS = 2 * 60_000;

export function LiveProvider({ children }: { children: ReactNode }) {
  const { status: authStatus } = useAuth();
  /**
   * Whether a socket address exists at all.
   *
   * Inlined at build time, so this cannot change while the page is open — it
   * belongs in the initial state rather than being written by an effect on
   * first render, which is both a wasted render and a cascading one.
   */
  const configured = Boolean(config.api.socketUrl);
  const [status, setStatus] = useState<LiveStatus>(configured ? 'connecting' : 'disabled');
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  /** Timestamped metric hits, newest first, capped like the feed. */
  const [ticks, setTicks] = useState<{ metric: string; at: number }[]>([]);
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Only once the backend has confirmed this person is an admin. Connecting
    // earlier just produces a refused handshake and a spurious "offline".
    if (authStatus !== 'ready') return undefined;
    // Already reported as 'disabled' by the initial state.
    if (!configured) return undefined;

    let cancelled = false;

    const socket = io(`${config.api.socketUrl.replace(/\/$/, '')}/admin`, {
      // The token is read per attempt rather than captured once: Firebase
      // rotates ID tokens roughly hourly, and a socket that reconnects after
      // that would otherwise present an expired one forever.
      auth: async (callback: (data: { token: string | null }) => void) => {
        callback({ token: await currentIdToken() });
      },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      if (!cancelled) setStatus('live');
    });

    socket.on('disconnect', (reason) => {
      if (cancelled) return;
      // Our own background pause, below — not a fault.
      if (reason === 'io client disconnect') return;
      // A deliberate server-side disconnect is not something to retry into.
      setStatus(reason === 'io server disconnect' ? 'offline' : 'reconnecting');
    });

    socket.io.on('reconnect_attempt', () => {
      if (!cancelled) setStatus('reconnecting');
    });

    socket.io.on('reconnect_failed', () => {
      if (!cancelled) setStatus('offline');
    });

    socket.on('connect_error', () => {
      // Includes the namespace refusing a non-admin. Either way the console
      // falls back to polling rather than showing a broken live badge.
      if (!cancelled) setStatus((current) => (current === 'live' ? 'reconnecting' : 'offline'));
    });

    socket.on('activity', (item: ActivityItem) => {
      if (cancelled) return;

      const at = Date.now();
      setLastEventAt(at);
      setTicks((current) => [{ metric: item.metric, at }, ...current].slice(0, MAX_TICKS));

      // High-frequency events are counted but never listed — the server
      // already withholds them from the stored feed, and this mirrors that so
      // a burst of chat cannot push everything else out of view.
      if (item.type === 'MESSAGE_SENT' || item.type === 'NOTIFICATION_SENT') return;

      setActivity((current) => [item, ...current].slice(0, MAX_ITEMS));
    });

    /**
     * Close the socket when the tab has been in the background for a while.
     *
     * A billing decision: Cloud Run bills api.spllit.app for as long as any
     * request is open, and this socket is one long request — a console tab left
     * open overnight kept the backend billed all night. Coming back reconnects,
     * the figures refetch on focus, and the activity backlog is refetched so
     * whatever happened meanwhile fills in (mergeBacklog drops duplicates).
     */
    let pauseTimer: ReturnType<typeof setTimeout> | null = null;
    let paused = false;
    const onVisibility = () => {
      if (document.hidden) {
        if (pauseTimer) return;
        pauseTimer = setTimeout(() => {
          pauseTimer = null;
          if (!document.hidden) return;
          paused = true;
          socket.disconnect();
        }, HIDDEN_GRACE_MS);
        return;
      }
      if (pauseTimer) clearTimeout(pauseTimer);
      pauseTimer = null;
      if (!paused) return;
      paused = false;
      setStatus('connecting');
      socket.connect();
      void queryClient.invalidateQueries({ queryKey: ['activity'] });
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (pauseTimer) clearTimeout(pauseTimer);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [authStatus, configured, queryClient]);

  const value = useMemo<LiveState>(
    () => ({
      status,
      activity,
      lastEventAt,
      deltaSince: (metric, since) =>
        ticks.reduce(
          (total, tick) => (tick.metric === metric && tick.at > since ? total + 1 : total),
          0,
        ),
    }),
    [status, activity, ticks, lastEventAt],
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive(): LiveState {
  const context = useContext(LiveContext);
  if (!context) throw new Error('useLive must be used inside <LiveProvider>');
  return context;
}

/** Seeds the feed with the backlog fetched over HTTP, without duplicating. */
export function mergeBacklog(live: ActivityItem[], backlog: ActivityItem[]): ActivityItem[] {
  const seen = new Set(live.map((item) => `${item.type}:${item.createdAt}`));
  return [...live, ...backlog.filter((item) => !seen.has(`${item.type}:${item.createdAt}`))].slice(
    0,
    MAX_ITEMS,
  );
}
