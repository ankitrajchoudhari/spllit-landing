import { Skeleton } from '@/components/ui/skeleton';

/**
 * See app/(app)/squads/[id]/loading.tsx for why the dynamic routes need this
 * file and the static ones must not have it.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-[240px] w-full rounded-lg" />
      <Skeleton className="h-20 w-full rounded-lg" />
    </div>
  );
}
