# Feature Specification: Runtime Hardening Completion & Architecture Polish

**Feature Branch**: `161-runtime-hardening-completion`

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "Khắc phục 5 điểm còn lại từ review runtime architecture: localQuotaTracker load cap 100 với sanitize helper, bỏ flushToStorage khỏi failure hot path (debounce recordFailure), hoàn thiện GeminiRequestError taxonomy thay cho Error + dynamic properties, loại bỏ any trong directGlossaryEngine và error handlers, nâng cấp môi trường build/CI lên Node 24 LTS."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bounded and Memory-Safe Quota Storage Ingestion (Priority: P1)

As a translator reloading or opening multiple tabs with long-running sessions, I want the quota tracker to strictly sanitize and cap sliding-window entries to at most 100 records per key and model during storage deserialization, so that corrupt, bloated, or excessively large stored histories never cause memory exhaustion or slow down application startup.

**Why this priority**: Preventing unbounded memory ingestion at hydration time enforces the data contract symmetrically with serialization, protecting the client runtime against memory leaks or poisoned storage states.

**Independent Test**: Can be verified by loading a simulated session storage payload containing 1,000 recent timestamp entries and confirming that exactly the 100 most recent valid entries within the 60-second window are loaded into memory, while malformed entries are cleanly pruned.

**Acceptance Scenarios**:

1. **Given** a stored session state containing 500 valid attempt timestamps within the active 60-second window, **When** the application hydrates quota state on startup or tab reload, **Then** at most the 100 most recent valid timestamps are retained in memory per key and model.
2. **Given** stored sliding-window token records containing a mixture of valid, expired, and non-numeric entries, **When** state is deserialized, **Then** a unified sanitization routine filters out expired or invalid records and caps the final array to the 100 most recent valid records.

---

### User Story 2 - True Asynchronous Quota Storage on Error Hot Path (Priority: P1)

As an active novel translator encountering transient rate limits (429) or temporary server overloads (503), I want failure metrics to be recorded using debounced asynchronous persistence rather than blocking synchronous storage writes, so that rapid error cascades do not trigger synchronous serialization pauses on the UI thread while still guaranteeing durability before tab closure.

**Why this priority**: Synchronous `sessionStorage.setItem` and `JSON.stringify` on the error hot path reintroduces UI thread micro-stutters during transient failure bursts, contradicting the core debounce architecture established for success metrics.

**Independent Test**: Can be verified by simulating rapid consecutive request failures and verifying that in-memory metrics update immediately while storage writes are debounced within the 300ms window, with an automatic synchronous flush triggered on page lifecycle events (`pagehide`, `visibilitychange` to hidden).

**Acceptance Scenarios**:

1. **Given** rapid consecutive translation failures occurring within tens of milliseconds, **When** `recordFailure()` is executed, **Then** failure counters update in memory immediately and storage persistence is scheduled via a 300ms debounce timer without executing synchronous `sessionStorage.setItem`.
2. **Given** pending in-memory failure metrics in the debounce queue, **When** the user closes the tab or switches apps causing the document visibility to transition to hidden, **Then** all pending failure metrics are flushed synchronously to storage immediately.

---

### User Story 3 - Comprehensive Structured Gemini Error Hierarchy (Priority: P2)

As a developer maintaining the translation pipeline or an end-user receiving error notifications, I want all Gemini API error scenarios (including resource not found, bad request, quota exhaustion, timeouts, and authentication failures) to produce structured, typed error instances rather than generic errors with monkey-patched dynamic properties, so that downstream error handlers can safely and accurately inspect failure causes without fragile type casts.

**Why this priority**: Completing the error taxonomy eliminates informal property mutations (`(err as any).code = ...`) and provides type-safe, reliable classification across the entire client SDK integration layer.

**Independent Test**: Can be verified by triggering various API error states (404 model not found, 400 bad request, 429 quota exhaustion across all keys, timeout expiration) and asserting that each thrown error is an instance of `GeminiRequestError` with accurate `code`, `category`, and `isRetryable` properties.

**Acceptance Scenarios**:

