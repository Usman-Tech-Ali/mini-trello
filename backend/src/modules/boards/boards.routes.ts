import { Router } from 'express';

import { requireAuth } from '../../middleware/require-auth';
import { requireBoardAccess } from '../../middleware/require-board';
import { requireWorkspaceMember } from '../../middleware/require-workspace';
import * as activity from '../activity/activity.controller';
import * as tasks from '../tasks/tasks.controller';
import * as boards from './boards.controller';

/** Mounted at /api/workspaces/:workspaceId/boards */
export const workspaceBoardsRouter = Router({ mergeParams: true });
workspaceBoardsRouter.use(requireAuth, requireWorkspaceMember);
workspaceBoardsRouter.get('/', boards.list);
workspaceBoardsRouter.post('/', boards.create);

/** Mounted at /api/boards */
export const boardsRouter = Router();
boardsRouter.use(requireAuth);
boardsRouter.get('/:boardId', requireBoardAccess, boards.get);
boardsRouter.patch('/:boardId', requireBoardAccess, boards.rename);
// Admin-only; checked in the controller against the board's workspace membership.
boardsRouter.delete('/:boardId', requireBoardAccess, boards.remove);
boardsRouter.post('/:boardId/columns', requireBoardAccess, boards.addColumn);
boardsRouter.patch('/:boardId/columns/:columnId', requireBoardAccess, boards.updateColumn);
boardsRouter.delete('/:boardId/columns/:columnId', requireBoardAccess, boards.removeColumn);
boardsRouter.get('/:boardId/tasks', requireBoardAccess, tasks.listForBoard);
boardsRouter.post('/:boardId/tasks', requireBoardAccess, tasks.create);
boardsRouter.get('/:boardId/activity', requireBoardAccess, activity.listForBoard);
