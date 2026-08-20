# Feature Specification: Observability and Explainable Telemetry for Gemini Scheduler

**Feature Branch**: `025-scheduler-observability`

**Created**: 2026-08-20

**Status**: Draft

**Input**: User request: "TASK 12 — OBSERVABILITY CHO GEMINI SCHEDULER. Mục tiêu: Mở rộng metrics hiện tại để giải thích được: Tại sao request này chậm? Tại sao key này không được chọn? Tại sao retry? Tại sao model fail? Metrics tối thiểu: logicalRequests, providerAttempts, retries, successes, failures; perModel: requests, errors, latency; perKey: attempts, errors, quota events, cooldown events; scheduler: queueWait, selection count, rejected. Logging: Mỗi request có: requestId, modelId, key identifier/index, attempt, errorCode, latency. Không log: API key, session token, full sensitive prompt. Tests: Đảm bảo requestId tồn tại và được giữ qua retry."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Request Tracing and Retries Explainability (Priority: P1) 🎯 MVP

As an administrator or developer debugging translation performance, I want every logical translation request and all its rotation attempts to share a consistent `requestId` and record attempt-level telemetry (attempt number, model ID, masked key identifier, latency, error code), so that when a translation request is slow or requires retries, I can trace exactly why it retried and which attempt succeeded or failed without exposing secrets.

**Why this priority**: Core observability foundation that links end-to-end user transactions with individual API provider attempts, providing immediate insight into slow or failing requests.

**Independent Test**: Execute a translation request that fails on Key 1 (e.g. rate limit error) and succeeds on Key 2. Assert that:
1. Both attempts share the identical `requestId`.
2. Telemetry logs record attempt 1 with `attempt = 1`, `errorCode = RATE_LIMITED`, and its individual latency.
3. Telemetry logs record attempt 2 with `attempt = 2`, `errorCode = null`, and its individual latency.
4. Total logical metrics reflect `logicalRequests = 1`, `retries = 1`, `successes = 1`.

**Acceptance Scenarios**:

1. **Given** an incoming request with an `x-request-id` header (or auto-generated), **When** a translation is executed across multiple provider attempts, **Then** all attempt logs and metrics retain the exact same `requestId`.
2. **Given** a provider attempt that fails with an upstream error (such as 429 Rate Limit or 503 Overload), **When** rotating to a fallback key, **Then** the error code and attempt duration are recorded in structured telemetry before proceeding to the next attempt.
3. **Given** a translation request where all keys fail, **When** the final error response is returned to the client, **Then** the response includes the `requestId` and normalized error taxonomy code for diagnosis.

---

### User Story 2 - Key Selection & Scheduler Decision Transparency (Priority: P2)

As a system operator reviewing key rotation behavior, I want the scheduler to record metrics on key selection counts and rejection reasons (cooldown, pacing delay, circuit breaker open, unsupported model, quota exhausted) along with queue wait times, so that I can explain why a specific key was bypassed or why a request experienced scheduling delay.

**Why this priority**: Eliminates the "black box" behavior of multi-key rotation by making scheduling heuristics, queue delays, and key exclusion decisions fully transparent.

**Independent Test**: Simulate key selection with one key in active cooldown, one key unsupported for the target model, and one healthy key. Query the scheduler metrics and assert that `selectionCount` increments, and `rejected` counts accurately categorize reasons for the excluded keys.

**Acceptance Scenarios**:

1. **Given** a key in active cooldown or circuit breaker open state, **When** the scheduler evaluates candidate keys, **Then** the candidate is rejected with an explicit reason (`in_cooldown` or `circuit_breaker_open`) and the rejection counter for that reason increments.
2. **Given** a request that experiences rate-limit pacing delay or concurrency backpressure, **When** key execution proceeds, **Then** `scheduler.queueWait` tracks the accumulated wait duration.
3. **Given** multiple translation requests processed by the scheduler, **When** querying the telemetry endpoint, **Then** the payload includes aggregated `scheduler` metrics (`queueWaitTotalMs`, `queueWaitAvgMs`, `selectionCount`, `rejectedByReason`).

---

### User Story 3 - Per-Model & Per-Key Diagnostic Telemetry Breakdown (Priority: P3)

