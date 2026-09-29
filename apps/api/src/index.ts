import { config } from './config';
import { createApp } from './app';
import { startExpirationJob } from './jobs/expirationJob';
import { logger } from './utils/logger';

function main(): void {
  const app = createApp();

  const server = app.listen(config.PORT, () => {
    logger.info(`TripVault API listening on port ${config.PORT} (storage: ${config.STORAGE_PROVIDER})`);
  });

  startExpirationJob();

  const shutdown = (signal: string): void => {
    logger.info(`Received ${signal}, shutting down...`);
    server.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });
    // Force-exit if connections linger.
    setTimeout(() => process.exit(0), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
