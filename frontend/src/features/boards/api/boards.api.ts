import type {
  BoardDto,
  BoardListResponse,
  BoardResponse,
  ColumnDto,
  ColumnResponse,
  CreateBoardInput,
  CreateColumnInput,
} from '@mini-trello/shared';

import { apiRequest } from '@/lib/api/client';

export async function listBoards(workspaceId: string, signal?: AbortSignal): Promise<BoardDto[]> {
  const { boards } = await apiRequest<BoardListResponse>(`/api/workspaces/${workspaceId}/boards`, {
    signal,
  });
  return boards;
}

export async function createBoard(workspaceId: string, input: CreateBoardInput): Promise<BoardDto> {
  const { board } = await apiRequest<BoardResponse>(`/api/workspaces/${workspaceId}/boards`, {
    method: 'POST',
    body: input,
  });
  return board;
}

export async function getBoard(boardId: string, signal?: AbortSignal): Promise<BoardDto> {
  const { board } = await apiRequest<BoardResponse>(`/api/boards/${boardId}`, { signal });
  return board;
}

export async function renameBoard(boardId: string, name: string): Promise<BoardDto> {
  const { board } = await apiRequest<BoardResponse>(`/api/boards/${boardId}`, {
    method: 'PATCH',
    body: { name },
  });
  return board;
}

export function deleteBoard(boardId: string): Promise<void> {
  return apiRequest<void>(`/api/boards/${boardId}`, { method: 'DELETE' });
}

export async function createColumn(boardId: string, input: CreateColumnInput): Promise<ColumnDto> {
  const { column } = await apiRequest<ColumnResponse>(`/api/boards/${boardId}/columns`, {
    method: 'POST',
    body: input,
  });
  return column;
}

export async function renameColumn(
  boardId: string,
  columnId: string,
  name: string,
): Promise<ColumnDto> {
  const { column } = await apiRequest<ColumnResponse>(
    `/api/boards/${boardId}/columns/${columnId}`,
    { method: 'PATCH', body: { name } },
  );
  return column;
}

export function deleteColumn(boardId: string, columnId: string): Promise<void> {
  return apiRequest<void>(`/api/boards/${boardId}/columns/${columnId}`, { method: 'DELETE' });
}
