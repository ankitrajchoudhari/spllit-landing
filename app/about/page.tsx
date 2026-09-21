import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Car, MapPin, ShieldCheck, Users, Wallet } from 'lucide-react';

import { SITE } from '@/content/site';
import { LegalFooter } from '@/components/shared/legal-footer';

export const metadata: Metadata = {
  title: 'About Spllit — Why we built a campus travel network',
  description:
    'Spllit exists because students travelling the same way rarely find each other. Here is what it does, who it is for, and what it deliberately does not do.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About Spllit — Why we built a campus travel network',
    description:
      'Students travelling the same way rarely find each other. Spllit fixes the coordination problem, not the transport.',
    url: `${SITE.url}/about`,
  },
};

const PILLARS = [
  {
    Icon: Users,
    title: 'Group Rides, not group chats',
    body: 'A group ride is a group heading to the same place at the same time — an exam centre, an airport, a match. One meeting point, everyone’s ETA on one map, no "where are you?" thread.',
  },
  {
    Icon: Car,
    title: 'Rides with spare seats',
    body: 'Already driving? Post the route and take someone along. Going alone? Find someone whose route already passes your pickup and your drop.',
  },
  {
    Icon: Wallet,
    title: 'A fare that is agreed upfront',
    body: 'The per-person share is set when the ride is posted, so it is visible before anyone joins. Nothing to negotiate at the destination.',
  },
  {
    Icon: ShieldCheck,
    title: 'Verified campus, not the open internet',
    body: 'Creating or joining anything requires a working institute email, checked against your college’s real domain. It is a smaller pool on purpose.',
  },
];

export default function AboutPage() {
  return (
    <main className="px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-[13px] font-medium text-ink-muted transition-colors hover:text-ink"
        >
          ← Back
        </Link>

        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.08em] text-brand">
          About Spllit
        </p>
        <h1 className="mt-3 font-display text-[34px] font-semibold leading-[1.1] tracking-[-0.035em] text-ink sm:text-[42px]">
          Nobody should pay for a whole cab they are sharing a road with.
        </h1>
        <p className="mt-5 text-[15px] leading-relaxed text-ink-muted">
          Every morning, dozens of students leave the same campus for the same
          places — the same exam centre, the same airport terminal, the same
          station — in separate autos, each paying full fare. Not because they
          want to, but because finding each other is harder than paying the
          extra ₹300.
        </p>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">
          Spllit is the coordination layer for that. We are not a taxi company
          and we do not own a single vehicle. We solve the part that was
          actually broken: knowing who is going your way, and agreeing where to
          meet.
        </p>

        <section className="mt-12">
          <h2 className="font-display text-[22px] font-semibold tracking-[-0.025em] text-ink">
            What it does
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {PILLARS.map(({ Icon, title, body }) => (
              <div
                key={title}
                className="rounded-xl border border-line bg-surface p-5 shadow-soft"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-muted text-brand">
                  <Icon className="h-4 w-4" />
                </span>
                <h3 className="mt-3 text-[15px] font-semibold text-ink">{title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-[22px] font-semibold tracking-[-0.025em] text-ink">
            What it deliberately is not
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
            Being straight about the limits is part of being safe to use.
          </p>
          <ul className="mt-4 space-y-3">
            {[
              'We are not a transport provider. We do not employ drivers, own vehicles, or operate journeys.',
              'We do not vet drivers, inspect vehicles, verify licences or check insurance. We verify that an account holds a working institute email — nothing more.',
              'We do not process payments or take a commission. Money moves directly between the people travelling.',
              'We are not open to the general public. Without a verified campus address you cannot create or join anything.',
            ].map((line) => (
              <li key={line} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-ink-subtle"
                />
                <span className="text-[13.5px] leading-relaxed text-ink-muted">{line}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 rounded-xl border border-line bg-surface p-6 shadow-soft">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-muted text-brand">
            <MapPin className="h-4 w-4" />
          </span>
          <h2 className="mt-3 font-display text-[19px] font-semibold tracking-[-0.02em] text-ink">
            Where we are
          </h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">
            Spllit started at IIT Madras and is rolling out campus by campus
            across India. A network like this is worth nothing at one user and a
            great deal at two hundred, so we open one college at a time rather
            than everywhere at once.
          </p>
          <Link
            href="/auth"
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-[13.5px] font-semibold text-brand-fg transition-opacity hover:opacity-90"
          >
            Join with your campus email
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>

        <LegalFooter className="mt-14 border-t border-line pt-6" />
      </div>
    </main>
  );
}