As a translator or system supervisor monitoring system health, I want to view detailed performance metrics broken down by model (requests, errors, latency distribution) and by key (attempts, errors, quota events, cooldown events), so that I can identify failing or degrading models and unhealthy keys before total outage occurs.

**Why this priority**: Enables granular root-cause analysis distinguishing between model outages (e.g. Gemini 2.5 Flash 503s) and key-specific quota exhaustion (e.g. Key 3 hitting daily RPD limits).

**Independent Test**: Dispatch requests to two different models (`gemini-2.5-flash` and `gemini-2.5-pro`) across two API keys. Verify that metrics track per-model latency (average, min, max) and errors, while tracking per-key quota and cooldown events independently.

**Acceptance Scenarios**:

1. **Given** successful and failed requests to a specific model, **When** inspecting `perModel` telemetry, **Then** the system reports `requests`, `errors`, `totalLatencyMs`, `avgLatencyMs`, `minLatencyMs`, and `maxLatencyMs` for that model.
2. **Given** a key encountering 429 rate limits or being moved to cooldown, **When** inspecting `perKey` telemetry, **Then** `quotaEvents` and `cooldownEvents` counters for that specific key are incremented.
3. **Given** an administrator accessing the monitoring or quota dashboard, **When** viewing the diagnostics section, **Then** per-model error rates and per-key health events are cleanly presented in accordance with the design system.

---

### User Story 4 - Strict Sensitive Data Redaction & Security Invariant (Priority: P4)

As a security auditor, I want absolute assurance that telemetry logs, metrics, and error traces NEVER contain raw API keys, session tokens, or full sensitive prompt text, so that observability logs can be safely stored and analyzed in production environments without privacy or security risks.

**Why this priority**: Compliance with strict security, privacy, and zero-leakage standards across all application logging pipelines.

**Independent Test**: Inspect all structured log outputs and telemetry snapshots generated during translation requests, asserting that all raw API keys are masked or hashed, session tokens are scrubbed, and prompt contents are strictly omitted.

**Acceptance Scenarios**:

1. **Given** any operational log output during key rotation or retry, **When** formatted, **Then** the key identifier is either masked (`AIzaSy...ABCD`) or hashed (`keyHash`), and never printed in plaintext.
2. **Given** any translation prompt containing user manuscript text, **When** logging attempt metadata, **Then** full prompt contents and translated texts are excluded from the log payload.
3. **Given** authenticated requests, **When** logging request headers or context, **Then** session tokens and Authorization headers are stripped.

---

### Edge Cases

- **Zero Keys Configured / Available**: If no valid API keys exist or all keys are in cooldown/disabled, the system records `logicalRequests = 1`, `failedRequests = 1`, `providerAttempts = 0`, and logs scheduler rejection reasons for all inspected keys.
- **Concurrent Burst Pacing**: When high concurrency causes multiple requests to queue for the same key, each request's queue wait duration is recorded in `scheduler.queueWait`, preventing latency misattribution to Google's server inference time.
- **Client Disconnection / Abort Mid-Rotation**: If a client disconnects during rotation, completed attempts are recorded with their respective latencies and statuses, and the logical request is marked as aborted/failed.
- **Custom vs Auto-Generated Request ID**: If a client provides a valid `x-request-id` header, it is preserved and propagated; if empty or invalid, a new cryptographic request ID is generated and returned in the response header.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST track top-level logical request lifecycle metrics:
  - `logicalRequests`: Total translation operations requested.
  - `providerAttempts`: Total physical upstream API calls dispatched.
  - `retries`: Total retry attempts (`max(0, providerAttempts - 1)` per logical request).
  - `successes`: Successfully completed logical requests.
  - `failures`: Logical requests that resulted in an error after exhausting retries or encountering fatal errors.
- **FR-002**: The system MUST track `perModel` observability metrics for each model ID:
  - `requests`: Total provider attempts dispatched to this model.
  - `errors`: Total failed attempts for this model.
  - `latency`: Attempt latency metrics including `totalLatencyMs`, `avgLatencyMs`, `minLatencyMs`, and `maxLatencyMs`.
- **FR-003**: The system MUST track `perKey` observability metrics for each key identifier:
  - `attempts`: Total provider attempts made using this key.
  - `errors`: Total errors encountered by this key.
  - `quotaEvents`: Total quota-related events (e.g. HTTP 429, RPD/RPM limits reached).
  - `cooldownEvents`: Total cooldown and degradation transitions triggered for this key.
