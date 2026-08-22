# Security Hardening Research & Architectural Decisions

**Feature**: [`specs/058-security-hardening`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/058-security-hardening)  
**Date**: 2026-08-22  

---

## 1. WebSocket Collaboration Authentication (SEC-01)

### Decision
Enforce strict authentication during the HTTP upgrade handshake for `/ws/sync` in `server/services/websocketRelayService.ts`.

### Rationale
- The previous implementation inspected `token` optionally (`if (token) ...`). If the query parameter was omitted or invalid, the upgrade succeeded with `userEmail = ''` and the socket joined the CRDT room (`formatRoomId(projectId, chapterId)`).
- This allowed unauthorized users knowing or guessing `projectId` + `chapterId` to subscribe to and publish binary CRDT updates.
- By verifying the token via Google UserInfo API (`verifyGoogleAccessToken`) during the HTTP upgrade handshake, unauthenticated connections are rejected with `HTTP/1.1 401 Unauthorized` before establishing the WebSocket connection.
- Valid tokens are cached in-memory with a 5-minute TTL (`tokenCache`), ensuring minimal latency and zero rate-limiting from Google's UserInfo endpoint.

### Alternatives Considered
- **Post-handshake message auth**: Allowing the socket to open and waiting for an auth frame. *Rejected*: Increases socket resource consumption, complexity, and window of vulnerability before first message.
- **Client-side secret sharing**: Using a shared room password. *Rejected*: The app already uses Google OAuth 2.0 PKCE with `drive.file` scope and token sharing. Google OAuth token verification is already implemented and directly available in `websocketRelayService.ts`.

---

## 2. Production Server Access Warning (SEC-02)

### Decision
Add a prominent multi-line boxed security warning banner in stdout on server startup when `process.env.NODE_ENV === 'production'` and `!authStore.isAuthRequired()`.

### Rationale
- Setting `ACCESS_PASSWORD` is an operational decision for the administrator deploying the service on Render.
- When `ACCESS_PASSWORD` is absent, all `/api/*` routes are public, allowing anyone who discovers the server URL to invoke translation routes using the server's `GEMINI_API_KEY`.
- A prominent multi-line warning ensures deployers inspecting Render server logs immediately notice the unprotected state.

### Alternatives Considered
- **Hard-failing on startup if ACCESS_PASSWORD is unset in production**: *Rejected*: Violates user specification ("KHÔNG tự ý bắt buộc ACCESS_PASSWORD phải có giá trị, đó là quyết định vận hành của user").
- **Subtle single-line console.warn**: *Rejected*: Easily lost among other startup logs; user requested an unmistakable, prominent alert.

---

## 3. In-Transit Redis Encryption & Same-Origin CORS Policy

### Decision
1. **Redis TLS (In-transit security)**:
   - `ioredis` in `server/services/redisService.ts` natively supports TLS when using the `rediss://` protocol scheme.
   - When deploying to Render connected to managed cloud Redis (e.g. Upstash, Redis Cloud), deployers must supply `rediss://...` as `REDIS_URL`.
2. **CORS & Same-Origin**:
   - The application serves both the static Vite frontend and the Express `/api` backend from the same origin (`'self'`).
   - No `cors()` package or `Access-Control-Allow-Origin: *` is present, maintaining secure same-origin boundary.
