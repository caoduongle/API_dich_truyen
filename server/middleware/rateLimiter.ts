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
  algorithm: 'sliding-window-counter';
  lastRedisError?: string;
  lastRedisTransitionAt?: number;
}

export interface LocalSlidingWindowEntry {
  currentBucket: number;
  currentCount: number;
  previousCount: number;
}

const MAX_LOCAL_MAP_ENTRIES = 10000;
const LOG_THROTTLE_MS = 60000;

// Shared telemetry state
let globalRedisStatus: RateLimiterRedisStatus = process.env.REDIS_URL ? 'connected' : 'disconnected';
let globalDegradedFallbackCount = 0;
let lastLoggedErrorTime = 0;
let lastRedisErrorMsg: string | undefined;
let lastRedisTransitionTimestamp: number = Date.now();
const allLocalMaps = new Set<Map<string, LocalSlidingWindowEntry>>();

/**
 * Tính toán số lượng request ước tính theo trọng số cửa sổ trượt (Sliding Window Counter)
 */
export function calculateSlidingWindowCount(
  now: number,
  windowMs: number,
  currentCount: number,
  previousCount: number
): { estimatedCount: number; prevWeight: number; timeIntoCurrent: number; currentBucket: number } {
  const currentBucket = Math.floor(now / windowMs) * windowMs;
  const timeIntoCurrent = now - currentBucket;
  const prevWeight = Math.max(0, Math.min(1, (windowMs - timeIntoCurrent) / windowMs));
  const estimatedCount = currentCount + previousCount * prevWeight;
  return { estimatedCount, prevWeight, timeIntoCurrent, currentBucket };
}

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
    algorithm: 'sliding-window-counter',
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
 * Lua Script thực thi nguyên tử Sliding Window Counter trên Redis
 * KEYS[1]: Current window bucket key
 * KEYS[2]: Previous window bucket key
 * ARGV[1]: windowMs (e.g. 60000)
 * ARGV[2]: maxRequests (e.g. 60)
 * ARGV[3]: now (epoch ms)
 * Return: [isAllowed (1/0), estimatedCount, retryAfterSecOrRemaining, resetEpochSec]
 */
export const SLIDING_WINDOW_LUA_SCRIPT = `
  local current_key = KEYS[1]
  local prev_key = KEYS[2]
  local window_ms = tonumber(ARGV[1])
  local max_req = tonumber(ARGV[2])
  local now = tonumber(ARGV[3])

  local current_count = tonumber(redis.call('get', current_key) or '0')
  local prev_count = tonumber(redis.call('get', prev_key) or '0')

  local current_bucket = math.floor(now / window_ms) * window_ms
  local time_into_current = now - current_bucket
  local prev_weight = math.max(0, math.min(1, (window_ms - time_into_current) / window_ms))
  local estimated_count = current_count + (prev_count * prev_weight)

  local reset_epoch_sec = math.ceil((current_bucket + window_ms) / 1000)

  if estimated_count >= max_req then
    local retry_after = math.max(1, math.ceil((window_ms - time_into_current) / 1000))
    return {0, math.floor(estimated_count), retry_after, reset_epoch_sec}
  end

  local new_count = redis.call('incr', current_key)
  if new_count == 1 then
    redis.call('pexpire', current_key, window_ms * 2)
  end

  local remaining = math.max(0, max_req - (new_count + math.floor(prev_count * prev_weight)))
  return {1, remaining, reset_epoch_sec, new_count}
`;

/**
 * Factory tạo Rate Limiter Middleware hỗ trợ Graceful Degradation và phân loại Endpoint
 */
