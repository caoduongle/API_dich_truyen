# Feature Specification: Secure Session Tokens (Zero URL Query Credentials)

**Feature Branch**: `023-session-token-no-url`

**Created**: 2026-08-20

**Status**: Draft

**Input**: User request: "TASK 10 — SESSION TOKEN KHÔNG ĐI QUA URL. Mục tiêu: Loại bỏ query-token compatibility khỏi session endpoints nếu không còn requirement tương thích. Audit: req.query.token, ?token=, session endpoints, frontend session requests, tests, docs. Desired: X-Session-Token: <token> là cơ chế chính thức. Không để token xuất hiện: URL, logs, errors, referrer. Compatibility: Nếu buộc phải giữ query token vì backward compatibility: ghi rõ lý do, đánh dấu deprecated, thêm warning/telemetry, có migration/removal plan. Không âm thầm giữ vĩnh viễn. Tests: header token -> success, query token -> rejected/deprecated, missing -> unauthorized, invalid -> unauthorized."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Header-Based Session Token Enforcement & Disallowing URL Query Tokens (Priority: P1) 🎯 MVP

As an API security maintainer, I want all session-related endpoints (`GET /api/session-keys/status`, `DELETE /api/session-keys`, and protected API translation endpoints) to strictly require the `X-Session-Token` HTTP header (or request body for POST creation) and reject any attempts to supply tokens in URL query parameters (`?token=...`), so that session credentials are never leaked via browser histories, server access logs, reverse proxy access logs, or HTTP Referrer headers.

**Why this priority**: Credentials transmitted in URL query parameters violate OWASP Top 10 security standards and leak into web server access logs, CDN access logs, and referrer headers.

**Independent Test**: Send requests with `X-Session-Token` header (assert 200 OK), send requests with `?token=...` query string (assert 400 Bad Request / Rejected), and send requests with missing/invalid header tokens (assert 401 Unauthorized / valid: false).

**Acceptance Scenarios**:

1. **Given** a request with a valid `X-Session-Token: <token>` header, **When** hitting `GET /api/session-keys/status` or `DELETE /api/session-keys`, **Then** the server processes the request successfully with HTTP 200.
2. **Given** a request with a `?token=...` in the query string, **When** hitting session endpoints, **Then** the server explicitly rejects the request with HTTP 400 `{ code: 'DISALLOWED_URL_CREDENTIALS', error: 'Session token không được truyền qua URL query parameter. Vui lòng sử dụng header X-Session-Token.' }`.
3. **Given** a request with no token header or body, **When** hitting `DELETE /api/session-keys`, **Then** the server responds with HTTP 401 `{ code: 'MISSING_SESSION_TOKEN' }`.
4. **Given** a request with an invalid or expired `X-Session-Token`, **When** hitting `GET /api/session-keys/status`, **Then** the server responds with `{ valid: false, keyCount: 0 }`.

---

### User Story 2 - Zero URL Credential Leaks in Logs & Telemetry (Priority: P2)

As a security auditor inspecting server logs, I want all logging middleware and metrics collectors to sanitize and redact any accidental query strings or credential tokens, so that even if a misconfigured client attempts to send credentials in URLs, zero sensitive tokens appear in plaintext log files.

**Why this priority**: Guarantees defense-in-depth compliance across all log streams.

**Independent Test**: Send requests with dirty URLs (e.g. `/api/session-keys/status?token=secret-uuid`) through the request logging pipeline and assert that logged URLs and metrics are stripped of query tokens (`/api/session-keys/status`).

**Acceptance Scenarios**:

1. **Given** an incoming HTTP request containing query parameters, **When** processed by `metricsMiddleware` or logger, **Then** query parameters matching `token`, `key`, `apiKey` are sanitized/redacted before writing to logs.

---

### Edge Cases

- **Mixed Header and Query**: If a client sends both `X-Session-Token: valid` and `?token=anything`, the request is rejected with HTTP 400 to enforce strict URL cleanliness.
- **Empty Query String**: Requests without query parameters proceed normally to header extraction.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `server/controllers/sessionController.ts` MUST completely eliminate `(req.query.token as string)` from acceptable credential extraction paths.
- **FR-002**: If `req.query.token` is detected on any session endpoint, the controller MUST respond with HTTP 400 Bad Request `{ code: 'DISALLOWED_URL_CREDENTIALS', error: 'Session token không được truyền qua URL query parameter. Vui lòng sử dụng header X-Session-Token.' }`.
- **FR-003**: `GET /api/session-keys/status` MUST extract session token exclusively from `req.headers['x-session-token']` (or `req.body?.sessionToken`).
- **FR-004**: `DELETE /api/session-keys` MUST extract session token exclusively from `req.headers['x-session-token']` (or `req.body?.sessionToken`), returning HTTP 401 if missing.
- **FR-005**: Frontend `src/utils/apiClient.ts` MUST continue using `X-Session-Token` headers for all session communications (0 usage of `?token=`).
- **FR-006**: Server documentation and API contract files MUST explicitly declare `X-Session-Token` as the sole official session authentication mechanism.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0 references to `req.query.token` or `?token=` remain in `server/controllers/` or `server/routes/`.
- **SC-002**: 100% of requests attempting `?token=...` on session endpoints receive HTTP 400 `DISALLOWED_URL_CREDENTIALS`.
- **SC-003**: Full quality verification gates (`npm test`, `npm run lint`, `npm run build`) pass cleanly with 0 errors.
