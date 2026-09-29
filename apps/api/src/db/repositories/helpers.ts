import type { PostgrestError } from '@supabase/supabase-js';
import { AppError } from '../../utils/appError';
import { logger } from '../../utils/logger';

/** Throw a 500 AppError on any Supabase error; otherwise return data. */
export function unwrap<T>(data: T | null, error: PostgrestError | null, what: string): T {
  if (error) {
    logger.error(`Supabase error (${what})`, error);
    throw new AppError(500, 'DATABASE_ERROR', 'A database error occurred.');
  }
  return data as T;
}
