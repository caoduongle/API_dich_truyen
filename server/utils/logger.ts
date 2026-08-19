/**
 * Structured Logger Module for Node.js Backend
 * Chuẩn hóa toàn bộ logs theo định dạng có cấu trúc (JSON / Structured Log)
 * Tự động che dấu khóa nhạy cảm (API Keys, Passwords).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const CURRENT_LOG_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) ||
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

/**
 * Làm sạch chuỗi tự do (URL, query string, message, error stack),
 * che giấu tất cả các token, API key, password, secret, Bearer auth.
 */
export function sanitizeSecretString(str: string): string {
  if (!str || typeof str !== 'string') return str;

  let sanitized = str;

  // 1. Che giấu Google Gemini API keys: AIzaSy...
  sanitized = sanitized.replace(/AIza[0-9A-Za-z-_]{35}/g, 'AIza***[REDACTED]');

  // 2. Che giấu token / key / password trong query strings hoặc gán key-value:
  // Khớp: ?token=..., &token=..., token=..., apiKey=..., access_token=..., password=..., secret=...
  sanitized = sanitized.replace(
    /((?:[?&]|\b)(?:token|apikey|api_key|password|secret|key|access_token)=)([^&\s"'`]+)/gi,
    '$1[REDACTED]'
  );

  // 3. Che giấu Bearer tokens trong header Authorization hoặc log message
  sanitized = sanitized.replace(
    /(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi,
    '$1[REDACTED]'
  );

  return sanitized;
}

export function sanitizeValue(val: any): any {
  if (!val) return val;
  if (typeof val === 'string') {
    return sanitizeSecretString(val);
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeValue);
  }
  if (typeof val === 'object') {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (/(?:password|secret|apikey|api_key|token|authorization|^key$|[_-]key$)/i.test(k) && typeof v === 'string') {
        clean[k] = v.length > 8 ? `${v.slice(0, 4)}...[REDACTED]` : '***';
      } else {
        clean[k] = sanitizeValue(v);
      }
    }
    return clean;
  }
  return val;
}

export class Logger {
  private context: string;

  constructor(context: string = 'App') {
    this.context = context;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LOG_LEVEL];
  }

  private formatMessage(level: LogLevel, message: string, meta?: any): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const sanitizedMessage = sanitizeSecretString(message);
    const sanitizedMeta = meta ? sanitizeValue(meta) : undefined;

    const logEntry = {
      timestamp,
      level,
      context: this.context,
      message: sanitizedMessage,
      ...(sanitizedMeta !== undefined && { meta: sanitizedMeta }),
    };

    const isProd = process.env.NODE_ENV === 'production';

    if (isProd) {
      // Production: In chuẩn JSON single-line cho Log Aggregator (CloudWatch, Datadog, GCP Logs)
      const jsonStr = JSON.stringify(logEntry);
      if (level === 'error') {
        console.error(jsonStr);
      } else if (level === 'warn') {
        console.warn(jsonStr);
      } else {
        console.log(jsonStr);
      }
    } else {
      // Development: In màu dễ đọc
      const color =
        level === 'error' ? '\x1b[31m' :
        level === 'warn' ? '\x1b[33m' :
        level === 'debug' ? '\x1b[36m' : '\x1b[32m';
      const reset = '\x1b[0m';
      const metaStr = sanitizedMeta ? ` ${JSON.stringify(sanitizedMeta)}` : '';
      const output = `${color}[${timestamp}] [${level.toUpperCase()}] [${this.context}]${reset} ${sanitizedMessage}${metaStr}`;

      if (level === 'error') {
        console.error(output);
      } else if (level === 'warn') {
        console.warn(output);
      } else {
        console.log(output);
      }
    }
  }

  debug(message: string, meta?: any): void {
    this.formatMessage('debug', message, meta);
  }

  info(message: string, meta?: any): void {
    this.formatMessage('info', message, meta);
  }

  warn(message: string, meta?: any): void {
    this.formatMessage('warn', message, meta);
  }

  error(message: string, meta?: any): void {
    this.formatMessage('error', message, meta);
  }
}

export const logger = new Logger('Server');
