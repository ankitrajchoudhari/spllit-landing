'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/primitives';
import { formatCount } from '@/lib/utils';

/**
 * The console's one table.
 *
 * Every list page renders through this so pagination, empty rows and
 * horizontal overflow behave identically everywhere. Wide tables scroll inside
 * their own container — the page body never scrolls sideways.
 */

export interface Column<Row> {
  key: string;
  header: string;
  /** Cell renderer. Kept as a function so a column can compose several fields. */
  cell: (row: Row) => ReactNode;
  /** Right-aligned, tabular — for counts and durations. */
  numeric?: boolean;
}

export interface Paged<Row> {
  rows: Row[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export function DataTable<Row extends { id: string }>({
  data,
  columns,
  hrefFor,
  onPage,
}: {
  data: Paged<Row>;
  columns: Column<Row>[];
  /** When given, the whole row becomes a link to the detail page. */
  hrefFor?: (row: Row) => string;
  onPage: (page: number) => void;
}) {
  return (
    <>
      <div className="scroll-x rounded-xl border border-line bg-surface shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04)]">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            {/* Sticky, because a table you scroll is a table whose headings you
              lose — and a column of unlabelled ids is unreadable. */}
          <tr className="sticky top-0 z-10 border-b border-line-strong bg-surface-sunken/95 backdrop-blur">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`px-4 py-3 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-subtle ${
                    column.numeric ? 'text-right' : 'text-left'
                  }`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-line transition-colors duration-snap last:border-0 hover:bg-surface-raised/60"
              >
                {columns.map((column, index) => {
                  const content = column.cell(row);
                  return (
                    <td
                      key={column.key}
                      className={`px-4 py-2.5 align-middle ${
                        // Right-aligned and tabular so digits line up down the
                        // column — the only way a column of numbers can be
                        // compared at a glance rather than read one by one.
                        column.numeric ? 'tabular text-right' : ''
                      }`}
                    >
                      {/* Only the first cell is the link. A link wrapping every
                          cell makes text selection inside the row impossible. */}
                      {index === 0 && hrefFor ? (
                        <Link
                          href={hrefFor(row)}
                          className="block hover:text-brand focus-visible:text-brand"
                        >
                          {content}
                        </Link>
                      ) : (
                        content
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="tabular text-xs text-ink-subtle">
          {formatCount(data.total)} total · page {data.page} of {data.pages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={data.page <= 1}
            onClick={() => onPage(Math.max(data.page - 1, 1))}
          >
            Previous
          </Button>
          <Button
            variant="secondary"
            disabled={data.page >= data.pages}
            onClick={() => onPage(data.page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </>
  );
}

/** Filter chips shared by every list page. */
export function FilterBar<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Filter">
      {options.map((option) => (
        <Button
          key={option.value || 'all'}
          variant={value === option.value ? 'primary' : 'ghost'}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
