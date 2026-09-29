import cron from 'node-cron';
import { expirationService } from '../services/expirationService';
import { logger } from '../utils/logger';

async function runOnce(reason: string): Promise<void> {
  try {
    const summary = await expirationService.runLifecycle();
    logger.info(
      `Expiration lifecycle (${reason}): expiringSoon=${summary.expiringSoon} expired=${summary.expired} ` +
        `gracePeriod=${summary.gracePeriod} deleted=${summary.deleted} videosPromoted=${summary.videosPromoted}`,
    );
  } catch (err) {
    logger.error('Expiration lifecycle failed', err);
  }
}

/** Hourly lifecycle pass, plus one run on boot. */
export function startExpirationJob(): void {
  void runOnce('boot');
  cron.schedule('0 * * * *', () => {
    void runOnce('hourly');
  });
}
