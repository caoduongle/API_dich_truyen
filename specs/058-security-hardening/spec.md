# Feature Specification: Pre-Deployment Security Hardening for Public Render Hosting

**Feature Directory**: `specs/058-security-hardening`  
**Feature Branch**: `058-security-hardening`  
**Created**: 2026-08-22  
**Status**: DRAFT  

---

## 1. Executive Summary & Problem Description

Before hosting this AI Novel Translation application publicly on Render, the codebase requires targeted verification and defensive security hardening.

### Verified Critical Points:
1. **WebSocket Relay Authentication Bypass (`server/services/websocketRelayService.ts`)**:
   - The `/ws/sync` endpoint previously checked for a Google OAuth token optionally (`if (token) ...`), allowing unauthenticated connections with an empty `userEmail` to proceed.
   - Once connected, anonymous clients joined the room and could broadcast and receive CRDT document updates if they guessed the `projectId` and `chapterId`.
   - **Remediation**: Enforce mandatory Google OAuth token verification during the HTTP upgrade handshake. Reject missing or invalid tokens with `HTTP 401 Unauthorized`.

2. **Public Server Endpoint Exposure Warning (`server/middleware/authMiddleware.ts` & `server.ts`)**:
   - When `ACCESS_PASSWORD` is unset, all `/api/*` endpoints are publicly accessible, including endpoints consuming server-side `GEMINI_API_KEY` quota.
   - While keeping `ACCESS_PASSWORD` optional as an operational choice for single-user local setups, the server must emit a prominent, unmissable security alert box upon startup when running in `NODE_ENV=production` without an `ACCESS_PASSWORD`.

3. **Codebase-wide Security Verification**:
   - **XSS Prevention**: Validate that user-facing text and AI translations rendered dynamically (e.g., `DiffModal.tsx`) are safely escaped before HTML rendering.
   - **Stack Trace & Information Disclosure**: Ensure production API error responses do not leak file system paths or stack traces to clients.
   - **CORS & Same-Origin**: Confirm no overly permissive `cors('*')` headers are exposed.
   - **Redis TLS & Auth**: Confirm `ioredis` connection configuration supports TLS (`rediss://`) and password authentication for cloud Redis instances.
   - **Dependency Vulnerabilities**: Verify `npm audit` reports 0 vulnerabilities.

---

## 2. User Scenarios & Acceptance Criteria

### User Story 1: Enforce Authentication on Real-Time Collaboration Relay (Priority: P1) 🎯 MVP
**As a** translator collaborating on a shared novel project,  
**I want** all connections to the real-time WebSocket relay (`/ws/sync`) to require verified Google OAuth credentials,  
**So that** unauthenticated external parties cannot eavesdrop on or overwrite my translation drafts.

#### Acceptance Scenarios:
1. **Reject Unauthenticated Handshake**: An HTTP upgrade request to `/ws/sync?projectId=X&chapterId=Y` without a `token` query param is immediately rejected with `HTTP 401 Unauthorized` and closed.
2. **Reject Invalid/Expired Token**: An HTTP upgrade request with a malformed or expired `token` fails Google OAuth verification and is rejected with `HTTP 401 Unauthorized`.
3. **Allow Legitimate Collaborator**: An HTTP upgrade request with a valid Google OAuth token succeeds, resolving the user's email and joining the room.

---

### User Story 2: Prominent Production Alert for Unprotected Server Access (Priority: P1)
**As a** system administrator deploying the application on Render in production mode,  
**I want** the server log to display an unmistakable security warning box if `ACCESS_PASSWORD` is empty,  
**So that** I do not accidentally leave public API endpoints and server API key quotas unprotected on the internet.

#### Acceptance Scenarios:
1. **Production Warning**: When `NODE_ENV=production` and `ACCESS_PASSWORD` is unset/empty, server startup logs a prominent multi-line warning banner in stdout.
2. **Quiet on Configured Server**: When `ACCESS_PASSWORD` is set with a valid non-empty string, no warning banner is emitted.
3. **Local Dev Unaffected**: When `NODE_ENV` is not `production`, standard local developer workflow runs seamlessly without clutter.

---

### User Story 3: Comprehensive Security Audit & Quality Verification (Priority: P2)
**As a** project maintainer,  
**I want** automated and manual checks confirming XSS safety, CORS isolation, absence of stack leaks, and zero dependency vulnerabilities,  
**So that** the deployment on Render is robust and secure against common web application vulnerabilities.

