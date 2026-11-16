import type { BoardListResponse, BoardResponse, ColumnResponse } from '@mini-trello/shared';
import {
  createBoardSchema,
  createColumnSchema,
  renameBoardSchema,
  renameColumnSchema,
} from '@mini-trello/shared';
import type { Request, Response } from 'express';

import { getAuthUserId, getBoardAccess, getMembership } from '../../lib/request-context';
import { parseIdParam, parseInput } from '../../lib/validate';
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

export async function rename(req: Request, res: Response<BoardResponse>): Promise<void> {
  const { name } = parseInput(renameBoardSchema, req.body);
  res.json({ board: await renameBoard(getBoardAccess(req).boardId, name) });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { boardId, membership } = getBoardAccess(req);
  assertWorkspaceAdmin(membership);
  await deleteBoard(boardId);
  res.status(204).end();
}

export async function addColumn(req: Request, res: Response<ColumnResponse>): Promise<void> {
  const input = parseInput(createColumnSchema, req.body);
  const { column, created } = await createColumn(getBoardAccess(req).boardId, input);
  res.status(created ? 201 : 200).json({ column });
}

export async function updateColumn(req: Request, res: Response<ColumnResponse>): Promise<void> {
  const columnId = parseIdParam(req.params.columnId, COLUMN_NOT_FOUND);
  const { name } = parseInput(renameColumnSchema, req.body);
  res.json({ column: await renameColumn(getBoardAccess(req).boardId, columnId, name) });
}

export async function removeColumn(req: Request, res: Response): Promise<void> {
  const columnId = parseIdParam(req.params.columnId, COLUMN_NOT_FOUND);
  await deleteColumn(getBoardAccess(req).boardId, columnId);
  res.status(204).end();
}
