import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock, ExternalLink, MapPin, Users } from 'lucide-react';

import { LandingNav } from '@/components/landing/landing-nav';
import { careersService } from '@/lib/services/careers';
import { toEmbedUrl } from '@/lib/google-form';
import { CAREERS_SUPPORT_EMAIL, roleStatus } from '@/content/careers';
import { SITE } from '@/content/site';

/**
 * The application form, on Spllit rather than on Google.
 *
 * Apply used to throw the applicant into a new tab on docs.google.com, which
 * is a jarring place to land from a careers page — an unbranded form with no
 * indication it belongs to the company they just read about, and no way back.
 * The form is the same Google Form; it is framed here instead, under the title
 * of the role being applied for and with a way back to the board.
 *
 * Two things the frame cannot do, so the page says them in words: it cannot
 * tell when the form has been submitted (the iframe is another origin), and it
 * cannot render a form that demands a Google sign-in. Hence the note about the
 * confirmation email, and the link out directly beneath the frame.
 */

export const revalidate = 30;

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const role = await careersService.role(id);
  if (!role) return { title: 'Apply' };
  return {
    title: `Apply · ${role.title}`,
    description: `Apply for ${role.title} at ${SITE.name} — ${role.location}, ${role.type}.`,
    alternates: { canonical: `/careers/${role.id}/apply` },
    // An application form has nothing to offer a search engine, and a stale
    // listing for a role that has closed is worse than none.
    robots: { index: false, follow: true },
  };
}

export default async function ApplyPage({ params }: Params) {
  const { id } = await params;
  const role = await careersService.role(id);

  // A hidden or closed role has no form to fill in. Sending somebody to the
  // board is friendlier than a bare 404, but the URL must not keep working
  // after applications shut — that is how people apply to nothing.
  if (!role || role.draft || roleStatus(role) === 'closed' || !role.applyUrl.trim()) {
    notFound();
  }

  const embedUrl = await toEmbedUrl(role.applyUrl);

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto w-full max-w-[1360px]">
        <LandingNav />
      </div>

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-6 sm:py-14 lg:px-8">
        <Link
          href="/careers"
          className="inline-flex min-h-[44px] items-center gap-2 text-[14px] font-medium text-ink-muted transition-colors duration-snap hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All roles
        </Link>

        <header className="mt-4 border-b border-line pb-7">
          <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
            Applying for
          </p>
          <h1 className="mt-2.5 font-sans text-[clamp(1.75rem,4.4vw,2.6rem)] font-medium leading-[1.05] tracking-[-0.035em] text-ink">
            {role.title}
          </h1>

          <dl className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13.5px] text-ink-muted">
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Team</dt>
              <Users className="h-[15px] w-[15px] shrink-0 text-ink-subtle" aria-hidden />
              <dd>{role.team}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Location</dt>
              <MapPin className="h-[15px] w-[15px] shrink-0 text-ink-subtle" aria-hidden />
              <dd>{role.location}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Commitment</dt>
              <Clock className="h-[15px] w-[15px] shrink-0 text-ink-subtle" aria-hidden />
              <dd>{role.type}</dd>
            </div>
          </dl>

          {/* Said before the form rather than after it, because after it the
              applicant has already gone. */}
          <p className="mt-5 max-w-xl text-[14.5px] leading-relaxed text-ink-muted">
            Fill this in and you are done. A confirmation lands in your inbox from{' '}
            <span className="font-medium text-ink">{CAREERS_SUPPORT_EMAIL}</span> within a minute or
            so — if it does not, check spam before assuming it failed.
          </p>
        </header>

        {embedUrl ? (
          <section className="mt-7">
            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              {/* A cross-origin frame cannot report its content height, so the
                  height is fixed and Google scrolls inside it. 600/760 is
                  Google's own embed size: taller left a long white void under
                  short forms, and there is no height that suits every form. */}
              <iframe
                src={embedUrl}
                title={`Application form for ${role.title}`}
                className="h-[600px] w-full border-0 sm:h-[760px]"
                loading="lazy"
              />
            </div>

            <p className="mt-4 text-[13.5px] text-ink-muted">
              Form not loading, or asking you to sign in?{' '}
              <a
                href={role.applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-ink underline underline-offset-4"
              >
                Open it in a new tab
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            </p>
          </section>
        ) : (
          /* Not a Google Form, or a link that could not be resolved. Rather
             than frame something unknown, hand it over as a link. */
          <section className="mt-7 rounded-2xl border border-line bg-surface p-7 text-center sm:p-9">
            <h2 className="font-sans text-[19px] font-medium tracking-[-0.01em] text-ink">
              The form opens in a new tab
            </h2>
            <p className="mx-auto mt-2.5 max-w-md text-[14.5px] leading-relaxed text-ink-muted">
              This one is hosted somewhere we cannot show inside the page. It is the right form —
              it just opens on its own.
            </p>
            <a
              href={role.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-ink px-6 text-[14.5px] font-medium text-canvas transition-all duration-snap hover:opacity-85 active:scale-95"
            >
              Open the application form
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          </section>
        )}

        <p className="mt-8 border-t border-line pt-6 text-[13.5px] leading-relaxed text-ink-subtle">
          Something wrong with this page? Write to{' '}
          <a
            href={`mailto:${CAREERS_SUPPORT_EMAIL}?subject=${encodeURIComponent(`Applying: ${role.title}`)}`}
            className="font-medium text-ink-muted underline underline-offset-4 hover:text-ink"
          >
            {CAREERS_SUPPORT_EMAIL}
          </a>
          .
        </p>
      </main>
    </div>
  );
}
