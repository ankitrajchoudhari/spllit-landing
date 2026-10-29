'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { formatCount } from '@/lib/utils';

/**
 * A curved line chart with real axes, drawn in SVG.
 *
 * Still no chart library, for the same reason as before: a dependency would be
 * the largest thing in the bundle. What changed is that this one carries its
 * own scale — a labelled y-axis on round numbers, dated x-axis ticks, gridlines
 * and a hover read-out — so every height on it can be read, not guessed.
 *
 * The "depth" is shading only: a gradient under each curve and a soft shadow
 * beneath the line. The geometry stays flat on purpose; a perspective-tilted
 * axis makes bars and points at the back read smaller than they are.
 *
 * The curve is monotone (Fritsch–Carlson), so it never swings below zero or
 * above a peak between two points — a smooth line that invented a dip would
 * be decoration lying about the data.
 */

export interface CurveSeries {
  key: string;
  label: string;
  /** Any CSS colour. */
  color: string;
  values: number[];
}

interface CurveChartProps {
  /** One label per point, shared by every series. */
  labels: string[];
  series: CurveSeries[];
  height?: number;
  /** Long form of a label for the hover read-out, e.g. a full date. */
  describe?: (index: number) => string;
  /** Short label printed under the x-axis. */
  tickLabel?: (index: number) => string;
  /** Shading under the curves. Off for crowded comparisons. */
  area?: boolean;
}

const PAD = { top: 16, right: 16, bottom: 28, left: 44 };

/** Round axis maximum and ticks: 0, 5, 10, 15, 20 rather than 0, 4.75, 9.5… */
function niceScale(peak: number, count = 4): { max: number; ticks: number[] } {
  if (peak <= 0)
    return {
      max: count,
      ticks: Array.from({ length: count + 1 }, (_, i) => i),
    };
  const rough = peak / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? rough;
  // Whole-number data never wants a 0.5 tick.
  const whole = Math.max(step, 1);
  const max = Math.ceil(peak / whole) * whole;
  const ticks: number[] = [];
  for (let t = 0; t <= max + whole / 2; t += whole) ticks.push(t);
  return { max, ticks };
}

/** SVG path through the points as a monotone cubic curve. */
function monotonePath(points: [number, number][]): string {
  const n = points.length;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  // Indexes below are always in range; this only satisfies the strict index type.
  const at = (list: number[], i: number) => list[i] ?? 0;

  if (n === 0) return '';
  if (n === 1) return `M${at(xs, 0)},${at(ys, 0)}`;

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx.push(at(xs, i + 1) - at(xs, i));
    slope.push((at(ys, i + 1) - at(ys, i)) / at(dx, i));
  }

  const tangent: number[] = [at(slope, 0)];
  for (let i = 1; i < n - 1; i += 1) {
    const before = at(slope, i - 1);
    const after = at(slope, i);
    tangent.push(before * after <= 0 ? 0 : (before + after) / 2);
  }
  tangent.push(at(slope, n - 2));

  for (let i = 0; i < n - 1; i += 1) {
    const s = at(slope, i);
    if (s === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = at(tangent, i) / s;
    const b = at(tangent, i + 1) / s;
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      tangent[i] = t * a * s;
      tangent[i + 1] = t * b * s;
    }
  }

  let d = `M${at(xs, 0)},${at(ys, 0)}`;
  for (let i = 0; i < n - 1; i += 1) {
    const third = at(dx, i) / 3;
    const c1 = `${at(xs, i) + third},${at(ys, i) + at(tangent, i) * third}`;
    const c2 = `${at(xs, i + 1) - third},${at(ys, i + 1) - at(tangent, i + 1) * third}`;
    d += ` C${c1} ${c2} ${at(xs, i + 1)},${at(ys, i + 1)}`;
  }
  return d;
}

