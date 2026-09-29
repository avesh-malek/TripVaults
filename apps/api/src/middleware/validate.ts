import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { AppError } from '../utils/appError.js';

/**
 * Validate req.body (or req.query) against a Zod schema.
 * On success the parsed value replaces the original; on failure → 400 VALIDATION_ERROR.
 */
export function validate(schema: ZodTypeAny, where: 'body' | 'query' = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[where]);
    if (!result.success) {
      next(
        new AppError(400, 'VALIDATION_ERROR', 'The request data is invalid.', result.error.flatten()),
      );
      return;
    }
    if (where === 'body') req.body = result.data;
    else req.query = result.data as Request['query'];
    next();
  };
}
