import type { Metadata } from 'next';
import Image from 'next/image';

import { LandingNav } from '@/components/landing/landing-nav';
import { ParallaxFooter } from '@/components/landing/parallax-footer';
import { FeaturedCard, PostCard } from '@/components/blog/post-cards';
import { blurProps } from '@/lib/image-blur';
import { allPosts } from '@/content/blog';
import { SITE } from '@/content/site';

export const metadata: Metadata = {
  title: 'Blog & News — Campus travel, fare splitting and safety',
  description:
    'Practical guides on sharing rides between students — splitting a cab fare fairly, staying safe carpooling with classmates, how group rides work — and what is new at Spllit.',
  alternates: { canonical: '/blog' },
  openGraph: {
    title: `Blog & News · ${SITE.name}`,
    description:
      'Guides on sharing rides and splitting fares between students, and what is new at Spllit.',
    url: `${SITE.url}/blog`,
  },
};

/**
 * Blog & News.
 *
 * Was a bare list on a white page with no nav and no footer — findable only by
 * knowing the URL, and reading like a sitemap entry rather than somewhere worth
 * spending a minute. It now carries the same nav and footer as the rest of the
 * marketing site, and is laid out as a front page: a masthead, one lead story,
 * then the rest.
 *
 * The art direction comes from the cutouts in public/blog. That style needs
 * room, so the masthead is type and two pictures with nothing competing.
 *
 * No filter control. Filters are for lists you cannot see the end of; this one
 * fits on a screen, and the chips already say which is a guide and which is an
 * announcement.
 */
export default function BlogIndexPage() {
  const posts = allPosts();
  const [lead, ...rest] = posts;

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto w-full max-w-[1360px]">
        <LandingNav />
      </div>

      <main>
        <section className="border-b border-line">
          <div className="mx-auto max-w-6xl px-5 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-12 lg:px-8">
            {/* The cutouts flank the type on a wide screen and drop away on a
                phone, where they would only push the headline below the fold. */}
            <div className="grid items-center gap-8 lg:grid-cols-[0.75fr_1.5fr_0.75fr]">
              <div className="hidden lg:block">
                <Image
                  src="/blog/plug.png"
                  alt=""
                  width={360}
                  height={360}
                  sizes="200px"
                  {...blurProps('/blog/plug.png')}
                  className="mx-auto h-auto w-full max-w-[200px] -rotate-6"
                />
              </div>

              <div className="text-center">
                <p className="text-[15px] font-semibold uppercase tracking-[0.3em] text-ink-subtle sm:text-[17px]">
                  Blog &amp; News
                </p>
                <h1 className="mx-auto mt-4 max-w-[17ch] font-sans text-[clamp(2rem,5.2vw,3.4rem)] font-medium leading-[1.03] tracking-[-0.045em] text-ink">
                  How to travel together, and what we are building.
                </h1>
                <p className="mx-auto mt-5 max-w-[54ch] text-[16px] leading-relaxed text-ink-muted">
                  Guides on splitting a fare without an argument and staying safe with people you
                  have not met — plus the things worth announcing as they happen.
                </p>
              </div>

              <div className="hidden lg:block">
                <Image
                  src="/blog/blog-letters.png"
                  alt=""
                  width={360}
                  height={180}
                  sizes="230px"
                  {...blurProps('/blog/blog-letters.png')}
                  className="mx-auto h-auto w-full max-w-[230px] rotate-3"
                />
              </div>
            </div>
          </div>
        </section>

        {posts.length === 0 ? (
          <section className="mx-auto max-w-2xl px-5 py-20 text-center sm:px-6 lg:px-8">
            <Image
              src="/blog/binoculars.png"
              alt=""
              width={420}
              height={420}
              sizes="(min-width: 640px) 260px, 62vw"
              {...blurProps('/blog/binoculars.png')}
              className="mx-auto h-auto w-[62%] max-w-[260px]"
            />
            <h2 className="mt-7 font-sans text-[22px] font-medium tracking-[-0.02em] text-ink">
              Nothing published yet.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-ink-muted">
              We are writing the first one.
            </p>
          </section>
        ) : (
          <>
            {lead ? (
              <section className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-14 lg:px-8">
                <FeaturedCard post={lead} />
              </section>
            ) : null}

            {rest.length > 0 ? (
              <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-6 sm:pb-24 lg:px-8">
                <div className="flex items-baseline justify-between gap-4 border-t border-line pt-8">
                  <h2 className="font-sans text-[15px] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
                    Everything else
                  </h2>
                  <p className="text-[13px] text-ink-subtle">
                    {posts.length} {posts.length === 1 ? 'piece' : 'pieces'}
                  </p>
                </div>

                <div className="mt-8 grid gap-x-7 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((post) => (
                    <PostCard key={post.slug} post={post} />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </main>

      <ParallaxFooter />
    </div>
  );
}
