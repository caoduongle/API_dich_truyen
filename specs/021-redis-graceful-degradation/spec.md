# Feature Specification: Redis Graceful Degradation & Differentiated Local Fallback

**Feature Branch**: `021-redis-graceful-degradation`

**Created**: 2026-08-20

**Status**: Draft

**Input**: User request: "TASK 08 — REDIS GRACEFUL DEGRADATION. Mục tiêu: Khi Redis lỗi, HTTP rate limiter không được: Redis error -> allow everything, nhưng cũng không: Redis error -> kill entire application. Desired behavior: Redis healthy -> distributed limiter; Redis unavailable -> conservative local fallback -> degraded state. Phân biệt endpoint: security/auth, translation, non-critical. Không dùng cùng failure policy cho mọi endpoint. Requirements: local fallback có giới hạn; không memory leak; recovery khi Redis trở lại; logs không spam; metrics phản ánh degraded mode. Giữ nguyên HTTP limit hiện tại trừ khi source/spec chứng minh cần thay đổi. Tests: Redis healthy, Redis unavailable, Redis recovers, local fallback, multiple requests, auth endpoint, translation endpoint."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Graceful In-Memory Fallback & Automatic Redis Recovery (Priority: P1) 🎯 MVP

As an Express API service with Redis rate limiting, when the Redis instance experiences a network partition, timeout, or service crash, I want the HTTP rate limiter to seamlessly transition into a degraded in-memory fallback state with bounded memory, so that the service neither allows unthrottled request floods (fail-open) nor crashes/blocks incoming user traffic (fail-dead), and automatically restores distributed rate limiting once Redis reconnects.

**Why this priority**: Eliminates critical single-point-of-failure vulnerabilities in rate limiting infrastructure while maintaining application availability and security during Redis outages.

**Independent Test**: Disconnect/mock fail Redis and verify that incoming requests are throttled using the local in-memory store; re-establish Redis connection and assert that the limiter automatically switches back to Redis Lua evaluation without restart.

**Acceptance Scenarios**:

1. **Given** Redis is healthy (`isRedisHealthy = true`), **When** requests arrive at `/api`, **Then** the rate limiter evaluates distributed counts via Redis Lua script (`ratelimit:<ip>`).
2. **Given** Redis throws a connection error or query failure, **When** requests arrive, **Then** the rate limiter catches the error, marks state as degraded, and applies conservative local in-memory limiting without rejecting valid requests or throwing unhandled exceptions.
3. **Given** the limiter is operating in degraded mode, **When** Redis fires a `ready` event, **Then** state transitions back to healthy (`isRedisHealthy = true`), logging reconnection once and resuming distributed Redis operations.
4. **Given** degraded mode handles high volumes of distinct IP addresses, **When** local map exceeds capacity (`MAX_LOCAL_MAP_ENTRIES = 10,000`), **Then** expired entries are purged and LRU/FIFO eviction prevents memory growth.

---

### User Story 2 - Differentiated Endpoint Failure Policies (Priority: P2)

As a security architect, I want different endpoint categories (`auth`, `translation`, `non-critical`) to apply tailored failure policies during degraded mode, so that sensitive login endpoints maintain strict abuse protection while translation workflows remain accessible to legitimate users.

**Why this priority**: A one-size-fits-all fallback policy either over-restricts standard translation requests or exposes sensitive authentication endpoints to brute-force vulnerability.

**Independent Test**: Send excess requests to both `/api/auth/login` and `/api/translate` in degraded mode, asserting that auth enforces strict limits (e.g. 5 req/15min) while translation maintains the standard conservative limit (60 req/min).

**Acceptance Scenarios**:

1. **Given** an authentication endpoint (`endpointType: 'auth'`), **When** Redis is down, **Then** the local fallback enforces strict security limits (`5 req / 15 min / IP`) with zero relaxation.
2. **Given** a translation endpoint (`endpointType: 'translation'`), **When** Redis is down, **Then** the local fallback enforces standard conservative limits (`60 req / 1 min / IP`), rejecting IP floods beyond 60 while permitting legitimate usage.
3. **Given** a non-critical endpoint (`endpointType: 'non-critical'`), **When** Redis is down, **Then** a relaxed fallback is applied (`120 req / 1 min / IP`).

