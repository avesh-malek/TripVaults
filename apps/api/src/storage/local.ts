import { createHmac, timingSafeEqual } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import * as path from 'node:path';
import { UPLOAD_URL_TTL_SECONDS, DOWNLOAD_URL_TTL_SECONDS } from '@tripvault/shared';
import type { StorageProvider } from './types.js';

export type FileUrlPurpose = 'upload' | 'download';

/** HMAC-SHA256 over `${key}:${exp}:${purpose}`. */
export function signFileUrl(key: string, exp: number, purpose: FileUrlPurpose, secret: string): string {
  return createHmac('sha256', secret).update(`${key}:${exp}:${purpose}`).digest('hex');
}

export interface VerifiedFileUrl {
  key: string;
  purpose: FileUrlPurpose;
  fileName?: string;
  contentType?: string;
}

/** Verify the sig/exp/purpose query params of a local file URL. Returns null when invalid. */
export function verifyFileUrl(
  key: string,
  query: { sig?: unknown; exp?: unknown; purpose?: unknown; filename?: unknown; contentType?: unknown },
  secret: string,
): VerifiedFileUrl | null {
  const { sig, exp, purpose, filename, contentType } = query;
  if (typeof sig !== 'string' || typeof exp !== 'string') return null;
  if (purpose !== 'upload' && purpose !== 'download') return null;
  const expNum = Number.parseInt(exp, 10);
  if (Number.isNaN(expNum) || expNum * 1000 <= Date.now()) return null;

  const expected = signFileUrl(key, expNum, purpose, secret);
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return {
    key,
    purpose,
    fileName: typeof filename === 'string' ? filename : undefined,
    contentType: typeof contentType === 'string' ? contentType : undefined,
  };
}

export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local' as const;

  constructor(
    private readonly baseDir: string,
    private readonly apiPublicUrl: string,
    private readonly secret: string,
  ) {}

  /** Resolve a storage key to a filesystem path, refusing path traversal. */
  private resolve(key: string): string {
    if (key.includes('..') || path.isAbsolute(key)) {
      throw new Error(`Unsafe storage key: ${key}`);
    }
    const base = path.resolve(this.baseDir);
    const resolved = path.resolve(base, key);
    if (resolved !== base && !resolved.startsWith(base + path.sep)) {
      throw new Error(`Unsafe storage key: ${key}`);
    }
    return resolved;
  }

  private encodeKey(key: string): string {
    return key.split('/').map(encodeURIComponent).join('/');
  }

  private signedUrl(key: string, purpose: FileUrlPurpose, expiresInSeconds: number, extra: string): string {
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const sig = signFileUrl(key, exp, purpose, this.secret);
    return `${this.apiPublicUrl}/api/files/${this.encodeKey(key)}?sig=${sig}&exp=${exp}&purpose=${purpose}${extra}`;
  }

  async getUploadUrl(key: string, contentType: string, expiresInSeconds = UPLOAD_URL_TTL_SECONDS): Promise<string> {
    return this.signedUrl(key, 'upload', expiresInSeconds, `&contentType=${encodeURIComponent(contentType)}`);
  }

  async getDownloadUrl(key: string, fileName: string, expiresInSeconds = DOWNLOAD_URL_TTL_SECONDS): Promise<string> {
    return this.signedUrl(key, 'download', expiresInSeconds, `&filename=${encodeURIComponent(fileName)}`);
  }

  async deleteObject(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }

  async deletePrefix(prefix: string): Promise<void> {
    // Prefixes map to directories (e.g. `trips/<id>/` → `trips/<id>`).
    const dir = this.resolve(prefix.replace(/\/+$/, ''));
    await fs.rm(dir, { recursive: true, force: true });
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async getObjectStream(key: string): Promise<NodeJS.ReadableStream> {
    return createReadStream(this.resolve(key));
  }

  async getObjectSize(key: string): Promise<number> {
    const stat = await fs.stat(this.resolve(key));
    return stat.size;
  }

  /** Write a fully-buffered upload body to the given key (used by PUT /api/files/*). */
  async writeObject(key: string, body: Buffer): Promise<void> {
    const target = this.resolve(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body);
  }
}
