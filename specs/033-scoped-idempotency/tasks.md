# Tasks: Scoped Idempotency & Conflict-Safe Replay Engine (TASK 02)

**Feature**: `specs/033-scoped-idempotency/spec.md`  
**Plan**: `specs/033-scoped-idempotency/plan.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish data models, shared types, and test utility harnesses for composite scoped idempotency.

- [X] T001 Define types and interfaces (`IdempotencyEntry`, `IdempotencyStatus`, `IdempotencyStore`, `IdempotencyListenerResult`) in `server/middleware/idempotencyMiddleware.ts`
- [X] T002 [P] Create mock request factories and test utilities in `server/middleware/__tests__/idempotencyTestUtils.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core scoping and hashing functions that MUST be complete before user stories can be implemented.

- [X] T003 Implement `buildCompositeIdempotencyKey(req: Request, clientKey: string)` scoping across session/identity, endpoint path, and client key in `server/middleware/idempotencyMiddleware.ts`
- [X] T004 [P] Implement `computeRequestFingerprint(body: any)` with deterministic canonical JSON serialization and SHA-256 hashing in `server/middleware/idempotencyMiddleware.ts`
- [X] T005 [P] Implement `MemoryIdempotencyStore` with in-memory state map, 5-minute TTL, safe eviction, and periodic cleanup in `server/middleware/idempotencyMiddleware.ts`

---

## Phase 3: User Story 1 - Multi-Dimensional Composite Key Scoping & Tenant Isolation (Priority: P1) 🎯 MVP

**Goal**: Scope idempotency keys by `identity + endpoint + clientKey` so that User A and User B using the same client key never collide, and different endpoints sharing a key operate independently.

**Independent Test**: Send requests from User A and User B with key `KEY123` to `/api/translate-raw` and verify User B triggers a fresh translation and does not receive User A's response; send request with `KEY123` to `/api/polish-translation` and verify independent execution.

### Tests for User Story 1 🧪

- [X] T006 [P] [US1] Write unit tests in `server/middleware/__tests__/idempotency.test.ts` for same-user replay, different-users isolation, and cross-endpoint isolation

### Implementation for User Story 1

- [X] T007 [US1] Implement composite key resolution, store integration, and multi-tenant scoping in `server/middleware/idempotencyMiddleware.ts`

---

## Phase 4: User Story 2 - Request Fingerprinting & Payload Conflict Detection (Priority: P2)

**Goal**: Compare the cryptographic hash of the incoming request body against the stored entry fingerprint, rejecting mismatches with HTTP `409 Conflict` (`IDEMPOTENCY_CONFLICT`) instead of returning stale data.

**Independent Test**: Send request with `Idempotency-Key: KEY1` and body `{"prompt": "Text A"}` $\to$ status 200. Send subsequent request with `Idempotency-Key: KEY1` and body `{"prompt": "Text B"}` $\to$ verify response is HTTP 409 Conflict.

### Tests for User Story 2 🧪

- [X] T008 [P] [US2] Write unit tests in `server/middleware/__tests__/idempotency.test.ts` for request fingerprinting and 409 Conflict rejection

### Implementation for User Story 2

- [X] T009 [US2] Implement payload fingerprint verification and HTTP 409 `IDEMPOTENCY_CONFLICT` error payload dispatch in `server/middleware/idempotencyMiddleware.ts`

---

## Phase 5: User Story 3 - In-Flight Concurrency Coordination & Failure Recovery (Priority: P3)

**Goal**: Coordinate concurrent duplicate requests by queueing listeners on the in-flight pending request, broadcasting the single upstream response with `x-idempotent-replay: true`, and immediately evicting failed requests (status $\ge 400$).

**Independent Test**: Send two concurrent requests with identical key and body; verify both receive the identical response, only one upstream execution runs, and second response has `x-idempotent-replay: true`. Verify failed upstream requests are evicted immediately to allow fresh retries.

### Tests for User Story 3 🧪

- [X] T010 [P] [US3] Write unit tests in `server/middleware/__tests__/idempotency.test.ts` for concurrent duplicate listeners, completed replay broadcast, and failed entry eviction

### Implementation for User Story 3

- [X] T011 [US3] Implement listener queueing, in-flight response broadcasting, status capture hooks, and failure eviction in `server/middleware/idempotencyMiddleware.ts`

---

## Phase 6: User Story 4 - Multi-Instance Evaluation & Storage Abstraction (Priority: P4)

**Goal**: Formalize the `IdempotencyStore` abstraction supporting memory store with explicit single-instance assumptions and graceful Redis distributed store capabilities when Redis is configured.

**Independent Test**: Verify memory store functions with zero overhead; verify TTL expiration and periodic cleanup; audit multi-instance deployment assumptions.

### Tests for User Story 4 🧪

- [X] T012 [P] [US4] Write unit tests in `server/middleware/__tests__/idempotency.test.ts` for `IdempotencyStore` lifecycle and TTL expiration cleanup

### Implementation for User Story 4

- [X] T013 [US4] Implement `IdempotencyStore` abstraction with pluggable storage support and documentation of deployment architecture assumptions in `server/middleware/idempotencyMiddleware.ts`

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verify translation routes integration, run full quality gates, and execute quickstart validation.

- [X] T014 [P] Verify and update integration tests across translation endpoints in `server/middleware/__tests__/idempotency.test.ts`
- [X] T015 [P] Run full quality gate checks (`npm run lint`, `npm test`, `npm run build`) and verify 0 regressions
- [X] T016 Execute quickstart validation scenarios from `specs/033-scoped-idempotency/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1: Setup (T001, T002)
   │
   ▼
Phase 2: Foundational (T003, T004, T005) [BLOCKS ALL USER STORIES]
   │
   ├──────────────────────────────┬──────────────────────────────┐
   ▼                              ▼                              ▼
Phase 3: User Story 1 (P1)    Phase 4: User Story 2 (P2)    Phase 5: User Story 3 (P3)
(T006 -> T007)                 (T008 -> T009)                 (T010 -> T011)
   │                              │                              │
   └──────────────────────────────┼──────────────────────────────┘
                                  ▼
                     Phase 6: User Story 4 (P4)
                     (T012 -> T013)
                                  │
                                  ▼
                     Phase 7: Polish & Verification
                     (T014, T015, T016)
```
