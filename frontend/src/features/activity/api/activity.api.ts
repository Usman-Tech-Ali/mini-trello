import type { ActivityFilters, ActivityListResponse } from '@mini-trello/shared';

import { apiRequest } from '@/lib/api/client';

export function listActivity(
  boardId: string,
  cursor: string | undefined,
  filters: ActivityFilters,
  signal?: AbortSignal,
): Promise<ActivityListResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  if (cursor) params.set('cursor', cursor);
  const query = params.size > 0 ? `?${params.toString()}` : '';
  return apiRequest<ActivityListResponse>(`/api/boards/${boardId}/activity${query}`, { signal });
}
