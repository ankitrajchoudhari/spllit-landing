'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { api, ApiError } from '@/lib/api';
import type { Paged } from '@/components/ui/data-table';

/**
 * The state every list page needs: a search box, one filter, and a page.
 *
 * Written once because the alternative is five pages each re-deriving when to
 * reset the page number — and forgetting it on one of them leaves an admin
 * looking at page 7 of a filter that has four pages, which renders as an empty
 * table that looks like missing data.
 */
export function useEntityList<Row extends { id: string }>(
  key: string,
  path: string,
  initialFilter = '',
) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(initialFilter);
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: [key, search, filter, page],
    queryFn: () =>
      api<Paged<Row>>(path, { query: { q: search, status: filter, page, limit: 25 } }),
    placeholderData: keepPreviousData,
  });

  return {
    query,
    searchInput,
    setSearchInput,
    /** Commits the search box and returns to page one. */
    submitSearch: () => {
      setSearch(searchInput.trim());
      setPage(1);
    },
    filter,
    setFilter: (next: string) => {
      setFilter(next);
      setPage(1);
    },
    page,
    setPage,
    /** True when the failure is "your role may not see this". */
    isForbidden: query.error instanceof ApiError && query.error.isForbidden,
    errorMessage:
      query.error instanceof ApiError ? query.error.message : 'Something went wrong.',
  };
}
