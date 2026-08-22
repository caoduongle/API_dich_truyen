# Implementation Plan: Pre-Deployment Security Hardening for Render Hosting

**Branch**: `058-security-hardening` | **Spec**: [`specs/058-security-hardening/spec.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/058-security-hardening/spec.md)

---

## 1. Technical Context & Scope

- **Problem**:
  1. `/ws/sync` in `server/services/websocketRelayService.ts` accepts unauthenticated handshakes, letting anyone join CRDT collaboration rooms.
  2. `server.ts` does not display a prominent warning when running in `NODE_ENV=production` without an `ACCESS_PASSWORD`.
- **Target Changes**:
  - `server/services/websocketRelayService.ts`: Require valid Google OAuth token during WebSocket upgrade; reject missing/invalid tokens with `HTTP 401 Unauthorized`.
  - `server.ts`: Add prominent multi-line boxed security warning banner when `NODE_ENV=production` and `!authStore.isAuthRequired()`.
  - `server/services/__tests__/websocketRelayService.test.ts`: Add test cases for unauthenticated vs authenticated WebSocket upgrade requests.

---

## 2. Constitution Check

| Principle / Rule | Evaluation | Status |
|---|---|---|
| **Quality Gates** | `npm run lint`, `npm test`, `npm run build` must pass cleanly before completion. | ✅ PASS |
| **No New Dependencies** | Zero packages added. | ✅ PASS |
| **Domain Boundaries** | Changes strictly limited to backend security enforcement and startup telemetry. No translation logic or IndexedDB schemas modified. | ✅ PASS |
| **Atomic Scope** | Focused exclusively on the verified security findings prior to Render deployment. | ✅ PASS |

---

## 3. Implementation Plan

### Phase 1: WebSocket Authentication Enforcement (SEC-01)
- Modify `server/services/websocketRelayService.ts` lines 142-150:
  - Check `if (!token) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return; }`
  - Await `verifyGoogleAccessToken(token)`. If null/empty, reject with `HTTP 401 Unauthorized`.
- Update `server/services/__tests__/websocketRelayService.test.ts` to assert 401 response on missing or invalid token.

### Phase 2: Production Server Access Warning (SEC-02)
- Modify `server.ts` lines 84-88:
  - Check `if (process.env.NODE_ENV === 'production' && !authStore.isAuthRequired())`
  - Print prominent multi-line boxed warning in stdout informing the deployer that `/api/*` endpoints and server Gemini quota are public.

### Phase 3: Verification & Quality Gates
- Execute `npm run lint` (`tsc --noEmit`).
- Execute `npm test` (`vitest run`).
- Execute `npm run build` (`vite build && esbuild server.ts`).
- Execute `npm audit --audit-level=low`.
