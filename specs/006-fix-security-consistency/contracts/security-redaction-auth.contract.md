# Contract: Security Redaction & Exact Public Path Matching

**Feature**: `006-fix-security-consistency`  
**Date**: 2026-08-19  

## 1. Gemini Service Aggregated Error Contract

### Function: `generateWithRotation(...)`
- **Location**: `server/services/geminiService.ts`
- **Invariant**: When all candidate keys in `keysToTry` fail, the thrown `Error` must have its message sanitized with `redactApiKey(lastErrorMsg, keysToTry)`.
- **Contract Test Case**:
  - **Given**: `keysToTry = ["AIzaSyKeyABC1234567890123456789012345"]`
  - **And**: `lastError = new Error("Network timeout contacting https://generativelanguage.googleapis.com/...&key=AIzaSyKeyABC1234567890123456789012345")`
  - **Expected Thrown Message**: Contains `Lỗi cuối: Network timeout contacting https://generativelanguage.googleapis.com/...&key=***REDACTED***` and does NOT contain `AIzaSyKeyABC1234567890123456789012345`.

---

## 2. Controller Logging Invariant Contract

### Module Scope: `server/controllers/**`
- **Invariant 1**: No controller source file shall invoke `console.log`, `console.warn`, or `console.error` directly.
- **Invariant 2**: All controller logging must be performed via `Logger` instances imported from `server/utils/logger.ts`.
- **Invariant 3**: Message strings in Vietnamese must maintain exact equivalence with legacy logs.

---

## 3. Auth Middleware Route Protection Contract

### Function: `authMiddleware(req: Request, res: Response, next: NextFunction)`
- **Location**: `server/middleware/authMiddleware.ts`
- **Whitelist Table**:

| Request Path | Auth Enabled (`ACCESS_PASSWORD` set) | Token Provided | Expected Status |
|:---|:---|:---|:---|
| `/api/auth/login` | Yes | None | Allowed (`next()`) |
| `/api/auth/status` | Yes | None | Allowed (`next()`) |
| `/api/health` | Yes | None | Allowed (`next()`) |
| `/auth/login` | Yes | None | Allowed (`next()`) |
| `/auth/status` | Yes | None | Allowed (`next()`) |
| `/health` | Yes | None | Allowed (`next()`) |
| `/api/fake/health` | Yes | None | **401 Unauthorized** |
| `/x/auth/login` | Yes | None | **401 Unauthorized** |
| `/admin/auth/status` | Yes | None | **401 Unauthorized** |
| `/api/translate-raw` | Yes | None | **401 Unauthorized** |
| `/api/translate-raw` | Yes | Valid Bearer | Allowed (`next()`) |
| `/api/fake/health` | No | None | Allowed (`next()`) |
