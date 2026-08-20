# Contract: Rate Limiter Middleware & Graceful Degradation Engine

## 1. Rate Limiter Factory & Telemetry Methods (`server/middleware/rateLimiter.ts`)

```typescript
export function createRateLimiter(options?: RateLimiterOptions): (req: Request, res: Response, next: NextFunction) => Promise<void> | void;

export function getRateLimiterStatus(): RateLimiterStatus;

export function resetRateLimiterForTesting(): void;
```

### Invariants
1. When Redis is connected, rate counts are stored and expired in Redis with key format `${keyPrefix}${ip}`.
2. When Redis throws an error, the limiter marks status as `'degraded'` and invokes bounded in-memory `applyLocalLimit`.
3. In-memory map never exceeds `MAX_LOCAL_MAP_ENTRIES` (10,000).
4. Error logs on Redis disconnect are throttled (maximum 1 log per outage episode).
5. When Redis emits `ready`, status automatically returns to `'connected'`.
