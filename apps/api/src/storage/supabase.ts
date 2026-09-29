import { Readable } from 'node:stream';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { UPLOAD_URL_TTL_SECONDS, DOWNLOAD_URL_TTL_SECONDS } from '@tripvault/shared';
import type { StorageProvider } from './types';
import { logger } from '../utils/logger';

/**
 * Supabase Storage backend.
 *
 * Browser upload semantics (verified against @supabase/storage-js 2.x):
 * - `createSignedUploadUrl(key, { upsert: true })` returns
 *   `{ signedUrl, token, path }` where signedUrl is
 *   `https://<project>.supabase.co/storage/v1/object/upload/sign/<bucket>/<key>?token=<TOKEN>`.
 *   Signed upload URLs are valid for a fixed 2 hours (not configurable).
 * - The browser uploads with `PUT <signedUrl>` and the raw file bytes as the
 *   body, setting `Content-Type` to the file's MIME type. The storage server
 *   routes signed uploads through the same `fileUploadFromRequest` pipeline
 *   as authenticated uploads, so raw (non-multipart) bodies are accepted; the
 *   SDK itself sends multipart/form-data for Blob bodies, which is the other
 *   accepted shape.
 */
export class SupabaseStorageProvider implements StorageProvider {
  readonly name = 'supabase' as const;

  private readonly client: SupabaseClient;
  private readonly bucket: string;
  private bucketReady: Promise<void> | null = null;

  constructor(opts: { supabaseUrl: string; serviceRoleKey: string; bucket: string }) {
    this.bucket = opts.bucket;
    this.client = createClient(opts.supabaseUrl, opts.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  private bucketApi() {
    return this.client.storage.from(this.bucket);
  }

  /**
   * Create the bucket as private on first use. Idempotent: concurrent
   * creators are tolerated by re-listing after a creation conflict.
   */
  private ensureBucket(): Promise<void> {
    if (!this.bucketReady) {
      this.bucketReady = (async () => {
        const { data: buckets, error: listError } = await this.client.storage.listBuckets();
        if (listError) {
          throw new Error(`Supabase storage listBuckets failed: ${listError.message}`);
        }
        if ((buckets ?? []).some((b) => b.name === this.bucket)) return;

        const { error: createError } = await this.client.storage.createBucket(this.bucket, {
          public: false,
        });
        if (createError) {
          const { data: retry, error: retryError } = await this.client.storage.listBuckets();
          const exists = !retryError && (retry ?? []).some((b) => b.name === this.bucket);
          if (!exists) {
            throw new Error(`Supabase storage createBucket failed: ${createError.message}`);
          }
        }
        logger.info(`Supabase storage bucket ready: ${this.bucket}`);
      })();
    }
    return this.bucketReady;
  }

  async getUploadUrl(key: string, _contentType: string, _expiresInSeconds = UPLOAD_URL_TTL_SECONDS): Promise<string> {
    // NOTE: Supabase fixes signed upload URL validity at 2 hours; the
    // expiresInSeconds argument is accepted for interface compatibility only.
    await this.ensureBucket();
    const { data, error } = await this.bucketApi().createSignedUploadUrl(key, { upsert: true });
    if (error || !data) {
      throw new Error(`Supabase createSignedUploadUrl failed for ${key}: ${error?.message ?? 'unknown error'}`);
    }
    return data.signedUrl;
  }

  async getDownloadUrl(key: string, fileName: string, expiresInSeconds = DOWNLOAD_URL_TTL_SECONDS): Promise<string> {
    await this.ensureBucket();
    const { data, error } = await this.bucketApi().createSignedUrl(key, expiresInSeconds, {
      download: sanitizeFileName(fileName),
    });
    if (error || !data) {
      throw new Error(`Supabase createSignedUrl failed for ${key}: ${error?.message ?? 'unknown error'}`);
    }
    return data.signedUrl;
  }

  async deleteObject(key: string): Promise<void> {
    await this.ensureBucket();
    const { error } = await this.bucketApi().remove([key]);
    if (error) {
      throw new Error(`Supabase remove failed for ${key}: ${error.message}`);
    }
  }

  async deletePrefix(prefix: string): Promise<void> {
    await this.ensureBucket();
    const normalized = prefix.replace(/\/+$/, '');
    let cursor: string | undefined;
    do {
      const { data, error } = await this.bucketApi().listV2({ prefix: normalized, limit: 100, cursor });
      if (error || !data) {
        throw new Error(`Supabase listV2 failed for prefix ${normalized}: ${error?.message ?? 'unknown error'}`);
      }
      const keys = data.objects
        .map((o) => o.key ?? o.name)
        .filter((k): k is string => typeof k === 'string' && k.length > 0);
      if (keys.length > 0) {
        const { error: removeError } = await this.bucketApi().remove(keys);
        if (removeError) {
          throw new Error(`Supabase remove failed for prefix ${normalized}: ${removeError.message}`);
        }
      }
      cursor = data.hasNext ? data.nextCursor : undefined;
    } while (cursor);
  }

  async objectExists(key: string): Promise<boolean> {
    await this.ensureBucket();
    const { data, error } = await this.bucketApi().exists(key);
    if (error) {
      throw new Error(`Supabase exists failed for ${key}: ${error.message}`);
    }
    return data;
  }

  async getObjectStream(key: string): Promise<NodeJS.ReadableStream> {
    await this.ensureBucket();
    const { data, error } = await this.bucketApi().download(key);
    if (error || !data) {
      throw new Error(`Supabase download failed for ${key}: ${error?.message ?? 'unknown error'}`);
    }
    // Stream the Blob's web ReadableStream into Node without buffering the
    // whole object in memory.
    return Readable.fromWeb(data.stream() as unknown as import('node:stream/web').ReadableStream);
  }

  async getObjectSize(key: string): Promise<number> {
    await this.ensureBucket();
    const { data, error } = await this.bucketApi().info(key);
    if (error || !data) {
      throw new Error(`Supabase info failed for ${key}: ${error?.message ?? 'unknown error'}`);
    }
    return data.size ?? 0;
  }
}

/** Quote a filename for use in a Content-Disposition header. */
function sanitizeFileName(fileName: string): string {
  return fileName.replace(/["\\\r\n]/g, '_');
}
