# Phase 1 Data Model: Security Hardening Pass

**Feature**: `003-security-hardening-pass`
**Date**: 2026-08-19

## 1. Rate Limit Configuration Model

### RateLimiterOptions
Defines the parameters for creating an isolated rate limiter instance:

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `windowMs` | `number` | No | `60_000` (1 min) | Time window in milliseconds |
| `maxRequests` | `number` | No | `60` | Max permitted requests within `windowMs` |
| `keyPrefix` | `string` | No | `'ratelimit:'` | Prefix for rate limit keys in Redis / in-memory map |
| `message` | `string` | No | Vietnamese error message with retry countdown | Custom rate limit rejection message |

### Constants Extension (`SERVER_CONFIG`)
```typescript
export const SERVER_CONFIG = {
  BODY_SIZE_LIMIT: '15mb',
  DEFAULT_PORT: 3000,
  RATE_LIMIT_WINDOW_MS: 60 * 1000,
  RATE_LIMIT_MAX_REQUESTS: 60,
  // Dedicated Auth Rate Limiting
  AUTH_RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 phút
  AUTH_RATE_LIMIT_MAX_REQUESTS: 10,           // 10 lần thử / 15 phút / IP
} as const;
```

---

## 2. Structured Log & Redaction Model

### LogRecord
Represents a structured log entry emitted to standard output / log aggregators:

```typescript
export interface LogRecord {
  timestamp: string;      // ISO 8601 string, e.g. "2026-08-19T08:55:00.000Z"
  level: 'debug' | 'info' | 'warn' | 'error';
  context: string;        // E.g., 'Server', 'HTTP', 'GeminiService', 'SessionStore'
  message: string;        // Sanitized human-readable message
  meta?: Record<string, any>; // Sanitized key-value metadata
}
```

### Redaction Rules
1. **Query String / URL Secrets**: Any substring matching `(?:token|apikey|api_key|password|secret|key|access_token)=([^&\s"'`]+)` replaced with `[KEY]=[REDACTED]`.
2. **Google API Key Format**: Any substring matching `AIza[0-9A-Za-z-_]{35}` replaced with `AIza***[REDACTED]`.
3. **Bearer Tokens**: Any substring matching `Bearer\s+([A-Za-z0-9\-._~+/]+=*)` replaced with `Bearer [REDACTED]`.
4. **Metadata Object Properties**: Any object key matching `/password|secret|apikey|api_key|key|token|authorization/i` sanitized to `'***[REDACTED]'` or sliced string.

---

## 3. Sanitized Prompt Payload Model

### TextSanitizationResult
Represents the outcome of cleaning untrusted user input before injecting into AI prompts:

```typescript
export interface TextSanitizationResult {
  cleanedText: string;     // Input text stripped of invisible zero-width chars and unicode tag blocks
  removedZeroWidthCount: number;
  removedTagsCount: number;
}
```

### Prompt Defense Layers
1. **Sanitization Layer**: Strips `\u200B-\u200D`, `\uFEFF`, `\u200E\u200F`, `\u202A-\u202E`, `\u2060-\u2064\u206A-\u206F`, and `\u{E0000}-\u{E007F}`.
2. **System Framing Layer**: `ANTI_INJECTION_DEFENSE_DIRECTIVE` integrated with `LITERARY_TRANSLATION_FRAMING`.
3. **Model Specific Delimitation Layer**: For Gemma, separation between system instructions and untrusted content blocks.

---

## 4. Request Validation Schemas

### Standard Validation Result
```typescript
export interface ValidationResult {
  valid: boolean;
  error?: string;
  field?: string;
}
```

### Endpoint Body Constraints
| Endpoint | Expected Fields | Constraints |
|---|---|---|
| `POST /api/auth/login` | `password: string` | 1 <= length <= 256 chars, no unexpected keys |
| `POST /api/auth/logout` | `authToken?: string` | string if present, max 512 chars |
| `POST /api/session-keys` | `apiKeys: string[]` | Array of strings, 1 <= length <= 50, each key 10 <= length <= 256 chars |
| `POST /api/translate-raw` | `text: string`, `genre?: string`, `tone?: string`, `glossary?: Array`, `model?: string` | `text` required (1 <= length <= 500,000 chars), `glossary` is array if provided |
| `POST /api/polish-translation` | `rawTranslation: string`, `originalText?: string`, `genre?: string`, ... | `rawTranslation` required (> 0 chars) |
| `POST /api/qa-critique` | `rawTranslation: string`, `polishedTranslation: string`, ... | Both translation strings required (> 0 chars) |
| `POST /api/analyze-glossary` | `text: string`, `context?: string`, ... | `text` required (1 <= length <= 50,000 chars) |
| `POST /api/analyze-guidelines` | `content: string`, ... | `content` required (1 <= length <= 50,000 chars) |
| `POST /api/align-chapter` | `originalText: string`, `translatedText: string`, ... | Both texts required (> 0 chars) |
