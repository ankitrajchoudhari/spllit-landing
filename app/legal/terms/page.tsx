import type { Metadata } from 'next';

import { LegalDocument } from '@/components/shared/legal-document';
import { LegalFooter } from '@/components/shared/legal-footer';
import { TERMS } from '@/content/legal';

export const metadata: Metadata = {
  title: 'Terms of Service',
  alternates: { canonical: '/legal/terms' },
  description: 'The terms that govern your use of Spllit.',
};

export default function TermsPage() {
  return (
    <main className="px-4 py-10 sm:px-6">
      <LegalDocument
        title="Terms of Service"
        intro="Spllit connects students travelling the same way. These terms explain what we do, what we don't, and what each of us is responsible for."
        sections={TERMS}
      />
      <LegalFooter className="mx-auto mt-12 max-w-2xl border-t border-line pt-6" />
    </main>
  );
}
