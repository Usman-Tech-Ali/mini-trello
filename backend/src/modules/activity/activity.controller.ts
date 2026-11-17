import type { ActivityListResponse } from '@mini-trello/shared';
import { activityListQuerySchema } from '@mini-trello/shared';
import type { Request, Response } from 'express';

import { getBoardAccess } from '../../lib/request-context';
import { parseInput } from '../../lib/validate';
import { listActivity } from './activity.service';

export async function listForBoard(
  req: Request,
  res: Response<ActivityListResponse>,
): Promise<void> {
  const query = parseInput(activityListQuerySchema, req.query);
  res.json(await listActivity(getBoardAccess(req).boardId, query));
}
