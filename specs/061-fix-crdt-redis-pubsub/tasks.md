# Tasks: Fix Redis Pub/Sub Initialization & Offline Queue Configuration

## Feature Overview
- **Branch**: `061-fix-crdt-redis-pubsub`
- **Spec**: [`specs/061-fix-crdt-redis-pubsub/spec.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/061-fix-crdt-redis-pubsub/spec.md)
- **Plan**: [`specs/061-fix-crdt-redis-pubsub/plan.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/061-fix-crdt-redis-pubsub/plan.md)

---

## Phase 1: Setup & Pre-Verification

**Purpose**: Verify baseline quality gates and test suite before making edits.

- [x] T001 Verify baseline unit test suite passes via `npm test`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Confirm baseline Redis service settings are preserved.

- [x] T002 Verify redisService DEFAULT_REDIS_OPTIONS preserves fail-fast settings in `server/services/redisService.ts`

---

## Phase 3: User Story 1 - Clean Non-Blocking Server Startup with Redis Pub/Sub (Priority: P1) 🎯 MVP

**Goal**: Prevent "Stream isn't writeable and enableOfflineQueue options is false" by overriding `duplicate({ enableOfflineQueue: true, maxRetriesPerRequest: null })` on `subClient`.

**Independent Test**: Initialize `setupCrdtRedisPubSub()` with Redis client and verify `subClient` is created with `enableOfflineQueue: true` and does not throw offline queue rejection.

### Implementation
- [x] T003 [US1] Override duplicate options with enableOfflineQueue and maxRetriesPerRequest in `server/services/crdtRedisPubSub.ts`
- [x] T004 [US1] Wrap subscriber channel initialization in safe non-blocking execution block in `server/services/crdtRedisPubSub.ts`

**Checkpoint**: Server boots cleanly with Redis without offline queue write errors.

---

## Phase 4: User Story 2 - Resilient Auto-Reconnection & Error Handling (Priority: P2)

**Goal**: Add dedicated `error` and `ready` event listeners on `subClient` for self-healing and unhandled crash prevention.

**Independent Test**: Trigger error and ready events on `subClient` and verify warning log and automatic `psubscribe` re-registration.

### Implementation & Testing
- [x] T005 [US2] Add subClient error event listener to catch and log errors safely in `server/services/crdtRedisPubSub.ts`
- [x] T006 [US2] Add subClient ready event listener to auto-subscribe pattern channel on reconnect in `server/services/crdtRedisPubSub.ts`
- [x] T007 [US2] Ensure safe cleanup in cleanupCrdtRedisPubSub in `server/services/crdtRedisPubSub.ts`
- [x] T008 [P] [US2] Add unit tests for subscriber duplicate options, error handling, and ready re-subscription in `server/services/__tests__/crdtRedisPubSub.test.ts`

**Checkpoint**: Sub client self-heals after network reconnects and handles errors without crashing Node.js process.

---

## Phase 5: Polish & Quality Gates

**Purpose**: Strict Constitution quality assurance and end-to-end verification.

- [x] T009 [P] Verify type safety with zero type errors via `npm run lint` (`tsc --noEmit`)
- [x] T010 [P] Execute entire unit test suite via `npm test` (`vitest run`)
- [x] T011 Execute production bundle build via `npm run build` (`vite build && esbuild server.ts`)
- [x] T012 Verify quickstart scenarios from `specs/061-fix-crdt-redis-pubsub/quickstart.md`

---

## Dependencies & Execution Order

```text
Phase 1: Setup (T001)
   │
   ▼
Phase 2: Foundational (T002)
   │
   ▼
Phase 3: User Story 1 (T003, T004) ◄── MVP Checkpoint
   │
   ▼
Phase 4: User Story 2 (T005, T006, T007, T008 [P])
   │
   ▼
Phase 5: Polish & Quality Gates (T009 [P], T010 [P], T011, T012)
```

---

## Implementation Strategy

### MVP Scope (Phase 1 through Phase 3)
1. Complete T001 (baseline check).
2. Complete T002 + T003 + T004 in `crdtRedisPubSub.ts`.
3. Verify server boots without Redis stream writable / offline queue error.

### Full Delivery
4. Complete Phase 4 (event listeners & comprehensive unit tests).
5. Complete Phase 5 (all Constitution quality gates).
