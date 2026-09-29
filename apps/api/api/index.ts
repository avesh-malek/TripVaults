import { createApp } from '../src/app';

/**
 * Vercel serverless entry point.
 *
 * Exports the Express app as the request handler. There is deliberately no
 * `app.listen()` and no cron startup here — Vercel invokes the exported
 * handler per request, and the expiration lifecycle is driven by the lazy
 * sweep middleware registered in createApp().
 */
const app = createApp();

export default app;
