# Implementation Plan: Scoped Idempotency & Conflict-Safe Replay Engine (TASK 02)

**Branch**: `033-scoped-idempotency` | **Date**: 2026-08-20 | **Spec**: [specs/033-scoped-idempotency/spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/033-scoped-idempotency/spec.md)

---

## Summary

Refactor the translation idempotency system in `server/middleware/idempotencyMiddleware.ts` from a naive single-string key store to a multi-dimensional scoped architecture (`identity/session + endpoint + clientKey`) equipped with cryptographic request payload fingerprinting (SHA-256) to detect and reject body conflicts with HTTP 409, robust in-flight concurrency coordination, fail-safe eviction, and clean storage abstraction.

---

## Technical Context

- **Language/Version**: TypeScript 5.8 / Node.js 20+ (Express 4)
- **Primary Dependencies**: `express`, `crypto` (native Node.js), `ioredis` (optional Redis fallback)
- **Storage**: In-memory `Map<string, IdempotencyEntry>` (microsecond access for single-instance Node runtime) with graceful Redis abstraction
- **Testing**: `vitest run`
- **Target Platform**: Node.js Backend Server (`server/`)
- **Performance Goals**: $\le 5$ms replay latency for completed idempotent responses; zero redundant upstream AI provider calls
- **Constraints**: Strict multi-tenant session isolation; zero cross-user response leakage; immediate eviction of failed requests; 5-minute TTL

---

## Constitution Check

- [X] **No arbitrary dependencies**: Only built-in `crypto` and existing codebase dependencies used.
- [X] **Strict quality gates**: Must pass `npm run lint`, `npm test`, `npm run build`.
- [X] **Preserve API compatibility**: Client `Idempotency-Key` / `x-idempotency-key` headers continue to be recognized seamlessly.
- [X] **Security first**: Multi-tenant session scoping prevents response leakage between different user accounts or sessions.

---

## Project Structure

### Documentation (this feature)

```text
specs/033-scoped-idempotency/
├── spec.md              # Feature specification
├── plan.md              # Implementation plan (/speckit-plan output)
├── research.md          # Phase 0 technical research
├── data-model.md        # Phase 1 data entities and state machine
├── quickstart.md        # Phase 1 validation scenarios
├── contracts/           # Phase 1 API & error contracts
│   ├── idempotency-middleware.md
│   └── conflict-response.md
└── tasks.md             # Phase 2 tasks list (/speckit-tasks output)
```

### Source Code

```text
server/
├── middleware/
│   ├── idempotencyMiddleware.ts      # [MODIFY] Scoped composite key, fingerprinting, 409 conflict, in-flight coordination
│   └── __tests__/
│       └── idempotency.test.ts       # [MODIFY] Comprehensive unit & concurrency tests
├── routes/
│   └── api.ts                        # Translation routes using idempotency middleware
└── constants/
    └── errors.ts                     # AIErrorCode definitions
```

---

## Implementation Phases

### Phase 1: Setup & Data Structures
- Define `IdempotencyEntry`, `IdempotencyStatus`, and `IdempotencyStore` interfaces in `server/middleware/idempotencyMiddleware.ts`.
- Implement `buildCompositeIdempotencyKey(req, clientKey)` and `computeRequestFingerprint(body)`.

### Phase 2: Core Middleware Refactoring
- Implement scoped key lookup: `idemp:{identityHash}:{endpointPath}:{clientKey}`.
- Implement payload fingerprint verification with **HTTP 409 Conflict** (`IDEMPOTENCY_CONFLICT`) rejection on mismatch.
- Implement in-flight concurrency listener queue.
- Implement response capture with `x-idempotent-replay: true` on replay.
- Implement failed request eviction (non-caching of status $\ge 400$).
- Implement 5-minute TTL and periodic/on-access garbage collection.

### Phase 3: Comprehensive Test Suite
- Test 1: Same user + same key + same body $\to$ replay with `x-idempotent-replay: true`.
- Test 2: Same user + different key $\to$ independent execution.
- Test 3: Different users + same key $\to$ independent execution, zero data leakage.
- Test 4: Same key + different endpoint (`/translate-raw` vs `/polish-translation`) $\to$ independent execution.
- Test 5: Same key + different body $\to$ **409 Conflict**.
- Test 6: Concurrent duplicate requests $\to$ single upstream execution, both receive response.
- Test 7: Expired entry (> 5 minutes) $\to$ fresh execution.
- Test 8: Failed entry (500 or 400) $\to$ evicted, subsequent retry succeeds.

### Phase 4: Quality Gate Verification
- Run `npm run lint`, `npm test`, `npm run build`.
