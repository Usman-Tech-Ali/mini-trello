import { z } from 'zod';

import { requestIdSchema } from './common';

const boardNameSchema = z
  .string()
  .trim()
  .min(1, 'Board name is required')
  .max(80, 'Board name must be at most 80 characters');

const columnNameSchema = z
  .string()
  .trim()
  .min(1, 'Column name is required')
  .max(40, 'Column name must be at most 40 characters');

export const createBoardSchema = z.object({ name: boardNameSchema, requestId: requestIdSchema });
export type CreateBoardInput = z.infer<typeof createBoardSchema>;

export const renameBoardSchema = z.object({ name: boardNameSchema });
export type RenameBoardInput = z.infer<typeof renameBoardSchema>;

export const createColumnSchema = z.object({ name: columnNameSchema, requestId: requestIdSchema });
export type CreateColumnInput = z.infer<typeof createColumnSchema>;

export const renameColumnSchema = z.object({ name: columnNameSchema });
export type RenameColumnInput = z.infer<typeof renameColumnSchema>;

export const MAX_COLUMNS_PER_BOARD = 20;

export interface ColumnDto {
  id: string;
  name: string;
}

export interface BoardDto {
  id: string;
  workspaceId: string;
  name: string;
  /** In display order. */
  columns: ColumnDto[];
  createdAt: string;
  updatedAt: string;
}

export interface BoardResponse {
  board: BoardDto;
}

export interface BoardListResponse {
  boards: BoardDto[];
}

export interface ColumnResponse {
  column: ColumnDto;
}
