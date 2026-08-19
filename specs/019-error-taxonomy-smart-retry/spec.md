# Feature Specification: Error Taxonomy & Smart Retry Engine

**Feature Branch**: `019-error-taxonomy-smart-retry`

**Created**: 2026-08-20

**Status**: Draft

**Input**: User request: "TASK 06 — ERROR TAXONOMY + SMART RETRY. Mục tiêu: Loại bỏ logic retry phụ thuộc quá nhiều vào string matching. Audit toàn bộ: geminiService.ts, retry helpers, quota service, controllers, error responses. Chuẩn hóa error: RATE_LIMITED, QUOTA_EXCEEDED, AUTH_FAILED, MODEL_NOT_FOUND, MODEL_UNSUPPORTED, INVALID_REQUEST, SAFETY_BLOCKED, OVERLOADED, NETWORK_ERROR, TIMEOUT, SERVER_ERROR, UNKNOWN. Retry rules: NETWORK_ERROR, TIMEOUT, SERVER_ERROR, OVERLOADED, RATE_LIMITED -> retry theo policy; AUTH_FAILED -> rotate/disable key; QUOTA_EXCEEDED -> khác key hoặc wait; MODEL_NOT_FOUND, MODEL_UNSUPPORTED, INVALID_REQUEST -> không retry; SAFETY_BLOCKED -> không blind retry. Final mapping phải dựa trên response thực tế của provider. Requirement: Không để string matching nằm rải rác: if message.includes(...). Tập trung normalize error trước. Tests: Mỗi error category phải có test: classification, retry decision, key rotation decision, final HTTP response."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Structured Error Classification & Smart Retry Policy (Priority: P1) 🎯 MVP

As a translation runtime dispatching requests to Gemini API, I want all raw upstream exceptions (HTTP status, error codes, response JSON, gRPC status, GoogleGenAI errors) to be normalized into a unified `AIErrorCode` taxonomy before any retry decision is made, so that retry, key rotation, and cooldown policies are executed deterministically rather than relying on brittle ad-hoc string matching (`message.includes(...)`).

**Why this priority**: Eliminates flaky retry loops, misclassified errors, and hard-coded substring matching across services and controllers while maximizing translation resilience.

**Independent Test**: Provide mock errors for each of the 12 taxonomy categories (RATE_LIMITED, QUOTA_EXCEEDED, AUTH_FAILED, MODEL_NOT_FOUND, MODEL_UNSUPPORTED, INVALID_REQUEST, SAFETY_BLOCKED, OVERLOADED, NETWORK_ERROR, TIMEOUT, SERVER_ERROR, UNKNOWN), verify each is normalized accurately with the correct `isRetryable`, `recommendedAction`, and `httpStatus`.

**Acceptance Scenarios**:

1. **Given** an upstream 503 response with status "OVERLOADED" or "UNAVAILABLE", **When** normalized, **Then** `code = OVERLOADED`, `isRetryable = true`, `recommendedAction = 'retry'`, `httpStatus = 503`.
2. **Given** an upstream 401/403 response with reason "API_KEY_INVALID" or "PERMISSION_DENIED", **When** normalized, **Then** `code = AUTH_FAILED`, `isRetryable = false`, `recommendedAction = 'disable_key'`, `httpStatus = 401`.
3. **Given** an upstream error with finishReason "SAFETY" or blockReason "SAFETY", **When** normalized, **Then** `code = SAFETY_BLOCKED`, `isRetryable = false`, `recommendedAction = 'fail_immediately'`, `httpStatus = 400`.
4. **Given** a 404 response with model not found, **When** normalized, **Then** `code = MODEL_NOT_FOUND`, `isRetryable = false`, `recommendedAction = 'fail_immediately'`, `httpStatus = 404`.
5. **Given** a daily quota exhaustion (RPD), **When** normalized, **Then** `code = QUOTA_EXCEEDED`, `isRetryable = false` for that key, `recommendedAction = 'rotate_key'`, `httpStatus = 429`.

---

### User Story 2 - Normalize-First Centralized Pipeline (Priority: P2)

As a controller or background service handling translation jobs, I want to invoke centralized error helpers (`normalizeUpstreamError`, `isRetryableError`, `shouldRotateKey`) instead of performing custom substring inspections, ensuring uniform error handling and sanitized logging across the entire codebase.

**Why this priority**: Enforces DRY architecture and guarantees that sensitive API keys are consistently redacted across all error outputs.

**Independent Test**: Audit `geminiService.ts`, `translateController.ts`, `polishController.ts`, `rawController.ts`, and `glossaryController.ts`, ensuring all error branches consume `normalizeUpstreamError`.

**Acceptance Scenarios**:

