import dotenv from 'dotenv';

dotenv.config();

export type StorageProviderName = 'local' | 'r2' | 'supabase';

export interface ApiConfig {
  PORT: number;
  API_PUBLIC_URL: string;
  CORS_ORIGIN: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  STORAGE_PROVIDER: StorageProviderName;
  R2_ENDPOINT?: string;
  R2_BUCKET?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  SUPABASE_STORAGE_BUCKET?: string;
  STORAGE_LOCAL_DIR: string;
  /** Only required when STORAGE_PROVIDER=local (signs local file URLs). */
  FILE_SIGNING_SECRET: string;
  DOWNLOAD_URL_TTL_SECONDS: number;
  UPLOAD_URL_TTL_SECONDS: number;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name} (see apps/api/.env.example)`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function intOptional(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Env var ${name} must be a positive integer, got: ${raw}`);
  }
  return parsed;
}

function loadConfig(): ApiConfig {
  const port = intOptional('PORT', 4000);
  const storageProvider = optional('STORAGE_PROVIDER', 'local');
  if (storageProvider !== 'local' && storageProvider !== 'r2' && storageProvider !== 'supabase') {
    throw new Error(`Env var STORAGE_PROVIDER must be 'local', 'r2' or 'supabase', got: ${storageProvider}`);
  }

  const cfg: ApiConfig = {
    PORT: port,
    API_PUBLIC_URL: optional('API_PUBLIC_URL', `http://localhost:${port}`),
    CORS_ORIGIN: optional('CORS_ORIGIN', 'http://localhost:5173'),
    SUPABASE_URL: required('SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),
    STORAGE_PROVIDER: storageProvider,
    STORAGE_LOCAL_DIR: optional('STORAGE_LOCAL_DIR', './storage'),
    // Only the local provider signs file URLs itself; the other providers
    // issue storage-native signed URLs and need no signing secret.
    FILE_SIGNING_SECRET:
      storageProvider === 'local' ? required('FILE_SIGNING_SECRET') : optional('FILE_SIGNING_SECRET', ''),
    DOWNLOAD_URL_TTL_SECONDS: intOptional('DOWNLOAD_URL_TTL_SECONDS', 900),
    UPLOAD_URL_TTL_SECONDS: intOptional('UPLOAD_URL_TTL_SECONDS', 3600),
  };

  if (storageProvider === 'r2') {
    cfg.R2_ENDPOINT = required('R2_ENDPOINT');
    cfg.R2_BUCKET = required('R2_BUCKET');
    cfg.R2_ACCESS_KEY_ID = required('R2_ACCESS_KEY_ID');
    cfg.R2_SECRET_ACCESS_KEY = required('R2_SECRET_ACCESS_KEY');
  }

  if (storageProvider === 'supabase') {
    cfg.SUPABASE_STORAGE_BUCKET = optional('SUPABASE_STORAGE_BUCKET', 'tripvault-media');
  }

  return cfg;
}

export const config: ApiConfig = loadConfig();
