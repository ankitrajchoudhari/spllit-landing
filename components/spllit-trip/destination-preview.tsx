'use client';

import { useId, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

import { cn } from '@/lib/utils';
import { PhoneFrame, Print, Ticket } from '@/components/spllit-trip/ticket';

/**
 * One destination, everything around it — the screen Spllit Trip is built on.
 *
 * Every figure here is an example; the screen's header says "Sample". Anything
 * with a price is a small ticket with the fare on its stub, so the page reads
 * as one piece of travel paper rather than a stack of cards.
 */

type Tab = 'people' | 'trips' | 'stays' | 'do' | 'discover';

const TABS: { id: Tab; label: string }[] = [
  { id: 'people', label: 'People' },
  { id: 'trips', label: 'Trips' },
  { id: 'stays', label: 'Stays' },
  { id: 'do', label: 'Do' },
  { id: 'discover', label: 'Discover' },
];

const INITIALS = ['AR', 'MK', 'SP', 'NV'];

function Faces({ count }: { count: number }) {
  return (
    <div className="flex -space-x-2">
      {INITIALS.slice(0, count).map((initials, i) => (
        <span
          key={initials}
          className={cn(
            'grid h-8 w-8 place-items-center rounded-full border-2 border-trip-card font-mono text-[9.5px] font-semibold',
            i % 2 === 0 ? 'bg-trip text-white' : 'bg-ink text-canvas',
          )}
        >
          {initials}
        </span>
      ))}
    </div>
  );
}

/** A small ticket: what it is on the left, the fare on the stub. */
function FareTicket({
  title,
  meta,
  amount,
  per,
  children,
}: {
  title: string;
  meta: string;
  amount: string;
  per: string;
  children?: React.ReactNode;
}) {
  return (
    <Ticket
      stubSize={82}
      radius={12}
      hole={6}
      lift={false}
      bodyClassName="px-3.5 py-3"
      stub={
        <div className="flex h-full flex-col items-center justify-center px-1 text-center">
          <p className="font-serif text-[22px] leading-none">{amount}</p>
          <Print className="mt-1 text-[9px]">{per}</Print>
        </div>
      }
    >
      <p className="text-[14px] font-semibold leading-snug text-ink">{title}</p>
      <p className="mt-0.5 font-mono text-[11px] text-ink-muted">{meta}</p>
      {children}
    </Ticket>
  );
}

function Filled({ filled, total, label }: { filled: number; total: number; label: string }) {
  return (
    <div className="mt-2.5 flex items-center gap-2">
      <span className="h-1 flex-1 overflow-hidden rounded-full bg-trip-rule" aria-hidden>
        <span className="block h-full rounded-full bg-trip" style={{ width: `${(filled / total) * 100}%` }} />
      </span>
      <Print className="text-[9.5px] opacity-80">{label}</Print>
    </div>
  );
}

function Person({ title, meta, count }: { title: string; meta: string; count?: number }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed border-trip-rule py-3 last:border-b-0">
      <div>
        <p className="text-[14px] font-semibold text-ink">{title}</p>
        <p className="mt-0.5 font-mono text-[11px] text-ink-muted">{meta}</p>
      </div>
      {count ? <Faces count={count} /> : null}
    </div>
  );
}

