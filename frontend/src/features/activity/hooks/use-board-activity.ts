import type { ActivityFilters } from '@mini-trello/shared';
import { useInfiniteQuery } from '@tanstack/react-query';

import { listActivity } from '../api/activity.api';
import { activityKeys } from '../api/activity.keys';

/** The board's activity feed, newest first; `fetchNextPage` loads older entries. */
export function useBoardActivity(boardId: string, filters: ActivityFilters, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: activityKeys.feed(boardId, filters),
    queryFn: ({ pageParam, signal }) => listActivity(boardId, pageParam, filters, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    // Only fetched while the panel is open; live events keep a loaded feed current.
    enabled,
  });
}
