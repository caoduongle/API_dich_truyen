import { Request, Response, NextFunction } from "express";
import type Redis from "ioredis";
import { SERVER_CONFIG } from "@shared/constants";
import { redisManager } from "../services/redisService";

export type RateLimiterEndpointType = 'auth' | 'translation' | 'non-critical';
export type RateLimiterRedisStatus = 'connected' | 'degraded' | 'disconnected';

export interface RateLimiterOptions {
  endpointType?: RateLimiterEndpointType;
  windowMs?: number;
  maxRequests?: number;
  keyPrefix?: string;
  message?: string;
}

export interface RateLimiterStatus {
  redisStatus: RateLimiterRedisStatus;
  isDegraded: boolean;
  degradedFallbackCount: number;
  localEntriesCount: number;
  lastRedisError?: string;
  lastRedisTransitionAt?: number;
}

const MAX_LOCAL_MAP_ENTRIES = 10000;
const LOG_THROTTLE_MS = 60000;

// Shared telemetry state
let globalRedisStatus: RateLimiterRedisStatus = process.env.REDIS_URL ? 'connected' : 'disconnected';
let globalDegradedFallbackCount = 0;
let lastLoggedErrorTime = 0;
let lastRedisErrorMsg: string | undefined;
let lastRedisTransitionTimestamp: number = Date.now();
const allLocalMaps = new Set<Map<string, { count: number; resetTime: number }>>();

/**
 * Tra cứu trạng thái hoạt động & telemetry của Rate Limiter
 */
export function getRateLimiterStatus(): RateLimiterStatus {
  let totalLocalEntries = 0;
  for (const m of allLocalMaps) {
    totalLocalEntries += m.size;
  }

  return {
    redisStatus: globalRedisStatus,
    isDegraded: globalRedisStatus === 'degraded',
    degradedFallbackCount: globalDegradedFallbackCount,
    localEntriesCount: totalLocalEntries,
    lastRedisError: lastRedisErrorMsg,
    lastRedisTransitionAt: lastRedisTransitionTimestamp,
  };
}

/**
 * Xóa dữ liệu testing và reset telemetry counters
 */
export function resetRateLimiterForTesting(): void {
  for (const m of allLocalMaps) {
    m.clear();
  }
  globalDegradedFallbackCount = 0;
  lastLoggedErrorTime = 0;
  lastRedisErrorMsg = undefined;
  globalRedisStatus = process.env.REDIS_URL ? 'connected' : 'disconnected';
  lastRedisTransitionTimestamp = Date.now();
}

/**
 * Factory tạo Rate Limiter Middleware hỗ trợ Graceful Degradation và phân loại Endpoint
 */
export function createRateLimiter(options?: RateLimiterOptions) {
  const endpointType = options?.endpointType ?? 'translation';

  let defaultWindowMs: number = SERVER_CONFIG.RATE_LIMIT_WINDOW_MS;
  let defaultMaxRequests: number = SERVER_CONFIG.RATE_LIMIT_MAX_REQUESTS;
  let defaultKeyPrefix = "ratelimit:";
  let defaultMessage = "Quá nhiều yêu cầu. Vui lòng chờ một chút rồi thử lại.";

  if (endpointType === 'auth') {
    defaultWindowMs = SERVER_CONFIG.AUTH_RATE_LIMIT_WINDOW_MS;
    defaultMaxRequests = SERVER_CONFIG.AUTH_RATE_LIMIT_MAX_REQUESTS;
    defaultKeyPrefix = "ratelimit:login:";
    defaultMessage = "Quá nhiều lần thử đăng nhập không thành công. Vui lòng chờ 15 phút rồi thử lại.";
  } else if (endpointType === 'non-critical') {
    defaultWindowMs = 60 * 1000;
    defaultMaxRequests = 120;
    defaultKeyPrefix = "ratelimit:noncritical:";
    defaultMessage = "Quá nhiều yêu cầu. Vui lòng chờ một chút rồi thử lại.";
  }

  const windowMs = options?.windowMs ?? defaultWindowMs;
  const maxRequests = options?.maxRequests ?? defaultMaxRequests;
  const keyPrefix = options?.keyPrefix ?? defaultKeyPrefix;
  const redisClient = redisManager.getClient();

  // Bounded in-memory fallback store
  const localCounts = new Map<string, { count: number; resetTime: number }>();
  allLocalMaps.add(localCounts);

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
    globalDegradedFallbackCount++;
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
      const errorMsg = options?.message || (endpointType === 'auth' ? defaultMessage : `Quá nhiều yêu cầu. Vui lòng chờ ${remainingSeconds} giây rồi thử lại.`);
      res.status(429).json({
        error: errorMsg,
        code: 'RATE_LIMITED',
        retryAfterSec: remainingSeconds,
      });
      return;
    }

    next();
  };

  if (redisClient) {
    let isRedisHealthy = true;
    globalRedisStatus = 'connected';

    const handleRedisError = (err: any) => {
      const now = Date.now();
      lastRedisErrorMsg = err?.message || 'Redis connection error';
      if (isRedisHealthy || globalRedisStatus !== 'degraded') {
        console.warn('[RateLimiter] Mất kết nối Redis. Tự động chuyển sang bộ đếm cục bộ (Degraded Mode):', lastRedisErrorMsg);
        isRedisHealthy = false;
        globalRedisStatus = 'degraded';
        lastLoggedErrorTime = now;
        lastRedisTransitionTimestamp = now;
      } else if (now - lastLoggedErrorTime > LOG_THROTTLE_MS) {
        console.warn('[RateLimiter] Redis vẫn không phản hồi. Tiếp tục hoạt động ở Degraded Mode:', lastRedisErrorMsg);
        lastLoggedErrorTime = now;
      }
    };

    const handleRedisReady = () => {
      const now = Date.now();
      if (!isRedisHealthy || globalRedisStatus === 'degraded') {
        console.log('[RateLimiter] Đã tái kết nối Redis thành công. Khôi phục distributed rate limiter.');
        isRedisHealthy = true;
        globalRedisStatus = 'connected';
        lastRedisErrorMsg = undefined;
        lastRedisTransitionTimestamp = now;
      }
    };

    if (typeof redisClient.on === 'function') {
      redisClient.on('error', handleRedisError);
      redisClient.on('ready', handleRedisReady);
      redisClient.on('connect', handleRedisReady);
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
          const errorMsg = options?.message || (endpointType === 'auth' ? defaultMessage : `Quá nhiều yêu cầu. Vui lòng chờ ${remainingSeconds} giây rồi thử lại.`);
          res.status(429).json({
            error: errorMsg,
            code: 'RATE_LIMITED',
            retryAfterSec: remainingSeconds,
          });
          return;
        }
        next();
      } catch (err: any) {
        handleRedisError(err);
        applyLocalLimit(ip, req, res, next);
      }
    };
  } else {
    globalRedisStatus = 'disconnected';
    return (req: Request, res: Response, next: NextFunction): void => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      applyLocalLimit(ip, req, res, next);
    };
  }
}
