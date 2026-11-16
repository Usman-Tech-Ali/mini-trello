import { clientLogSchema } from '@mini-trello/shared';
import { Router } from 'express';

import { logger } from '../../lib/logger';
import { parseInput } from '../../lib/validate';

const webLogger = logger.child({ source: 'web' });

/** Development-only helpers. Not mounted in any other environment. */
export const devRouter = Router();

// Browser errors are written into the same log as API requests, giving one timeline per test session.
devRouter.post('/client-logs', (req, res) => {
  const entry = parseInput(clientLogSchema, req.body);
  webLogger[entry.level]({ url: entry.url, via: entry.source, stack: entry.stack }, entry.message);
  res.status(204).end();
});
