'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import dynamic from 'next/dynamic';

import { QueryProvider } from '@/lib/query/provider';
import { AuthProvider, useAuth } from '@/lib/auth/auth-provider';

/**
 * The realtime layer is loaded on demand, not imported.
 *
 * These providers sit in the root layout, so anything imported here is in the
 * bundle for *every* page — including the landing page, /about, the blog and
 * the six legal pages, which are the ones strangers and crawlers actually hit
 * first. `lib/live/socket` pulls in socket.io-client, and RealtimeBridge pulls
 * in `lib/live/socket`, so a signed-out visitor was downloading and parsing
 * the whole websocket client before the landing page could paint — to open a
 * connection that requires a signed-in user and therefore never opened.
 *
 * Splitting it out costs a round trip *after* sign-in, where a moment's delay
 * on a background socket is invisible, and takes it off the critical path of
 * the pages whose load time is the first thing anyone experiences.
 */
const RealtimeBridge = dynamic(
  () => import('@/components/live/realtime-bridge').then((m) => m.RealtimeBridge),
  {
    // It renders nothing, so there is nothing to prerender; ssr:false is what
    // keeps the chunk out of the server bundle as well.
    ssr: false,
  },
);

/**
 * Bridges Firebase identity into the socket layer, so the live connection
 * authenticates with the same token as HTTP requests and is torn down cleanly
 * on sign-out.
 */
function SocketBridge({ children }: { children: ReactNode }) {
  const { firebaseUser, status } = useAuth();

  /**
   * Whether this page ever got as far as loading the socket module.
   *
   * The signed-out branch below has to tear the connection down, but on a
   * public page there has never been one — and reaching for the module to say
   * so would import the very thing this component exists to avoid. The ref
   * distinguishes "signed out after being signed in", which must disconnect,
   * from "was never signed in", which has nothing to do.
   */
  const everConnected = useRef(false);

  useEffect(() => {
    if (!firebaseUser) {
      if (!everConnected.current) return;
      void import('@/lib/live/socket').then((socket) => {
        socket.setSocketTokenProvider(null);
        socket.disconnectSocket();
      });
      return;
    }

    everConnected.current = true;
    let cancelled = false;

    void import('@/lib/live/socket').then((socket) => {
      // The user signed out while the chunk was in flight — connecting now
      // would open a socket for an identity that is already gone.
      if (cancelled) return;
      socket.setSocketTokenProvider(() => firebaseUser.getIdToken());
      socket.connectSocket();
    });

    return () => {
      cancelled = true;
      // Only tear down on sign-out, not on every render — the effect key is
      // the user object, which is stable while signed in. The import resolves
      // from the module cache here: this cleanup cannot run before the effect
      // above has already fetched it.
      if (status === 'signed-out') {
        void import('@/lib/live/socket').then((socket) => socket.disconnectSocket());
      }
    };
  }, [firebaseUser, status]);

  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <SocketBridge>
          <LiveEvents />
          {children}
        </SocketBridge>
      </AuthProvider>
    </QueryProvider>
  );
}

/**
 * Mounts the app-wide realtime listeners, but only once there is somebody to
 * listen for — the events they wait on are only ever emitted to an
 * authenticated socket, so mounting this for a signed-out visitor downloads
 * the chunk to subscribe to nothing.
 *
 * A separate component because `Providers` renders AuthProvider and so cannot
 * consume its context itself.
 *
 * See RealtimeBridge for why the listeners are app-wide rather than per-screen.
 */
function LiveEvents() {
  const { firebaseUser } = useAuth();
  return firebaseUser ? <RealtimeBridge /> : null;
}
