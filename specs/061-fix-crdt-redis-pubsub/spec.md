# Feature Specification: Fix Redis Pub/Sub Initialization & Offline Queue Configuration

**Feature Branch**: `061-fix-crdt-redis-pubsub`

**Created**: 2026-08-23

**Status**: Ready

**Input**: User description: "Lỗi [CrdtRedisPubSub] Lỗi khởi tạo Redis Pub/Sub: Error: Stream isn't writeable and enableOfflineQueue options is false xuất hiện do redisManager cấu hình enableOfflineQueue: false để phục vụ cơ chế fail-fast/graceful degradation cho API rate-limiting. Khi setupCrdtRedisPubSub() gọi mainClient.duplicate(), đối tượng subClient kế thừa cấu hình này và ngay lập tức thực thi await subClient.psubscribe(...) khi kết nối TCP chưa ở trạng thái ready (stream chưa ghi được). Yêu cầu: Ghi đè cấu hình cho Sub Client khi duplicate() với enableOfflineQueue: true, maxRetriesPerRequest: null; Gắn event handlers error và ready (tự động re-subscribe); Không blocking khởi động server; Đảm bảo chất lượng toàn diện."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clean Non-Blocking Server Startup with Redis Pub/Sub (Priority: P1)

As a system administrator or developer starting the translation server with a configured `REDIS_URL`, I want the server and CRDT Redis Pub/Sub system to initialize smoothly without throwing `"Stream isn't writeable and enableOfflineQueue options is false"` errors during the TCP handshake, so that the server logs remain clean and real-time multi-instance collaboration activates reliably.

**Why this priority**: Directly eliminates the startup race condition where Redis commands are dispatched before the socket stream becomes writable, preventing noisy error logs and unhandled rejections during application boot.

**Independent Test**: Start the server with Redis enabled, verify no stream writeable / offline queue error is thrown, and verify that the subscriber client successfully transitions to `ready` and registers pattern subscription `crdt:room:*`.

**Acceptance Scenarios**:

1. **Given** `REDIS_URL` is configured and the main Redis client is connecting, **When** `setupCrdtRedisPubSub()` is executed, **Then** `subClient` is instantiated with `enableOfflineQueue: true` and does NOT throw an offline queue rejection.
2. **Given** `subClient` is created during server boot, **When** the Redis connection reaches `ready` state, **Then** it automatically executes `psubscribe('crdt:room:*')` and logs readiness.
3. **Given** Redis is operating in in-memory single-instance mode (no `REDIS_URL`), **When** `setupCrdtRedisPubSub()` runs, **Then** it gracefully exits immediately without error.

---

### User Story 2 - Resilient Auto-Reconnection and Error Handling for Sub Client (Priority: P2)

As a translator collaborating on a shared project across multiple server instances, I want the Redis subscriber connection to automatically re-subscribe to CRDT room channels after temporary network blips without crashing the Node.js server process, so that collaboration continues seamlessly once connectivity is restored.

**Why this priority**: Prevents EventEmitter unhandled `error` events from terminating the backend process during transient network disconnects and ensures subscription state is self-healing.

**Independent Test**: Simulate connection loss / error on `subClient`, verify the error is logged as a warning without crashing the process, and verify that upon reconnection (`ready` event), `psubscribe` is invoked again.

**Acceptance Scenarios**:

1. **Given** an active `subClient`, **When** a connection error occurs, **Then** the `error` event handler intercepts the error and logs a warning instead of raising an unhandled exception.
2. **Given** the Redis connection dropped and reconnected, **When** the `ready` event fires, **Then** `subClient` re-executes `psubscribe('crdt:room:*')` to restore cross-instance message routing.
3. **Given** the server is shutting down, **When** `cleanupCrdtRedisPubSub()` is called, **Then** `subClient` cleanly unsubscribes and terminates connection without hanging.

---

### Edge Cases

- **Redis connection latency / slow handshake**: When TCP connection takes several hundred milliseconds to establish, commands are buffered safely in the offline queue and sent as soon as the connection is ready.
- **Multiple rapid reconnects**: Pattern subscriptions in the `ready` handler are idempotent in Redis and handle repeated invocation without duplicate message delivery.
- **Main client already ready before setup**: If `subClient.status === 'ready'` immediately upon duplication, `psubscribe` is also dispatched directly.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `setupCrdtRedisPubSub()` MUST duplicate the Redis main client using `{ enableOfflineQueue: true, maxRetriesPerRequest: null }` for `subClient`, overriding the fail-fast defaults of `redisManager`.
- **FR-002**: `subClient` MUST register an `'error'` event listener to log warnings and prevent unhandled EventEmitter exceptions from crashing the application.
- **FR-003**: `subClient` MUST register a `'ready'` event listener to automatically invoke `psubscribe('crdt:room:*')` upon initial connection and subsequent reconnects.
- **FR-004**: If `subClient` is already in `'ready'` status when initialized, `psubscribe('crdt:room:*')` MUST be triggered immediately.
- **FR-005**: `setupCrdtRedisPubSub()` MUST remain non-blocking and handle initialization errors inside a try/catch block so server startup is never halted by Redis Pub/Sub issues.
- **FR-006**: `cleanupCrdtRedisPubSub()` MUST safely unsubscribe and disconnect `subClient` during server shutdown.

### Key Entities

- **`crdtRedisPubSub`** (`server/services/crdtRedisPubSub.ts`): Manages multi-instance CRDT cross-server synchronization via Redis Pub/Sub.
- **`redisManager`** (`server/services/redisService.ts`): Provides the shared `ioredis` client instance.
- **`websocketRelayService`** (`server/services/websocketRelayService.ts`): Dispatches local WebSocket room events and receives cross-instance broadcasts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0 occurrences of `"Stream isn't writeable and enableOfflineQueue options is false"` in server startup logs when Redis is enabled.
- **SC-002**: 100% of CRDT room synchronization messages broadcast successfully across instances once Redis reaches `ready` state.
- **SC-003**: 0 unhandled `error` event process crashes when Redis experiences transient disconnects.
- **SC-004**: All quality gates (`npm run lint`, `npm test`, `npm run build`) pass cleanly with 100% test pass rate.

## Assumptions

- The main Redis client in `redisService.ts` keeps `enableOfflineQueue: false` to ensure fast fallback to in-memory mode for rate-limiting, while the Pub/Sub subscriber client in `crdtRedisPubSub.ts` specifically overrides this with `enableOfflineQueue: true`.
- Existing channel naming format (`crdt:room:<roomId>`) and payload serialization (`{ inst, b64 }`) remain unchanged.
