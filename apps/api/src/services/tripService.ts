import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  buildStoragePrefix,
  createTripSchema,
  extendTripSchema,
  MAX_GALLERY_DAYS_FREE,
  updateTripSchema,
  type CreateTripResponse,
  type Trip,
  type TripDetailResponse,
  type TripMember,
} from '@tripvault/shared';
import { tripRepository } from '../db/repositories/tripRepository';
import { memberRepository, toPublic } from '../db/repositories/memberRepository';
import { mediaRepository } from '../db/repositories/mediaRepository';
import { joinRequestRepository } from '../db/repositories/joinRequestRepository';
import { ensureUniqueInviteCode } from '../utils/inviteCode';
import { addDays, daysUntil, MS_PER_DAY } from '../utils/time';
import { AppError } from '../utils/appError';
import { storage } from '../storage';

type CreateTripInput = z.infer<typeof createTripSchema>;
type UpdateTripInput = z.infer<typeof updateTripSchema>;
type ExtendTripInput = z.infer<typeof extendTripSchema>;

async function purgeTripData(trip: Trip): Promise<void> {
  // Best-effort object cleanup first; DB rows are removed regardless.
  try {
    await storage.deletePrefix(buildStoragePrefix(trip.id));
  } catch {
    // Continue with row cleanup even if object deletion fails.
  }
  await mediaRepository.deleteByTrip(trip.id);
  await memberRepository.deleteByTrip(trip.id);
  await joinRequestRepository.deleteByTrip(trip.id);
}

export const tripService = {
  async createTrip(input: CreateTripInput, sessionId: string): Promise<CreateTripResponse> {
    const inviteCode = await ensureUniqueInviteCode();
    const expiresAt = addDays(new Date(), input.availabilityDays);

    const trip = await tripRepository.create({
      id: randomUUID(),
      name: input.name,
      description: input.description ?? null,
      owner_member_id: null,
      invite_code: inviteCode,
      access_type: input.accessType,
      expires_at: expiresAt.toISOString(),
      status: 'active',
    });

    const owner = await memberRepository.create({
      id: randomUUID(),
      trip_id: trip.id,
      session_id: sessionId,
      name: input.ownerName,
      role: 'owner',
      status: 'active',
    });

    const withOwner = await tripRepository.update(trip.id, { owner_member_id: owner.id });

    return { trip: withOwner, member: toPublic(owner) };
  },

  async getTripDetail(tripId: string, member: TripMember): Promise<TripDetailResponse> {
    const trip = await tripRepository.findById(tripId);
    if (!trip) throw new AppError(404, 'TRIP_NOT_FOUND', 'Trip not found.');

    const [memberCount, photoCount, videoCount] = await Promise.all([
      memberRepository.countActiveByTrip(tripId),
      mediaRepository.countReadyByTripAndKind(tripId, 'image'),
      mediaRepository.countReadyByTripAndKind(tripId, 'video'),
    ]);

    return {
      trip,
      memberCount,
      photoCount,
      videoCount,
      myMember: toPublic(member),
      isOwner: member.role === 'owner',
      expiresInDays: Math.max(0, daysUntil(trip.expires_at)),
    };
  },

  async updateTrip(tripId: string, input: UpdateTripInput): Promise<{ trip: Trip }> {
    const patch: { name?: string; description?: string | null; access_type?: 'open' | 'approval' } = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description;
    if (input.accessType !== undefined) patch.access_type = input.accessType;
    const trip = await tripRepository.update(tripId, patch);
    return { trip };
  },

  async extendTrip(trip: Trip, input: ExtendTripInput): Promise<{ trip: Trip }> {
    const now = new Date();
    const base = Math.max(now.getTime(), new Date(trip.expires_at).getTime());
    const newExpiry = new Date(base + input.additionalDays * MS_PER_DAY);

    // Free-tier cap: the gallery may live at most MAX_GALLERY_DAYS_FREE days from creation.
    const totalLifetimeMs = newExpiry.getTime() - new Date(trip.created_at).getTime();
    if (totalLifetimeMs > MAX_GALLERY_DAYS_FREE * MS_PER_DAY) {
      throw new AppError(
        422,
        'EXTENSION_LIMIT_EXCEEDED',
        `Trips can be extended to at most ${MAX_GALLERY_DAYS_FREE} days from creation on the free plan.`,
      );
    }

    const updated = await tripRepository.update(trip.id, {
      expires_at: newExpiry.toISOString(),
      status: 'active',
    });
    return { trip: updated };
  },

  async closeTrip(tripId: string): Promise<{ trip: Trip }> {
    const trip = await tripRepository.updateStatus(tripId, 'expired');
    return { trip };
  },

  /** Owner-initiated deletion: purge objects + rows immediately, keep the trip row as 'deleted'. */
  async deleteTrip(trip: Trip): Promise<{ deleted: true }> {
    await purgeTripData(trip);
    await tripRepository.updateStatus(trip.id, 'deleted');
    return { deleted: true };
  },

  /** Used by the expiration lifecycle for trips past the grace period. */
  async purgeDeletedTrip(trip: Trip): Promise<void> {
    await purgeTripData(trip);
    await tripRepository.updateStatus(trip.id, 'deleted');
  },
};
