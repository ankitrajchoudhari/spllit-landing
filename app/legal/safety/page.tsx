import type { Metadata } from 'next';

import { LegalDocument } from '@/components/shared/legal-document';
import { LegalFooter } from '@/components/shared/legal-footer';
import { SAFETY } from '@/content/legal';

export const metadata: Metadata = {
  title: 'Safety',
  alternates: { canonical: '/legal/safety' },
  description:
    'How to travel safely on Spllit: what we verify, what we do not, what to do before and during a journey, and how to report harassment.',
};

export default function SafetyPage() {
  return (
    <main className="px-4 py-10 sm:px-6">
      <LegalDocument
        title="Staying safe on Spllit"
        intro="We verify that you belong to your institute. We do not check licences, vehicles or backgrounds — so this page is what that means in practice, and what to do about it."
        sections={SAFETY}
      />
      <LegalFooter className="mx-auto mt-12 max-w-2xl border-t border-line pt-6" />
    </main>
  );
}
