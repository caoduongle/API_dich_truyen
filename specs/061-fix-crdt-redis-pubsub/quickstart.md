# Quickstart & Verification Guide: Fix Redis Pub/Sub Initialization

## 1. Prerequisites
- Node.js runtime environment

---

## 2. Automated Quality Verification

```bash
# 1. Typecheck
npm run lint

# 2. Unit tests
npm test

# 3. Production bundle build
npm run build
```

---

## 3. Targeted Test Execution

```bash
npx vitest run server/services/__tests__/crdtRedisPubSub.test.ts
```

---

## 4. Verification Scenarios

### Scenario A: Clean Boot with Mock/Real Redis
1. Start the server with `REDIS_URL` configured or run the server startup test harness.
2. **Expected**:
   - No log messages matching `Error: Stream isn't writeable and enableOfflineQueue options is false`.
   - Log shows `[CrdtRedisPubSub] Đã kích hoạt Pub/Sub đa instance`.

### Scenario B: Offline Queue Buffering & Event Readiness
1. When `duplicate()` is invoked on the main client, the subscriber client receives `{ enableOfflineQueue: true, maxRetriesPerRequest: null }`.
2. When the `'ready'` event fires on `subClient`, it logs readiness and subscribes to `crdt:room:*`.
