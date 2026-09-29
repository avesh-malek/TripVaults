import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/appError';

/** Requires req.member (set by requireTripMember) to have the owner role. */
export function requireOwner(req: Request, _res: Response, next: NextFunction): void {
  if (!req.member || req.member.role !== 'owner') {
    next(new AppError(403, 'FORBIDDEN', 'Only the trip owner can perform this action.'));
    return;
  }
  next();
}
