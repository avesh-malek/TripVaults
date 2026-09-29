import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorBody } from '@tripvault/shared';
import { AppError, DuplicateError } from '../utils/appError.js';
import { createLogger } from '../utils/logger.js';

function body(code: string, message: string, details?: unknown): ApiErrorBody {
  return { error: { code, message, ...(details !== undefined ? { details } : {}) } } as ApiErrorBody;
}

/** Final error handler: converts AppError/ZodError/unknown into JSON ApiErrorBody. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const log = createLogger(req.requestId);

  if (err instanceof DuplicateError) {
    res.status(409).json({ ...body('DUPLICATE_MEDIA', err.message), duplicate: err.duplicate });
    return;
  }

  if (err instanceof AppError) {
    if (err.status >= 500) log.error(`${req.method} ${req.path} → ${err.status} ${err.code}`, err);
    res.status(err.status).json(body(err.code, err.message, err.details));
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json(body('VALIDATION_ERROR', 'The request data is invalid.', err.flatten()));
    return;
  }

  log.error(`${req.method} ${req.path} → 500 INTERNAL_ERROR`, err);
  res.status(500).json(body('INTERNAL_ERROR', 'An unexpected error occurred.'));
}
