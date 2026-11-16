import type { ApiErrorResponse } from '@mini-trello/shared';
import type { ErrorRequestHandler } from 'express';

import { AppError } from '../lib/app-error';

/** Errors raised by Express/body-parser follow the http-errors shape (`status`, `expose`). */
interface HttpError {
  status: number;
  expose: boolean;
  type?: string;
}

function isClientHttpError(error: unknown): error is HttpError {
  if (typeof error !== 'object' || error === null) return false;
  const { status, expose } = error as Partial<HttpError>;
  return typeof status === 'number' && status >= 400 && status < 500 && expose === true;
}

function fromClientHttpError(error: HttpError): AppError {
  if (error.type === 'entity.parse.failed') {
    return new AppError(400, 'BAD_REQUEST', 'Request body is not valid JSON.');
  }
  if (error.status === 413) {
    return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.');
  }
  return new AppError(error.status, 'BAD_REQUEST', 'The request could not be processed.');
}

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  let appError: AppError;
  if (error instanceof AppError) {
    appError = error;
  } else if (isClientHttpError(error)) {
    appError = fromClientHttpError(error);
  } else {
    req.log.error({ err: error }, 'Unhandled error');
    appError = new AppError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
  }

  const body: ApiErrorResponse = {
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details && { details: appError.details }),
    },
  };
  res.status(appError.status).json(body);
};
