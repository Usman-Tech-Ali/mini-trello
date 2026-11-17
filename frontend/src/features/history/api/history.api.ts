import type {
  RestoreTaskInput,
  TaskDto,
  TaskHistoryResponse,
  TaskResponse,
} from '@mini-trello/shared';

import { apiRequest } from '@/lib/api/client';

export function getTaskHistory(
  taskId: string,
  cursor: string | undefined,
  signal?: AbortSignal,
): Promise<TaskHistoryResponse> {
  const query = cursor ? `?cursor=${cursor}` : '';
  return apiRequest<TaskHistoryResponse>(`/api/tasks/${taskId}/history${query}`, { signal });
}

export async function restoreTask(taskId: string, input: RestoreTaskInput): Promise<TaskDto> {
  const { task } = await apiRequest<TaskResponse>(`/api/tasks/${taskId}/restore`, {
    method: 'POST',
    body: input,
  });
  return task;
}
