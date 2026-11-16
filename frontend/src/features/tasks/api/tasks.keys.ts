export const taskKeys = {
  all: ['tasks'] as const,
  board: (boardId: string) => [...taskKeys.all, 'board', boardId] as const,
};
