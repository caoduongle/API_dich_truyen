import { Request, Response, NextFunction } from "express";
import Redis from "ioredis";
import { SERVER_CONFIG } from "@shared/constants";

export interface RateLimiterOptions {
  windowMs?: number;
  maxRequests?: number;
  keyPrefix?: string;
  message?: string;
}

export function createRateLimiter(options?: RateLimiterOptions) {
  const windowMs = options?.windowMs ?? SERVER_CONFIG.RATE_LIMIT_WINDOW_MS;
  const maxRequests = options?.maxRequests ?? SERVER_CONFIG.RATE_LIMIT_MAX_REQUESTS;
  const keyPrefix = options?.keyPrefix ?? "ratelimit:";
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    const redisClient = new Redis(redisUrl);

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
      try {
        const evalResult = await redisClient.eval(LUA_SCRIPT, 1, key, windowMs);
        const [count, pttl] = evalResult as [number, number];

        if (count > maxRequests) {
          const remainingSeconds = Math.ceil(Math.max(0, pttl) / 1000);
          const errorMsg = options?.message || `Quá nhiều yêu cầu. Vui lòng chờ ${remainingSeconds} giây rồi thử lại.`;
          res.status(429).json({
            error: errorMsg
          });
          return;
        }
        next();
      } catch (err) {
        console.error('[RateLimiter] Redis error:', err);
        next();
      }
    };
  } else {
    const ipRequestCounts = new Map<string, { count: number; resetTime: number }>();

    // Cleanup interval
    const interval = setInterval(() => {
      const now = Date.now();
      for (const [ip, data] of ipRequestCounts) {
        if (now > data.resetTime) {
          ipRequestCounts.delete(ip);
        }
      }
    }, 5 * 60 * 1000);

    // Unref interval if running in node to prevent keeping process alive in tests
    if (interval && typeof interval.unref === 'function') {
      interval.unref();
    }

    return (req: Request, res: Response, next: NextFunction): void => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const now = Date.now();

      const existing = ipRequestCounts.get(ip);
      if (!existing || now > existing.resetTime) {
        ipRequestCounts.set(ip, { count: 1, resetTime: now + windowMs });
        next();
        return;
      }

      existing.count++;
      if (existing.count > maxRequests) {
        const remainingSeconds = Math.ceil((existing.resetTime - now) / 1000);
        const errorMsg = options?.message || `Quá nhiều yêu cầu. Vui lòng chờ ${remainingSeconds} giây rồi thử lại.`;
        res.status(429).json({
          error: errorMsg
        });
        return;
      }

      next();
    };
  }
}
