import { Skeleton } from '@/components/ui/skeleton';

/**
 * Route-level loading boundary, and the reason this route is prefetched at all.
 *
 * `/squads/[id]` builds as ƒ (Dynamic) — a dynamic segment with no
 * generateStaticParams is rendered on demand. Next does not prefetch a dynamic
 * route *unless* it has a loading boundary: without this file a `<Link>` to a
 * squad fetched nothing on hover or in the viewport, and the click paid for a
 * full server roundtrip before anything at all appeared. With it, the layout
 * down to this fallback is prefetched and painted the instant the link is
 * clicked, and the page streams in behind it.
 *
 * Deliberately NOT added to the static routes (/squads, /rides, /home …).
 * Those are prerendered and already prefetch in full with a 5-minute client
 * cache; giving them a loading boundary would cut the prefetch back to this
 * fallback and drop that TTL, which is a straight downgrade.
 *
 * The shape mirrors the page's own pending state exactly — same max-w-3xl
 * column, same three blocks — so the skeleton is not replaced by a differently
 * sized one a moment later.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