function Panel({ tab }: { tab: Tab }) {
  switch (tab) {
    case 'people':
      return (
        <div className="rounded-[14px] bg-trip-card px-4">
          <Person title="4 going on 15 Oct" meta="Leaving from Chennai" count={4} />
          <Person title="3 looking for company" meta="Same dates, same budget" count={3} />
          <Person title="2 groups need 2 more" meta="Two more and the villa is theirs" />
        </div>
      );
    case 'trips':
      return (
        <div className="space-y-2.5">
          <FareTicket title="Backpacker Goa" meta="3N / 4D · bus included" amount="₹8,499" per="per head">
            <Filled filled={16} total={24} label="16/24" />
          </FareTicket>
          <FareTicket
            title="North Goa weekender"
            meta="2N · started by students"
            amount="₹5,900"
            per="per head"
          >
            <Filled filled={7} total={10} label="7/10" />
          </FareTicket>
          <FareTicket title="South Goa, slow" meta="3N · beaches, no clubs" amount="₹6,800" per="per head">
            <Filled filled={11} total={16} label="11/16" />
          </FareTicket>
        </div>
      );
    case 'stays':
      return (
        <div className="space-y-2.5">
          <FareTicket
            title="Private villa, Assagao"
            meta="₹24,000 / night ÷ 8"
            amount="₹3,000"
            per="per head"
          >
            <Filled filled={6} total={8} label="2 beds left" />
          </FareTicket>
          <FareTicket
            title="Homestay near Anjuna"
            meta="Sleeps 4 · 1 spot left"
            amount="₹1,400"
            per="per head"
          />
          <FareTicket title="Hostel, Vagator" meta="Dorm · 6 beds free" amount="₹650" per="per bed" />
        </div>
      );
    case 'do':
      return (
        <div className="space-y-2.5">
          <FareTicket
            title="Scuba, Grande Island"
            meta="Half day · 6 on your dates"
            amount="₹1,999"
            per="each"
          />
          <FareTicket title="Kayaking at sunrise" meta="Chapora river · 2 hrs" amount="₹900" per="each" />
          <FareTicket title="Night market crawl" meta="Saturdays · Arpora" amount="Free" per="entry" />
        </div>
      );
    case 'discover':
      return (
        <div>
          <Print>Saved by people who went before you</Print>
          <ul className="mt-3 rounded-[14px] bg-trip-card px-4">
            {[
              'A hidden café in Fontainhas',
              'The sunset point locals use',
              'A beach with no one on it',
              'Fish thali for ₹180',
              'Chapora fort at 5 pm',
            ].map((place, i) => (
              <li
                key={place}
                className="flex items-center gap-3 border-b border-dashed border-trip-rule py-2.5 text-[13.5px] text-ink last:border-b-0"
              >
                <span className="font-mono text-[10.5px] text-trip">{String(i + 1).padStart(2, '0')}</span>
                {place}
              </li>
            ))}
          </ul>
        </div>
      );
  }
}

export function DestinationPreview() {
  const [tab, setTab] = useState<Tab>('trips');
  const baseId = useId();

  return (
    <PhoneFrame className="mx-auto max-w-[340px]">
      <div className="trip-paper flex h-full flex-col">
        {/* Clear of the Dynamic Island. */}
        <div className="px-5 pb-3 pt-[16%]">
          <div className="flex items-center justify-between">
            <Print>Destination</Print>
            <Print>Sample</Print>
          </div>
          <p className="mt-1.5 font-serif text-[46px] leading-[0.9] text-ink">Goa</p>
          <p className="mt-2.5 font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-muted">
            15–18 Oct · ₹8–12k · from MAS
          </p>
        </div>

        <div
          role="tablist"
          aria-label="What's around Goa"
          className="no-scrollbar flex justify-between gap-3 overflow-x-auto border-y border-trip-rule px-4"
        >
          {TABS.map(({ id, label }) => {
            const active = id === tab;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`${baseId}-${id}-tab`}
                aria-selected={active}
                aria-controls={`${baseId}-panel`}
                onClick={() => setTab(id)}
                className={cn(
                  '-mb-px shrink-0 border-b-2 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.1em] transition-colors duration-snap',
                  active ? 'border-trip text-ink' : 'border-transparent text-ink-subtle hover:text-ink',
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Fixed height so switching tabs never moves the page under a thumb. */}
        <div
          id={`${baseId}-panel`}
          role="tabpanel"
          aria-labelledby={`${baseId}-${tab}-tab`}
          className="min-h-0 flex-1 overflow-hidden px-3 py-3.5"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
            >
              <Panel tab={tab} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </PhoneFrame>
  );
}
