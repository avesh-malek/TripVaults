import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/** Assigns a request id, exposes it as `x-request-id` and `req.requestId`. */
export function requestId(_req: Request, res: Response, next: NextFunction): void {
  const req = _req as Request;
  const id = randomUUID();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}
