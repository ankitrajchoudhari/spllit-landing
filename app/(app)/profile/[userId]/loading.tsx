import { SkeletonProfile, SkeletonList } from '@/components/ui/skeleton';

/**
 * See app/(app)/squads/[id]/loading.tsx for why the dynamic routes need this
 * file and the static ones must not have it.
 *
 * Matches ProfileView's own pending state — max-w-2xl, header then two rows —
 * rather than the wider column the detail routes use.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <SkeletonProfile />
      <SkeletonList count={2} />
    </div>
  );
}
