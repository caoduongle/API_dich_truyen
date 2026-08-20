# Data Model: Redis Graceful Degradation & Differentiated Local Fallback

## 1. Entities & Type Definitions

### 1.1 `RateLimiterEndpointType` & `RateLimiterOptions`

```typescript
export type RateLimiterEndpointType = 'auth' | 'translation' | 'non-critical';

export interface RateLimiterOptions {
  endpointType?: RateLimiterEndpointType;
  windowMs?: number;
  maxRequests?: number;
  keyPrefix?: string;
  message?: string;
}
```

---

### 1.2 `RateLimiterStatus` & Telemetry Snapshot

```typescript
export type RateLimiterRedisStatus = 'connected' | 'degraded' | 'disconnected';

export interface RateLimiterStatus {
  redisStatus: RateLimiterRedisStatus;
  isDegraded: boolean;
  degradedFallbackCount: number;
  localEntriesCount: number;
  lastRedisError?: string;
  lastRedisTransitionAt?: number;
}
```

---

### 1.3 Local In-Memory Fallback Entry

```typescript
export interface LocalRateLimitEntry {
  count: number;
  resetTime: number;
}
```
