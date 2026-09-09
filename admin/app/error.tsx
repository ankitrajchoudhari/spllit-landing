'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/primitives';
import { ErrorState } from '@/components/ui/states';

/**
 * Last-resort boundary for a render that threw.
 *
 * The digest is shown rather than hidden: in production React replaces the
 * message with an opaque id, and that id is the only thing that ties what the
 * admin saw to the entry in the Worker logs.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[console/error]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md">
        <ErrorState
          title="This page failed to render"
          description={
            error.digest
              ? `Nothing was changed. Reference ${error.digest} if you need this looked into.`
              : 'Nothing was changed.'
          }
          action={
            <Button variant="primary" onClick={reset}>
              Try again
            </Button>
          }
        />
      </div>
    </div>
  );
}
