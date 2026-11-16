import type { CreateTaskInput, TaskDto, UpdateTaskInput } from '@mini-trello/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createTask, deleteTask, listTasks, moveTask, updateTask } from '../api/tasks.api';
import { taskKeys } from '../api/tasks.keys';
import { applyMove } from '../lib/task-order';

export function useBoardTasks(boardId: string) {
  return useQuery({
    queryKey: taskKeys.board(boardId),
    queryFn: ({ signal }) => listTasks(boardId, signal),
  });
}

/** Replaces one task in the board cache with the server's copy. */
function useStoreTask(boardId: string) {
  const queryClient = useQueryClient();
  return (task: TaskDto) => {
    queryClient.setQueryData<TaskDto[]>(taskKeys.board(boardId), (tasks = []) =>
      tasks.some((t) => t.id === task.id)
        ? tasks.map((t) => (t.id === task.id ? task : t))
        : [...tasks, task],
    );
  };
}

export function useCreateTask(boardId: string) {
  const storeTask = useStoreTask(boardId);
  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(boardId, input),
    onSuccess: storeTask,
  });
}

export function useUpdateTask(boardId: string) {
  const queryClient = useQueryClient();
  const storeTask = useStoreTask(boardId);
  return useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: UpdateTaskInput }) =>
      updateTask(taskId, input),
    onSuccess: storeTask,
    // A 409 means our copy is stale: reload so the user sees the latest version.
    onError: () => queryClient.invalidateQueries({ queryKey: taskKeys.board(boardId) }),
  });
}

interface MoveVariables {
  task: TaskDto;
  columnId: string;
  index: number;
}

/** Optimistic move: the card moves immediately; on failure the board snaps back and reloads. */
export function useMoveTask(boardId: string) {
  const queryClient = useQueryClient();
  const storeTask = useStoreTask(boardId);
  const key = taskKeys.board(boardId);
  return useMutation({
    mutationFn: ({ task, columnId, index }: MoveVariables) =>
      moveTask(task.id, { version: task.version, columnId, index }),
    onMutate: async ({ task, columnId, index }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TaskDto[]>(key);
      if (previous) queryClient.setQueryData(key, applyMove(previous, task.id, columnId, index));
      return { previous };
    },
    onSuccess: storeTask,
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      return queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useDeleteTask(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => deleteTask(taskId),
    onSuccess: (_data, taskId) => {
      queryClient.setQueryData<TaskDto[]>(taskKeys.board(boardId), (tasks = []) =>
        tasks.filter((t) => t.id !== taskId),
      );
    },
  });
}
