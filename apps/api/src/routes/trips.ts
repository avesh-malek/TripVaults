import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  SESSION_HEADER,
  bulkDownloadSchema,
  createTripSchema,
  extendTripSchema,
  initiateUploadSchema,
  joinTripSchema,
  mediaQuerySchema,
  updateTripSchema,
  type MediaQueryInput,
} from '@tripvault/shared';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireTripMember } from '../middleware/requireTripMember.js';
import { requireOwner } from '../middleware/requireOwner.js';
import { AppError } from '../utils/appError.js';
import { createLogger } from '../utils/logger.js';
import { tripService } from '../services/tripService.js';
import { memberService } from '../services/memberService.js';
import { mediaService } from '../services/mediaService.js';

export const tripsRouter = Router();

function requireSessionId(req: Request): string {
  const sessionId = req.header(SESSION_HEADER);
  if (!sessionId) {
    throw new AppError(401, 'SESSION_REQUIRED', 'The x-session-id header is required.');
  }
  return sessionId;
}

/** Stricter limiter for upload initiation: 120/hour per IP. */
const initiateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many upload requests, please slow down.' } },
});

// --- Public invite routes (registered before /:tripId) ---

tripsRouter.get(
  '/invite/:inviteCode',
  asyncHandler(async (req, res) => {
    res.json(await memberService.invitePreview(req.params.inviteCode as string));
  }),
);

tripsRouter.get(
  '/invite/:inviteCode/status',
  asyncHandler(async (req, res) => {
    const sessionId = requireSessionId(req);
    res.json(await memberService.inviteStatus(req.params.inviteCode as string, sessionId));
  }),
);

tripsRouter.post(
  '/join/:inviteCode',
  validate(joinTripSchema),
  asyncHandler(async (req, res) => {
    const sessionId = requireSessionId(req);
    const result = await memberService.joinByInviteCode(req.params.inviteCode as string, req.body, sessionId);
    res.json(result);
  }),
);

// --- Trip CRUD ---

tripsRouter.post(
  '/',
  validate(createTripSchema),
  asyncHandler(async (req, res) => {
    const sessionId = requireSessionId(req);
    const result = await tripService.createTrip(req.body, sessionId);
    res.status(201).json(result);
  }),
);

tripsRouter.get(
  '/:tripId',
  requireTripMember,
  asyncHandler(async (req, res) => {
    res.json(await tripService.getTripDetail(req.trip.id, req.member));
  }),
);

tripsRouter.patch(
  '/:tripId',
  requireTripMember,
  requireOwner,
  validate(updateTripSchema),
  asyncHandler(async (req, res) => {
    res.json(await tripService.updateTrip(req.trip.id, req.body));
  }),
);

tripsRouter.post(
  '/:tripId/extend',
  requireTripMember,
  requireOwner,
  validate(extendTripSchema),
  asyncHandler(async (req, res) => {
    res.json(await tripService.extendTrip(req.trip, req.body));
  }),
);

tripsRouter.post(
  '/:tripId/close',
  requireTripMember,
  requireOwner,
  asyncHandler(async (req, res) => {
    res.json(await tripService.closeTrip(req.trip.id));
  }),
);

tripsRouter.delete(
  '/:tripId',
  requireTripMember,
  requireOwner,
  asyncHandler(async (req, res) => {
    res.json(await tripService.deleteTrip(req.trip));
  }),
);

// --- Members ---

tripsRouter.get(
  '/:tripId/members',
  requireTripMember,
  asyncHandler(async (req, res) => {
    res.json(await memberService.listMembers(req.trip.id));
  }),
);

tripsRouter.post(
  '/:tripId/members/:memberId/remove',
  requireTripMember,
  requireOwner,
  asyncHandler(async (req, res) => {
    res.json(await memberService.removeMember(req.trip.id, req.params.memberId as string, req.member));
  }),
);

tripsRouter.post(
  '/:tripId/leave',
  requireTripMember,
  asyncHandler(async (req, res) => {
    res.json(await memberService.leaveTrip(req.member));
  }),
);

// --- Join requests ---

tripsRouter.get(
  '/:tripId/join-requests',
  requireTripMember,
  requireOwner,
  asyncHandler(async (req, res) => {
    res.json(await memberService.listJoinRequests(req.trip.id));
  }),
);

tripsRouter.post(
  '/:tripId/join-requests/:requestId/approve',
  requireTripMember,
  requireOwner,
  asyncHandler(async (req, res) => {
    res.json(await memberService.approveRequest(req.trip.id, req.params.requestId as string));
  }),
);

tripsRouter.post(
  '/:tripId/join-requests/:requestId/reject',
  requireTripMember,
  requireOwner,
  asyncHandler(async (req, res) => {
    res.json(await memberService.rejectRequest(req.trip.id, req.params.requestId as string));
  }),
);

// --- Gallery ---

tripsRouter.get(
  '/:tripId/media',
  requireTripMember,
  validate(mediaQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as MediaQueryInput;
    res.json(await mediaService.listMedia(req.trip.id, req.member, query));
  }),
);

tripsRouter.post(
  '/:tripId/media/initiate',
  requireTripMember,
  initiateLimiter,
  validate(initiateUploadSchema),
  asyncHandler(async (req, res) => {
    const result = await mediaService.initiateUpload(req.trip.id, req.member, req.body);
    res.status(201).json(result);
  }),
);

tripsRouter.post(
  '/:tripId/media/bulk-download',
  requireTripMember,
  validate(bulkDownloadSchema),
  asyncHandler(async (req, res) => {
    const log = createLogger(req.requestId);
    const { mediaIds } = req.body as { mediaIds: string[] };
    const { stream, fileName } = await mediaService.bulkDownload(req.trip.id, req.member, mediaIds);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    stream.once('error', (err: unknown) => {
      log.error('Bulk download stream failed', err);
      // If headers are already sent we can only destroy the connection.
      res.destroy(err instanceof Error ? err : new Error('Bulk download failed'));
    });
    stream.pipe(res);
  }),
);
