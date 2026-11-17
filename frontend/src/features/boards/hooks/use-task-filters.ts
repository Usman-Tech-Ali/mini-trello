import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import { applyFilterPatch, type FilterPatch, parseFilterParams } from '../lib/filter-params';

const NO_FILTERS: FilterPatch = {
  q: undefined,
  assignee: undefined,
  priority: undefined,
  column: undefined,
};

/**
 * Board filters live in the URL (`?q=&assignee=&priority=&column=`), so a filtered view survives
 * a refresh and can be shared as a link. `replace` keeps typing out of the back-button history.
 */
export function useTaskFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseFilterParams(searchParams), [searchParams]);

  const setFilters = useCallback(
    (patch: FilterPatch) => {
      const query = applyFilterPatch(searchParams, patch);
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );
  const clearFilters = useCallback(() => setFilters(NO_FILTERS), [setFilters]);

  return { filters, setFilters, clearFilters };
}
