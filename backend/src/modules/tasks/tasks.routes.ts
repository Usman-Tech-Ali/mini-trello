import { Router } from 'express';

import { requireAuth } from '../../middleware/require-auth';
import { requireTaskAccess } from '../../middleware/require-board';
import * as comments from '../comments/comments.controller';
import * as history from '../history/history.controller';
import * as tasks from './tasks.controller';

/** Mounted at /api/tasks */
export const tasksRouter = Router();
tasksRouter.use(requireAuth);
tasksRouter.get('/:taskId', requireTaskAccess, tasks.get);
tasksRouter.patch('/:taskId', requireTaskAccess, tasks.update);
tasksRouter.patch('/:taskId/move', requireTaskAccess, tasks.move);
tasksRouter.delete('/:taskId', requireTaskAccess, tasks.remove);
tasksRouter.get('/:taskId/comments', requireTaskAccess, comments.listForTask);
tasksRouter.post('/:taskId/comments', requireTaskAccess, comments.create);
tasksRouter.get('/:taskId/history', requireTaskAccess, history.listForTask);
tasksRouter.post('/:taskId/restore', requireTaskAccess, tasks.restore);
