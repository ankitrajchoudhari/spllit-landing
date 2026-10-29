import type { Metadata } from 'next';

import { LegalDocument } from '@/components/shared/legal-document';
import { LegalFooter } from '@/components/shared/legal-footer';
import { PRIVACY } from '@/content/legal';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  alternates: { canonical: '/legal/privacy' },
  description: 'What Spllit collects, what it does not, and who can see it.',
};

export default function PrivacyPage() {
  return (
    <main className="px-4 py-10 sm:px-6">
      <LegalDocument
        title="Privacy Policy"
        intro="What we collect, what we deliberately don't, who can see it, and how to get it back or have it deleted."
        sections={PRIVACY}
      />
      <LegalFooter className="mx-auto mt-12 max-w-2xl border-t border-line pt-6" />
    </main>
  );
}