---

### User Story 3 - Throttled Logging & Telemetry Observability (Priority: P3)

As a system administrator monitoring server logs and metrics, I want Redis connection transitions to log cleanly without log flooding (spamming every incoming request) and expose runtime health status in service telemetry (`redisStatus: 'connected' | 'degraded' | 'disconnected'`), so that server logs remain legible and operations dashboards reflect accurate infrastructure health.

**Why this priority**: Prevents I/O saturation and log flooding under high request loads when Redis is offline.

**Independent Test**: Send 100 consecutive requests while Redis is offline and verify that transition warning is logged at most once (or throttled), and that telemetry metrics report `redisStatus = 'degraded'` and increment `degradedFallbackCount`.

**Acceptance Scenarios**:

1. **Given** Redis goes offline, **When** 500 requests arrive, **Then** a single state transition warning is emitted without per-request log spam.
2. **Given** rate limiter telemetry is queried, **When** Redis is degraded, **Then** it returns `{ redisStatus: 'degraded', degradedFallbackCount: N, localEntriesCount: M }`.

---

### Edge Cases

- **Redis Intermittent Flapping**: If Redis connection flaps rapidly, log throttling prevents log storms and state toggles cleanly without leaving dangling listeners.
- **Node.js Process Teardown**: Periodic in-memory map cleanup timers use `.unref()` so tests and servers exit cleanly without hanging.
- **Clock Drift**: Timestamps for local reset calculations use monotonically advancing relative comparisons with `Date.now()`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `createRateLimiter` MUST support differentiated endpoint configurations via `RateLimiterOptions`:
  - `endpointType?: 'auth' | 'translation' | 'non-critical'`
  - `windowMs?: number` (defaults to `SERVER_CONFIG.RATE_LIMIT_WINDOW_MS = 60000`)
  - `maxRequests?: number` (defaults to `SERVER_CONFIG.RATE_LIMIT_MAX_REQUESTS = 60`)
  - `keyPrefix?: string` (defaults to `"ratelimit:"`)
  - `message?: string`
- **FR-002**: When Redis is connected and healthy, rate limits MUST be evaluated atomically in Redis via Lua scripts.
- **FR-003**: When Redis is disconnected or queries fail, `createRateLimiter` MUST NOT fail-open (allow all) and MUST NOT fail-dead (crash application); it MUST switch to a bounded local in-memory fallback store.
- **FR-004**: The in-memory fallback store MUST enforce a hard maximum capacity (`MAX_LOCAL_MAP_ENTRIES = 10000`) with periodic TTL sweep and FIFO/LRU eviction to guarantee 0 memory leaks.
- **FR-005**: Automatic recovery MUST restore Redis distributed limiting immediately upon Redis `ready` / `connect` events without requiring server restart.
- **FR-006**: Error logs during Redis outage MUST be throttled: log once upon disconnect and once upon reconnect, with per-request spam suppressed.
- **FR-007**: The rate limiter module MUST export a telemetry query method (e.g. `getRateLimiterHealth()`) returning `{ redisStatus, isDegraded, degradedFallbackCount, localEntriesCount }`.
- **FR-008**: Existing HTTP rate limits MUST remain strictly preserved:
  - Global `/api` limiter: 60 req / min / IP
  - Auth login `/api/auth/login` limiter: 5 req / 15 min / IP

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0 unhandled exceptions or server crashes when Redis disconnects, fails queries, or reconnects.
- **SC-002**: In degraded mode, requests exceeding configured threshold (`60 req/min` for API, `5 req/15min` for Auth) receive HTTP 429 `{ code: 'RATE_LIMITED' }`.
- **SC-003**: During a simulated Redis outage with 100 requests, error log statements are emitted $\le 2$ times (state transition only).
- **SC-004**: Full quality verification gates (`npm test`, `npm run lint`, `npm run build`) pass cleanly with 0 errors.
