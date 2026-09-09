import { Skeleton } from '@/components/ui/skeleton';

/**
 * See app/(app)/squads/[id]/loading.tsx for why the dynamic routes need this
 * file and the static ones must not have it.
 *
 * The first block stands in for the back button rather than omitting it: it is
 * a 16px icon in 8px of padding, so leaving it out would shift the thread
 * title sideways the moment the real header arrives.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-5 w-40" />
      </div>
      <Skeleton className="h-[460px] w-full rounded-lg" />
    </div>
  );
}
