# Research & Architecture Decisions: Fix Redis Pub/Sub Initialization & Offline Queue

## 1. Context & Problem Analysis

### Problem Description
When the backend starts with `REDIS_URL` set, `server/services/redisService.ts` initializes `redisManager` with default options:
```ts
const DEFAULT_REDIS_OPTIONS = {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  retryStrategy: (times: number) => Math.min(times * 500, 5000),
};
```
These options are intentional for API rate-limiting and session verification to enable fail-fast graceful degradation (fallback to in-memory mode without hanging API requests during Redis downtime).

However, in `server/services/crdtRedisPubSub.ts`, calling `subClient = mainClient.duplicate()` without overrides causes `subClient` to inherit `enableOfflineQueue: false`. During server startup:
1. The TCP connection to Redis is still performing initial handshake / authentication.
2. `setupCrdtRedisPubSub()` immediately invokes `await subClient.psubscribe('crdt:room:*')`.
3. Because `enableOfflineQueue: false` and the stream is not yet writable, `ioredis` rejects the command with:
   `Error: Stream isn't writeable and enableOfflineQueue options is false`
4. Furthermore, `subClient` lacked dedicated `'error'` and `'ready'` event listeners. If Redis dropped or reset, an unhandled `'error'` EventEmitter event could risk crashing the Node.js process.

---

## 2. Technical Decisions

### Decision 1: Override Options on `duplicate()` for Pub/Sub Subscriber
- **Decision**: Pass `{ enableOfflineQueue: true, maxRetriesPerRequest: null }` to `mainClient.duplicate(...)`.
- **Rationale**:
  - `enableOfflineQueue: true` allows `ioredis` to queue commands issued prior to the connection reaching `ready` state, executing them automatically as soon as the socket is open.
  - `maxRetriesPerRequest: null` ensures long-lived subscriber operations don't prematurely time out or abort during brief connection hiccups.
- **Alternatives Considered**:
  - *Changing `DEFAULT_REDIS_OPTIONS` in `redisService.ts`*: Rejected because rate-limiting and cache operations require `enableOfflineQueue: false` for instant fail-fast fallback.
  - *Polling until `mainClient.status === 'ready'` with `setTimeout`*: Rejected because it is brittle, introduces startup latency, and doesn't handle reconnects gracefully.

### Decision 2: Dedicated Event Listeners for Self-Healing
- **Decision**:
  - Register `subClient.on('error', (err) => console.warn('[CrdtRedisPubSub] Redis Sub client error:', err?.message || err))`
  - Register `subClient.on('ready', async () => { ... await subClient.psubscribe('crdt:room:*'); ... })`
- **Rationale**:
  - Prevents Node.js unhandled exception crashes when network sockets drop.
  - Automatically re-subscribes to all active room channels upon reconnection without requiring server restart.

### Decision 3: Safe Non-blocking Initialization & Cleanup
- **Decision**: Wrap setup in try/catch and ensure publisher hook only dispatches when `pubClient.status === 'ready'`. In `cleanupCrdtRedisPubSub()`, catch potential disconnection exceptions.
- **Rationale**: Guarantees zero side effects on the primary HTTP and WebSocket server boot sequence.

---

## 3. Compatibility & Non-Regression Analysis

| Component / Flow | Impact | Verification |
|---|---|---|
| **API Rate Limiting (`redisService.ts`)** | None. `mainClient` options unchanged (`enableOfflineQueue: false`). | Unit tests in `server/services/__tests__/` continue passing. |
| **CRDT Collaboration (`websocketRelayService.ts`)** | Real-time multi-instance message delivery restored and stabilized. | Unit tests in `server/services/__tests__/crdtRedisPubSub.test.ts`. |
| **Server Boot (`server.ts`)** | Non-blocking, clean logs on startup. | Zero offline queue error output during boot. |
