'use client';

import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Check, Search, X } from 'lucide-react';

import { api } from '@/lib/api';
import { Badge } from '@/components/ui/primitives';

/**
 * Picks specific people to notify.
 *
 * Search-then-select rather than a list of everybody with checkboxes: a console
 * with hundreds of accounts makes "scroll until you find them" the slow path,
 * and the operator almost always arrives already knowing who they mean.
 *
 * Chosen people stay visible above the results and survive a new search — the
 * failure this avoids is picking two students, searching for a third, and
 * silently losing the first two because the list re-rendered.
 */

interface Row {
  id: string;
  name: string;
  email: string;
  college: string;
  onboarded: boolean | null;
  isActive: boolean;
  profile: 'complete' | 'incomplete' | 'legacy';
  displayName: string;
  contact: string;
}

interface UsersResponse {
  rows: Row[];
  total: number;
}

export interface Recipient {
  id: string;
  name: string;
  email: string;
}

export function RecipientPicker({
  selected,
  onChange,
  max,
}: {
  selected: Recipient[];
  onChange: (next: Recipient[]) => void;
  max: number;
}) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');

  // Debounced so holding a key does not fire a query per character.
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(term.trim()), 250);
    return () => window.clearTimeout(id);
  }, [term]);

  const results = useQuery({
    queryKey: ['recipient-search', debounced],
    queryFn: () => api<UsersResponse>('/users', { query: { q: debounced, limit: 8 } }),
    enabled: debounced.length >= 2,
    placeholderData: keepPreviousData,
  });

  const chosen = new Set(selected.map((person) => person.id));
  const full = selected.length >= max;

  const toggle = (row: Row) => {
    if (chosen.has(row.id)) {
      onChange(selected.filter((person) => person.id !== row.id));
      return;
    }
    if (full) return;
    onChange([...selected, { id: row.id, name: row.displayName, email: row.contact }]);
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-ink-muted">
        Recipients {selected.length > 0 ? `(${selected.length}/${max})` : null}
      </span>

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => onChange(selected.filter((other) => other.id !== person.id))}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-sunken py-1 pl-2.5 pr-2 text-xs text-ink transition-colors hover:border-danger hover:text-danger"
            >
              {person.name}
              <X className="h-3 w-3" aria-hidden="true" />
              <span className="sr-only">Remove {person.name}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle"
          aria-hidden="true"
        />
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search by name, username or email"
          aria-label="Search for people to notify"
          className="w-full rounded-md border border-line bg-surface-sunken py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none"
        />
      </div>

      {full ? (
        <p className="text-xs text-warning">
          {max} is the most one send can name. Use a broader audience above for more.
        </p>
      ) : null}

      {debounced.length >= 2 ? (
        <div className="max-h-56 overflow-y-auto rounded-md border border-line">
          {results.isPending ? (
            <p className="px-3 py-3 text-xs text-ink-subtle">Searching…</p>
          ) : (results.data?.rows.length ?? 0) === 0 ? (
            <p className="px-3 py-3 text-xs text-ink-subtle">Nobody matches “{debounced}”.</p>
          ) : (
            <ul className="divide-y divide-line">
              {results.data!.rows.map((row) => {
                const picked = chosen.has(row.id);
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => toggle(row)}
                      disabled={!picked && full}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink">{row.displayName}</span>
                        <span className="block truncate text-xs text-ink-subtle">{row.contact}</span>
                      </span>
                      {/* Surfaced because a named list deliberately includes
                          people who have not finished signing up — see the
                          `users` case in adminConsoleSettings — and that is
                          worth seeing before you pick them. */}
                      {row.profile === 'incomplete' ? <Badge tone="warn">incomplete</Badge> : null}
                      {/* isActive is "not suspended" here — see presentUser. */}
                      {!row.isActive ? <Badge tone="bad">suspended</Badge> : null}
                      {picked ? <Check className="h-4 w-4 shrink-0 text-brand" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
