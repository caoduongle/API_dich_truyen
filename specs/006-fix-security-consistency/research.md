# Research: Fix Security Consistency (Redaction & Exact Path Auth)

**Feature**: `006-fix-security-consistency`  
**Date**: 2026-08-19  
**Status**: Completed

## 1. Issue A1: Redaction of API Keys in Aggregated Exception (`ALL_KEYS_EXHAUSTED`)

### Context
In `server/services/geminiService.ts` line 455, when all rotation keys fail or are exhausted, the server throws:
```typescript
throw new Error(`ALL_KEYS_EXHAUSTED: Đã thử toàn bộ ${keysToTry.length} khóa API đều thất bại. Lỗi cuối: ${lastError?.message || lastError || "Không xác định"}`);
```
If `lastError.message` originated from network errors containing query strings (e.g., `https://generativelanguage.googleapis.com/...&key=AIza...`), the raw key string is embedded into the exception message.

### Findings & Decision
- **Utility Available**: `redactApiKey(message: string, keys: string[]): string` already exists in `server/utils/text.ts`. It takes a message string and an array of keys and replaces all instances with `***REDACTED***`.
- **Decision**: 
  1. Extract `lastError?.message || String(lastError) || "Không xác định"`.
  2. Call `redactApiKey(lastMsg, keysToTry)`.
  3. Include the redacted error string in the final `ALL_KEYS_EXHAUSTED` exception.
- **Alternatives Considered**: 
  - Using `sanitizeSecretString` directly: `redactApiKey` specifically targets the active rotation key array `keysToTry` which may include user session keys that do not strictly match the `AIzaSy...` regex pattern, so applying `redactApiKey` ensures all keys in `keysToTry` are wiped out.

---

## 2. Issue A2: Controller Direct `console.*` to `Logger` Migration

### Context
In `server/controllers/**`, around 30 calls to `console.log`, `console.warn`, and `console.error` are made directly. These bypass the structured `Logger` class in `server/utils/logger.ts`.

### Findings & Decision
- **Logger API**: `Logger` in `server/utils/logger.ts` supports:
  - `logger.info(message, meta?)`
  - `logger.warn(message, meta?)`
  - `logger.error(message, meta?)`
  - `logger.debug(message, meta?)`
  Inside `formatMessage`, both `message` and `meta` are sanitized via `sanitizeSecretString` and `sanitizeValue`.
- **Context Names Mapping**:
  - `server/controllers/translation/rawController.ts` → `const logger = new Logger('RawTranslation');`
  - `server/controllers/translation/polishController.ts` → `const logger = new Logger('PolishTranslation');`
  - `server/controllers/translation/qaController.ts` → `const logger = new Logger('QACritique');`
  - `server/controllers/glossaryController.ts` → `const logger = new Logger('Glossary');`
  - `server/controllers/alignmentController.ts` → `const logger = new Logger('Alignment');`
  - `server/controllers/authController.ts` → `const logger = new Logger('AuthController');`
  - `server/controllers/quotaController.ts` → `const logger = new Logger('QuotaController');`
  - `server/controllers/sessionController.ts` → `const logger = new Logger('SessionController');`
- **Preservation of Vietnamese Messages**:
  All existing Vietnamese log strings, punctuation, and template literals will be preserved word-for-word.
  Example:
  - `console.error("[Align Chapter Error] Thất bại gióng hàng:", error);` → `logger.error("[Align Chapter Error] Thất bại gióng hàng:", error);`
  - `console.log("[Cache Hit - Phase 1] Tận dụng bản dịch lưu đệm...");` → `logger.info("[Cache Hit - Phase 1] Tận dụng bản dịch lưu đệm...");`
  - `console.warn("[Divide & Conquer Fallback]...");` → `logger.warn("[Divide & Conquer Fallback]...");`

---

## 3. Issue B1 & B2: Exact Match in `authMiddleware` and Purpose-Driven Testing

### Context
`server/middleware/authMiddleware.ts` line 27:
```typescript
const requestPath = req.path || req.originalUrl || "";
if (PUBLIC_API_PATHS.has(requestPath) || requestPath.endsWith("/auth/login") || requestPath.endsWith("/auth/status") || requestPath.endsWith("/health")) {
  next();
  return;
}
```
Using `endsWith(...)` allows any route ending with `/auth/login`, `/auth/status`, or `/health` (e.g. `/api/fake/health`, `/x/auth/login`, `/custom/something/auth/status`) to bypass authentication when `ACCESS_PASSWORD` is enabled.

### Findings & Decision
- **Set Content**: `PUBLIC_API_PATHS` is defined as:
  ```typescript
  const PUBLIC_API_PATHS = new Set([
    "/auth/login",
    "/auth/status",
    "/health",
    "/api/auth/login",
    "/api/auth/status",
    "/api/health",
  ]);
  ```
  This Set already explicitly contains both top-level and `/api/` prefixed versions of all legitimate public routes.
- **Decision**: Remove all `endsWith(...)` conditions. Keep only `PUBLIC_API_PATHS.has(requestPath)`.
- **Testing Requirements**:
  - In `server/controllers/__tests__/authController.test.ts`, add test cases for pseudo-public routes (`/api/fake/health`, `/x/auth/login`, `/admin/sub/health`, etc.).
  - Follow Principle #9 in `.agents/rules/context-engineering.md`: Document in test descriptions WHY exact match is critical (preventing path confusion attacks, unintentional authentication bypass, and security posture regression).
