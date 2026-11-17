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

/**
 * The open task is in the URL too (`?task=<id>`), so a notification or a shared link can open
 * a specific task, and the back button closes it.
 */
export function useOpenTaskParam() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openTaskId = searchParams.get('task');

  const setOpenTaskId = useCallback(
    (taskId: string | null) => {
      const query = applyFilterPatch(searchParams, { task: taskId ?? undefined });
      const href = query ? `${pathname}?${query}` : pathname;
      // Opening adds a history entry (back closes it); closing replaces it.
      if (taskId) router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return { openTaskId, setOpenTaskId };
}
