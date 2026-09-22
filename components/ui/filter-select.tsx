'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * A filter control that does not fall apart at scale.
 *
 * This replaces two earlier attempts, and it is worth recording why both
 * failed. A native <select> behaved perfectly and looked like a browser
 * default dropped into a designed page. A row of chips looked right and was
 * fine for four options — but it renders every option it is given, so a
 * hundred locations became a hundred buttons and a wall of wrapping pills.
 *
 * So: a styled trigger that shows the current choice, and a popover that holds
 * the list however long it gets. The search field appears only once the list is
 * long enough to need it — a search box over five options is furniture.
 */

/** Above this many options, scanning stops working and you need to type. */
const SEARCHABLE_FROM = 8;

export function FilterSelect({
  label,
  value,
  options,
  allLabel = 'All',
  onChange,
  className,
}: {
  label: string;
  value: string;
  options: string[];
  allLabel?: string;
  onChange: (next: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const searchable = options.length >= SEARCHABLE_FROM;

  const matches = useMemo(() => {
    const all = [allLabel, ...options];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((option) => option.toLowerCase().includes(q));
  }, [allLabel, options, query]);

  /** Closing always discards the search, so reopening starts from the whole list. */
  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  // Close on a click anywhere else, and on Escape. Both are what people
  // already expect from a menu; neither is free on a div.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  useEffect(() => {
    if (open && searchable) searchRef.current?.focus();
  }, [open, searchable]);

  const active = value !== allLabel;

  return (
    <div ref={rootRef} className={cn('relative min-w-0', className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        {label}
      </p>

      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'mt-2.5 flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-full border px-4',
          'text-[14px] font-medium transition-all duration-snap active:scale-[0.99]',
          active
            ? 'border-ink bg-ink text-canvas shadow-soft'
            : 'border-line bg-surface text-ink hover:border-line-strong',
        )}
      >
        <span className="truncate">{value}</span>
        <span className="flex shrink-0 items-center gap-1">
          {active ? (
            // Clearing is the most common next action once a filter is set, so
            // it lives on the control rather than in a separate "clear all".
            <span
              role="button"
              tabIndex={0}
              aria-label={`Clear ${label} filter`}
              onClick={(e) => {
                e.stopPropagation();
                onChange(allLabel);
                close();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(allLabel);
                  close();
                }
              }}
              className="-mr-0.5 rounded-full p-0.5 opacity-70 transition-opacity hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </span>
          ) : null}
          <ChevronDown
            className={cn('h-4 w-4 transition-transform duration-snap', open && 'rotate-180')}
            aria-hidden
          />
        </span>
      </button>

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-label={label}
          className={cn(
            'absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-2xl border border-line',
            'bg-surface shadow-float',
          )}
        >
          {searchable ? (
            <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
              <Search className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}`}
                className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-subtle"
              />
            </div>
          ) : null}

          {/* Capped height so a long list scrolls inside the popover instead of
              running off the bottom of the page. */}
          <ul className="max-h-[264px] overflow-y-auto py-1">
            {matches.length === 0 ? (
              <li className="px-4 py-3 text-[13.5px] text-ink-subtle">No matches.</li>
            ) : (
              matches.map((option) => {
                const selected = option === value;
                return (
                  <li key={option}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onChange(option);
                        close();
                      }}
                      className={cn(
                        'flex min-h-[44px] w-full items-center justify-between gap-3 px-4 text-left',
                        'text-[14px] transition-colors duration-snap',
                        selected
                          ? 'font-medium text-ink'
                          : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
                      )}
                    >
                      <span className="truncate">{option}</span>
                      {selected ? (
                        <Check className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
