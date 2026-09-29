import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { config } from './config';
import { requestId } from './middleware/requestId';
import { lazyExpirationSweep } from './middleware/lazyExpirationSweep';
import { errorHandler } from './middleware/errorHandler';
import { AppError } from './utils/appError';
import { apiRouter } from './routes';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGIN }));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestId);

  // On serverless (Vercel) there is no always-on process for node-cron, so
  // API traffic drives the hourly expiration sweep. The middleware's atomic
  // claim makes it safe on always-on deployments too.
  app.use(lazyExpirationSweep);

  // Global rate limit: 600 requests per 15 minutes per IP.
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 600,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please slow down.' } },
    }),
  );

  app.use('/api', apiRouter);

  // 404 for anything not matched above.
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new AppError(404, 'NOT_FOUND', 'Not found.'));
  });

  app.use(errorHandler);

  return app;
}
