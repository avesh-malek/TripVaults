import { Router } from 'express';
import { config } from '../config';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { asyncHandler } from '../middleware/asyncHandler';

function readVersion(): string {
  // dist/../package.json in prod, src/../../package.json under tsx.
  const candidates = [join(__dirname, '..', 'package.json'), join(__dirname, '..', '..', 'package.json')];
  for (const candidate of candidates) {
    try {
      if (existsSync(candidate)) {
        const pkg = JSON.parse(readFileSync(candidate, 'utf8')) as { version?: string };
        if (pkg.version) return pkg.version;
      }
    } catch {
      // fall through to default
    }
  }
  return '0.1.0';
}

export const healthRouter = Router();

healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ ok: true, version: readVersion(), storage: config.STORAGE_PROVIDER });
  }),
);
