import type {
  CreateTaskInput,
  MoveTaskInput,
  TaskDto,
  TaskListResponse,
  TaskResponse,
  UpdateTaskInput,
} from '@mini-trello/shared';

import { apiRequest } from '@/lib/api/client';

export async function listTasks(boardId: string, signal?: AbortSignal): Promise<TaskDto[]> {
  const { tasks } = await apiRequest<TaskListResponse>(`/api/boards/${boardId}/tasks`, { signal });
  return tasks;
}

export async function createTask(boardId: string, input: CreateTaskInput): Promise<TaskDto> {
  const { task } = await apiRequest<TaskResponse>(`/api/boards/${boardId}/tasks`, {
    method: 'POST',
    body: input,
  });
  return task;
}

export async function updateTask(taskId: string, input: UpdateTaskInput): Promise<TaskDto> {
  const { task } = await apiRequest<TaskResponse>(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    body: input,
  });
  return task;
}

export async function moveTask(taskId: string, input: MoveTaskInput): Promise<TaskDto> {
  const { task } = await apiRequest<TaskResponse>(`/api/tasks/${taskId}/move`, {
    method: 'PATCH',
    body: input,
  });
  return task;
}

export function deleteTask(taskId: string): Promise<void> {
  return apiRequest<void>(`/api/tasks/${taskId}`, { method: 'DELETE' });
}
