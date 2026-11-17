import type { BoardListResponse, BoardResponse, ColumnResponse } from '@mini-trello/shared';
import {
  createBoardSchema,
  createColumnSchema,
  renameBoardSchema,
  renameColumnSchema,
} from '@mini-trello/shared';
import type { Request, Response } from 'express';

import {
  getAuthUserId,
  getBoardAccess,
  getMembership,
  getOriginSocketId,
} from '../../lib/request-context';
import { parseIdParam, parseInput } from '../../lib/validate';
import { closeBoardRoom, emitToBoard } from '../../realtime/realtime-server';
import { assertWorkspaceAdmin } from '../workspaces/workspace-access';
import { COLUMN_NOT_FOUND } from './board-access';
import {
  createBoard,
  createColumn,
  deleteBoard,
  deleteColumn,
  getBoard,
  listBoards,
  renameBoard,
  renameColumn,
} from './boards.service';

export async function create(req: Request, res: Response<BoardResponse>): Promise<void> {
  const input = parseInput(createBoardSchema, req.body);
  const { workspaceId } = getMembership(req);
  const { board, created } = await createBoard(workspaceId, getAuthUserId(req), input);
  res.status(created ? 201 : 200).json({ board });
}

export async function list(req: Request, res: Response<BoardListResponse>): Promise<void> {
  res.json({ boards: await listBoards(getMembership(req).workspaceId) });
}

export async function get(req: Request, res: Response<BoardResponse>): Promise<void> {
  res.json({ board: await getBoard(getBoardAccess(req).boardId) });
}

/** Announces the board's new state (name and columns) to everyone else on it. */
async function broadcastBoard(req: Request, boardId: string): Promise<void> {
  const board = await getBoard(boardId);
  emitToBoard(boardId, getOriginSocketId(req), 'board:updated', { board });
}

export async function rename(req: Request, res: Response<BoardResponse>): Promise<void> {
  const { name } = parseInput(renameBoardSchema, req.body);
  const board = await renameBoard(getBoardAccess(req).boardId, name);
  emitToBoard(board.id, getOriginSocketId(req), 'board:updated', { board });
  res.json({ board });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { boardId, membership } = getBoardAccess(req);
  assertWorkspaceAdmin(membership);
  await deleteBoard(boardId);
  closeBoardRoom(boardId);
  res.status(204).end();
}

export async function addColumn(req: Request, res: Response<ColumnResponse>): Promise<void> {
  const input = parseInput(createColumnSchema, req.body);
  const { boardId } = getBoardAccess(req);
  const { column, created } = await createColumn(boardId, input);
  if (created) await broadcastBoard(req, boardId);
  res.status(created ? 201 : 200).json({ column });
}

export async function updateColumn(req: Request, res: Response<ColumnResponse>): Promise<void> {
  const columnId = parseIdParam(req.params.columnId, COLUMN_NOT_FOUND);
  const { name } = parseInput(renameColumnSchema, req.body);
  const { boardId } = getBoardAccess(req);
  const column = await renameColumn(boardId, columnId, name);
  await broadcastBoard(req, boardId);
  res.json({ column });
}

export async function removeColumn(req: Request, res: Response): Promise<void> {
  const columnId = parseIdParam(req.params.columnId, COLUMN_NOT_FOUND);
  const { boardId } = getBoardAccess(req);
  await deleteColumn(boardId, columnId);
  await broadcastBoard(req, boardId);
  res.status(204).end();
}
