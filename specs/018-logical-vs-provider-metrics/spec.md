# Feature Specification: Decoupling Logical Requests and Provider Attempts

**Feature Branch**: `018-logical-vs-provider-metrics`

**Created**: 2026-08-20

**Status**: Draft

**Input**: User request: "TASK 05 — TÁCH LOGICAL REQUEST VÀ PROVIDER ATTEMPT. Mục tiêu: Sửa metrics/quota semantics để phân biệt: logical translation request, provider attempt, retry, success, failure. Ví dụ: Một translation: logicalRequest = 1, Key 1 -> fail, Key 2 -> fail, Key 3 -> success => providerAttempts = 3, retries = 2, successfulAttempts = 1. Không để dashboard hiển thị requests = 3 rồi người dùng tưởng có 3 translation. Thiết kế: Audit quotaService, geminiService, metrics và dashboard. Tạo metrics rõ ràng: logicalRequests, providerAttempts, successfulRequests, failedRequests, retries. Nếu quota provider cần tính theo API attempts thì vẫn giữ metric riêng cho provider. UI: Nếu dashboard hiện hiển thị Requests, đổi label để tránh hiểu nhầm: Translation Requests, Provider Attempts, Retries. Không thay đổi design system. Tests: one successful attempt, one retry, multiple key rotation, all attempts fail."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Decoupling Logical Translation Requests from Upstream Provider Attempts (Priority: P1) 🎯 MVP

As a user monitoring translation jobs and API quota usage, I want the system to distinguish between a "Logical Translation Request" (a single translation task dispatched by the user) and a "Provider Attempt" (an individual upstream API call made to a specific Gemini API key during rotation or retry), so that 1 translation that required 3 key attempts is accurately recorded as 1 logical request with 3 provider attempts and 2 retries, rather than misleadingly appearing as 3 separate user translations.

**Why this priority**: Eliminates user confusion and metric distortion where rotation retries inflate perceived translation volume while maintaining strict accounting of raw API quota consumption per key.

**Independent Test**: Execute a translation request that fails on Key 1 and Key 2 before succeeding on Key 3. Assert that `logicalRequests = 1`, `successfulRequests = 1`, `failedRequests = 0`, `providerAttempts = 3`, `retries = 2`, `successfulAttempts = 1`, and `failedAttempts = 2`.

**Acceptance Scenarios**:

1. **Given** a translation request that succeeds on the first attempt (Key 1), **When** metrics are recorded, **Then** `logicalRequests = 1`, `successfulRequests = 1`, `providerAttempts = 1`, `retries = 0`, `successfulAttempts = 1`.
2. **Given** a translation request that fails on Key 1 and succeeds on Key 2, **When** metrics are recorded, **Then** `logicalRequests = 1`, `successfulRequests = 1`, `providerAttempts = 2`, `retries = 1`, `successfulAttempts = 1`, `failedAttempts = 1`.
3. **Given** a translation request where all candidate keys fail, **When** the error is returned, **Then** `logicalRequests = 1`, `successfulRequests = 0`, `failedRequests = 1`, `providerAttempts = N`, `retries = N - 1`, `failedAttempts = N`.

---

### User Story 2 - Comprehensive System & Model Telemetry API (Priority: P2)

As a frontend client or monitoring system consuming `/api/quota-status`, I want the API response to provide both system-level logical summary metrics and per-key/per-model provider quota metrics, so that both high-level user productivity and low-level API consumption are transparently observable.

**Why this priority**: Empowers dashboards and observability tools to display clear conversion rates, retry frequencies, and key health diagnostics without ambiguity.

**Independent Test**: Query `/api/quota-status` after executing single and multi-key translation requests, verifying that the payload includes both `systemSummary` (logical metrics) and per-key `providerStats` (provider attempt metrics).

**Acceptance Scenarios**:

1. **Given** requests processed across multiple keys and models, **When** querying `/api/quota-status`, **Then** the response includes:
   - `logicalSummary`: `logicalRequestsTotal`, `successfulRequestsTotal`, `failedRequestsTotal`, `retriesTotal`
   - `providerSummary`: `providerAttemptsTotal`, `successfulAttemptsTotal`, `failedAttemptsTotal`
   - Per-key snapshots maintaining backward-compatible `requestsTotal`/`requestsToday` as provider attempts alongside explicit `providerAttemptsTotal`.

---

### User Story 3 - Transparent Observability UI & Dashboard Clarification (Priority: P3)

As a translator viewing the Quota Panel in the web interface, I want the metrics cards and tables to display clear Vietnamese terminology ("Yêu cầu dịch", "Lượt gọi API", "Lượt thử lại"), so that I immediately understand whether a counter reflects my translation workload or Google API consumption.

**Why this priority**: Improves user trust and clarity while adhering to the established design system (Vietnamese labels, Badge/Seal styling, no AI slop).

