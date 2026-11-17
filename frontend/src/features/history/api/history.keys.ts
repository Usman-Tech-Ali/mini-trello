export const historyKeys = {
  all: ['history'] as const,
  task: (taskId: string) => [...historyKeys.all, taskId] as const,
  /** Keyed by version, so every new version (ours or someone else's) shows up. */
  taskAt: (taskId: string, version: number) => [...historyKeys.task(taskId), version] as const,
};
