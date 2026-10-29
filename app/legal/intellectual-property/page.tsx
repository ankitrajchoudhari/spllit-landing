import type { Metadata } from 'next';

import { LegalDocument } from '@/components/shared/legal-document';
import { LegalFooter } from '@/components/shared/legal-footer';
import { INTELLECTUAL_PROPERTY } from '@/content/legal';

export const metadata: Metadata = {
  title: 'Intellectual Property',
  alternates: { canonical: '/legal/intellectual-property' },
  description:
    'Copyright and trade mark ownership, what you may and may not do with Spllit, the licence you grant over your own content, and how to report infringement.',
};

export default function IntellectualPropertyPage() {
  return (
    <main className="px-4 py-10 sm:px-6">
      <LegalDocument
        title="Intellectual Property"
        intro="Who owns what: our software and marks, your content, and the narrow licence each side grants the other."
        sections={INTELLECTUAL_PROPERTY}
      />
      <LegalFooter className="mx-auto mt-12 max-w-2xl border-t border-line pt-6" />
    </main>
  );
}