1. **Given** an API response with HTTP 404 (Resource Not Found), **When** the error is processed by the Gemini client, **Then** it throws a `GeminiRequestError` with `code: 'RESOURCE_NOT_FOUND'`, `category: 'RESOURCE_NOT_FOUND'`, `status: 404`, and `isRetryable: false`.
2. **Given** all configured API keys have exceeded their quota under HTTP 429, **When** the request loop terminates, **Then** it throws a `GeminiRequestError` with `code: 'ALL_KEYS_EXHAUSTED'`, `category: 'QUOTA_EXHAUSTED_RPD'`, and `isRetryable: false`.
3. **Given** a cumulative request timeout exceeds the deadline, **When** the failure is caught, **Then** it throws a `GeminiRequestError` with `code: 'ETIMEDOUT'`, `category: 'NETWORK_FAILURE'`, and `isRetryable: true`.

---

### User Story 4 - Strict Unknown Error Handling in Direct Glossary Extraction (Priority: P2)

As a developer running static code analysis or maintaining terminology analysis routines, I want error inspection in the direct glossary engine to handle errors as `unknown` rather than `any`, utilizing safe message extraction helpers, so that unexpected non-Error throws do not cause runtime crashes or bypass compiler type checks.

**Why this priority**: Eliminating `any` in error handlers enforces strict type hygiene across service modules, preventing unhandled edge cases where thrown values are not standard Error instances.

**Independent Test**: Can be verified by passing non-standard error objects (plain objects, strings, custom errors) to glossary fallback routines and ensuring error messages are safely extracted and classified without runtime errors or `any` assertions.

**Acceptance Scenarios**:

1. **Given** an error thrown in glossary analysis routines, **When** evaluated by safety and empty response guards, **Then** the error is handled as `unknown` and its message is extracted via a type-safe helper.
2. **Given** a `GeminiRequestError` with `code: 'CONTENT_BLOCKED'` thrown during glossary extraction, **When** evaluated by direct glossary fallback logic, **Then** it is recognized as a content block and triggers fallback without type-casting to `any`.

---

### User Story 5 - Modernization of Build and CI Runtime to Node.js 24 LTS (Priority: P3)

As a continuous integration maintainer or contributor building the application via Docker, I want the project's CI workflows, Docker container definitions, and setup documentation to target Node.js 24 LTS, so that the project remains free from upstream runtime deprecation warnings and benefits from the latest LTS stability and performance improvements.

**Why this priority**: Node.js 20 is reaching deprecation on CI environments. Migrating to Node.js 24 LTS ensures long-term build stability, container parity, and zero deprecation noise in GitHub Actions logs.

**Independent Test**: Can be verified by running the CI workflow and verifying that GitHub Actions installs Node.js 24 without deprecation warnings, and verifying that the Docker builder image uses `node:24-alpine`.

**Acceptance Scenarios**:

1. **Given** the CI pipeline configuration in `.github/workflows/ci.yml`, **When** the build and test job runs, **Then** Node.js version 24 is installed and used for all verification steps.
2. **Given** the production multi-stage `Dockerfile`, **When** building the client-side SPA static bundle, **Then** the builder stage runs on `node:24-alpine`.
3. **Given** the project setup documentation in `README.md`, **When** developers consult prerequisite specifications, **Then** Node.js 24 LTS is specified as the supported runtime.

---

### Edge Cases