#### Acceptance Scenarios:
1. **XSS Safety**: All dynamic HTML rendering (e.g. `DiffModal.tsx`) uses robust HTML entity escaping (`escapeHtml`).
2. **CORS Safety**: Server operates strictly same-origin without wildcards (`Access-Control-Allow-Origin: *`).
3. **Error Leak Prevention**: API error responses return sanitized, user-friendly messages without internal stack traces.
4. **Clean Quality Gates**: `npm audit --audit-level=low` reports 0 vulnerabilities; `npm run lint`, `npm test`, and `npm run build` pass 100%.

---

## 3. Functional Requirements

- **FR-001**: WebSocket handshake at `/ws/sync` MUST reject requests missing a `token` query parameter with `HTTP 401 Unauthorized`.
- **FR-002**: WebSocket handshake at `/ws/sync` MUST verify the provided Google OAuth token via Google UserInfo API / token cache. If verification fails, the connection MUST be rejected with `HTTP 401 Unauthorized`.
- **FR-003**: Server startup in `NODE_ENV=production` MUST log a prominent multi-line security warning box if `ACCESS_PASSWORD` is not configured or empty.
- **FR-004**: Server API routes in `server/routes/api.ts` MUST NOT return stack traces or internal server file paths in production HTTP responses.
- **FR-005**: Dynamic HTML generators in client components MUST apply HTML entity escaping to untrusted input strings before rendering.
- **FR-006**: Existing valid collaborator flows and translation operations MUST remain 100% functional without regressions.

---

## 4. Success Criteria

- **SC-001**: 100% of WebSocket connections to `/ws/sync` without a valid Google OAuth token are rejected before socket upgrade.
- **SC-002**: Server logs an unmissable security warning banner upon startup in `NODE_ENV=production` when `ACCESS_PASSWORD` is not set.
- **SC-003**: `npm audit --audit-level=low` reports 0 known security vulnerabilities.
- **SC-004**: All automated Quality Gates (`npm run lint`, `npm test`, `npm run build`) pass cleanly with 0 errors.

---

## 5. Security Audit Findings Summary

| ID | Severity | File & Location | Description | Status / Recommendation |
|---|---|---|---|---|
| **SEC-01** | **CRITICAL** | `server/services/websocketRelayService.ts:L142-150` | Unauthenticated WebSocket connections allowed on `/ws/sync`, permitting anonymous read/write access to chapter CRDT rooms. | **Fix immediately** (Enforce 401 on missing/invalid token). |
| **SEC-02** | **MEDIUM** | `server/middleware/authMiddleware.ts` & `server.ts:L83` | When `ACCESS_PASSWORD` is empty, `/api/*` endpoints are open to public without a clear startup warning in production. | **Fix immediately** (Add prominent startup warning banner in production). |
| **SEC-03** | **LOW / INFO** | `src/components/auto-translator/DiffModal.tsx:L178` | Use of `dangerouslySetInnerHTML` for dictionary highlighting in diff modal. | **Verified Safe**: Input and replacement terms are escaped via `escapeHtml()` prior to interpolation. |
| **SEC-04** | **INFO** | `server/services/redisService.ts` | Redis connection defaults to URL scheme provided in `REDIS_URL`. | **Recommendation**: For public cloud Redis (Upstash/Render), deployers must use `rediss://` for TLS in transit. |
| **SEC-05** | **INFO** | `server/routes/api.ts` | REST API routes handling session keys and translation processing. | **Verified Safe**: Architecture uses client-side IndexedDB (Zero Server Storage). No database IDOR vulnerabilities exist in REST routes. |
| **SEC-06** | **INFO** | `server.ts:L24-43` | CORS & Content Security Policy. | **Verified Safe**: No `cors('*')` middleware is used; server uses same-origin with Helmet CSP in production. |
| **SEC-07** | **INFO** | `.github/workflows/ci.yml` | CI audit & secret leak detection. | **Verified**: `npm audit --audit-level=high` & secret leak check present. To enforce hard branch protection, enable `build-and-test` as required status check in GitHub repo settings. |

---

## 6. Assumptions & Scope Boundaries

- **Assumptions**:
  - Legitimate clients utilizing real-time collaboration always provide their Google OAuth access token obtained via `googleAuthService` in the WebSocket connection URL.
  - Deployers setting up production hosting on Render will configure environment variables (`ACCESS_PASSWORD`, `GEMINI_API_KEY`, `REDIS_URL`) via the Render Dashboard.
- **Out of Scope**:
  - Modifying Gemini AI translation prompt engineering or models.
  - Changing IndexedDB schema or client data models.
  - Changing user interface design or styling tokens.
  - Hardcoding secrets or passwords into source code.
