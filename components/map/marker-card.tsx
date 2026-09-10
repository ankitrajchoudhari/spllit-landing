'use client';

import { motion } from 'motion/react';
import { Crown, Flag, User } from 'lucide-react';

import { cn } from '@/lib/utils';
import { LAYERS } from '@/lib/map/config';
import type { MapEntity, MarkerKind } from '@/lib/map/types';

/**
 * Card-style map marker — not a default Mapbox pin. Rendered into a detached
 * DOM node by the marker factory and mounted as a mapboxgl.Marker.
 */
/**
 * Marker vocabulary from the squad spec.
 *
 * Colour alone is not enough — around 8% of men cannot reliably separate the
 * green member pin from the red meeting flag — so each kind carries a distinct
 * glyph as well.
 */
const MARKER_STYLE: Record<
  Exclude<MarkerKind, 'pin'>,
  { accent: string; Icon: typeof Crown; label: string }
> = {
  leader: { accent: 'var(--brand)', Icon: Crown, label: 'Squad leader' },
  member: { accent: 'var(--brand)', Icon: User, label: 'Member' },
  guest: { accent: '#8b918e', Icon: User, label: 'Guest' },
  meeting: { accent: '#e5484d', Icon: Flag, label: 'Meeting point' },
  destination: { accent: '#2979ff', Icon: Flag, label: 'Destination' },
};

/** Flag-shaped markers point at a spot, so they anchor at their tip. */
function PlaceFlag({ kind, title }: { kind: 'meeting' | 'destination'; title: string }) {
  const style = MARKER_STYLE[kind];
  return (
    <div className="flex flex-col items-center" title={`${style.label}: ${title}`}>
      <span
        className="flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-white shadow-float"
        style={{ backgroundColor: style.accent }}
      >
        <style.Icon className="h-4 w-4 text-white" strokeWidth={2.4} />
      </span>
      {/* Stem: the marker names a point, not the area under a circle. */}
      <span
        aria-hidden
        className="h-3 w-[2px] rounded-b-full"
        style={{ backgroundColor: style.accent }}
      />
    </div>
  );
}

export function MarkerCard({
  entity,
  selected,
  onSelect,
}: {
  entity: MapEntity;
  selected: boolean;
  onSelect: () => void;
}) {
  const kind = entity.marker ?? 'pin';

  if (kind === 'meeting' || kind === 'destination') {
    return <PlaceFlag kind={kind} title={entity.title} />;
  }

  const style = kind === 'pin' ? null : MARKER_STYLE[kind];
  const accent = entity.accent ?? style?.accent ?? LAYERS[entity.layer].color;

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10, scale: 0.86 }}
      animate={{ opacity: 1, y: 0, scale: selected ? 1.04 : 1 }}
      exit={{ opacity: 0, scale: 0.86 }}
      transition={{ type: 'spring', stiffness: 480, damping: 30 }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={cn(
        'group flex max-w-[190px] items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3',
        'border bg-surface shadow-float backdrop-blur-sm',
        'cursor-pointer transition-colors duration-snap',
        selected ? 'border-brand ring-2 ring-brand/25' : 'border-line hover:border-line-strong',
      )}
      style={{ willChange: 'transform' }}
    >
      <span
        className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold uppercase text-white"
        style={{ backgroundColor: accent }}
      >
        {kind === 'leader' ? (
          <Crown className="h-3.5 w-3.5" strokeWidth={2.6} aria-label="Squad leader" />
        ) : (
          entity.title.charAt(0)
        )}
        {entity.live ? (
          <span
            className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-surface"
            style={{ backgroundColor: 'var(--brand)' }}
          />
        ) : null}
      </span>

      <span className="min-w-0 text-left">
        <span className="block truncate text-[12px] font-semibold leading-tight text-ink">
          {entity.title}
        </span>
        {entity.subtitle ? (
          <span className="block truncate text-[10.5px] leading-tight text-ink-muted">
            {entity.subtitle}
          </span>
        ) : null}
      </span>
    </motion.button>
  );
}

/** The user's own position — a distinct, smaller puck with a heading arrow. */
export function SelfMarker({ heading }: { heading: number | null }) {
  return (
    <div className="relative flex h-4 w-4 items-center justify-center">
      <span className="absolute h-8 w-8 rounded-full bg-accent-muted animate-pulse-ring" />
      <span className="relative h-4 w-4 rounded-full border-[3px] border-white bg-accent shadow-soft" />
      {heading !== null ? (
        <span
          className="absolute -top-2.5 h-0 w-0 border-x-[4px] border-b-[6px] border-x-transparent border-b-accent"
          style={{ transform: `rotate(${heading}deg)`, transformOrigin: '50% 14px' }}
        />
      ) : null}
    </div>
  );
}
