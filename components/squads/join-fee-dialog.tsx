'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';

import { ApiError } from '@/lib/api/client';
import { squadsService } from '@/lib/services/squads';
import { qk } from '@/lib/hooks/queries';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

/**
 * The join fee, taken after the leader has approved.
 *
 * Razorpay's checkout script is loaded on demand rather than in the document
 * head: it is ~100kB that only matters to a member who has just been approved,
 * which is a small fraction of sessions.
 */
const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadCheckout(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(true), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function JoinFeeDialog({
  squadId,
  squadName,
  open,
  onClose,
}: {
  squadId: string;
  squadName: string;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  const status = useQuery({
    queryKey: ['squad', squadId, 'payment'],
    queryFn: () => squadsService.paymentStatus(squadId),
    enabled: open,
  });

  const pay = useMutation({
    mutationFn: async () => {
      const order = await squadsService.createPaymentOrder(squadId);

      // Already settled — nothing to charge, just unlock.
      if (order.alreadyPaid) return { alreadyPaid: true as const };

      const ready = await loadCheckout();
      if (!ready || !window.Razorpay) {
        throw new Error('Could not load the payment window. Check your connection.');
      }

      /**
       * Resolves only once the server has verified the signature. The checkout
       * callback firing is not proof of payment — Razorpay's response is
       * attacker-controlled until the HMAC is checked with the key secret.
       */
      return new Promise<{ alreadyPaid: false }>((resolve, reject) => {
        const checkout = new window.Razorpay!({
          key: order.keyId,
          order_id: order.orderId,
          amount: order.amountPaise,
          currency: order.currency ?? 'INR',
          name: 'Spllit',
          description: `Join ${order.squadName ?? squadName}`,
          theme: { color: '#00c853' },
          handler: (response: Record<string, string>) => {
            squadsService
              .verifyPayment(squadId, {
                razorpayOrderId: response.razorpay_order_id ?? '',
                razorpayPaymentId: response.razorpay_payment_id ?? '',
                razorpaySignature: response.razorpay_signature ?? '',
              })
              .then(() => resolve({ alreadyPaid: false }))
              .catch(reject);
          },
          modal: {
            // Dismissing the sheet is a cancellation, not a failure — the
            // promise has to settle or the button spins forever.
            ondismiss: () => reject(new Error('Payment cancelled.')),
          },
        });
        checkout.open();
      });
    },
    onSuccess: () => {
      setError(null);
      setPaid(true);
      // Chat, calling and navigation all key off membership, so it is re-read.
      void qc.invalidateQueries({ queryKey: qk.squad(squadId) });
      void qc.invalidateQueries({ queryKey: ['squad', squadId, 'payment'] });
      void qc.invalidateQueries({ queryKey: ['chat', 'resolve', 'squad', squadId] });
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Payment failed.',
      );
    },
  });

  const unavailable = status.data && !status.data.configured;

  if (paid) {
    return (
      <ConfirmDialog
        open={open}
        onClose={onClose}
        onConfirm={onClose}
        eyebrow="Payment received"
        title={`You're in ${squadName}`}
        description="Chat, calling and navigation are unlocked. See you at the meeting point."
        details={[
          {
            label: 'Now available',
            items: ['Group chat with the group ride', 'Live location and ETAs', 'Navigation to the meeting point'],
          },
        ]}
        confirmLabel="Open the group ride"
        cancelLabel="Close"
      />
    );
  }

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={() => (unavailable ? onClose() : pay.mutate())}
      eyebrow="Join fee"
      title={`₹2 to join ${squadName}`}
      description={
        unavailable
          ? 'Payments are not switched on for this environment yet, so joining is unavailable. Nothing has been charged.'
          : 'The leader approved you. A one-time ₹2 matching fee unlocks the group chat, calling and navigation for this trip.'
      }
      details={
        unavailable
          ? undefined
          : [
              {
                label: 'What it unlocks',
                items: [
                  'Group chat with everyone travelling',
                  'Live location and everyone’s ETA',
                  'Navigation to the meeting point',
                ],
              },
              {
                label: 'Before you pay',
                items: [
                  'Cancelling after this is not refunded — the leader has held you a seat',
                  'Nothing is charged if you close this window',
                ],
              },
            ]
      }
      confirmLabel={unavailable ? 'Close' : 'Pay ₹2'}
      cancelLabel={unavailable ? 'Back' : 'Not now'}
      loading={pay.isPending}
      error={error}
    />
  );
}

/** Small reassurance line for the squad page while a fee is outstanding. */
export function JoinFeeNotice({ onPay }: { onPay: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand/30 bg-brand-muted px-4 py-3">
      <ShieldCheck className="h-4 w-4 shrink-0 text-brand" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-ink">You&apos;re approved — ₹2 to unlock</p>
        <p className="text-[12.5px] text-ink-muted">
          Chat, calling and navigation open once the matching fee is paid.
        </p>
      </div>
      <button
        type="button"
        onClick={onPay}
        className="shrink-0 rounded-full bg-brand px-4 py-1.5 text-[13px] font-semibold text-brand-fg transition-opacity hover:opacity-90"
      >
        Pay ₹2
      </button>
    </div>
  );
}
