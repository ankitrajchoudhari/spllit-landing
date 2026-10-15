import { Plus } from 'lucide-react';

import { FAQ } from '@/content/faq';

/**
 * Questions and answers, visible and marked up from the same list.
 *
 * A disclosure per question, built on <details>. The answers stay in the HTML
 * whether open or shut, so an answer engine reading the page still gets every
 * one of them whole — the reason this used to be plain text — while a person
 * gets a list of questions they can scan and open. No JavaScript: it works
 * before hydration and with scripts off.
 *
 * The first answer starts open, so the section never reads as a wall of closed
 * rows and the shape of an answer is visible before anyone clicks.
 */
export function Faq() {
  return (
    <section id="faq" className="border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-6 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 lg:px-8 lg:py-24">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-[13px] font-semibold uppercase tracking-[0.3em] text-ink-subtle sm:text-[15px]">
            Questions
          </p>
          <h2 className="mt-4 font-sans text-[clamp(1.9rem,4.6vw,3rem)] font-medium leading-[1.04] tracking-[-0.04em] text-ink">
            The things people ask.
          </h2>
          <p className="mt-4 max-w-[34ch] text-[15.5px] leading-relaxed text-ink-muted">
            Anything else, write to{' '}
            <a
              href="mailto:support@spllit.app"
              className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
            >
              support@spllit.app
            </a>
            .
          </p>
        </div>

        <div className="border-t border-line-strong">
          {FAQ.map((item, index) => (
            <details
              key={item.q}
              open={index === 0}
              className="faq-item group border-b border-line-strong"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left sm:py-6 [&::-webkit-details-marker]:hidden">
                <span className="font-sans text-[17px] font-medium leading-snug tracking-[-0.015em] text-ink sm:text-[19px]">
                  {item.q}
                </span>
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line-strong text-ink transition-all duration-sheet group-open:rotate-45 group-open:border-ink group-open:bg-ink group-open:text-canvas"
                >
                  <Plus className="h-4 w-4" />
                </span>
              </summary>
              <p className="max-w-[62ch] pb-6 pr-12 text-[15.5px] leading-relaxed text-ink-muted">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * FAQPage JSON-LD, built from the same array the section renders.
 *
 * Shared source rather than a second copy, so the markup cannot drift from the
 * visible text — which is the condition Google actually enforces, and the one
 * a hand-maintained duplicate quietly breaks a month later.
 */
export function FaqStructuredData() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  return (
    <script
      type="application/ld+json"
      // Built from a constant in the repo, not from anything a user supplied.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
