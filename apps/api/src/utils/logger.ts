type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function format(level: LogLevel, requestId: string | undefined, message: string): string {
  const ts = new Date().toISOString();
  const rid = requestId ? ` [req:${requestId}]` : '';
  return `${ts} [${level.toUpperCase()}]${rid} ${message}`;
}

export interface Logger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string, err?: unknown): void;
}

export function createLogger(requestId?: string): Logger {
  return {
    debug: (message: string) => console.debug(format('debug', requestId, message)),
    info: (message: string) => console.info(format('info', requestId, message)),
    warn: (message: string) => console.warn(format('warn', requestId, message)),
    error: (message: string, err?: unknown) => {
      const detail = err instanceof Error ? ` :: ${err.stack ?? err.message}` : err !== undefined ? ` :: ${String(err)}` : '';
      console.error(format('error', requestId, `${message}${detail}`));
    },
  };
}

/** Logger without a request id, for boot/jobs. */
export const logger = createLogger();
