import type { RequestHandler } from 'express';

import { getAuthUserId } from '../lib/request-context';
import { parseIdParam } from '../lib/validate';
import {
  assertBoardAccess,
  assertTaskAccess,
  BOARD_NOT_FOUND,
  TASK_NOT_FOUND,
} from '../modules/boards/board-access';

/** Requires `:boardId` and membership of the board's workspace. */
export const requireBoardAccess: RequestHandler = async (req, _res, next) => {
  const boardId = parseIdParam(req.params.boardId, BOARD_NOT_FOUND);
  req.boardAccess = await assertBoardAccess(getAuthUserId(req), boardId);
  next();
};

/** Requires `:taskId` and membership of the task's workspace. */
export const requireTaskAccess: RequestHandler = async (req, _res, next) => {
  const taskId = parseIdParam(req.params.taskId, TASK_NOT_FOUND);
  req.taskAccess = await assertTaskAccess(getAuthUserId(req), taskId);
  next();
};
