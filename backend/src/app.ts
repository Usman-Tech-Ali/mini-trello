import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import { config } from './config/env';
import { errorHandler } from './middleware/error-handler';
import { notFound } from './middleware/not-found';
import { originCheck } from './middleware/origin-check';
import { requestLogger } from './middleware/request-logger';
import { authRouter } from './modules/auth/auth.routes';
import { boardsRouter, workspaceBoardsRouter } from './modules/boards/boards.routes';
import { healthRouter } from './modules/health/health.routes';
import { tasksRouter } from './modules/tasks/tasks.routes';
import { workspacesRouter } from './modules/workspaces/workspaces.routes';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(requestLogger);
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(originCheck(config.corsOrigins));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/workspaces', workspacesRouter);
  app.use('/api/workspaces/:workspaceId/boards', workspaceBoardsRouter);
  app.use('/api/boards', boardsRouter);
  app.use('/api/tasks', tasksRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
