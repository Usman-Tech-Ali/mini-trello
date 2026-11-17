import type { TaskHistoryResponse } from '@mini-trello/shared';
import { taskHistoryQuerySchema } from '@mini-trello/shared';
import type { Request, Response } from 'express';

import { getTaskAccess } from '../../lib/request-context';
import { parseInput } from '../../lib/validate';
import { listHistory } from './history.service';

export async function listForTask(req: Request, res: Response<TaskHistoryResponse>): Promise<void> {
  const query = parseInput(taskHistoryQuerySchema, req.query);
  res.json(await listHistory(getTaskAccess(req).taskId, query));
}
