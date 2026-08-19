import { Request, Response, NextFunction } from 'express';
import { metricsService } from '../services/metricsService';
import { Logger, sanitizeSecretString } from '../utils/logger';

const httpLogger = new Logger('HTTP');

/**
 * Middleware tự động ghi log có cấu trúc và đo latency/metrics cho mọi HTTP request
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, originalUrl } = req;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const { statusCode } = res;
    const sanitizedUrl = sanitizeSecretString(originalUrl);
    const routePath = originalUrl.split('?')[0];

    // Ghi nhận metrics theo route path (không gom lẫn query params bí mật)
    metricsService.recordRequest(method, routePath, statusCode, durationMs);

    // Ghi structured log đã che giấu secrets
    const meta = {
      method,
      url: sanitizedUrl,
      status: statusCode,
      durationMs,
      ip,
    };

    if (statusCode >= 500) {
      httpLogger.error(`${method} ${sanitizedUrl} ${statusCode} - ${durationMs}ms`, meta);
    } else if (statusCode >= 400) {
      httpLogger.warn(`${method} ${sanitizedUrl} ${statusCode} - ${durationMs}ms`, meta);
    } else {
      httpLogger.info(`${method} ${sanitizedUrl} ${statusCode} - ${durationMs}ms`, meta);
    }
  });

  next();
}
