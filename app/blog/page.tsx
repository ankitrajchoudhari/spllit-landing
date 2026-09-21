import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { BLOG_POSTS } from '@/content/blog';
import { SITE } from '@/content/site';
import { LegalFooter } from '@/components/shared/legal-footer';

export const metadata: Metadata = {
  title: 'Blog — Campus travel, fare splitting and safety',
  description:
    'Practical guides on sharing rides between students: how to split a cab fare fairly, staying safe carpooling with classmates, and how travel group rides work.',
  alternates: { canonical: '/blog' },
  openGraph: {
    title: 'Spllit Blog — Campus travel, fare splitting and safety',
    description: 'Practical guides on sharing rides and splitting fares between students.',
    url: `${SITE.url}/blog`,
  },
};

export default function BlogIndexPage() {
  return (
    <main className="px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-[13px] font-medium text-ink-muted transition-colors hover:text-ink"
        >
          ← Back
        </Link>

        <h1 className="mt-6 font-display text-[32px] font-semibold tracking-[-0.035em] text-ink">
          Guides
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
          How to split a fare without an argument, how to stay safe travelling with
          people you have not met, and how group rides actually work.
        </p>

        <ul className="mt-10 space-y-3">
          {BLOG_POSTS.map((post) => (
            <li key={post.slug}>
              <Link
                href={`/blog/${post.slug}`}
                className="block rounded-xl border border-line bg-surface p-5 shadow-soft transition-all duration-snap hover:-translate-y-px hover:shadow-raised"
              >
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-subtle">
                  <time dateTime={post.publishedAt}>
                    {new Date(post.publishedAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </time>
                  <span aria-hidden>·</span>
                  <span>{post.readingMinutes} min read</span>
                </div>

                <h2 className="mt-2 font-display text-[18px] font-semibold leading-snug tracking-[-0.02em] text-ink">
                  {post.title}
                </h2>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">
                  {post.excerpt}
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-brand">
                  Read
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <LegalFooter className="mt-14 border-t border-line pt-6" />
      </div>
    </main>
  );
}
