import type { TaskDto } from '@mini-trello/shared';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { taskKeys } from '@/features/tasks/api/tasks.keys';

import { getTaskHistory, restoreTask } from '../api/history.api';
import { historyKeys } from '../api/history.keys';

export function useTaskHistory(task: Pick<TaskDto, 'id' | 'version'>, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: historyKeys.taskAt(task.id, task.version),
    queryFn: ({ pageParam, signal }) => getTaskHistory(task.id, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
  });
}

export function useRestoreTask(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ task, toVersion }: { task: TaskDto; toVersion: number }) =>
      restoreTask(task.id, { version: task.version, toVersion }),
    onSuccess: (restored) => {
      queryClient.setQueryData<TaskDto[]>(taskKeys.board(boardId), (tasks = []) =>
        tasks.map((t) => (t.id === restored.id ? restored : t)),
      );
    },
    // A conflict means our copy is stale: reload the board's tasks.
    onError: () => queryClient.invalidateQueries({ queryKey: taskKeys.board(boardId) }),
  });
}