export function createRateLimiter(options?: RateLimiterOptions) {
  const endpointType = options?.endpointType ?? 'translation';

  let defaultWindowMs: number = SERVER_CONFIG.RATE_LIMIT_WINDOW_MS;
  let defaultMaxRequests: number = SERVER_CONFIG.RATE_LIMIT_MAX_REQUESTS;
  let defaultKeyPrefix = "ratelimit:translation:";
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

  // Bounded in-memory sliding window fallback store
  const localCounts = new Map<string, LocalSlidingWindowEntry>();
  allLocalMaps.add(localCounts);

  const cleanupLocalMap = () => {
    const now = Date.now();
    const currentBucket = Math.floor(now / windowMs) * windowMs;
    for (const [ip, data] of localCounts) {
      if (currentBucket - data.currentBucket > windowMs * 2) {
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
    const currentBucket = Math.floor(now / windowMs) * windowMs;

    // Guard chống tràn memory nếu số IP vượt 10,000
    if (localCounts.size >= MAX_LOCAL_MAP_ENTRIES) {
      cleanupLocalMap();
      if (localCounts.size >= MAX_LOCAL_MAP_ENTRIES) {
        const oldestKey = localCounts.keys().next().value;
        if (oldestKey) localCounts.delete(oldestKey);
      }
    }

    let entry = localCounts.get(ip);
    if (!entry) {
      entry = { currentBucket, currentCount: 0, previousCount: 0 };
      localCounts.set(ip, entry);
    } else if (entry.currentBucket === currentBucket) {
      // Đang ở cùng window, giữ nguyên
    } else if (entry.currentBucket === currentBucket - windowMs) {
      // Chuyển sang window kế tiếp: count hiện tại thành previousCount
      entry.previousCount = entry.currentCount;
      entry.currentCount = 0;
      entry.currentBucket = currentBucket;
    } else {
      // Đã qua 2 window trở lên: reset cả 2
      entry.previousCount = 0;
      entry.currentCount = 0;
      entry.currentBucket = currentBucket;
    }

    const { estimatedCount, timeIntoCurrent } = calculateSlidingWindowCount(
      now,
      windowMs,
      entry.currentCount,
      entry.previousCount
    );

    const resetEpochSec = Math.ceil((currentBucket + windowMs) / 1000);

    if (estimatedCount >= maxRequests) {
      const remainingSeconds = Math.max(1, Math.ceil((windowMs - timeIntoCurrent) / 1000));
      const errorMsg = options?.message || (endpointType === 'auth' ? defaultMessage : `Quá nhiều yêu cầu. Vui lòng chờ ${remainingSeconds} giây rồi thử lại.`);
      
      if (typeof res.setHeader === 'function') {
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('X-RateLimit-Reset', resetEpochSec);
        res.setHeader('Retry-After', remainingSeconds);
      }

      res.status(429).json({
        error: errorMsg,
        code: 'RATE_LIMITED',
        retryAfterSec: remainingSeconds,
      });
      return;
    }

    entry.currentCount++;
    const remaining = Math.max(0, maxRequests - Math.floor(estimatedCount + 1));
    if (typeof res.setHeader === 'function') {
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', resetEpochSec);
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

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const now = Date.now();
      const currentBucket = Math.floor(now / windowMs) * windowMs;
      const prevBucket = currentBucket - windowMs;

      const currentKey = `${keyPrefix}${ip}:${currentBucket}`;
      const prevKey = `${keyPrefix}${ip}:${prevBucket}`;

      if (!isRedisHealthy) {
        applyLocalLimit(ip, req, res, next);
        return;
      }

      try {
        const evalResult = await redisClient.eval(
          SLIDING_WINDOW_LUA_SCRIPT,
          2,
          currentKey,
          prevKey,
          windowMs,
          maxRequests,
          now
        );

        // Hỗ trợ cả định dạng mảng kết quả mới [isAllowed, remainingOrCount, retryAfterOrReset, ...]
        // và mock test [count, pttl]
        let isAllowed = true;
        let remaining = 0;
        let retryAfterSec = 1;
        let resetEpochSec = Math.ceil((currentBucket + windowMs) / 1000);

        if (Array.isArray(evalResult)) {
          if (evalResult.length >= 4) {
            // Định dạng mới từ SLIDING_WINDOW_LUA_SCRIPT
            isAllowed = Number(evalResult[0]) === 1;
            if (isAllowed) {
              remaining = Number(evalResult[1]);
              resetEpochSec = Number(evalResult[2]);
            } else {
              retryAfterSec = Number(evalResult[2]);
              resetEpochSec = Number(evalResult[3]);
            }
          } else {
            // Tương thích ngược với mock test cũ [count, pttl]
            const [count, pttl] = evalResult as [number, number];
            if (count > maxRequests) {
              isAllowed = false;
              retryAfterSec = Math.max(1, Math.ceil(Math.max(0, pttl) / 1000));
            } else {
              isAllowed = true;
              remaining = Math.max(0, maxRequests - count);
            }
          }
        }

        if (!isAllowed) {
          const errorMsg = options?.message || (endpointType === 'auth' ? defaultMessage : `Quá nhiều yêu cầu. Vui lòng chờ ${retryAfterSec} giây rồi thử lại.`);
          if (typeof res.setHeader === 'function') {
            res.setHeader('X-RateLimit-Limit', maxRequests);
            res.setHeader('X-RateLimit-Remaining', 0);
            res.setHeader('X-RateLimit-Reset', resetEpochSec);
            res.setHeader('Retry-After', retryAfterSec);
          }

          res.status(429).json({
            error: errorMsg,
            code: 'RATE_LIMITED',
            retryAfterSec,
          });
          return;
        }

        if (typeof res.setHeader === 'function') {
          res.setHeader('X-RateLimit-Limit', maxRequests);
          res.setHeader('X-RateLimit-Remaining', remaining);
          res.setHeader('X-RateLimit-Reset', resetEpochSec);
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
