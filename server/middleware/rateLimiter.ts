import { Request, Response, NextFunction } from "express";
import Redis from "ioredis";
import { SERVER_CONFIG } from "@shared/constants";

export interface RateLimiterOptions {
  windowMs?: number;
  maxRequests?: number;
  keyPrefix?: string;
  message?: string;
}

const MAX_LOCAL_MAP_ENTRIES = 10000;

export function createRateLimiter(options?: RateLimiterOptions) {
  const windowMs = options?.windowMs ?? SERVER_CONFIG.RATE_LIMIT_WINDOW_MS;
  const maxRequests = options?.maxRequests ?? SERVER_CONFIG.RATE_LIMIT_MAX_REQUESTS;
  const keyPrefix = options?.keyPrefix ?? "ratelimit:";
  const redisUrl = process.env.REDIS_URL;

  // Bounded in-memory fallback store
  const localCounts = new Map<string, { count: number; resetTime: number }>();

  const cleanupLocalMap = () => {
    const now = Date.now();
    for (const [ip, data] of localCounts) {
      if (now > data.resetTime) {
        localCounts.delete(ip);
      }
    }
  };

  const cleanupInterval = setInterval(cleanupLocalMap, 60 * 1000);
  if (cleanupInterval && typeof cleanupInterval.unref === 'function') {
    cleanupInterval.unref();
  }

  const applyLocalLimit = (ip: string, req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();

    // Guard chống tràn memory nếu số IP vượt 10,000
    if (localCounts.size >= MAX_LOCAL_MAP_ENTRIES) {
      cleanupLocalMap();
      if (localCounts.size >= MAX_LOCAL_MAP_ENTRIES) {
        const oldestKey = localCounts.keys().next().value;
        if (oldestKey) localCounts.delete(oldestKey);
      }
    }

    const existing = localCounts.get(ip);
    if (!existing || now > existing.resetTime) {
      localCounts.set(ip, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    existing.count++;
    if (existing.count > maxRequests) {
      const remainingSeconds = Math.ceil((existing.resetTime - now) / 1000);
      const errorMsg = options?.message || `Quá nhiều yêu cầu. Vui lòng chờ ${remainingSeconds} giây rồi thử lại.`;
      res.status(429).json({
        error: errorMsg,
        code: 'RATE_LIMITED',
        retryAfterSec: remainingSeconds,
      });
      return;
    }

    next();
  };

  if (redisUrl) {
    let isRedisHealthy = true;
    const redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times) => Math.min(times * 500, 5000),
    });

    if (typeof redisClient.on === 'function') {
      redisClient.on('error', (err) => {
        if (isRedisHealthy) {
          console.warn('[RateLimiter] Mất kết nối Redis. Tự động chuyển sang bộ đếm cục bộ (Degraded Mode):', err.message);
          isRedisHealthy = false;
        }
      });

      redisClient.on('ready', () => {
        if (!isRedisHealthy) {
          console.log('[RateLimiter] Đã tái kết nối Redis thành công. Khôi phục distributed rate limiter.');
          isRedisHealthy = true;
        }
      });
    }


    const LUA_SCRIPT = `
      local current = redis.call('incr', KEYS[1])
      if current == 1 then
        redis.call('pexpire', KEYS[1], ARGV[1])
      end
      return {current, redis.call('pttl', KEYS[1])}
    `;

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const key = `${keyPrefix}${ip}`;

      if (!isRedisHealthy) {
        applyLocalLimit(ip, req, res, next);
        return;
      }

      try {
        const evalResult = await redisClient.eval(LUA_SCRIPT, 1, key, windowMs);
        const [count, pttl] = evalResult as [number, number];

        if (count > maxRequests) {
          const remainingSeconds = Math.ceil(Math.max(0, pttl) / 1000);
          const errorMsg = options?.message || `Quá nhiều yêu cầu. Vui lòng chờ ${remainingSeconds} giây rồi thử lại.`;
          res.status(429).json({
            error: errorMsg,
            code: 'RATE_LIMITED',
            retryAfterSec: remainingSeconds,
          });
          return;
        }
        next();
      } catch (err) {
        isRedisHealthy = false;
        console.warn('[RateLimiter] Lỗi truy vấn Redis. Kích hoạt bộ đếm in-memory fallback:', (err as any).message);
        applyLocalLimit(ip, req, res, next);
      }
    };
  } else {
    return (req: Request, res: Response, next: NextFunction): void => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      applyLocalLimit(ip, req, res, next);
    };
  }
}
