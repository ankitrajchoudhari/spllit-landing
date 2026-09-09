'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { AuthProvider } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { ToastProvider } from '@/components/ui/toast';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            /**
             * Deliberately slow, and deliberately not "realtime".
             *
             * The overview endpoint counts collections live. Until the metric
             * rollups land, a fast refetch here multiplies straight into
             * database load whether or not anyone is looking at the tab —
             * which is exactly the failure mode the plan calls out. Realtime
             * arrives over the socket, not by polling harder.
             */
            staleTime: 30_000,
            refetchInterval: 60_000,
            refetchOnWindowFocus: true,

            retry: (failureCount, error) => {
              // Retrying an authorisation failure just produces the same
              // answer three more times and delays telling the user.
              if (error instanceof ApiError && (error.isForbidden || error.isUnauthenticated)) {
                return false;
              }
              return failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AuthProvider>{children}</AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
