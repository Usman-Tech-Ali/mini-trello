import type { ActivityDto, ActivityListResponse } from '@mini-trello/shared';
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
