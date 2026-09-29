import cron from 'node-cron';
import { expirationService, type LifecycleSummary } from '../services/expirationService.js';
import { logger } from '../utils/logger.js';

/**
 * The expiration sweep itself. Idempotent: every transition sets an explicit
 * status and the purge path deletes rows/objects that are already gone as a
 * no-op, so overlapping runs (cron + lazy serverless sweep) are harmless.
 */
export async function runExpirationCycle(now: Date = new Date()): Promise<LifecycleSummary> {
  return expirationService.runLifecycle(now);
}

async function runOnce(reason: string): Promise<void> {
  try {
    const summary = await runExpirationCycle();
    logger.info(
      `Expiration lifecycle (${reason}): expiringSoon=${summary.expiringSoon} expired=${summary.expired} ` +
        `gracePeriod=${summary.gracePeriod} deleted=${summary.deleted} videosPromoted=${summary.videosPromoted}`,
    );
  } catch (err) {
    logger.error('Expiration lifecycle failed', err);
  }
}

/**
 * Hourly lifecycle pass, plus one run on boot. Only for always-on
 * deployments; on Vercel the lazy sweep middleware (registered in
 * createApp) keeps the lifecycle running instead.
 */
export function startExpirationJob(): void {
  void runOnce('boot');
  cron.schedule('0 * * * *', () => {
    void runOnce('hourly');
  });
}
