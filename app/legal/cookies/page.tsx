import type { Metadata } from 'next';

import { LegalDocument } from '@/components/shared/legal-document';
import { LegalFooter } from '@/components/shared/legal-footer';
import { COOKIES } from '@/content/legal';

export const metadata: Metadata = {
  title: 'Cookies',
  alternates: { canonical: '/legal/cookies' },
  description:
    'Every cookie and local-storage key Spllit sets, what each is for, and how to turn off the optional ones.',
};

export default function CookiesPage() {
  return (
    <main className="px-4 py-10 sm:px-6">
      <LegalDocument
        title="Cookies & local storage"
        intro="No advertising cookies, no cross-site trackers, no marketing pixels. This is the full list of what Spllit does store, and why."
        sections={COOKIES}
      />
      <LegalFooter className="mx-auto mt-12 max-w-2xl border-t border-line pt-6" />
    </main>
  );
}
