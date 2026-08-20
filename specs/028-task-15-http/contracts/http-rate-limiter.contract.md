# Interface Contract: HTTP Rate Limiter Upgrade (Sliding Window Counter)

**Feature**: HTTP Rate Limiter Upgrade & Boundary Protection  
**Branch**: `028-task-15-http` | **Date**: 2026-08-20  

---

## 1. Middleware Factory Interface (`server/middleware/rateLimiter.ts`)

```typescript
import { Request, Response, NextFunction } from 'express';

export type RateLimiterEndpointType = 'auth' | 'translation' | 'non-critical';
export type RateLimiterRedisStatus = 'connected' | 'degraded' | 'disconnected';

export interface RateLimiterOptions {
  /** Phân loại endpoint ('translation' | 'auth' | 'non-critical') */
  endpointType?: RateLimiterEndpointType;
  /** Độ dài cửa sổ thời gian (ms), mặc định: 60,000ms */
  windowMs?: number;
  /** Số lượng request tối đa trong cửa sổ, mặc định: 60 */
  maxRequests?: number;
  /** Tiền tố key lưu trữ, ví dụ 'ratelimit:translation:' */
  keyPrefix?: string;
  /** Thông điệp trả về khi vượt hạn mức */
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

/**
 * Tạo middleware rate limiter dựa trên thuật toán Sliding Window Counter
 */
export function createRateLimiter(options?: RateLimiterOptions): (req: Request, res: Response, next: NextFunction) => Promise<void> | void;

/**
 * Tra cứu telemetry trạng thái của rate limiter
 */
export function getRateLimiterStatus(): RateLimiterStatus;

/**
 * Reset toàn bộ bộ đếm và telemetry cho testing
 */
export function resetRateLimiterForTesting(): void;
```

---

## 2. HTTP Headers & 429 Response Schema

### 2.1 Standard Headers Attached on Every Request
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 54
X-RateLimit-Reset: 1724143260
```

### 2.2 Rate Limited Response (`HTTP 429 Too Many Requests`)
```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json; charset=utf-8
Retry-After: 18
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1724143260

{
  "error": "Quá nhiều yêu cầu. Vui lòng chờ 18 giây rồi thử lại.",
  "code": "RATE_LIMITED",
  "retryAfterSec": 18
}
```
