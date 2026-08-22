# Implementation Plan: Fix Redis Pub/Sub Initialization & Offline Queue Configuration

**Branch**: `061-fix-crdt-redis-pubsub` | **Date**: 2026-08-23 | **Spec**: [`specs/061-fix-crdt-redis-pubsub/spec.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/061-fix-crdt-redis-pubsub/spec.md)

**Input**: Feature specification from `/specs/061-fix-crdt-redis-pubsub/spec.md`

## Summary

Resolve the Redis Pub/Sub initialization error (`"Error: Stream isn't writeable and enableOfflineQueue options is false"`) in `server/services/crdtRedisPubSub.ts`. When creating `subClient = mainClient.duplicate()`, explicitly override Redis client options with `{ enableOfflineQueue: true, maxRetriesPerRequest: null }`. Add dedicated `'error'` and `'ready'` event listeners to ensure graceful warning logging, automatic re-subscription on reconnection, and non-blocking server startup.

---

## Technical Context

**Language/Version**: TypeScript 5.8.2 / Node.js  
**Primary Dependencies**: `ioredis`, Express.js, `ws`  
**Storage**: Redis Pub/Sub (`crdt:room:*`)  
**Testing**: Vitest 4.1.9 (`npm test`), TypeScript `tsc --noEmit` (`npm run lint`), `npm run build`  
**Target Platform**: Node.js Backend Server  
**Project Type**: Express Backend Service with WebSocket & Redis Pub/Sub  
**Performance Goals**: Instant non-blocking startup (< 5ms setup overhead)  
**Constraints**:
- DO NOT alter `DEFAULT_REDIS_OPTIONS` (`enableOfflineQueue: false`) in `server/services/redisService.ts` as rate limiting requires fail-fast degradation.
- Ensure zero unhandled EventEmitter errors on `subClient`.
- Keep CRDT payload serialization and channel naming 100% backward-compatible.  
**Scale/Scope**: 1 backend service file (`server/services/crdtRedisPubSub.ts`) + 1 test file (`server/services/__tests__/crdtRedisPubSub.test.ts`).

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Strict Quality Gates & Verification**: `tsc --noEmit`, `vitest run`, and `vite build` will pass cleanly.
- [x] **II. Dependency Minimization & Existing Library Reuse**: Uses existing `ioredis` features without adding packages.
- [x] **III. Strict Concern Separation & Domain Boundary Preservation**: Purely backend infrastructure change in `crdtRedisPubSub.ts`. No UI or Gemini pipeline changes.
- [x] **IV. Immutable Core Schemas & Storage Stability**: Core schemas and interfaces remain unchanged.
- [x] **V. Atomic Commits & Documentation Synchronization**: Single, modular bugfix diff.

---

## Project Structure

### Documentation (this feature)

```text
specs/061-fix-crdt-redis-pubsub/
├── plan.md              # Implementation plan (this document)
├── research.md          # Phase 0: Technical decisions and root cause analysis
├── data-model.md        # Phase 1: Client configuration & state transitions
├── quickstart.md        # Phase 1: Verification scenarios
├── contracts/           # Phase 1: Interface contracts
│   └── crdt-pubsub.contract.md
├── checklists/
│   └── requirements.md  # Quality checklist
└── spec.md              # Feature specification
```

### Source Code Layout

```text
server/
└── services/
    ├── crdtRedisPubSub.ts                       # [MODIFY] Override duplicate options with enableOfflineQueue, add error/ready handlers
    └── __tests__/
        └── crdtRedisPubSub.test.ts              # [MODIFY] Unit tests for duplicate options and event handlers
```

---

## Proposed Changes

### Component: `server/services/crdtRedisPubSub.ts`

1. **Override duplicate options**:
   ```typescript
   subClient = mainClient.duplicate({
     enableOfflineQueue: true,
     maxRetriesPerRequest: null,
   });
   ```

2. **Add error and ready event handlers**:
   ```typescript
   subClient.on('error', (err) => {
     console.warn('[CrdtRedisPubSub] Redis Sub client error:', err?.message || err);
   });

   subClient.on('ready', async () => {
     try {
       await subClient?.psubscribe(`${CHANNEL_PREFIX}*`);
       console.log(`[CrdtRedisPubSub] Sub client sẵn sàng, đã đăng ký channel ${CHANNEL_PREFIX}*`);
     } catch (err: any) {
       console.warn('[CrdtRedisPubSub] Lỗi khi psubscribe trong event ready:', err?.message || err);
     }
   });
   ```

3. **Immediate subscribe if already ready**:
   ```typescript
   if (subClient.status === 'ready') {
     await subClient.psubscribe(`${CHANNEL_PREFIX}*`);
   }
   ```

4. **Safe shutdown handling**:
   In `cleanupCrdtRedisPubSub()`, catch potential disconnect exceptions and ensure clean state reset.

---

## Verification Plan

### Automated Tests
```bash
npm run lint    # tsc --noEmit: Must pass with 0 errors
npm test        # vitest run: All tests must pass
npm run build   # vite build + esbuild: Must build successfully
```

### Targeted Tests
```bash
npx vitest run server/services/__tests__/crdtRedisPubSub.test.ts
```
