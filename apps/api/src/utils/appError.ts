import type { MediaListItem } from '@tripvault/shared';

/** Application error with an HTTP status and a machine-readable code. */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Thrown by mediaService.initiateUpload when the file hash already exists in the trip. */
export class DuplicateError extends AppError {
  readonly duplicate: MediaListItem;

  constructor(duplicate: MediaListItem) {
    super(409, 'DUPLICATE_MEDIA', 'This file has already been uploaded to this trip.');
    this.name = 'DuplicateError';
    this.duplicate = duplicate;
  }
}
