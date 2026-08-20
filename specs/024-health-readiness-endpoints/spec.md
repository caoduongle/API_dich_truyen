# Feature Specification: Real Health, Liveness & Readiness Endpoints

**Feature Branch**: `024-health-readiness-endpoints`

**Created**: 2026-08-20

**Status**: Draft

**Input**: User request: "TASK 11 — HEALTH/READINESS ENDPOINT. Mục tiêu: Sửa /health để phản ánh health thực tế thay vì chỉ kiểm tra REDIS_URL tồn tại. Tách: /live, /ready hoặc architecture tương đương nếu repo đã có endpoint convention. Liveness: Chỉ xác nhận process đang chạy. Readiness: Kiểm tra dependency cần thiết: Redis, critical services. Không gọi Gemini API ở mỗi health request chỉ để “test provider”. Response: Phân biệt: healthy, degraded, unavailable. Tests: process alive, Redis healthy, Redis down, Redis reconnect."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dedicated Liveness & Readiness Probes (Priority: P1) 🎯 MVP

As a container orchestrator (Kubernetes, Docker Swarm) or load balancer, I want distinct `/api/live` (Liveness) and `/api/ready` (Readiness) HTTP endpoints so that I can determine if the process is responsive without triggering expensive dependency checks, and verify if the service is fully prepared to accept user traffic before routing incoming requests.

**Why this priority**: Prevents premature traffic routing during cold starts and isolates process liveness from transient network blips.

**Independent Test**: Query `GET /api/live` (assert 200 OK `{ status: "alive" }`), query `GET /api/ready` during healthy state (assert 200 OK `{ status: "healthy" }`), and query `GET /api/ready` during Redis outage (assert 200 OK `{ status: "degraded" }` with degraded mode notice).

**Acceptance Scenarios**:

1. **Given** the Node.js Express process is up, **When** `GET /api/live` (or `/live`) is called, **Then** it immediately responds with HTTP 200 `{ status: "alive", timestamp: string, uptimeSeconds: number }`.
2. **Given** Redis is configured and connected, **When** `GET /api/ready` (or `/ready`) is called, **Then** it checks real Redis connectivity and responds with HTTP 200 `{ status: "healthy", ready: true, dependencies: { redis: "connected", memory: "ok" } }`.
3. **Given** Redis is configured but disconnected/failing, **When** `GET /api/ready` is called, **Then** it responds with HTTP 200 `{ status: "degraded", ready: true, dependencies: { redis: "degraded" } }` indicating fallback in-memory operation.

---

### User Story 2 - Real System Health & Diagnostic Telemetry (Priority: P2)

As a DevOps engineer or monitoring dashboard, I want `GET /api/health` to reflect true runtime dependency states (`healthy`, `degraded`, `unavailable`) instead of static string checks (`!!process.env.REDIS_URL`), so that infrastructure telemetry accurately reports the operational mode of Redis, active sessions, memory, and uptime.

**Why this priority**: Eliminates false "healthy" reporting when Redis has crashed or dropped connection.

**Independent Test**: Simulate Redis connected vs degraded states and assert that `GET /api/health` output transitions between `status: "healthy"` and `status: "degraded"` with accurate `redis.status` telemetry.

**Acceptance Scenarios**:

1. **Given** Redis is healthy, **When** `GET /api/health` is queried, **Then** response contains `status: "healthy"`, `redis: { enabled: true, status: "connected", mode: "redis" }`.
2. **Given** Redis drops connection, **When** `GET /api/health` is queried, **Then** response contains `status: "degraded"`, `redis: { enabled: true, status: "degraded", mode: "in-memory-fallback" }`.

---

### User Story 3 - Zero Provider Call Invariant & Public Whitelist (Priority: P3)

As a financial and quota manager, I want health checks to NEVER execute upstream Gemini API calls during liveness/readiness/health queries, and allow unrestricted access to probe endpoints without authentication headers.

**Why this priority**: Calling LLMs during periodic 5-second health checks would rapidly exhaust daily rate limits and generate massive unnecessary latency/cost.

**Independent Test**: Send 100 consecutive requests to `/api/live`, `/api/ready`, and `/api/health` and verify that 0 calls to `geminiService.ts` or Google API occur, and all requests pass without `X-Auth-Token`.

**Acceptance Scenarios**:

1. **When** health/live/ready endpoints are invoked, **Then** 0 calls are made to Gemini API providers.
2. **When** health/live/ready endpoints are invoked with no `X-Auth-Token` on a password-protected server, **Then** access is permitted (HTTP 200).

---

### Edge Cases

- **Redis Reconnection**: Transition from `degraded` back to `healthy` is immediately reflected in subsequent `/api/ready` and `/api/health` responses.
- **Unconfigured Redis (`REDIS_URL` unset)**: Service reports `status: "healthy"` in `"in-memory"` standalone mode.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `GET /api/live` (and `/live`) MUST respond with HTTP 200 `{ status: 'alive', uptimeSeconds: number, timestamp: string }` without dependency checks.
- **FR-002**: `GET /api/ready` (and `/ready`) MUST evaluate real runtime dependency health via `redisManager.getStatus()`.
- **FR-003**: `GET /api/health` (and `/health`) MUST report true aggregated health state:
  - `'healthy'`: Dependencies functioning normally (Redis connected or standalone in-memory configured).
  - `'degraded'`: Redis configured but operating in local in-memory fallback.
  - `'unavailable'`: Process terminating or severe system failure.
- **FR-004**: Health/ready checks MUST NEVER make upstream calls to Gemini API providers.
- **FR-005**: `/live`, `/ready`, `/health`, `/api/live`, `/api/ready`, `/api/health` MUST be included in `PUBLIC_API_PATHS` in `server/middleware/authMiddleware.ts`.
- **FR-006**: The `/api/health` response structure MUST include:
  - `status: 'healthy' | 'degraded' | 'unavailable'`
  - `timestamp: string`
  - `uptime: string`
  - `uptimeSeconds: number`
  - `redis: { enabled: boolean, status: string, mode: string }`
  - `sessions: { activeCount: number }`
  - `memory: { heapUsedMB: number, rssMB: number }`
  - `models: { supported: string[] }`

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0 upstream Gemini API calls during `/live`, `/ready`, or `/health` invocations.
- **SC-002**: Real-time status transitions between `'healthy'` and `'degraded'` when Redis connects, fails, or reconnects.
- **SC-003**: Public probe endpoints return HTTP 200 without requiring `X-Auth-Token`.
- **SC-004**: Full quality verification gates (`npm test`, `npm run lint`, `npm run build`) pass cleanly with 0 errors.
