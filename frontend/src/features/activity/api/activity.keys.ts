export const activityKeys = {
  all: ['activity'] as const,
  board: (boardId: string) => [...activityKeys.all, 'board', boardId] as const,
};
