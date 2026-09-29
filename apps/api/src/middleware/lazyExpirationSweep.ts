import type { NextFunction, Request, Response } from 'express';
import { supabase } from '../db/supabase.js';
import { runExpirationCycle } from '../jobs/expirationJob.js';
import { logger } from '../utils/logger.js';

/** Minimum gap between lazy sweeps. */
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Serverless-friendly expiration sweep.
 *
 * Vercel has no always-on process, so node-cron cannot run there. Instead,
 * API traffic drives the sweep: the middleware checks the single-row
 * `sweep_state` table and atomically claims the sweep with a conditional
 * UPDATE (`last_run_at IS NULL OR last_run_at < now() - interval '1 hour'`),
 * so at most one instance per hour actually runs it. The sweep itself is
 * fire-and-forget — request handling is never blocked and failures are only
 * logged. The claim query is the only concurrency control, so the operation
 * is safe even if many instances race it.
 */
export function lazyExpirationSweep(_req: Request, _res: Response, next: NextFunction): void {
  void maybeSweep().catch((err) => logger.error('Lazy expiration sweep failed', err));
  next();
}

async function maybeSweep(): Promise<void> {
  // Insert the singleton row first if it is missing (migration 002 also
  // seeds it; this is belt-and-braces for databases migrated manually).
  const { error: insertError } = await supabase
    .from('sweep_state')
    .upsert({ id: 1 }, { onConflict: 'id', ignoreDuplicates: true });
  if (insertError) {
    logger.warn(`sweep_state upsert failed: ${insertError.message}`);
    return;
  }

  const cutoff = new Date(Date.now() - SWEEP_INTERVAL_MS).toISOString();
  const { data, error } = await supabase
    .from('sweep_state')
    .update({ last_run_at: new Date().toISOString() })
    .eq('id', 1)
    .or(`last_run_at.is.null,last_run_at.lt.${cutoff}`)
    .select('id');

  if (error) {
    logger.warn(`sweep_state sweep claim failed: ${error.message}`);
    return;
  }
  if (!data || data.length === 0) {
    // Another instance claimed the sweep within the last hour.
    return;
  }

  logger.info('Claimed hourly expiration sweep (lazy).');
  try {
    await runExpirationCycle();
  } catch (err) {
    logger.error('Lazy expiration sweep run failed', err);
  }
}
