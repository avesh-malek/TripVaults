import { Router } from 'express';
import { healthRouter } from './health.js';
import { tripsRouter } from './trips.js';
import { mediaRouter } from './media.js';
import { filesRouter } from './files.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/trips', tripsRouter);
apiRouter.use('/media', mediaRouter);
apiRouter.use('/files', filesRouter);
