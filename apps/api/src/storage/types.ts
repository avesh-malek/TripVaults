/** Abstraction over the object store (Cloudflare R2, local filesystem, or Supabase Storage). */
export interface StorageProvider {
  readonly name: 'r2' | 'local' | 'supabase';

  /** Time-limited URL the client can PUT the file to. */
  getUploadUrl(key: string, contentType: string, expiresInSeconds?: number): Promise<string>;

  /** Time-limited URL the client can GET the file from (download as attachment). */
  getDownloadUrl(key: string, fileName: string, expiresInSeconds?: number): Promise<string>;

  deleteObject(key: string): Promise<void>;

  /** Delete every object under a key prefix (e.g. a whole trip). */
  deletePrefix(prefix: string): Promise<void>;

  objectExists(key: string): Promise<boolean>;

  getObjectStream(key: string): Promise<NodeJS.ReadableStream>;

  getObjectSize(key: string): Promise<number>;
}
