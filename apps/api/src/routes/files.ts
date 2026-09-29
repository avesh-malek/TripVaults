import { Router, type Request } from 'express';
import express from 'express';
import { config } from '../config.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../utils/appError.js';
import { createLogger } from '../utils/logger.js';
import { LocalStorageProvider, storage, verifyFileUrl } from '../storage/index.js';
export const filesRouter = Router();

function contentTypeFor(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    case 'mp4':
      return 'video/mp4';
    case 'mov':
      return 'video/quicktime';
    default:
      return 'application/octet-stream';
  }
}

function localProvider(): LocalStorageProvider {
  if (config.STORAGE_PROVIDER !== 'local' || !(storage instanceof LocalStorageProvider)) {
    throw new AppError(404, 'NOT_FOUND', 'Not found.');
  }
  return storage;
}

function wildcardKey(req: Request): string {
  // Express 4 exposes the `*` capture as req.params[0].
  const key = (req.params as unknown as string[])[0] ?? '';
  if (!key || key.includes('..')) {
    throw new AppError(400, 'INVALID_KEY', 'Invalid file key.');
  }
  return key;
}

/**
 * Signed download: streams the file as an attachment.
 * Query: sig, exp, purpose=download, filename.
 */
filesRouter.get(
  '/*',
  asyncHandler(async (req, res) => {
    const provider = localProvider();
    const key = wildcardKey(req);
    const verified = verifyFileUrl(key, req.query, config.FILE_SIGNING_SECRET);
    if (!verified) {
      throw new AppError(403, 'INVALID_SIGNATURE', 'The file URL signature is invalid.');
    }
    if (verified.purpose !== 'download') {
      throw new AppError(403, 'INVALID_PURPOSE', 'This URL is not valid for downloads.');
    }
    if (!(await provider.objectExists(key))) {
      throw new AppError(404, 'FILE_NOT_FOUND', 'File not found.');
    }
    const fileName = verified.fileName ?? key.split('/').pop() ?? 'file';
    res.setHeader('Content-Type', contentTypeFor(key));
    res.setHeader('Content-Disposition', `attachment; filename="${fileName.replace(/["\\\r\n]/g, '_')}"`);
    const stream = await provider.getObjectStream(key);
    stream.once('error', (err: unknown) => {
      createLogger(req.requestId).error(`File stream failed for ${key}`, err);
      res.destroy(err instanceof Error ? err : new Error('File stream failed'));
    });
    stream.pipe(res);
  }),
);

/**
 * Signed upload: writes the raw request body to the storage key.
 * Query: sig, exp, purpose=upload, contentType.
 */
filesRouter.put(
  '/*',
  express.raw({ type: '*/*', limit: '2gb' }),
  asyncHandler(async (req, res) => {
    const provider = localProvider();
    const key = wildcardKey(req);
    const verified = verifyFileUrl(key, req.query, config.FILE_SIGNING_SECRET);
    if (!verified) {
      throw new AppError(403, 'INVALID_SIGNATURE', 'The file URL signature is invalid.');
    }
    if (verified.purpose !== 'upload') {
      throw new AppError(403, 'INVALID_PURPOSE', 'This URL is not valid for uploads.');
    }
    const body: unknown = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new AppError(400, 'EMPTY_BODY', 'The upload body is empty.');
    }
    await provider.writeObject(key, body);
    res.json({ ok: true });
  }),
);
