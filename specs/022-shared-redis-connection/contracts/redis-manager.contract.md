# Contract: Shared Redis Connection Manager (`server/services/redisService.ts`)

## 1. Class Interface & Exported Methods

```typescript
export interface IRedisManager {
  getClient(): Redis | null;
  getStatus(): RedisConnectionStatus;
  getTelemetry(): RedisManagerTelemetry;
  onStatusChange(listener: (status: RedisConnectionStatus) => void): () => void;
  close(): Promise<void>;
  setMockClient(client: Redis | null): void;
  resetForTesting(): void;
}

export const redisManager: IRedisManager;
export function getRedisClient(): Redis | null;
```

### Invariants
1. `redisManager.getClient()` always returns the identical shared `Redis` instance across multiple calls within the process.
2. If `REDIS_URL` is empty, `getClient()` returns `null` with status `'disconnected'`.
3. `close()` terminates the connection cleanly via `quit()` and prevents future commands until re-initialized.
4. `setMockClient` overrides the shared client for test isolation.
