import type { BoardDto } from '@mini-trello/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createBoard,
  createColumn,
  deleteBoard,
  deleteColumn,
  getBoard,
  listBoards,
  renameBoard,
  renameColumn,
} from '../api/boards.api';
import { boardKeys } from '../api/boards.keys';

export function useBoards(workspaceId: string | undefined) {
  return useQuery({
    queryKey: boardKeys.list(workspaceId ?? ''),
    queryFn: ({ signal }) => listBoards(workspaceId ?? '', signal),
    enabled: !!workspaceId,
  });
}

export function useBoard(boardId: string | undefined) {
  return useQuery({
    queryKey: boardKeys.detail(boardId ?? ''),
    queryFn: ({ signal }) => getBoard(boardId ?? '', signal),
    enabled: !!boardId,
  });
}

function useSyncBoard() {
  const queryClient = useQueryClient();
  return (board: BoardDto) => {
    queryClient.setQueryData(boardKeys.detail(board.id), board);
    return queryClient.invalidateQueries({ queryKey: boardKeys.list(board.workspaceId) });
  };
}

export function useCreateBoard(workspaceId: string) {
  const syncBoard = useSyncBoard();
  return useMutation({
    mutationFn: (input: { name: string; requestId: string }) => createBoard(workspaceId, input),
    onSuccess: syncBoard,
  });
}

export function useRenameBoard(boardId: string) {
  const syncBoard = useSyncBoard();
  return useMutation({
    mutationFn: (name: string) => renameBoard(boardId, name),
    onSuccess: syncBoard,
  });
}

export function useDeleteBoard(board: Pick<BoardDto, 'id' | 'workspaceId'>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteBoard(board.id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: boardKeys.detail(board.id) });
      return queryClient.invalidateQueries({ queryKey: boardKeys.list(board.workspaceId) });
    },
  });
}

/** Column changes are reflected by refetching the board (it embeds its columns). */
function useInvalidateBoard(boardId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
}

export function useCreateColumn(boardId: string) {
  const invalidate = useInvalidateBoard(boardId);
  return useMutation({
    mutationFn: (input: { name: string; requestId: string }) => createColumn(boardId, input),
    onSuccess: invalidate,
  });
}

export function useRenameColumn(boardId: string) {
  const invalidate = useInvalidateBoard(boardId);
  return useMutation({
    mutationFn: ({ columnId, name }: { columnId: string; name: string }) =>
      renameColumn(boardId, columnId, name),
    onSuccess: invalidate,
  });
}

export function useDeleteColumn(boardId: string) {
  const invalidate = useInvalidateBoard(boardId);
  return useMutation({
    mutationFn: (columnId: string) => deleteColumn(boardId, columnId),
    onSuccess: invalidate,
  });
}
