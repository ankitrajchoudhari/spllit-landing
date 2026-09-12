'use client';

import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from 'react';

import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANTS: Record<ButtonVariant, string> = {
  // The inset highlight is a single hairline of light along the top edge. It is
  // what stops a filled button on a dark ground reading as a flat rectangle —
  // the detail that separates a considered dark UI from a coloured div.
  primary:
    'bg-brand text-brand-fg hover:bg-brand-hover shadow-[inset_0_1px_0_0_rgb(255_255_255/0.18)]',
  secondary:
    'bg-surface-raised text-ink border border-line hover:border-line-strong hover:bg-surface',
  ghost: 'text-ink-muted hover:bg-surface-raised hover:text-ink',
  danger: 'bg-danger-muted text-danger border border-danger/30 hover:border-danger/60',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs rounded-[6px]',
  md: 'h-9 px-3.5 text-sm rounded-md',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 font-semibold',
        'transition-[background-color,border-color,transform,box-shadow] duration-snap',
        // Keyboard users get a ring; mouse users never see it. An admin console
        // is a keyboard tool, and `outline-none` with nothing in its place is
        // how that stops being true.
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        // A press should be felt. One pixel is enough and survives at any size.
        'active:translate-y-px',
        'disabled:pointer-events-none disabled:opacity-45',
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-9 w-full rounded-md border border-line bg-surface-sunken px-3 text-sm text-ink',
        'transition-colors duration-snap placeholder:text-ink-subtle',
        'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25',
        className,
      )}
      {...props}
    />
  );
}

type BadgeTone = 'neutral' | 'good' | 'warn' | 'bad' | 'info';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken text-ink-muted border-line',
  good: 'bg-brand-muted text-brand border-brand/30',
  warn: 'bg-warning-muted text-warning border-warning/30',
  bad: 'bg-danger-muted text-danger border-danger/30',
  info: 'bg-accent-muted text-accent border-accent/30',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-xl border border-line bg-surface p-5',
        // One hairline of light along the top edge, and a shadow low enough to
        // read as contact rather than elevation. Flat panels on a dark ground
        // are the thing that makes a console look generated rather than built.
        'shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04),0_1px_2px_0_rgb(0_0_0/0.25)]',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {description ? <p className="max-w-2xl text-sm text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/**
 * A single dashboard number.
 *
 * The label sits above the value rather than below it. A column of these is
 * scanned for the one thing the reader is looking for, and that scan runs on
 * the labels — putting the value first makes them read every number to find
 * the right row.
 *
 * ## Sizes exist because not every number matters equally
 *
 * Sixteen identically-weighted boxes is the most common way a console ends up
 * looking machine-made: it tells the reader that total users and open
 * emergencies deserve the same attention, which is never true. `hero` is for the
 * handful you would put on a wall; `compact` is for the supporting numbers that
 * only matter once you are already looking.
 */
type StatSize = 'hero' | 'default' | 'compact';

export function Stat({
  label,
  value,
  sub,
  tone = 'neutral',
  icon,
  size = 'default',
  delta,
  deltaLabel,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: BadgeTone;
  icon?: ReactNode;
  size?: StatSize;
  /**
   * Change against the previous comparable period, as a signed number.
   *
   * Only ever passed where the comparison has actually been computed from real
   * data. A trend arrow that is decoration is worse than no arrow — it is a
   * claim, and people act on it.
   */
  delta?: number;
  /** What the delta is measured against, e.g. "vs last week". */
  deltaLabel?: string;
}) {
  const accent =
    tone === 'bad' ? 'text-danger' : tone === 'warn' ? 'text-warning' : 'text-ink';

  const valueSize =
    size === 'hero'
      ? 'text-[34px] leading-[1.05]'
      : size === 'compact'
        ? 'text-lg leading-tight'
        : 'text-2xl leading-tight';

  const pad = size === 'compact' ? 'p-3.5' : size === 'hero' ? 'p-5' : 'p-4';

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-2 overflow-hidden rounded-xl border border-line bg-surface',
        'shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04)]',
        'transition-colors duration-snap hover:border-line-strong',
        pad,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
          {label}
        </span>
        {icon ? (
          <span className="text-ink-subtle transition-colors duration-snap group-hover:text-ink-muted">
            {icon}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={cn('tabular font-bold tracking-[-0.02em]', valueSize, accent)}>
          {value}
        </span>
        {typeof delta === 'number' && delta !== 0 ? (
          <span
            className={cn(
              'tabular text-xs font-semibold',
              delta > 0 ? 'text-brand' : 'text-danger',
            )}
            title={deltaLabel}
          >
            {delta > 0 ? '+' : ''}
            {delta}%
          </span>
        ) : null}
      </div>

      {sub ? <span className="text-xs leading-snug text-ink-muted">{sub}</span> : null}
    </div>
  );
}

/**
 * A labelled rule across the top of a group.
 *
 * The rule is the point. A bare caps label floating above a grid leaves the
 * reader to infer where the group ends; a line that runs to the edge says it.
 */
export function SectionHeader({
  title,
  aside,
}: {
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-subtle">
        {title}
      </h2>
      <span className="h-px flex-1 bg-line" aria-hidden />
      {aside ? <span className="shrink-0 text-xs text-ink-muted">{aside}</span> : null}
    </div>
  );
}

/**
 * A trend line, drawn from real points.
 *
 * An SVG polyline rather than a chart library: this is one series with no axes,
 * no legend and no interaction, and pulling in a charting dependency for it
 * would cost more bytes than the whole page.
 *
 * Deliberately renders nothing below two points — a "trend" through one value
 * is a straight line that says something the data does not.
 */
export function Sparkline({
  points,
  className,
}: {
  points: number[];
  className?: string;
}) {
  if (points.length < 2) return null;

  const peak = Math.max(...points, 1);
  const floor = Math.min(...points, 0);
  const span = peak - floor || 1;

  const path = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 100;
      // SVG y grows downward, so the value is inverted to point up.
      const y = 100 - ((point - floor) / span) * 100;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg
      viewBox="0 0 100 100"
      // Stretched to its container; without this the line renders at whatever
      // aspect the viewBox implies and ignores the height it was given.
      preserveAspectRatio="none"
      className={cn('h-full w-full', className)}
      aria-hidden
    >
      <polyline
        points={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        // Stroke scales with the viewBox otherwise, so a stretched sparkline
        // ends up with a thick horizontal and a hairline vertical.
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