/** Width of the element, kept current as the layout changes. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export function CurveChart({
  labels,
  series,
  height = 220,
  describe = (i) => labels[i] ?? '',
  tickLabel = (i) => labels[i] ?? '',
  area = true,
}: CurveChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const id = useId().replace(/:/g, '');

  const count = labels.length;
  const peak = Math.max(0, ...series.flatMap((s) => s.values));
  const { max, ticks } = niceScale(peak);

  const plotW = Math.max(width - PAD.left - PAD.right, 0);
  const plotH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (count <= 1 ? plotW / 2 : (i / (count - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const baseline = PAD.top + plotH;

  // As many x labels as fit at roughly 64px apart, always including both ends.
  const slots = Math.max(Math.min(Math.floor(plotW / 64), count), 2);
  const tickIndexes =
    count <= slots
      ? labels.map((_, i) => i)
      : Array.from({ length: slots }, (_, k) => Math.round((k / (slots - 1)) * (count - 1)));

  function onMove(event: React.PointerEvent<SVGRectElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    setHover(Math.min(Math.max(Math.round(ratio * (count - 1)), 0), count - 1));
  }

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && count > 0 ? (
        <svg width={width} height={height} className="block overflow-visible" role="img">
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`${id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.38} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
            <filter id={`${id}-shadow`} x="-5%" y="-20%" width="110%" height="160%">
              <feDropShadow dx="0" dy="6" stdDeviation="5" floodOpacity="0.45" />
            </filter>
          </defs>

          {/* Y axis: gridlines on round numbers, each labelled. */}
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={PAD.left + plotW}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--line)"
                strokeDasharray={tick === 0 ? undefined : '3 4'}
              />
              <text
                x={PAD.left - 8}
                y={y(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-ink-subtle tabular text-[10px]"
              >
                {formatCount(tick)}
              </text>
            </g>
          ))}

          {/* X axis ticks and labels. */}
          {tickIndexes.map((i) => (
            <g key={i}>
              <line
                x1={x(i)}
                x2={x(i)}
                y1={baseline}
                y2={baseline + 4}
                stroke="var(--line-strong)"
              />
              <text
                x={x(i)}
                y={baseline + 16}
                textAnchor={i === 0 ? 'start' : i === count - 1 ? 'end' : 'middle'}
                className="fill-ink-subtle text-[10px]"
              >
                {tickLabel(i)}
              </text>
            </g>
          ))}

          {series.map((s) => {
            const points = s.values.map((v, i) => [x(i), y(v)] as [number, number]);
            const line = monotonePath(points);
            return (
              <g key={s.key}>
                {area ? (
                  <path
                    d={`${line} L${x(count - 1)},${baseline} L${x(0)},${baseline} Z`}
                    fill={`url(#${id}-${s.key})`}
                  />
                ) : null}
                <path
                  d={line}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  filter={`url(#${id}-shadow)`}
                />
              </g>
            );
          })}

          {hover !== null ? (
            <g pointerEvents="none">
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={PAD.top}
                y2={baseline}
                stroke="var(--line-strong)"
              />
              {series.map((s) => (
                <circle
                  key={s.key}
                  cx={x(hover)}
                  cy={y(s.values[hover] ?? 0)}
                  r={4.5}
                  fill={s.color}
                  stroke="rgb(var(--surface))"
                  strokeWidth={2}
                />
              ))}
            </g>
          ) : null}

          <rect
            x={PAD.left}
            y={PAD.top}
            width={plotW}
            height={plotH}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      ) : null}

      {hover !== null ? (
        <div
          className="pointer-events-none absolute z-10 min-w-[120px] rounded-md border border-line-strong bg-surface-raised px-2.5 py-2 text-xs shadow-lg"
          style={{
            top: PAD.top,
            left: x(hover),
            transform: `translateX(${x(hover) > width / 2 ? 'calc(-100% - 10px)' : '10px'})`,
          }}
        >
          <p className="mb-1 font-semibold text-ink">{describe(hover)}</p>
          {series.map((s) => (
            <p key={s.key} className="flex items-center justify-between gap-3 text-ink-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="tabular font-semibold text-ink">
                {formatCount(s.values[hover] ?? 0)}
              </span>
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Colours for compared series, readable on the dark and light surfaces. */
export const SERIES_COLORS = {
  brand: 'rgb(var(--brand))',
  accent: 'rgb(var(--accent))',
  warning: 'rgb(var(--warning))',
  danger: 'rgb(var(--danger))',
  violet: '#a77bff',
} as const;
