import { SESSION_HEADER } from '@tripvault/shared';
import type { ApiErrorBody } from '@tripvault/shared';

/** Base URL of the TripVault API, e.g. `http://localhost:4000/api`. */
export const API_BASE =
  import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export class ApiError extends Error {
  status: number;
  code: string;
  /** Present on 409 DUPLICATE_MEDIA responses: the conflicting media record. */
  duplicate?: unknown;

  constructor(status: number, code: string, message: string, duplicate?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.duplicate = duplicate;
  }
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  sessionId?: string;
  query?: Record<string, string | number | boolean | undefined | null>;
}

function buildUrl(path: string, query?: ApiOptions['query']): string {
  const url = new URL(API_BASE + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

/**
 * Typed fetch wrapper. Throws `ApiError` (parsed from `ApiErrorBody`) on
 * non-2xx responses.
 */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, sessionId, query } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (sessionId) headers[SESSION_HEADER] = sessionId;

  const res = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const errBody = data as ApiErrorBody | null;
    throw new ApiError(
      res.status,
      errBody?.error?.code ?? 'REQUEST_FAILED',
      errBody?.error?.message ?? `Request failed with status ${res.status}`,
      (data as { duplicate?: unknown } | null)?.duplicate,
    );
  }

  return data as T;
}
