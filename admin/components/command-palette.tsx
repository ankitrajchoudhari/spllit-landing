'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CornerDownLeft, Search } from 'lucide-react';

import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/states';

interface SearchItem {
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

interface SearchGroup {
  key: string;
  label: string;
  items: SearchItem[];
}

/**
 * Cmd/Ctrl-K search across every entity Spllit actually has.
 *
 * The query runs on the backend against indexed collections and is capped at
 * five hits per group. Nothing is filtered client-side, and no dataset is
 * downloaded to search through — the palette knows only what it asked for.
 *
 * This outer half owns nothing but "is it open" and the shortcut that toggles
 * it. Everything the search itself needs lives in PaletteDialog below, which
 * is mounted only while open — see the note there.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }
      if (event.key === 'Escape') setOpen(false);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!open) return null;

  return <PaletteDialog onClose={() => setOpen(false)} />;
}

/**
 * The palette proper. Mounted when it opens, unmounted when it closes.
 *
 * That is the whole reason it is a separate component. Previously all of this
 * state lived alongside `open` and survived closing, so opening had to be
 * followed by an effect that blanked the term, the debounced term and the
 * cursor — three setState calls in an effect body, which React flags as
 * cascading renders. State that is created by mounting does not need to be
 * reset by anything: closing throws it away, and the next open starts clean.
 */
function PaletteDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus after paint rather than during the commit, so opening the palette
    // cannot fight the browser for scroll position.
    const id = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, []);

  // Debounced so holding a key does not fire a database query per character.
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(term.trim()), 200);
    return () => window.clearTimeout(id);
  }, [term]);

  const search = useQuery({
    queryKey: ['search', debounced],
    queryFn: () =>
      api<{ query: string; groups: SearchGroup[] }>('/search', { query: { q: debounced } }),
    enabled: debounced.length >= 2,
    staleTime: 15_000,
  });

  // Flattened once so arrow keys can walk across group boundaries.
  const flat = useMemo(
    () => (search.data?.groups ?? []).flatMap((group) => group.items),
    [search.data],
  );

  /**
   * The highlighted row, tagged with the query it was chosen for.
   *
   * Highlighting the first row again whenever the results change used to be an
   * effect on `debounced` that called setCursor(0) — the same cascading-render
   * problem. Storing which query an index belongs to makes that reset
   * derivable instead: an index chosen for a query the user has since typed
   * past no longer matches, so it reads as 0 without anything writing to it.
   */
  const [cursorFor, setCursorFor] = useState({ query: '', index: 0 });
  const cursor = cursorFor.query === debounced ? cursorFor.index : 0;

  /** Always resolves the current index from the committed state, so two moves
   *  in one tick cannot read a stale one. */
  const moveCursor = (update: (current: number) => number) =>
    setCursorFor((previous) => ({
      query: debounced,
      index: update(previous.query === debounced ? previous.index : 0),
    }));

  function go(item: SearchItem) {
    onClose();
    router.push(item.href);
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center bg-black/70 p-4 pt-[12vh]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex w-full max-w-xl flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Search Spllit"
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
          <input
            ref={inputRef}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                moveCursor((current) => Math.min(current + 1, Math.max(flat.length - 1, 0)));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                moveCursor((current) => Math.max(current - 1, 0));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                const item = flat[cursor];
                if (item) go(item);
              }
            }}
            placeholder="Search users, rides, squads, events, communities…"
            aria-label="Search"
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
          />
          <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-ink-subtle">
            ESC
          </kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-2">
          {debounced.length < 2 ? (
            <p className="px-3 py-6 text-center text-sm text-ink-subtle">
              Type at least two characters.
            </p>
          ) : search.isLoading ? (
            <div className="px-3 py-6">
              <Spinner label="Searching" />
            </div>
          ) : search.isError ? (
            <p className="px-3 py-6 text-center text-sm text-danger">
              Search failed. The API did not answer.
            </p>
          ) : flat.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-ink-subtle">
              Nothing matches “{debounced}”.
            </p>
          ) : (
            (search.data?.groups ?? []).map((group) => (
              <div key={group.key} className="mb-2 last:mb-0">
                <p className="px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                  {group.label}
                </p>
                {group.items.map((item) => {
                  const index = flat.findIndex((candidate) => candidate.id === item.id);
                  const active = index === cursor;
                  return (
                    <button
                      key={`${group.key}-${item.id}`}
                      type="button"
                      onMouseEnter={() => moveCursor(() => index)}
                      onClick={() => go(item)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors duration-snap',
                        active ? 'bg-surface-raised' : 'hover:bg-surface-raised',
                      )}
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium text-ink">{item.title}</span>
                        <span className="truncate text-xs text-ink-subtle">{item.subtitle}</span>
                      </span>
                      {active ? (
                        <CornerDownLeft className="h-3.5 w-3.5 text-ink-subtle" aria-hidden="true" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