1. **Given** any caught upstream error in `geminiService` or controllers, **When** handled, **Then** the error is first converted via `normalizeUpstreamError` before logging or branching.
2. **Given** an error containing raw API keys, **When** normalized, **Then** all API keys are redacted before producing user-facing messages or server log entries.

---

### User Story 3 - Predictable HTTP Error Responses (Priority: P3)

As a client consuming translation endpoints, I want server errors to return consistent JSON structures (`{ error: string, code: AIErrorCode, isRetryable: boolean, retryAfterSec?: number }`) and appropriate HTTP status codes (400, 401, 404, 429, 502, 503, 504, 500), so that the UI can render targeted recovery guidance.

**Why this priority**: Improves user experience and allows the frontend to show distinct messages for quota exhaustion vs. auth errors vs. safety blocks.

**Independent Test**: Send requests triggering various failure modes and verify that the resulting HTTP responses match the standardized error contract.

**Acceptance Scenarios**:

1. **Given** an auth failure, **When** returned to client, **Then** HTTP response is 401 with `code: 'AUTH_FAILED'`.
2. **Given** all keys rate-limited, **When** returned to client, **Then** HTTP response is 429 with `code: 'RATE_LIMITED'` and `retryAfterSec`.

---

### Edge Cases

- **Custom / Fine-Tuned Model Incompatibility**: If a model does not support `generateContent` methods, normalized as `MODEL_UNSUPPORTED` with `fail_immediately`.
- **Transient Network Glitch vs Permanent DNS Failure**: Both classified as `NETWORK_ERROR` with `retry` action, allowing fallback rotation.
- **Overload Exponential Backoff Limit**: If overload retries exceed `MAX_OVERLOAD_RETRIES`, the key is placed in transient cooldown and rotation continues to the next candidate key.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST define an exhaustive `AIErrorCode` enum containing:
  - `RATE_LIMITED`
  - `QUOTA_EXCEEDED`
  - `AUTH_FAILED`
  - `MODEL_NOT_FOUND`
  - `MODEL_UNSUPPORTED`
  - `INVALID_REQUEST`
  - `SAFETY_BLOCKED`
  - `OVERLOADED`
  - `NETWORK_ERROR`
  - `TIMEOUT`
  - `SERVER_ERROR`
  - `UNKNOWN`
- **FR-002**: The system MUST define `AIRecommendedAction` enum containing:
  - `'retry'`: Retry on current key after delay (for transient network/server errors).
  - `'rotate_key'`: Skip current key and try next candidate key (for quota exhaustion).
  - `'cooldown_key'`: Place key in cooldown and try next candidate key (for rate limits).
  - `'disable_key'`: Mark key as invalid and exclude from future requests (for auth failures).
  - `'fail_immediately'`: Abort translation request immediately without retrying (for safety blocks, invalid arguments, unsupported models).
- **FR-003**: `normalizeUpstreamError` MUST prioritize structural inspection (HTTP status, error object properties, error details, finishReason) before fallback pattern matching.
- **FR-004**: All string matching patterns MUST be centralized inside `server/utils/errorClassifier.ts`. `geminiService.ts` and controllers MUST NOT contain ad-hoc `message.includes(...)` error checks.
- **FR-005**: `isOverloadError(err)` and `isSafetyOrEmptyError(err)` in `geminiService.ts` MUST delegate directly to `normalizeUpstreamError(err)`.
- **FR-006**: In `geminiService.generateWithRotation`, error handling MUST execute the smart retry decision dictated by `normalized.recommendedAction`.
- **FR-007**: API controllers MUST serialize normalized errors into a standardized JSON response format:
  ```json
  {
    "error": "Mô tả lỗi thân thiện",
    "code": "RATE_LIMITED",
    "isRetryable": true,
    "retryAfterSec": 5
  }
  ```
- **FR-008**: 100% of sensitive API keys in error messages and error details MUST be sanitized via `redactApiKey`.

### Key Entities *(include if feature involves data)*

- **AIErrorNormalized**:
  ```typescript
  export interface AIErrorNormalized {
    code: AIErrorCode;
    message: string;
    isRetryable: boolean;
    recommendedAction: AIRecommendedAction;
    httpStatus: number;
    retryAfterSec?: number;
    details?: Record<string, unknown>;
  }
  ```

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of upstream errors encountered in `geminiService.ts` and controllers pass through `normalizeUpstreamError` before retry/cooldown decisions.
- **SC-002**: Zero scattered ad-hoc `message.includes(...)` error checks remain in `server/services/geminiService.ts` or controllers.
- **SC-003**: 100% of unit tests covering all 12 error taxonomy categories, retry actions, and key rotation decisions pass cleanly.
- **SC-004**: Full test suite (`npm test`), lint (`npm run lint`), and build (`npm run build`) pass with 0 errors.