- **FR-004**: The system MUST track `scheduler` operational telemetry:
  - `queueWait`: Total and average time (ms) spent waiting in rate-limit pacing or concurrency queue before upstream execution.
  - `selectionCount`: Total number of key selection/evaluation events performed.
  - `rejected`: Rejection count broken down by reason (e.g. `in_cooldown`, `rate_limited_pacing`, `circuit_breaker_open`, `unsupported_model`, `quota_exhausted`).
- **FR-005**: Every logical request MUST be assigned a unique `requestId` (retaining incoming `x-request-id` or generating a new cryptographically random ID) that persists across all rotation attempts and retries.
- **FR-006**: Every provider attempt MUST emit a structured operational log entry containing:
  - `requestId`: The correlation ID for the logical request.
  - `modelId`: Target model identifier (e.g. `models/gemini-2.5-flash`).
  - `keyIdentifier`: Masked key string or key hash and key index.
  - `attempt`: Current attempt number (1, 2, ...).
  - `errorCode`: Standardized error code (`AIErrorCode`) or `null` on success.
  - `latency`: Attempt duration in milliseconds.
- **FR-007**: Operational telemetry logs MUST NOT contain raw API keys, session tokens, authorization headers, or full sensitive prompt text.
- **FR-008**: The `/api/quota-status` and `/api/metrics` endpoints MUST expose the enriched `scheduler`, `perModel`, and `perKey` metrics while preserving backward compatibility for existing fields.
- **FR-009**: Error responses from translation endpoints MUST include the `requestId` and `errorCode` in their error payload for client-side correlation.
- **FR-010**: Resetting daily metrics at 00:00 Pacific Time MUST reset daily sub-counters while maintaining cumulative lifetime counters.

### Key Entities *(include if feature involves data)*

- **RequestAttemptLog**:
  ```typescript
  export interface RequestAttemptLog {
    requestId: string;
    modelId: string;
    keyIdentifier: string; // Masked key or hash
    keyIndex: number;
    attempt: number;
    status: 'success' | 'failure';
    errorCode: string | null;
    latencyMs: number;
    timestamp: number;
  }
  ```

- **SchedulerTelemetry**:
  ```typescript
  export interface SchedulerTelemetry {
    selectionCount: number;
    queueWaitTotalMs: number;
    queueWaitAvgMs: number;
    rejectedTotal: number;
    rejectedByReason: Record<string, number>;
  }
  ```

- **ModelObservabilityMetrics**:
  ```typescript
  export interface ModelObservabilityMetrics {
    requestsTotal: number;
    errorsTotal: number;
    totalLatencyMs: number;
    avgLatencyMs: number;
    minLatencyMs: number;
    maxLatencyMs: number;
  }
  ```

- **KeyObservabilityMetrics**:
  ```typescript
  export interface KeyObservabilityMetrics {
    attemptsTotal: number;
    errorsTotal: number;
    quotaEventsTotal: number;
    cooldownEventsTotal: number;
  }
  ```

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of translation requests involving retries, all attempt logs share the exact same `requestId` across all rotation iterations.
- **SC-002**: For any slow or failing request, administrators can determine the exact root cause within 4 distinct categories (queue/pacing delay, key rejection reason, retry trigger reason, model error) via the telemetry data.
- **SC-003**: 0% of operational logs or telemetry endpoints contain unmasked raw API keys, session tokens, or sensitive prompt contents.
- **SC-004**: `/api/quota-status` and `/api/metrics` return comprehensive `scheduler`, `perModel`, and `perKey` telemetry with less than 5ms server computation overhead.
- **SC-005**: 100% of automated unit and integration test suites pass cleanly with zero type errors (`tsc --noEmit`) and no skipped tests.

## Assumptions

- **Clock Synchronization**: Latency and duration measurements use monotonic system time (`Date.now()` or `performance.now()`).
- **Telemetry Retention**: In-memory attempt trace buffers retain a bounded rolling history (e.g. last 100-500 attempts) to prevent memory leaks in long-running processes.
- **Design System Consistency**: UI display of new metrics in QuotaPanel will use existing Vietnamese terminology, Badge, and Seal primitives without modifying design tokens.
