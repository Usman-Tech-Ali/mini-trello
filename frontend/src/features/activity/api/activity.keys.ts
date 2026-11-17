import type { ActivityFilters } from '@mini-trello/shared';

export const activityKeys = {
  all: ['activity'] as const,
  /** Every feed of a board, whatever its filters (prefix for live updates). */
  board: (boardId: string) => [...activityKeys.all, 'board', boardId] as const,
  feed: (boardId: string, filters: ActivityFilters) =>
    [...activityKeys.board(boardId), filters] as const,
};
