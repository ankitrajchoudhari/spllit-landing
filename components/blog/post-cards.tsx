import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { blurProps } from '@/lib/image-blur';
import { postKind, type BlogPost } from '@/content/blog';

/**
 * next/image refuses to optimise SVG, and rasterising one would throw away
 * the reason it is an SVG. The logos are the only vectors here, so they are
 * passed through untouched rather than every image losing optimisation.
 */
function imageProps(src: string) {
  return src.toLowerCase().endsWith('.svg')
    ? { unoptimized: true as const }
    : blurProps(src);
}


/**
 * Cards for the blog index and the "keep reading" rail.
 *
 * The art is cut-out photography on white — black-and-white figures against
 * flat blocks of colour — so every picture is contained rather than cropped to
 * fill. Cropping a cutout slices the subject in half and loses the thing that
 * makes the style work, which is the empty space around it.
 */

/**
 * Blog and News are different promises — a guide meant to hold up next term,
 * and something that happened on a date — so they get different colours rather
 * than the same grey pill with a different word in it.
 */
export function KindChip({ post }: { post: BlogPost }) {
  const kind = postKind(post);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1',
        'text-[11px] font-semibold uppercase tracking-[0.1em]',
        kind === 'News' ? 'bg-danger-muted text-danger' : 'bg-brand-muted text-brand',
      )}
    >
      {kind}
    </span>
  );
}

export function PostMeta({ post, className }: { post: BlogPost; className?: string }) {
  return (
    <p className={cn('text-[12.5px] text-ink-subtle', className)}>
      <time dateTime={post.publishedAt}>
        {new Date(post.publishedAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      </time>
      <span aria-hidden> · </span>
      {post.readingMinutes} min read
    </p>
  );
}

/**
 * The lead story: wider, and the only card that runs its picture large.
 *
 * A grid where everything is the same size has no front page — the reader has
 * to choose for themselves, and most will not choose at all.
 */
export function FeaturedCard({ post }: { post: BlogPost }) {
  return (
    <article className="group overflow-hidden rounded-3xl border border-line bg-surface shadow-soft transition-shadow duration-snap hover:shadow-raised">
      <Link href={`/blog/${post.slug}`} className="grid md:grid-cols-[1.05fr_1fr]">
        <div className="relative aspect-[16/11] overflow-hidden bg-surface-sunken md:aspect-auto md:min-h-[340px]">
          {post.image ? (
            <Image
              src={post.image}
              alt={post.imageAlt ?? ''}
              fill
              sizes="(min-width: 768px) 52vw, 100vw"
              {...imageProps(post.image)}
              className="object-contain p-8 transition-transform duration-500 group-hover:scale-[1.03] md:p-12"
              priority
            />
          ) : null}
        </div>

        <div className="flex flex-col justify-center gap-4 p-6 sm:p-9 lg:p-11">
          <div className="flex flex-wrap items-center gap-3">
            <KindChip post={post} />
            <PostMeta post={post} />
          </div>

          <h2 className="font-sans text-[clamp(1.55rem,3vw,2.2rem)] font-medium leading-[1.1] tracking-[-0.035em] text-ink">
            {post.title}
          </h2>

          <p className="max-w-[48ch] text-[15.5px] leading-relaxed text-ink-muted">{post.excerpt}</p>

          <span className="mt-1 inline-flex items-center gap-1.5 text-[14px] font-medium text-ink">
            Read it
            <ArrowUpRight
              className="h-4 w-4 transition-transform duration-snap group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </div>
      </Link>
    </article>
  );
}

export function PostCard({ post }: { post: BlogPost }) {
  return (
    <article className="group h-full">
      <Link href={`/blog/${post.slug}`} className="flex h-full flex-col">
        <div className="relative aspect-[5/4] overflow-hidden rounded-2xl border border-line bg-surface">
          {post.image ? (
            <Image
              src={post.image}
              alt={post.imageAlt ?? ''}
              fill
              sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
              {...imageProps(post.image)}
              className="object-contain p-7 transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : null}
          <span className="absolute left-4 top-4">
            <KindChip post={post} />
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-2.5 pt-5">
          <h3 className="font-sans text-[19px] font-medium leading-[1.22] tracking-[-0.02em] text-ink sm:text-[20px]">
            {post.title}
          </h3>
          <p className="text-[14.5px] leading-relaxed text-ink-muted">{post.excerpt}</p>
          <PostMeta post={post} className="mt-auto pt-2" />
        </div>
      </Link>
    </article>
  );
}
