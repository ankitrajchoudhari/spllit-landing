import type { Metadata } from 'next';

import { LegalDocument } from '@/components/shared/legal-document';
import { LegalFooter } from '@/components/shared/legal-footer';
import { REFUNDS } from '@/content/legal';

export const metadata: Metadata = {
  title: 'Refunds & Cancellations · Spllit',
  description:
    'When the ₹2 matching fee is refunded, when it is not, how carbon coins work, and how to request a refund.',
};

export default function RefundsPage() {
  return (
    <main className="px-4 py-10 sm:px-6">
      <LegalDocument
        title="Refunds & Cancellations"
        intro="Joining a group ride costs a one-time ₹2 matching fee, charged only after the leader approves you. This is exactly when that comes back and when it does not."
        sections={REFUNDS}
      />
      <LegalFooter className="mx-auto mt-12 max-w-2xl border-t border-line pt-6" />
    </main>
  );
}