**Independent Test**: Render `QuotaPanel` and verify that the summary metrics display distinct cards/labels for Translation Requests, API Attempts, and Retries without visual breakage or design system violations.

**Acceptance Scenarios**:

1. **Given** the Quota Panel is opened, **When** viewing the metrics overview, **Then** the labels clearly indicate "Yêu cầu dịch (Logical)" and "Lượt gọi API (Provider)" instead of an ambiguous generic "Requests".
2. **Given** keys that performed retries, **When** viewing the model/key statistics, **Then** the retry count and provider attempt counts are cleanly presented.

---

### Edge Cases

- **Zero-Key Immediate Failure**: If a request is dispatched with no valid API keys configured, `logicalRequests` is incremented by 1, `failedRequests` is incremented by 1, while `providerAttempts` remains 0 (since no upstream call was attempted).
- **Aborted / Cancelled Requests**: If a client disconnects mid-flight, completed provider attempts are recorded against the respective keys, while the logical request is marked as aborted/failed.
- **Model-Specific Logical Aggregation**: Logical requests are tracked both globally and broken down per model to accurately measure success/retry ratios per model family.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST define explicit, separate metric counters for:
  - `logicalRequestsTotal`: Total translation jobs requested by the user.
  - `successfulRequestsTotal`: Logical translation jobs completed successfully.
  - `failedRequestsTotal`: Logical translation jobs that failed after all rotation attempts.
  - `providerAttemptsTotal`: Total physical upstream API calls dispatched to Gemini API.
  - `successfulAttemptsTotal`: Upstream API calls that returned successful responses.
  - `failedAttemptsTotal`: Upstream API calls that resulted in errors (429, 503, 500, etc.).
  - `retriesTotal`: Total retry/fallback attempts (`max(0, providerAttempts - 1)` per logical request).
- **FR-002**: `quotaService` MUST maintain in-memory logical request metrics globally and per model alongside existing per-key provider quota metrics.
- **FR-003**: `geminiService.ts` MUST record logical request lifecycle (`startLogicalRequest` / `recordLogicalOutcome`) encompassing all provider attempts and retries within `generateWithRotation`.
- **FR-004**: Each physical upstream API attempt in `generateWithRotation` MUST continue to record its individual provider attempt (`recordUsage`) against the specific API key for accurate RPM/TPM/RPD rate limiting.
- **FR-005**: `/api/quota-status` MUST return a structured payload containing:
  - `logicalSummary`: Aggregated logical translation requests, successes, failures, and retries.
  - `providerSummary`: Aggregated upstream API attempts, successful attempts, and failed attempts.
  - `keys`: Array of per-key snapshots containing both provider attempts and health states.
- **FR-006**: Existing per-key snapshot fields (`requestsTotal`, `requestsToday`, `requestsThisMinute`) MUST be preserved as aliases for provider attempts to maintain backward compatibility with existing clients and tests.
- **FR-007**: `src/components/QuotaPanel.tsx` MUST update user-facing terminology to clearly distinguish between "Yêu cầu dịch" (Logical Requests), "Lượt gọi API" (Provider Attempts), and "Lượt thử lại" (Retries) without modifying the design system primitives or colors.
- **FR-008**: Resetting daily metrics at 00:00 Pacific Time (`America/Los_Angeles`) MUST reset daily counters for both logical requests and provider attempts.

### Key Entities *(include if feature involves data)*

- **LogicalRequestMetrics**:
  ```typescript
  export interface LogicalRequestMetrics {
    logicalRequestsTotal: number;
    logicalRequestsToday: number;
    successfulRequestsTotal: number;
    successfulRequestsToday: number;
    failedRequestsTotal: number;
    failedRequestsToday: number;
    retriesTotal: number;
    retriesToday: number;
  }
  ```
- **ProviderAttemptMetrics**:
  ```typescript
  export interface ProviderAttemptMetrics {
    providerAttemptsTotal: number;
    providerAttemptsToday: number;
    successfulAttemptsTotal: number;
    successfulAttemptsToday: number;
    failedAttemptsTotal: number;
    failedAttemptsToday: number;
  }
  ```
- **QuotaSystemOverview**: Combined logical and provider metrics returned by `/api/quota-status`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In all multi-key rotation scenarios (e.g. 1 translation, 3 keys attempted, 1 success), `logicalRequests` is exactly 1, `providerAttempts` is exactly 3, `retries` is exactly 2, and `successfulRequests` is exactly 1.
- **SC-002**: 100% of unit tests covering single attempt success, single retry, multi-key rotation, and complete exhaustion pass cleanly.
- **SC-003**: `/api/quota-status` provides both logical and provider summaries with 100% backward compatibility for existing fields.
- **SC-004**: QuotaPanel UI accurately displays separate logical and provider metrics in Vietnamese without design system violations.