- **Massive Corrupted Storage Payloads**: If session storage contains a corrupted array with tens of thousands of items, `sanitizeRecentWindow` must limit memory intake to 100 entries via `.slice(-100)` immediately after filtering, preventing memory spikes.
- **Consecutive Failures Immediately Preceding Tab Unload**: If multiple 429/503 errors occur in rapid succession and the user immediately closes the browser tab before the 300ms debounce timer fires, the `pagehide` / `visibilitychange` lifecycle listener must synchronously flush pending failure state to storage so that cooldown and circuit breaker flags are preserved.
- **Non-Error Throws in Async Functions**: If a third-party library or network fetch throws a string or raw object instead of a JavaScript `Error`, `getErrorMessage(error: unknown)` must safely return a readable string without throwing a `TypeError`.
- **Node.js 24 Compatibility**: Dependencies and build scripts must execute without deprecation warnings or breaking behavior on Node.js 24 LTS.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The quota tracker's storage loader MUST cap sliding-window entries (`recentAttempts` and `recentTokens`) for both keys and models at a maximum of 100 entries per collection upon deserialization.
- **FR-002**: A shared sanitization helper function MUST be utilized for both serialization and deserialization of sliding-window arrays, ensuring identical filtering criteria (valid numeric timestamps, within 60-second window, no future clock skew > 5s, capped at 100 records).
- **FR-003**: The `recordFailure()` method in the local quota tracker MUST schedule persistence via the 300ms debounce mechanism (`scheduleSave`) instead of executing synchronous storage flush operations during failure handling.
- **FR-004**: Synchronous storage flush (`flushToStorage`) MUST strictly be reserved for document lifecycle events (`pagehide`, `visibilitychange` transitioning to hidden) and explicit manual flush invocations.
- **FR-005**: All error scenarios within the Gemini client (`RESOURCE_NOT_FOUND`, `BAD_REQUEST`, `ALL_KEYS_EXHAUSTED`, `ETIMEDOUT`, `AUTH_FAILURE`, `CONTENT_BLOCKED`, `UNRECOGNIZED`) MUST throw structured `GeminiRequestError` instances with strongly-typed `GeminiErrorCode` identifiers.
- **FR-006**: The Gemini client request loop MUST eliminate all dynamic monkey-patching on error instances (such as `(err as any).code = ...` or `(err as any).status = ...`) and replace `catch (err: any)` with `catch (err: unknown)`.
- **FR-007**: The direct glossary extraction engine MUST eliminate all usages of `any` in error catching and error checking, utilizing safe error message extraction (`getErrorMessage(error: unknown)`).
- **FR-008**: The GitHub Actions CI configuration (`.github/workflows/ci.yml`) MUST specify Node.js version 24 (`node-version: '24'`).
- **FR-009**: The Docker container configuration (`Dockerfile`) MUST use `node:24-alpine` as the base image for the builder stage.
- **FR-010**: Developer documentation in `README.md` MUST specify Node.js 24 LTS as the required runtime environment.

### Key Entities

- **Sanitized Sliding Window**: A bounded array containing at most 100 call attempt or token volume records, constrained strictly to timestamps within `[now - 60_000, now + 5_000]`.
- **Structured Gemini Request Error**: A strongly-typed `Error` subclass (`GeminiRequestError`) encapsulating a standardized `GeminiErrorCode`, classified category, optional HTTP status, and retryability boolean.
- **Debounced Persistence Buffer**: In-memory quota state accumulated during translation operations and flushed periodically (300ms) or synchronously upon page navigation/backgrounding.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of deserialized sliding window arrays in quota storage are capped at 100 records or fewer, regardless of how many entries exist in the underlying storage payload.
- **SC-002**: 0 synchronous storage writes executed during consecutive failure events in the translation hot path, reducing synchronous I/O blocking to zero during rate limit or overload events.
- **SC-003**: 100% of structured error codes across Gemini API interactions are represented by typed `GeminiRequestError` instances with zero reliance on dynamic `(err as any)` mutations.
- **SC-004**: 0 occurrences of `any` in error catching or error checking across `directGlossaryEngine.ts` and `geminiClient.ts`.
- **SC-005**: CI pipeline executes and passes cleanly on Node.js 24 LTS with zero deprecation warnings related to Node 20.
- **SC-006**: 100% pass rate across the full test suite (98+ test files, 946+ tests) and production build without any type errors or regressions.

## Assumptions

- **Node 24 Compatibility**: All existing dependencies (Vite 6, React 19, TypeScript 5.8, Tailwind v4, Vitest) are fully compatible with Node.js 24 LTS.
- **Session Durability on Background**: Browsers supporting modern Page Lifecycle APIs reliably emit either `visibilitychange` (state = 'hidden') or `pagehide` before discarding tabs, guaranteeing debounced data flush.
- **Client-Side Scope**: Changes are strictly confined to client-side services, error classifications, deployment scripts, and workflow files, without altering core IndexedDB schemas or user-facing Vietnamese UI text.
