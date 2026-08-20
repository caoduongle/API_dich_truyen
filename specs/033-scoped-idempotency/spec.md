# Feature Specification: Scoped Idempotency & Conflict-Safe Replay Engine

**Feature Branch**: `033-scoped-idempotency`  
**Created**: 2026-08-20  
**Status**: Draft  
**Input**: User description: "TASK 02 — SỬA IDEMPOTENCY SCOPE: Sửa phạm vi idempotency từ process-local Map đơn giản sang composite key scoped theo identity/session + endpoint + Idempotency-Key, tích hợp request fingerprint chống conflict, xử lý in-flight concurrency, và đánh giá multi-instance storage."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Multi-Dimensional Composite Key Scoping & Tenant Isolation (Priority: P1) 🎯 MVP

As a translation application user or client,  
I want my translation requests with client-generated idempotency keys to be strictly isolated by my user session and endpoint path,  
So that my responses are never leaked to or replayed by other users, and requests to different endpoints with the same key identifier do not collide.

**Why this priority**: Preventing cross-user data leakage and cross-endpoint collision is a critical security and correctness requirement.

**Independent Test**:
1. User A sends `/api/translate-raw` with key `KEY123`.
2. User B sends `/api/translate-raw` with key `KEY123`.
3. Verify User B triggers a fresh translation and does not receive User A's response.
4. User A sends `/api/polish-translation` with key `KEY123`.
5. Verify User A triggers a fresh polish call and does not receive the raw translation response.

**Acceptance Scenarios**:
1. **Given** User A with Session `token-A` calls `/api/translate-raw` with `Idempotency-Key: batch_1`, **When** the request completes, **Then** the response is stored scoped strictly under `token-A + POST /api/translate-raw + batch_1`.
2. **Given** User B with Session `token-B` calls `/api/translate-raw` with the identical `Idempotency-Key: batch_1`, **When** the request is received, **Then** the system treats it as a completely distinct request and executes fresh processing without returning User A's cached response.
3. **Given** User A with Session `token-A` calls `/api/polish-translation` with `Idempotency-Key: batch_1`, **When** the request is received, **Then** the system does not collide with `/api/translate-raw` and executes fresh polishing.

---

### User Story 2 - Request Fingerprinting & Payload Conflict Detection (Priority: P2)

As an API client or automated retry worker,  
I want the system to verify that retried idempotent requests match the original request payload,  
So that if a request uses an existing key with different input parameters, the system rejects it with `409 Conflict` instead of silently returning mismatched data.

**Why this priority**: Prevents silent corruption where a modified chapter or changed prompt accidentally returns the translation of a completely different text because the client reused an idempotency key.

**Independent Test**: Send a request with `Idempotency-Key: KEY123` and body `{"prompt": "Text 1"}`. Once completed, send another request with the same `Idempotency-Key: KEY123` but body `{"prompt": "Text 2"}`. Verify the server returns HTTP `409 Conflict` with `errorCode: "IDEMPOTENCY_CONFLICT"`.

**Acceptance Scenarios**:
1. **Given** a completed idempotent entry for `Session A + /api/translate-raw + KEY1` with payload hash $H_1$, **When** a new request arrives with identical scope but payload hash $H_2 \neq H_1$, **Then** the server responds with HTTP `409 Conflict` and descriptive error message.
2. **Given** a completed idempotent entry for `Session A + /api/translate-raw + KEY1` with payload hash $H_1$, **When** a new request arrives with identical scope and matching payload hash $H_1$, **Then** the server replays the stored response with header `x-idempotent-replay: true`.

---

### User Story 3 - In-Flight Concurrency Coordination & Failure Recovery (Priority: P3)

As a concurrent client submitting duplicate requests simultaneously (e.g. rapid double-clicks or parallel network retries),  
I want duplicate in-flight requests to wait on the primary request execution,  
So that upstream AI providers are only invoked once and all concurrent callers receive the identical result without duplicate billing or race conditions.

**Why this priority**: Eliminates duplicate upstream Gemini API calls and prevents race conditions when clients retry aggressively before the first request finishes.

**Independent Test**: Launch two simultaneous asynchronous HTTP requests with identical identity, endpoint, key, and body. Verify that only one upstream AI call is executed, both requests return the exact same output, and the second response includes `x-idempotent-replay: true`.

**Acceptance Scenarios**:
1. **Given** Request 1 is currently `pending` upstream, **When** duplicate Request 2 arrives with identical scope and body fingerprint, **Then** Request 2 attaches as a listener to the in-flight execution without triggering a second upstream call.
2. **Given** Request 1 completes successfully (HTTP 200-299), **When** execution finishes, **Then** both Request 1 and Request 2 receive the response payload, and entry transitions to `completed`.
3. **Given** Request 1 fails (HTTP 4xx/5xx or unhandled exception), **When** execution terminates, **Then** entry transitions to `failed` and is immediately evicted, allowing subsequent retries to execute freshly.

---

### User Story 4 - Multi-Instance Evaluation & Storage Abstraction (Priority: P4)

As a DevOps engineer or system administrator,  
I want the idempotency architecture to provide a unified storage interface supporting both local in-memory store and Redis distributed store,  
So that single-node deployments run with zero overhead while multi-instance cluster deployments can share idempotent state across server processes.

