'use client';

import { motion } from 'motion/react';
import { Car, KeyRound, Receipt, ShoppingBag } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const reveal = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

/**
 * Feature rows. The "visual" for each is built from the same primitives the
 * product uses, so what you see here is the real component vocabulary rather
 * than an illustration of it.
 */
function FeatureRow({
  id,
  eyebrow,
  title,
  body,
  visual,
  flip,
}: {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  visual: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <motion.div
      id={id}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      transition={{ staggerChildren: 0.1 }}
      className={cn(
        'grid items-center gap-7 py-10 sm:gap-9 sm:py-14 lg:grid-cols-2 lg:gap-20 lg:py-20',
        flip && 'lg:[&>*:first-child]:order-2',
      )}
    >
      <motion.div variants={reveal} transition={{ duration: 0.5 }}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand">
          {eyebrow}
        </p>
        <h3 className="mt-3 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-semibold leading-tight tracking-[-0.025em] text-ink">
          {title}
        </h3>
        <p className="mt-4 max-w-md text-[15.5px] leading-relaxed text-ink-muted">{body}</p>
      </motion.div>

      <motion.div variants={reveal} transition={{ duration: 0.5, delay: 0.1 }}>
        {visual}
      </motion.div>
    </motion.div>
  );
}

function RideVisual() {
  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-raised">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-muted text-brand">
            <Car className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">Airport T1</p>
            <p className="text-xs text-ink-muted">Leaving in 18 min · 2 seats</p>
          </div>
        </div>
        <Badge tone="live">Live</Badge>
      </div>

      {/* Route rail */}
      <div className="mt-5 flex gap-3">
        <div className="flex flex-col items-center pt-1">
          <span className="h-2 w-2 rounded-full bg-accent" />
          <span className="my-1 w-px flex-1 bg-line-strong" />
          <span className="h-2 w-2 rounded-full bg-brand" />
        </div>
        <div className="flex-1 space-y-4 text-[13px]">
          <p className="text-ink">Taramani Gate</p>
          <p className="text-ink">Chennai Intl. Airport</p>
        </div>
        <div className="space-y-4 text-right text-[13px] tabular-nums text-ink-muted">
          <p>now</p>
          <p>42 min</p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
        <span className="text-[13px] text-ink-muted">Your share</span>
        <span className="font-display text-lg font-semibold text-ink">₹210</span>
      </div>
    </div>
  );
}

function SquadVisual() {
  const members = [
    { name: 'Meera', eta: '4 min', at: true },
    { name: 'Arun', eta: '11 min', at: false },
    { name: 'Dev', eta: '12 min', at: false },
    { name: 'Sana', eta: 'arrived', at: true },
  ];

  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-raised">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">Friday Studio Session</p>
          <p className="text-xs text-ink-muted">Meeting at Central Library steps</p>
        </div>
        <Badge tone="accent">4 going</Badge>
      </div>

      <ul className="mt-5 space-y-3">
        {members.map((member) => (
          <li key={member.name} className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-sunken text-[11px] font-semibold text-ink-muted ring-1 ring-line">
              {member.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="flex-1 text-[13px] text-ink">{member.name}</span>
            <span
              className={cn(
                'text-[12px] tabular-nums',
                member.at ? 'text-brand' : 'text-ink-muted',
              )}
            >
              {member.eta}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EventVisual() {
  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-raised">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-base font-semibold text-ink">Open Mic · Quad</p>
          <p className="mt-1 text-[13px] text-ink-muted">
            Tonight, 8:00 PM · Open to all campuses
          </p>
        </div>
        <div className="shrink-0 rounded-md bg-warning-muted px-2.5 py-1.5 text-center">
          <p className="font-display text-base font-bold leading-none text-warning">3h</p>
          <p className="mt-0.5 text-[9px] uppercase tracking-wide text-warning">to go</p>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3 border-t border-line pt-4">
        <div className="flex -space-x-2">
          {['A', 'R', 'K', 'M'].map((letter) => (
            <span
              key={letter}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-sunken text-[10px] font-semibold text-ink-muted ring-2 ring-surface"
            >
              {letter}
            </span>
          ))}
        </div>
        <span className="text-[13px] text-ink-muted">64 going</span>
      </div>
    </div>
  );
}

const SOON = [
  {
    icon: KeyRound,
    title: 'Rentals',
    body: 'Borrow a bike, a camera, a projector — from people on your campus.',
  },
  {
    icon: Receipt,
    title: 'Bill Splitting',
    body: 'One running balance per person across every ride, rental and dinner.',
  },
  {
    icon: ShoppingBag,
    title: 'Marketplace',
    body: 'Buy and sell inside your campus, with mapped pickup points.',
  },
];

export function Features() {
  return (
    <div className="mx-auto max-w-6xl px-5 lg:px-8">
      <FeatureRow
        id="rides"
        eyebrow="Ride Together"
        title="The cab you're already taking, shared."
        body="Post where you're going or find someone already headed there. Watch them approach on the map, split the fare automatically, and never negotiate in a group chat again."
        visual={<RideVisual />}
      />

      <FeatureRow
        id="squads"
        eyebrow="Group Rides"
        title="Everyone converging on one point."
        body="A group ride is a group with a place and a time. Set the meeting point once and every member sees where the others are and how long they'll be — live, without asking."
        visual={<SquadVisual />}
        flip
      />

      <FeatureRow
        id="events"
        eyebrow="Events & Communities"
        title="What's happening, actually near you."
        body="Events plot on the same map as everything else, with live attendance. Communities give each campus its own channels for placements, internships and everything in between."
        visual={<EventVisual />}
      />

      {/* Coming soon — deliberately quieter than the shipped features. */}
      <section id="soon" className="border-t border-line py-12 sm:py-16 lg:py-20">
        <div className="flex items-baseline gap-3">
          <h3 className="font-display text-xl font-semibold tracking-[-0.02em] text-ink">
            Next on the map
          </h3>
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">
            Coming soon
          </span>
        </div>

        <div className="mt-7 grid gap-3 sm:mt-8 sm:grid-cols-3 sm:gap-4">
          {SOON.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                className="rounded-lg border border-dashed border-line bg-surface-sunken p-5"
              >
                <Icon className="h-[18px] w-[18px] text-ink-subtle" />
                <p className="mt-4 text-sm font-semibold text-ink-muted">{item.title}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-subtle">
                  {item.body}
                </p>
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
