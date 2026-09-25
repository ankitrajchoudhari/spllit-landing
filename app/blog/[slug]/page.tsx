import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { allPosts, findPost } from '@/content/blog';
import { SITE } from '@/content/site';
import { ArticleStructuredData } from '@/components/shared/structured-data';
import { LandingNav } from '@/components/landing/landing-nav';
import { ParallaxFooter } from '@/components/landing/parallax-footer';
import { KindChip, PostCard, PostMeta } from '@/components/blog/post-cards';
import { blurProps } from '@/lib/image-blur';

/**
 * A single post.
 *
 * Measure over width: the column is capped near 68 characters, because that is
 * where a line stops being comfortable however much screen there is. The
 * picture is the one element allowed to break out of it.
 *
 * Pre-rendered at build time. These are the pages meant to rank, so they have
 * to be static HTML a crawler can read without executing anything.
 */
export function generateStaticParams() {
  return allPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = findPost(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.description,
      url: `${SITE.url}/blog/${post.slug}`,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
      tags: [...post.tags],
      ...(post.image ? { images: [{ url: post.image, alt: post.imageAlt ?? '' }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = findPost(slug);
  if (!post) notFound();

  const more = allPosts()
    .filter((other) => other.slug !== post.slug)
    .slice(0, 3);

  return (
    <div className="min-h-dvh bg-canvas">
      <ArticleStructuredData
        title={post.title}
        description={post.description}
        slug={post.slug}
        publishedAt={post.publishedAt}
        updatedAt={post.updatedAt}
      />

      <div className="mx-auto w-full max-w-[1360px]">
        <LandingNav />
      </div>

      <main>
        <article>
          <header className="mx-auto max-w-3xl px-5 pt-8 sm:px-6 sm:pt-12 lg:px-8">
            <Link
              href="/blog"
              className="inline-flex min-h-[44px] items-center gap-2 text-[14px] font-medium text-ink-muted transition-colors duration-snap hover:text-ink"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Blog &amp; News
            </Link>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <KindChip post={post} />
              <PostMeta post={post} />
            </div>

            <h1 className="mt-4 font-sans text-[clamp(1.95rem,4.6vw,3rem)] font-medium leading-[1.05] tracking-[-0.04em] text-ink">
              {post.title}
            </h1>

            <p className="mt-5 max-w-[54ch] text-[18px] leading-relaxed text-ink-muted">
              {post.excerpt}
            </p>
          </header>

          {post.image ? (
            /* Wider than the text column — the one element that gains from the
               extra room, and the thing that gives the page a top edge. */
            <div className="mx-auto mt-10 max-w-4xl px-5 sm:px-6 lg:px-8">
              <div className="relative aspect-[16/10] overflow-hidden rounded-3xl border border-line bg-surface">
                <Image
                  src={post.image}
                  alt={post.imageAlt ?? ''}
                  fill
                  sizes="(min-width: 1024px) 896px, 94vw"
                  {...blurProps(post.image)}
                  className="object-contain p-8 sm:p-14"
                  priority
                />
              </div>
            </div>
          ) : null}

          <div className="mx-auto max-w-[68ch] px-5 pb-14 pt-10 sm:px-6 lg:px-8">
            <div className="space-y-11">
              {post.sections.map((section) => (
                <section key={section.heading}>
                  <h2 className="font-sans text-[22px] font-medium leading-[1.25] tracking-[-0.025em] text-ink sm:text-[26px]">
                    {section.heading}
                  </h2>

                  {section.paragraphs?.map((paragraph) => (
                    <p key={paragraph} className="mt-5 text-[17px] leading-[1.7] text-ink-muted">
                      {paragraph}
                    </p>
                  ))}

                  {section.bullets ? (
                    <ul className="mt-5 space-y-3">
                      {section.bullets.map((bullet) => (
                        <li key={bullet} className="flex gap-3.5">
                          <span
                            aria-hidden
                            className="mt-[13px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                          />
                          <span className="min-w-0 text-[17px] leading-relaxed text-ink-muted">
                            {bullet}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>

            <div className="mt-14 rounded-2xl border border-line bg-surface p-7 text-center shadow-soft sm:p-9">
              <p className="font-sans text-[20px] font-medium tracking-[-0.02em] text-ink">
                Travelling somewhere this week?
              </p>
              <p className="mx-auto mt-2 max-w-sm text-[14.5px] leading-relaxed text-ink-muted">
                Find someone from your campus going the same way.
              </p>
              <Link
                href="/auth"
                className="mt-6 inline-flex min-h-[48px] items-center rounded-full bg-ink px-6 text-[14.5px] font-medium text-canvas transition-all duration-snap hover:opacity-85 active:scale-95"
              >
                Get started — it is free
              </Link>
            </div>
          </div>
        </article>

        {more.length > 0 ? (
          <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-6 sm:pb-24 lg:px-8">
            <h2 className="border-t border-line pt-8 font-sans text-[15px] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
              Keep reading
            </h2>
            <div className="mt-8 grid gap-x-7 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {more.map((item) => (
                <PostCard key={item.slug} post={item} />
              ))}
            </div>
          </section>
        ) : null}
      </main>

      <ParallaxFooter />
    </div>
  );
}
