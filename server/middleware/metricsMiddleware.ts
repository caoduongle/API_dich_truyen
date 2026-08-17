import { Request, Response, NextFunction } from 'express';
import { metricsService } from '../services/metricsService';
import { Logger } from '../utils/logger';

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

    // Ghi nhận metrics
    metricsService.recordRequest(method, originalUrl, statusCode, durationMs);

    // Ghi structured log
    const meta = {
      method,
      url: originalUrl,
      status: statusCode,
      durationMs,
      ip,
    };

    if (statusCode >= 500) {
      httpLogger.error(`${method} ${originalUrl} ${statusCode} - ${durationMs}ms`, meta);
    } else if (statusCode >= 400) {
      httpLogger.warn(`${method} ${originalUrl} ${statusCode} - ${durationMs}ms`, meta);
    } else {
      httpLogger.info(`${method} ${originalUrl} ${statusCode} - ${durationMs}ms`, meta);
    }
  });

  next();
}
