import type { NextFunction, Request, Response } from 'express';
import { SESSION_HEADER, type Trip } from '@tripvault/shared';
import { tripRepository } from '../db/repositories/tripRepository';
import { memberRepository } from '../db/repositories/memberRepository';
import { mediaRepository } from '../db/repositories/mediaRepository';
import { AppError } from '../utils/appError';

/**
 * A trip accepts writes while it is 'active' or 'expiring_soon' and its
 * expiry is in the future. Reads stay available on expired/grace-period
 * trips so clients can render the expired screen; 'deleted' trips are 404.
 */
export function isTripWritable(trip: Trip): boolean {
  const statusOk = trip.status === 'active' || trip.status === 'expiring_soon';
  return statusOk && new Date(trip.expires_at).getTime() > Date.now();
}

function readSessionId(req: Request): string {
  const sessionId = req.header(SESSION_HEADER);
  if (!sessionId) {
    throw new AppError(401, 'SESSION_REQUIRED', 'The x-session-id header is required.');
  }
  return sessionId;
}

async function loadTripOr404(tripId: string): Promise<Trip> {
  const trip = await tripRepository.findById(tripId);
  if (!trip || trip.status === 'deleted') {
    throw new AppError(404, 'TRIP_NOT_FOUND', 'Trip not found.');
  }
  return trip;
}

/**
 * Requires the caller to be an active member of the trip in `:tripId`.
 * Attaches `req.trip` and `req.member`. Write operations (non-GET, non-DELETE)
 * on expired/grace-period trips are rejected with 410; reads are allowed.
 */
export async function requireTripMember(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const trip = await loadTripOr404(req.params.tripId as string);
    const sessionId = readSessionId(req);
    const member = await memberRepository.findActiveByTripAndSession(trip.id, sessionId);
    if (!member) {
      throw new AppError(403, 'NOT_A_MEMBER', 'You are not a member of this trip.');
    }

    req.trip = trip;
    req.member = member;

    // Best-effort presence; never blocks the request.
    void memberRepository.touchLastSeen(member.id);

    if (!isTripWritable(trip) && req.method !== 'GET' && req.method !== 'DELETE') {
      throw new AppError(410, 'TRIP_EXPIRED', 'This trip has expired and no longer accepts changes.');
    }
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Variant for `/api/media/:id/*` routes: resolves the trip via the media row.
 * Attaches `req.media`, `req.trip` and `req.member`; same read/write rules apply.
 */
export async function requireMediaMember(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const media = await mediaRepository.findById(req.params.id as string);
    if (!media) {
      throw new AppError(404, 'MEDIA_NOT_FOUND', 'Media not found.');
    }
    const trip = await loadTripOr404(media.trip_id);
    const sessionId = readSessionId(req);
    const member = await memberRepository.findActiveByTripAndSession(trip.id, sessionId);
    if (!member) {
      throw new AppError(403, 'NOT_A_MEMBER', 'You are not a member of this trip.');
    }

    req.media = media;
    req.trip = trip;
    req.member = member;

    void memberRepository.touchLastSeen(member.id);

    if (!isTripWritable(trip) && req.method !== 'GET' && req.method !== 'DELETE') {
      throw new AppError(410, 'TRIP_EXPIRED', 'This trip has expired and no longer accepts changes.');
    }
    next();
  } catch (err) {
    next(err);
  }
}
