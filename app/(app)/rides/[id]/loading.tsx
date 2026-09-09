import { SkeletonMap, Skeleton } from '@/components/ui/skeleton';

/**
 * See app/(app)/squads/[id]/loading.tsx for why the dynamic routes need this
 * file and the static ones must not have it.
 *
 * Mirrors the page's own pending state, including the map block: this route
 * also waits on the Mapbox bundle, so standing in with a map-shaped surface
 * keeps the column height stable from the first paint through to the real map.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Skeleton className="h-7 w-48" />
      <SkeletonMap className="h-[280px]" />
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
}
