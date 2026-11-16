import { AppError } from '../../lib/app-error';
import { TaskModel } from '../tasks/task.model';
import { findMembership, type MembershipContext } from '../workspaces/workspace-access';
import { BoardModel } from './board.model';

/**
 * Board and task authorization: access follows workspace membership. Like workspaces, a board or
 * task the user can't access is reported as not found. Shared by REST and (Phase 3) Socket.IO.
 */

export const BOARD_NOT_FOUND = 'Board not found.';
export const COLUMN_NOT_FOUND = 'Column not found.';
export const TASK_NOT_FOUND = 'Task not found.';

export interface BoardAccess {
  boardId: string;
  workspaceId: string;
  membership: MembershipContext;
}

export interface TaskAccess extends BoardAccess {
  taskId: string;
}

export async function assertBoardAccess(userId: string, boardId: string): Promise<BoardAccess> {
  const board = await BoardModel.findById(boardId).select('workspaceId').lean();
  const membership = board ? await findMembership(userId, board.workspaceId.toString()) : null;
  if (!board || !membership) throw new AppError(404, 'NOT_FOUND', BOARD_NOT_FOUND);
  return { boardId, workspaceId: membership.workspaceId, membership };
}

export async function assertTaskAccess(userId: string, taskId: string): Promise<TaskAccess> {
  const task = await TaskModel.findById(taskId).select('boardId workspaceId').lean();
  const membership = task ? await findMembership(userId, task.workspaceId.toString()) : null;
  if (!task || !membership) throw new AppError(404, 'NOT_FOUND', TASK_NOT_FOUND);
  return {
    taskId,
    boardId: task.boardId.toString(),
    workspaceId: membership.workspaceId,
    membership,
  };
}
