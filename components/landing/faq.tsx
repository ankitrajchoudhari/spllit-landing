import { FAQ } from '@/content/faq';

/**
 * Questions and answers, visible and marked up from the same list.
 *
 * Plain text rather than an accordion. A disclosure would be tidier, but an
 * answer engine reads what it is handed and a person scanning for one fact
 * should not have to open six things to find it. Six short answers cost less
 * page than the control that would hide them.
 */
export function Faq() {
  return (
    <section id="faq" className="border-t border-line">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 sm:py-20 lg:px-8">
        <p className="text-[13px] font-semibold uppercase tracking-[0.3em] text-ink-subtle sm:text-[15px]">
          Questions
        </p>
        <h2 className="mt-4 font-sans text-[clamp(1.9rem,4.6vw,3rem)] font-medium leading-[1.04] tracking-[-0.04em] text-ink">
          The things people ask.
        </h2>

        <dl className="mt-10 grid gap-x-12 gap-y-9 sm:mt-12 lg:grid-cols-2">
          {FAQ.map((item) => (
            <div key={item.q}>
              <dt className="font-sans text-[17px] font-medium leading-snug tracking-[-0.015em] text-ink sm:text-[18px]">
                {item.q}
              </dt>
              <dd className="mt-2.5 max-w-[56ch] text-[15px] leading-relaxed text-ink-muted">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
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
