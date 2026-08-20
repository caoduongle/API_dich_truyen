# Feature Specification: Shared Redis Connection Manager & Lifecycle Engine

**Feature Branch**: `022-shared-redis-connection`

**Created**: 2026-08-20

**Status**: Draft

**Input**: User request: "TASK 09 — SHARED REDIS CONNECTION. Mục tiêu: Audit toàn bộ: new Redis(...) trong repo. Xác định hiện có bao nhiêu Redis connections. Nếu nhiều service tạo client riêng không cần thiết, tạo shared Redis abstraction. Desired architecture: RedisConnectionManager -> rate limiter, session store, auth store, quota/cache. Requirements: connection reuse; graceful shutdown; testability; không global mutable state khó kiểm soát; không phá test isolation. Không nhất thiết phải dùng đúng tên RedisConnectionManager. Tests: single shared connection, connection failure, reconnect, shutdown, service initialization."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Shared Redis Connection Singleton & Reuse (Priority: P1) 🎯 MVP

As an Express backend application initializing multiple components (`rateLimiter`, `authStore`, `sessionStore`), I want all modules to consume a single shared, managed Redis client instance rather than opening redundant TCP/TLS connections, so that server resource utilization is optimized and connection limit overhead on the Redis server is minimized.

**Why this priority**: Eliminates 4+ redundant socket connections per server process, unifying retry policies and connection health tracking into a single source of truth.

**Independent Test**: Initialize `rateLimiter`, `authStore`, and `sessionStore` with `REDIS_URL` set, and assert that all components share the identical `Redis` client instance (`client1 === client2`).

**Acceptance Scenarios**:

1. **Given** `REDIS_URL` is set in environment, **When** `rateLimiter`, `authStore`, and `sessionStore` initialize, **Then** all three consume the identical shared Redis instance created by `redisManager`.
2. **Given** `REDIS_URL` is not set or empty, **When** components request a Redis client, **Then** `redisManager.getClient()` returns `null` and components operate in local memory mode.
3. **Given** Redis emits an `error` or `ready` event, **When** received, **Then** connection state is recorded centrally and broadcast to registered component listeners.

---

### User Story 2 - Graceful Shutdown & Process Lifecycle Management (Priority: P2)

As a DevOps engineer deploying or stopping the server container, I want the Redis connection manager to cleanly terminate active Redis client connections during process shutdown (`SIGINT`, `SIGTERM`) or test teardown, so that socket leaks and lingering connection handles are prevented.

**Why this priority**: Ensures zero connection hanging or leaked file descriptors during hot reloads, graceful deployments, and test suite executions.

**Independent Test**: Trigger `redisManager.close()` during shutdown simulation and assert that `redisClient.quit()` is invoked and internal state transitions to `'closed'`.

**Acceptance Scenarios**:

1. **Given** an active shared Redis connection, **When** `redisManager.close()` is called, **Then** `quit()` is executed cleanly and subsequent queries safely return `null` / local fallback.
2. **Given** process termination signals (`SIGINT`, `SIGTERM`), **When** received, **Then** `redisManager.close()` is automatically invoked as part of the graceful shutdown pipeline.

---

### User Story 3 - Test Isolation & Mocking Support (Priority: P3)

As a test developer running unit and integration tests across multiple suites, I want to inject mock Redis clients or reset connection state cleanly via `setMockClient` / `resetForTesting()`, so that test runs remain isolated and never leak background intervals or TCP connections.

**Why this priority**: Prevents inter-test cross-contamination and unstable mock state in Vitest.

**Independent Test**: In a test suite, inject a custom `MockRedis` instance via `redisManager.setMockClient(...)`, verify that all consuming services use the mock, and call `resetForTesting()` to restore pristine baseline state.

**Acceptance Scenarios**:

1. **Given** a mock Redis client injected via `redisManager.setMockClient(mock)`, **When** consuming services query `redisManager.getClient()`, **Then** they receive the injected mock instance.
2. **Given** `redisManager.resetForTesting()` is called in `afterEach`, **When** the next test runs, **Then** mock state and listeners are cleanly reset.

---

### Edge Cases

- **Redis Connection Flapping**: Rapid disconnect/reconnect cycles handled by ioredis `retryStrategy` without creating duplicate client instances.
- **Concurrent Startup Queries**: Services requesting `getClient()` concurrently during startup receive the single shared instance without race conditions.
- **No-op on Null Shutdown**: Calling `close()` when no client was instantiated resolves immediately without throwing errors.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A centralized connection manager module (`server/services/redisService.ts` / `redisManager`) MUST be created as the single authority for Redis connections.
- **FR-002**: `rateLimiter.ts`, `authStore.ts`, and `sessionStore.ts` MUST NOT instantiate `new Redis(...)` independently; they MUST obtain their client via `redisManager.getClient()`.
- **FR-003**: `redisManager.getClient()` MUST return a singleton `Redis | null` based on `process.env.REDIS_URL`.
- **FR-004**: Centralized Redis connection options MUST be standardized:
  - `maxRetriesPerRequest: 1`
  - `enableOfflineQueue: false`
  - `retryStrategy: (times) => Math.min(times * 500, 5000)`
- **FR-005**: `redisManager` MUST expose lifecycle methods:
  - `getStatus(): 'connected' | 'degraded' | 'disconnected' | 'closed'`
  - `close(): Promise<void>`
  - `onStatusChange(listener: (status) => void): () => void`
- **FR-006**: `redisManager` MUST expose test isolation helpers:
  - `setMockClient(client: Redis | null): void`
  - `resetForTesting(): void`
- **FR-007**: Server entrypoint (`server.ts`) MUST register graceful shutdown handling to close `redisManager` on process termination.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of Redis client instantiations are centralized in `redisService.ts` (0 instances of `new Redis` in middleware or stores).
- **SC-002**: `rateLimiter`, `authStore`, and `sessionStore` share the exact same Redis instance in runtime.
- **SC-003**: `redisManager.close()` terminates connection cleanly with 0 dangling timers or open sockets.
- **SC-004**: Full quality verification gates (`npm test`, `npm run lint`, `npm run build`) pass cleanly with 0 errors.
