import {
  EXPIRING_SOON_THRESHOLD_HOURS,
  GRACE_PERIOD_DAYS,
  GRACE_WARNING_DAYS,
  VIDEO_PROCESSING_READY_AFTER_MINUTES,
} from '@tripvault/shared';
import { tripRepository } from '../db/repositories/tripRepository';
import { mediaRepository } from '../db/repositories/mediaRepository';
import { tripService } from './tripService';
import { addDays, addHours, addMinutes } from '../utils/time';
import { logger } from '../utils/logger';

export interface LifecycleSummary {
  expiringSoon: number;
  expired: number;
  gracePeriod: number;
  deleted: number;
  videosPromoted: number;
}

export const expirationService = {
  /**
   * Hourly lifecycle pass:
   *  - active && expires within 48h          → expiring_soon
   *  - active/expiring_soon && expired       → expired
   *  - expired && expired 5+ days ago        → grace_period
   *  - expired/grace_period && expired 7+ days ago → purge + deleted
   */
  async runLifecycle(now: Date = new Date()): Promise<LifecycleSummary> {
    const summary: LifecycleSummary = { expiringSoon: 0, expired: 0, gracePeriod: 0, deleted: 0, videosPromoted: 0 };

    const soonCutoff = addHours(now, EXPIRING_SOON_THRESHOLD_HOURS).toISOString();
    const nowIso = now.toISOString();

    const toWarn = await tripRepository.findActiveExpiringBetween(nowIso, soonCutoff);
    for (const trip of toWarn) {
      await tripRepository.updateStatus(trip.id, 'expiring_soon');
      summary.expiringSoon += 1;
    }

    const toExpire = await tripRepository.findLiveExpiredBefore(nowIso);
    for (const trip of toExpire) {
      await tripRepository.updateStatus(trip.id, 'expired');
      summary.expired += 1;
    }

    const graceCutoff = addDays(now, -GRACE_WARNING_DAYS).toISOString();
    const toGrace = await tripRepository.findExpiredBefore(graceCutoff);
    for (const trip of toGrace) {
      await tripRepository.updateStatus(trip.id, 'grace_period');
      summary.gracePeriod += 1;
    }

    const deleteCutoff = addDays(now, -GRACE_PERIOD_DAYS).toISOString();
    const toDelete = await tripRepository.findDeletableBefore(deleteCutoff);
    for (const trip of toDelete) {
      try {
        await tripService.purgeDeletedTrip(trip);
        summary.deleted += 1;
      } catch (err) {
        logger.error(`Failed to purge trip ${trip.id}`, err);
      }
    }

    summary.videosPromoted = await expirationService.promoteProcessingVideos(now);
    return summary;
  },

  /**
   * Documented stub for a future background video worker: videos left in
   * 'processing' longer than VIDEO_PROCESSING_READY_AFTER_MINUTES are
   * assumed done and flipped to 'ready'.
   */
  async promoteProcessingVideos(now: Date = new Date()): Promise<number> {
    const cutoff = addMinutes(now, -VIDEO_PROCESSING_READY_AFTER_MINUTES).toISOString();
    const stale = await mediaRepository.findStaleProcessing(cutoff);
    for (const media of stale) {
      await mediaRepository.setStatus(media.id, 'ready');
    }
    return stale.length;
  },
};