**Why this priority**: Clarifies deployment assumptions, provides future-proof distributed readiness, and prevents split-brain idempotency across multi-instance clusters.

**Independent Test**: Verify memory store works out-of-the-box in single-node mode. When Redis connection is active (`redisManager.getStatus() === 'connected'`), verify idempotent keys and payload fingerprints are stored with Redis TTLs.

**Acceptance Scenarios**:
1. **Given** the application runs in single-instance mode without Redis, **When** idempotent requests are processed, **Then** the in-memory scoped store handles concurrency, replay, and TTL cleanup with zero external dependencies.
2. **Given** the application runs in a multi-instance deployment with Redis enabled, **When** idempotent requests are processed, **Then** the store leverages Redis keys with atomic TTLs to synchronize idempotency state across instances.

---

### Edge Cases

- **Missing or Empty Idempotency Key**: If `Idempotency-Key` / `x-idempotency-key` is omitted or contains only whitespace, the middleware calls `next()` immediately without overhead.
- **Missing Session Token / Anonymous Client**: If client does not provide `x-session-token`, fallback to client IP or credential hash to maintain tenant boundaries rather than creating a global collision bucket.
- **Payload Normalization**: JSON whitespace or key ordering differences should not trigger false-positive 409 conflicts (normalized serialization before hashing).
- **TTL Expiration**: Entries older than 5 minutes (300,000ms) are cleaned up and rejected from replay, allowing subsequent requests to run freshly.
- **Crash / Stalled In-Flight Request**: In-flight requests have a timeout ceiling (e.g. 90s); if stalled, listeners receive timeout error and stale pending locks are cleared.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST compute a composite idempotency key combining `identity/session` + `HTTP method & endpoint path` + `client idempotency-key`.
- **FR-002**: System MUST isolate cached responses such that `User A + /endpoint + Key1` is strictly separated from `User B + /endpoint + Key1`.
- **FR-003**: System MUST isolate cached responses across different endpoints such that `User A + /api/translate-raw + Key1` is strictly separated from `User A + /api/polish-translation + Key1`.
- **FR-004**: System MUST compute a deterministic cryptographic hash (SHA-256) of the incoming request payload (`req.body`) as a request fingerprint.
- **FR-005**: System MUST compare incoming request fingerprints against stored entry fingerprints for matching composite keys, rejecting mismatches with HTTP status `409 Conflict` and error code `IDEMPOTENCY_CONFLICT`.
- **FR-006**: System MUST coordinate concurrent duplicate in-flight requests, queueing duplicate requests to wait on the primary execution rather than making redundant upstream provider calls.
- **FR-007**: System MUST set HTTP response header `x-idempotent-replay: true` whenever a cached or in-flight broadcast response is returned.
- **FR-008**: System MUST only store successful upstream responses (`statusCode >= 200 && statusCode < 300`) as `completed`; failed or errored requests MUST transition to `failed` and be evicted immediately.
- **FR-009**: System MUST enforce a 5-minute Time-To-Live (TTL) on all idempotency entries with automated periodic cleanup of expired records.
- **FR-010**: System MUST abstract storage through an `IdempotencyStore` interface supporting in-memory operation by default and optional Redis backing when configured.

---

### Key Entities

- **IdempotencyScopeKey**: The composite string identifier format:  
  `idemp:{identityHash}:{endpointPath}:{clientKey}`
- **RequestFingerprint**: SHA-256 hexadecimal hash of the normalized request body.
- **IdempotencyEntry**:
  - `key`: Composite scope key string.
  - `fingerprint`: SHA-256 hash of the initial request payload.
  - `status`: `'pending' | 'completed' | 'failed'`.
  - `createdAt`: Millisecond epoch timestamp.
  - `statusCode`: HTTP status code captured on response completion.
  - `responseBody`: Serialized response payload.
  - `listeners`: Array of in-flight listener callbacks waiting on resolution.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: **Zero Cross-User Data Leaks**: 100% of requests from different user sessions sharing identical client idempotency keys execute independently with zero response leakage.
- **SC-002**: **Zero Cross-Endpoint Collisions**: 100% of requests to different endpoints sharing identical client keys execute independently.
- **SC-003**: **100% Conflict Detection**: Any request presenting an existing key with altered body content is rejected immediately with HTTP 409 Conflict without invoking upstream providers.
- **SC-004**: **Replay Latency $\le$ 5ms**: Cached completed idempotent responses are returned in $\le$ 5ms without AI model invocation.
- **SC-005**: **Elimination of Duplicate Upstream Calls**: 100% of simultaneous in-flight duplicate requests share a single upstream AI call.
- **SC-006**: **Zero Memory Growth**: Memory store automatically evicts entries older than 5 minutes, maintaining bounded memory footprint.

---

## Assumptions

- Single-instance Node.js process is the primary runtime mode for the current application architecture; Redis-backed distributed storage is supported via existing `redisManager` infrastructure.
- User identity is primarily resolved via `req.headers['x-session-token']`, `req.headers['x-auth-token']`, or client IP fallback.
- The 5-minute idempotency TTL provides adequate window for network retries and client reconnections without causing stale data issues.
- All translation and critique endpoints (`/api/translate-raw`, `/api/polish-translation`, `/api/qa-critique`) continue to use the idempotency middleware.
