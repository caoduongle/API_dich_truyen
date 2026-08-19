# Contract: Security Logging, Auth Rate Limiting & Session Observability

**Feature**: `003-security-hardening-pass`
**Date**: 2026-08-19

## 1. Logger API & String Redaction Contract

### Function: `sanitizeSecretString(str: string): string`
- **Location**: `server/utils/logger.ts`
- **Behavior**: Scans any input string and redacts all key-value secrets, Google API keys, Bearer tokens, and password query parameters.
- **Contract Tests**:
  - `sanitizeSecretString('/api/session-keys/status?token=secret123&other=val')` -> `'/api/session-keys/status?token=[REDACTED]&other=val'`
  - `sanitizeSecretString('Error with key AIzaSyD12345678901234567890123456789012')` -> `'Error with key AIza***[REDACTED]'`
  - `sanitizeSecretString('Authorization: Bearer mySecretToken123')` -> `'Authorization: Bearer [REDACTED]'`

### Class: `Logger`
- **Log Methods**: `debug(message: string, meta?: any)`, `info(...)`, `warn(...)`, `error(...)`
- **Invariant**: No call to `logger.*` shall ever emit unredacted secret values in `message`, `meta`, or serialized JSON output.

---

## 2. Dedicated Auth Rate Limiter Contract

### Middleware: `createRateLimiter(options?: RateLimiterOptions)`
- **Location**: `server/middleware/rateLimiter.ts`
- **Interface**:
  ```typescript
  export interface RateLimiterOptions {
    windowMs?: number;
    maxRequests?: number;
    keyPrefix?: string;
    message?: string;
  }
  ```
- **Login Rate Limit Specification**:
  - `windowMs`: `15 * 60 * 1000` (15 minutes)
  - `maxRequests`: `10`
  - `keyPrefix`: `'ratelimit:login:'`
  - Response on rejection: HTTP `429 Too Many Requests` with JSON `{ error: string }`.

---

## 3. Session Store Active Count Contract

### Method: `sessionStore.getActiveSessionCount(): Promise<number>`
- **Location**: `server/services/sessionStore.ts`
- **Behavior**:
  - If Redis is active: Executes non-blocking scan matching `session_keys:*` (matching `SESSION_PREFIX`), returns accurate key count.
  - If Redis is inactive (in-memory mode): Counts unexpired sessions in `memorySessions` map.
  - On Redis error: Logs warning and safely returns `0` without throwing or blocking.
- **Endpoint**: `GET /api/health`
  - Response property `sessions.activeCount` matches active session count.
