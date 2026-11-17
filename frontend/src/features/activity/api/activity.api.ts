import type { ActivityListResponse } from '@mini-trello/shared';

import { apiRequest } from '@/lib/api/client';

export function listActivity(
  boardId: string,
  cursor: string | undefined,
  signal?: AbortSignal,
): Promise<ActivityListResponse> {
  const query = cursor ? `?cursor=${cursor}` : '';
  return apiRequest<ActivityListResponse>(`/api/boards/${boardId}/activity${query}`, { signal });
}
