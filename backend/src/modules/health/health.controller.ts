import type { HealthResponse } from '@mini-trello/shared';
import type { Request, Response } from 'express';

import { checkDatabase } from './health.service';

export async function getHealth(_req: Request, res: Response<HealthResponse>): Promise<void> {
  const database = await checkDatabase();
  const body: HealthResponse = {
    status: database.status === 'up' ? 'ok' : 'degraded',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    database,
  };
  res
    .status(body.status === 'ok' ? 200 : 503)
    .set('Cache-Control', 'no-store')
    .json(body);
}
