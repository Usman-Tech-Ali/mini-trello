import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import { config } from './config/env';
import { errorHandler } from './middleware/error-handler';
import { notFound } from './middleware/not-found';
import { originCheck } from './middleware/origin-check';
import { requestLogger } from './middleware/request-logger';
import { healthRouter } from './modules/health/health.routes';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(requestLogger);
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(originCheck(config.corsOrigins));
  app.use(express.json({ limit: '100kb' }));

  app.use('/health', healthRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
