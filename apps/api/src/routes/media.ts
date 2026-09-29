import { Router } from 'express';
import type { MediaVariant } from '@tripvault/shared';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireMediaMember } from '../middleware/requireTripMember';
import { AppError } from '../utils/appError';
import { mediaService } from '../services/mediaService';

export const mediaRouter = Router();

const DOWNLOAD_VARIANTS: MediaVariant[] = ['original', 'compressed'];

mediaRouter.post(
  '/:id/complete',
  requireMediaMember,
  asyncHandler(async (req, res) => {
    res.json(await mediaService.completeUpload(req.media, req.member));
  }),
);

mediaRouter.post(
  '/:id/fail',
  requireMediaMember,
  asyncHandler(async (req, res) => {
    res.json(await mediaService.failUpload(req.media, req.member));
  }),
);

mediaRouter.delete(
  '/:id',
  requireMediaMember,
  asyncHandler(async (req, res) => {
    res.json(await mediaService.deleteMedia(req.media, req.member));
  }),
);

mediaRouter.get(
  '/:id/urls',
  requireMediaMember,
  asyncHandler(async (req, res) => {
    res.json(await mediaService.getMediaUrls(req.media));
  }),
);

mediaRouter.get(
  '/:id/download',
  requireMediaMember,
  asyncHandler(async (req, res) => {
    const raw = typeof req.query.variant === 'string' ? req.query.variant : 'original';
    if (!DOWNLOAD_VARIANTS.includes(raw as MediaVariant)) {
      throw new AppError(400, 'INVALID_VARIANT', 'variant must be "original" or "compressed".');
    }
    res.json(await mediaService.getDownloadUrl(req.media, raw as MediaVariant));
  }),
);
