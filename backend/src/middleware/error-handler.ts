import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../utils/app-error.js';
import { sendFailure } from '../utils/api-response.js';

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', 'Resource not found.'));
};

/** body-parser errors carry an HTTP status and a `type` such as "entity.parse.failed". */
function isBodyParserError(error: unknown): error is { status: number; type: string } {
  return typeof error === 'object' && error !== null && 'type' in error && 'status' in error;
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof AppError) {
    return sendFailure(res, error.statusCode, {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  }
  if (isBodyParserError(error)) {
    if (error.type === 'entity.parse.failed') {
      return sendFailure(res, 400, { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' });
    }
    if (error.type === 'entity.too.large') {
      return sendFailure(res, 413, { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' });
    }
  }
  req.log.error({ err: error }, 'Unhandled error');
  sendFailure(res, 500, { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' });
};
