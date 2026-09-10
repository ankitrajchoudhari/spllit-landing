import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';

import { LegalFooter } from '@/components/shared/legal-footer';
import { LEGAL_UPDATED } from '@/content/legal';

export const metadata: Metadata = {
  title: 'Legal · Spllit',
  description:
    'Spllit’s terms of service, privacy policy, safety guidance, refunds and cancellations, cookie policy and intellectual property notice.',
};

/**
 * `/legal` used to 308 straight to `/legal/terms`, which made every document
 * other than Terms reachable only by typing its URL. Six of them now exist, so
 * the shelf is the page and the redirect is gone.
 */
const DOCUMENTS = [
  {
    href: '/legal/terms',
    title: 'Terms of Service',
    blurb: 'What Spllit does, what it does not, and what each of us is responsible for.',
  },
  {
    href: '/legal/privacy',
    title: 'Privacy Policy',
    blurb: 'Every category of data we hold, why we are allowed to hold it, how long for, and your rights under the DPDP Act 2023.',
  },
  {
    href: '/legal/safety',
    title: 'Safety',
    blurb: 'What we verify and what we do not, how to travel safely, and how to report harassment.',
  },
  {
    href: '/legal/refunds',
    title: 'Refunds & Cancellations',
    blurb: 'When the ₹2 matching fee comes back, when it does not, and how carbon coins work.',
  },
  {
    href: '/legal/cookies',
    title: 'Cookies & local storage',
    blurb: 'Every key we set and what each is for. No advertising cookies, no cross-site trackers.',
  },
  {
    href: '/legal/intellectual-property',
    title: 'Intellectual Property',
    blurb: 'Copyright and trade marks, the licence you grant over your content, and how to report infringement.',
  },
] as const;

export default function LegalIndexPage() {
  return (
    <main className="px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl pb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>

        <h1 className="mt-4 font-display text-[30px] font-semibold tracking-[-0.03em] text-ink">
          Legal
        </h1>
        <p className="mt-1 text-[12.5px] text-ink-subtle">Last updated {LEGAL_UPDATED}</p>
        <p className="mt-4 text-[14px] leading-relaxed text-ink-muted">
          Written against what Spllit actually does today, in plain language, rather
          than assembled from a template. If a document here disagrees with the app,
          the document is the bug — tell us.
        </p>

        <ul className="mt-8 space-y-3">
          {DOCUMENTS.map((doc) => (
            <li key={doc.href}>
              <Link
                href={doc.href}
                className="group flex items-start gap-4 rounded-xl border border-line bg-surface px-4 py-3.5 transition-colors duration-snap hover:border-brand hover:bg-brand-muted"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[15px] font-semibold tracking-[-0.01em] text-ink">
                    {doc.title}
                  </span>
                  <span className="mt-1 block text-[13px] leading-relaxed text-ink-muted">
                    {doc.blurb}
                  </span>
                </span>
                <ArrowRight
                  aria-hidden
                  className="mt-1 h-4 w-4 shrink-0 text-ink-subtle transition-transform duration-snap group-hover:translate-x-0.5 group-hover:text-brand"
                />
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-10 rounded-lg border border-dashed border-line px-4 py-3 text-[12.5px] leading-relaxed text-ink-subtle">
          Questions, a data request, or a complaint: spllittech@gmail.com. Grievance
          Officer contact details are in the Terms and the Privacy Policy.
        </p>
      </div>

      <LegalFooter className="mx-auto mt-12 max-w-2xl border-t border-line pt-6" />
    </main>
  );
}
