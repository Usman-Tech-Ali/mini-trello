export const boardKeys = {
  all: ['boards'] as const,
  list: (workspaceId: string) => [...boardKeys.all, 'list', workspaceId] as const,
  detail: (boardId: string) => [...boardKeys.all, 'detail', boardId] as const,
};
