import type {
  ActivityAction,
  ActivityDto,
  ActivityFilters,
  ActivityListResponse,
} from '@mini-trello/shared';
import type { InfiniteData } from '@tanstack/react-query';

export type ActivityPages = InfiniteData<ActivityListResponse>;

/** Puts a live entry at the top of a loaded feed, once. An unloaded feed is left alone. */
export function addActivity(
  data: ActivityPages | undefined,
  activity: ActivityDto,
): ActivityPages | undefined {
  const [newest, ...older] = data?.pages ?? [];
  if (!data || !newest) return data;
  if (data.pages.some((page) => page.activities.some((a) => a.id === activity.id))) return data;
  return {
    ...data,
    pages: [{ ...newest, activities: [activity, ...newest.activities] }, ...older],
  };
}

/** Feed filters as typed in the panel: calendar days rather than instants. */
export interface ActivityFilterInput {
  actor?: string;
  action?: ActivityAction;
  /** "YYYY-MM-DD", first day included. */
  fromDate?: string;
  /** "YYYY-MM-DD", last day included. */
  toDate?: string;
}

function localDayStart(date: string, addDays = 0): string {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  return new Date(year, month - 1, day + addDays).toISOString();
}

/**
 * Turns local calendar days into the API's instants: from the start of the first day up to (not
 * including) the start of the day after the last, so the whole last day is included.
 */
export function toActivityFilters(input: ActivityFilterInput): ActivityFilters {
  const filters: ActivityFilters = {};
  if (input.actor) filters.actor = input.actor;
  if (input.action) filters.action = input.action;
  if (input.fromDate) filters.from = localDayStart(input.fromDate);
  if (input.toDate) filters.to = localDayStart(input.toDate, 1);
  return filters;
}
