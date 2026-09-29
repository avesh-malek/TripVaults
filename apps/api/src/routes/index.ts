import { Router } from 'express';
import { healthRouter } from './health';
import { tripsRouter } from './trips';
import { mediaRouter } from './media';
import { filesRouter } from './files';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/trips', tripsRouter);
apiRouter.use('/media', mediaRouter);
apiRouter.use('/files', filesRouter);
