/**
 * TripVault zod request schemas.
 *
 * Every schema below has a corresponding `*Input` type inferred with
 * `z.infer`. Backend routes validate request bodies/queries against these
 * schemas; the frontend can reuse them for client-side validation.
 */
import { z } from 'zod';

export const createTripSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  availabilityHours: z.number().int().min(1).max(336),
  accessType: z.enum(['open', 'approval']),
  ownerName: z.string().trim().min(1).max(50),
});

export type CreateTripInput = z.infer<typeof createTripSchema>;

export const updateTripSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  accessType: z.enum(['open', 'approval']).optional(),
});

export type UpdateTripInput = z.infer<typeof updateTripSchema>;

export const joinTripSchema = z.object({
  name: z.string().trim().min(1).max(50),
});

export type JoinTripInput = z.infer<typeof joinTripSchema>;

export const initiateUploadSchema = z.object({
  originalName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  fileSize: z.number().int().positive(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  duration: z.number().positive().optional(),
  fileHash: z.string().regex(/^[a-f0-9]{64}$/i),
  uploadMode: z.enum(['original', 'compressed']),
});

export type InitiateUploadInput = z.infer<typeof initiateUploadSchema>;

export const extendTripSchema = z.object({
  additionalDays: z.number().int().min(1).max(14),
});

export type ExtendTripInput = z.infer<typeof extendTripSchema>;

export const bulkDownloadSchema = z.object({
  mediaIds: z.array(z.string().uuid()).min(1).max(100),
});

export type BulkDownloadInput = z.infer<typeof bulkDownloadSchema>;

export const bulkDeleteSchema = z.object({
  mediaIds: z.array(z.string().uuid()).min(1).max(100),
});

export type BulkDeleteInput = z.infer<typeof bulkDeleteSchema>;

export const mediaQuerySchema = z.object({
  filter: z.enum(['all', 'photos', 'videos', 'mine']).default('all'),
  /** Filter gallery to media uploaded by a specific member. */
  uploaderId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(60),
  cursor: z.string().uuid().optional(),
});

export type MediaQueryInput = z.infer<typeof mediaQuerySchema>;
