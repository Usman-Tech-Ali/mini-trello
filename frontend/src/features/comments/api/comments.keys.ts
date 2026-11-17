export const commentKeys = {
  all: ['comments'] as const,
  task: (taskId: string) => [...commentKeys.all, 'task', taskId] as const,
};
