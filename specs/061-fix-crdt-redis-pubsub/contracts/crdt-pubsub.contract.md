# Contract: CRDT Redis Pub/Sub Interface

## 1. Module Definition
- **File**: `server/services/crdtRedisPubSub.ts`
- **Module**: `crdtRedisPubSub`

---

## 2. Public API Signatures

```typescript
export function formatRedisChannel(roomId: string): string;

export function parseRedisChannel(channel: string): string;

export function serializeRedisPayload(instanceId: string, data: Buffer): string;

export function deserializeRedisPayload(payload: string): { instanceId: string; data: Buffer };

export function setupCrdtRedisPubSub(): Promise<void>;

export function cleanupCrdtRedisPubSub(): Promise<void>;
```

---

## 3. Operational Guarantees

1. **Subscriber Offline Queue**:
   - `subClient` MUST be duplicated with `{ enableOfflineQueue: true, maxRetriesPerRequest: null }`.
   - `subClient` MUST NOT reject with offline queue disabled errors if `psubscribe` is called before socket is writable.

2. **Self-Healing & Error Interception**:
   - `subClient` MUST intercept `'error'` events to prevent unhandled EventEmitter process crashes.
   - `subClient` MUST listen on `'ready'` events to auto-subscribe to `crdt:room:*` on reconnects.

3. **Safe Shutdown**:
   - `cleanupCrdtRedisPubSub()` MUST unsubscribe from `crdt:room:*` and quit/disconnect `subClient` cleanly.
