import { config } from '../config.js';
import { LocalStorageProvider } from './local.js';
import { R2StorageProvider } from './r2.js';
import { SupabaseStorageProvider } from './supabase.js';
import type { StorageProvider } from './types.js';

export type { StorageProvider } from './types.js';
export { LocalStorageProvider, signFileUrl, verifyFileUrl } from './local.js';
export type { FileUrlPurpose } from './local.js';
export { R2StorageProvider } from './r2.js';
export { SupabaseStorageProvider } from './supabase.js';

export function createStorageProvider(): StorageProvider {
  if (config.STORAGE_PROVIDER === 'r2') {
    return new R2StorageProvider({
      endpoint: config.R2_ENDPOINT as string,
      bucket: config.R2_BUCKET as string,
      accessKeyId: config.R2_ACCESS_KEY_ID as string,
      secretAccessKey: config.R2_SECRET_ACCESS_KEY as string,
    });
  }
  if (config.STORAGE_PROVIDER === 'supabase') {
    return new SupabaseStorageProvider({
      supabaseUrl: config.SUPABASE_URL,
      serviceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY,
      bucket: config.SUPABASE_STORAGE_BUCKET as string,
    });
  }
  const secret = config.FILE_SIGNING_SECRET;
  if (!secret) {
    throw new Error('FILE_SIGNING_SECRET is required when STORAGE_PROVIDER=local');
  }
  return new LocalStorageProvider(config.STORAGE_LOCAL_DIR, config.API_PUBLIC_URL, secret);
}

/** Process-wide storage singleton. */
export const storage: StorageProvider = createStorageProvider();
