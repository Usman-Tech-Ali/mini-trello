import { randomUUID } from 'node:crypto';

import type { Request, Response } from 'express';
import { pinoHttp } from 'pino-http';

import { logger } from '../lib/logger';

const REQUEST_ID_PATTERN = /^[\w-]{1,64}$/;

export const requestLogger = pinoHttp<Request, Response>({
  logger,
  genReqId: (req, res) => {
    const incoming = req.headers['x-request-id'];
    const id =
      typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  // Log only what's useful for tracing; full header dumps are noisy and risk leaking data.
  serializers: {
    req: (req: { id: unknown; method: string; url: string }) => ({
      id: req.id,
      method: req.method,
      url: req.url,
    }),
    res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
  },
  // Evaluated again when the response finishes, so the user and error code are known by then.
  customProps: (req, res) => ({
    source: 'api',
    userId: req.auth?.userId,
    errorCode: res.locals.errorCode,
  }),
  customLogLevel: (_req, res, error) => {
    if (error || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
});
