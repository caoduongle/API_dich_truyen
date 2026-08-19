# Contract: Security Redaction, Sanitization & Logging Guarantees

## 1. Zero Key Leakage Guarantees

### 1.1 Server Structured Logs
All logging outputs from `server/utils/logger.ts` MUST apply sanitization to:
1. Google API keys matching regular expression: `/AIza[0-9A-Za-z-_]{35}/g` -> `AIza***[REDACTED]`.
2. Query/Parameter assignments: `/((?:[?&]|\b)(?:token|apikey|api_key|password|secret|key|access_token)=)([^&\s"'`]+)/gi` -> `$1[REDACTED]`.
3. Authorization headers: `Bearer <token>` -> `Bearer [REDACTED]`.
4. Objects with keys matching `password`, `secret`, `apikey`, `api_key`, `token`, `authorization`, `key` -> Value masked.

### 1.2 Upstream Google Error Redaction
Whenever upstream Gemini APIs or Google endpoints return an error message containing raw keys, `redactApiKey(errorMessage, keys)` MUST replace occurrences with `***REDACTED***` before propagating to controllers or logs.

### 1.3 URL Query Parameters
No endpoint in `server/routes/api.ts` may accept or require API keys in URL query strings (e.g. `?apiKey=...` or `?key=...`). All credential references must pass via HTTP headers (`X-Session-Token`, `X-Auth-Token`) or POST bodies during initial session creation.

### 1.4 Response Payload Masking
All endpoints returning key status (`/api/quota-status`, `/api/models-for-key`, `/api/session-keys/status`) MUST ONLY return:
- `maskedKey`: e.g. `AIzaSy...4xAb`
- `keyHash`: SHA-256 hex string
- Never full plaintext key strings.
