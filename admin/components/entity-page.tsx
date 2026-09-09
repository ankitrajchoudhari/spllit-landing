'use client';

import { Search } from 'lucide-react';
import type { ReactNode } from 'react';

import { Input, PageHeader } from '@/components/ui/primitives';
import { Column, DataTable, FilterBar, Paged } from '@/components/ui/data-table';
import { EmptyState, ErrorState, PermissionState, SkeletonRows } from '@/components/ui/states';
import type { useEntityList } from '@/lib/use-entity-list';
import type { Permission } from '@/lib/permissions';

/**
 * A whole list page: header, search, filters, table, pagination, and all four
 * states. Each entity page below supplies only its columns and filters.
 */
export function EntityPage<Row extends { id: string }>({
  title,
  description,
  permission,
  searchPlaceholder,
  filters,
  columns,
  hrefFor,
  list,
  children,
}: {
  title: string;
  description: string;
  permission: Permission;
  searchPlaceholder: string;
  filters?: readonly { value: string; label: string }[];
  columns: Column<Row>[];
  hrefFor?: (row: Row) => string;
  list: ReturnType<typeof useEntityList<Row>>;
  /** Extra content between the filters and the table. */
  children?: ReactNode;
}) {
  const { query } = list;

  if (query.isError) {
    if (list.isForbidden) return <PermissionState permission={permission} />;
    return <ErrorState title={`Could not load ${title.toLowerCase()}`} description={list.errorMessage} />;
  }

  const data = query.data as Paged<Row> | undefined;

  return (
    <>
      <PageHeader title={title} description={description} />

      <div className="flex flex-wrap items-center gap-2">
        <form
          className="relative min-w-[220px] flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            list.submitSearch();
          }}
        >
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
            aria-hidden="true"
          />
          <Input
            value={list.searchInput}
            onChange={(event) => list.setSearchInput(event.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
            aria-label={searchPlaceholder}
          />
        </form>

        {filters ? (
          <FilterBar options={filters} value={list.filter} onChange={list.setFilter} />
        ) : null}
      </div>

      {children}

      {query.isLoading && !data ? (
        <SkeletonRows rows={8} />
      ) : !data || data.rows.length === 0 ? (
        <EmptyState
          title={`No ${title.toLowerCase()} match this view`}
          description="Try a different search term, or clear the filter."
        />
      ) : (
        <DataTable data={data} columns={columns} hrefFor={hrefFor} onPage={list.setPage} />
      )}
    </>
  );
}
