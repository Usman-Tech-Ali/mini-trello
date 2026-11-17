import type { TaskFilters } from '@mini-trello/shared';
import { taskFiltersSchema } from '@mini-trello/shared';

/** A change to the filters; an undefined or empty value removes that filter. */
export type FilterPatch = { [K in keyof TaskFilters]?: TaskFilters[K] | undefined };

const FILTER_KEYS = ['q', 'assignee', 'priority', 'column'] as const;

/** Reads filters from the URL. Each value is validated on its own; invalid ones are ignored. */
export function parseFilterParams(params: Pick<URLSearchParams, 'get'>): TaskFilters {
  const filters: TaskFilters = {};
  for (const key of FILTER_KEYS) {
    const value = params.get(key);
    if (!value) continue;
    const parsed = taskFiltersSchema.shape[key].safeParse(value);
    if (parsed.success && parsed.data) Object.assign(filters, { [key]: parsed.data });
  }
  return filters;
}

/** The query string after applying `patch` (undefined or "" removes a param); keeps the others. */
export function applyFilterPatch(
  params: Pick<URLSearchParams, 'toString'>,
  patch: Readonly<Record<string, string | undefined>>,
): string {
  const next = new URLSearchParams(params.toString());
  for (const [key, value] of Object.entries(patch)) {
    if (value) next.set(key, value);
    else next.delete(key);
  }
  return next.toString();
}
