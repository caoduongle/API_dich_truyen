# Feature Specification: Enforce Personal Quota Limits & Smart Key Selection

**Feature Branch**: `109-enforce-quota-limits`

**Created**: 2026-09-11

**Status**: Draft

**Input**: User description: "kiểm tra xem quota hoạt động như nào; rõ ràng tôi đã đặt ngưỡng giới hạn cá nhân rồi mà nó vẫn vượt ngưỡng; tôi đang gặp lỗi;"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Personal Daily Quota Limit Enforcement (Priority: P1)

As a novel translator using multiple personal Google Gemini API keys,
I want the application to strictly enforce my personal daily quota limits (Max RPD) configured in the Quota Settings,
So that no API key is used beyond my designated request budget, preventing unexpected provider quota exhaustion or billing risks.

**Why this priority**:
Currently, personal limits configured by the user (e.g. 500 requests/day) are stored in local storage and displayed visually in progress bars, but are never enforced when requests are dispatched. As a result, the system continues making calls until the provider physically cuts off the key with HTTP 429, causing user distress and broken budget expectations.

**Independent Test**:
Set a key's personal limit `maxRpd` to $M$ (e.g., 5). Run translation requests. Observe that after request count reaches $M$, the system ceases dispatching requests to this key, transitions to the next available healthy key, and stops dispatching when all keys reach their limits without exceeding $M$.

**Acceptance Scenarios**:

1. **Given** Key #1 has a user-configured limit of 500 requests/day and currently has 500 recorded requests, **When** a new translation or analysis request is triggered, **Then** Key #1 is considered unavailable, and the system automatically routes the request to Key #2 without sending an HTTP call with Key #1.
2. **Given** a user changes the personal limit of Key #1 from 500 to 600 while requests today is 500, **When** the next request is dispatched, **Then** Key #1 immediately becomes available and eligible for selection again.
3. **Given** all configured keys have reached their respective personal `maxRpd` limits, **When** a user attempts to translate, **Then** the operation stops cleanly with an advisory message indicating all keys have reached their configured limits, without generating network errors.

---

### User Story 2 - Pre-Call Health Inspection & Prevention of Redundant Errors (Priority: P1)

As a user translating long chapters or batches,
I want the API client to check the health and availability status of each candidate key *before* making network requests,
So that keys already marked as `QuotaExhausted`, `AuthFailed`, `RateLimited` (in cooldown), or at limit are bypassed immediately without generating failing HTTP round-trips, bloated error metrics, and retry latency.

**Why this priority**:
Currently, `callGeminiDirect` does not inspect `keyHealth` before making HTTP calls. It blindly sends an HTTP request using the first candidate key even if that key is known to be exhausted. In the user's report, this caused 90 consecutive failed calls (HTTP 429) on an already-exhausted Key #1, inflating error logs and retry metrics to 91.

**Independent Test**:
Mark Key #1 as `QuotaExhausted`. Send 10 consecutive translation requests with keys [Key #1, Key #2]. Verify that Key #1 is skipped 10 times with 0 HTTP requests sent using Key #1, Key #1's `errorsTotal` remains unchanged, and Key #2 handles all 10 requests immediately with 0 retries.

**Acceptance Scenarios**:

1. **Given** Key #1 has received an HTTP 429 `RESOURCE_EXHAUSTED` (or reached personal limit) and is in `QuotaExhausted` state, **When** subsequent translation tasks run, **Then** the key selection algorithm skips Key #1 and directly invokes the next healthy candidate.
2. **Given** a candidate key is bypassed due to pre-call health checks, **When** quota metrics are recorded, **Then** the bypass is NOT treated as a provider failure, does NOT increment the key's `errorsTotal`, and does NOT count as a failed retry.
3. **Given** a key in temporary `Cooldown` completes its wait time, **When** a new request is dispatched, **Then** the key is reintroduced to the candidate pool in `HalfOpen`/`Degraded` state for a trial call.

---

### User Story 3 - Transparent UI Indication of Limit Status (Priority: P2)

As a user monitoring quota in the Quota Panel,
I want to clearly distinguish between a key that has reached my personal custom limit versus a key that received an upstream provider 429 quota exhaustion,
So that I understand why a key is paused and have full visibility into my system's behavior.

**Why this priority**:
Users need confidence that their custom limits are functioning as intended rather than wondering if their keys are broken or banned.

**Independent Test**:
Open the Quota Panel when a key reaches its personal limit (e.g. 500/500). Verify that the badge clearly displays "Đạt giới hạn ngày (Tự đặt)" or appropriate indicator, distinguishing it from an upstream provider error.

**Acceptance Scenarios**:

1. **Given** a key reaches its user-defined `maxRpd` limit without any upstream 429 error, **When** the user opens the Quota Panel, **Then** the key status badge reflects that the personal limit has been reached, while upstream health remains unblemished.
2. **Given** a key receives an actual HTTP 429 from Google API, **When** viewing the Quota Panel, **Then** the badge reflects "Hết hạn mức ngày (Google 429)" with the upstream reason recorded.

---

### Edge Cases

- **No custom limits defined in storage**: If the user has never opened or modified the Custom Limits panel, the system falls back to default safe thresholds (`maxRpm: 15`, `maxRpd: 1500`, `maxTpm: 1000000`).
- **PST midnight rollover**: When midnight PST occurs (`America/Los_Angeles`), all daily counters reset to 0, and keys paused due to personal daily limits or daily provider exhaustion automatically transition back to `Healthy`.
- **All configured keys unavailable**: If all keys are in `QuotaExhausted`, `AuthFailed`, or at their personal limit, the system gracefully throws an `ALL_KEYS_EXHAUSTED` error without hammering the network.
- **Concurrent batch requests**: When multiple chapters or segments execute concurrently, atomic key allocation or round-robin selection prevents all concurrent workers from simultaneously overloading the same key.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST evaluate each API key against its active personal limits (`maxRpd`, `maxRpm`, `maxTpm`) retrieved from `gemini_quota_custom_limits` before dispatching API calls.
- **FR-002**: When a key's `requestsToday` reaches or exceeds its configured `maxRpd`, the system MUST flag that key as ineligible for new requests for the remainder of the PST day.
- **FR-003**: The direct API client (`callGeminiDirect`) MUST perform pre-flight key availability checks (`getKeyHealth` and custom limit evaluation) before initiating any network `fetch` call.
- **FR-004**: Candidate keys in `QuotaExhausted`, `AuthFailed`, active `RateLimited`/`Cooldown` cooldown, or personal limit reached MUST be bypassed without dispatching network traffic.
- **FR-005**: Proactive key bypasses MUST NOT increment `errorsTotal`, MUST NOT increment `failedAttemptsToday`, and MUST NOT trigger false failure alerts.
- **FR-006**: When rotating through keys, the selection algorithm MUST automatically locate and start with the next available healthy key instead of always beginning at index 0.
- **FR-007**: If all configured keys are ineligible, the system MUST abort the request cycle cleanly with error code `ALL_KEYS_EXHAUSTED` and clear user-facing guidance.
- **FR-008**: The Quota Panel MUST reflect accurate status badges and progress metrics that correspond 1:1 with enforced limits.
- **FR-009**: All daily quota resets and date evaluations MUST strictly follow `America/Los_Angeles` (PST) midnight rollover.

### Key Entities

- **CustomLimit**: Per-key user threshold containing `maxRpm` (number), `maxRpd` (number), and `maxTpm` (number).
- **KeyQuotaFullSnapshot**: Real-time snapshot containing `requestsToday`, `requestsThisMinute`, `tokensToday`, `tokensThisMinute`, `errorsTotal`, and `healthState`.
- **KeyHealthState**: The state machine status: `Healthy`, `Degraded`, `RateLimited`, `QuotaExhausted`, `AuthFailed`, `Cooldown`, `Disabled`.
- **KeyAvailabilityResult**: An evaluation result indicating whether a key can be used immediately, is temporarily rate-limited/cooling down, or is exhausted for the day.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of API requests respect the configured `maxRpd` personal limit; zero requests are dispatched on a key once its recorded `requestsToday` reaches the limit.
- **SC-002**: Elimination of redundant HTTP 429 provider errors on already-exhausted keys; keys with exhausted quota receive 0 subsequent HTTP requests until reset.
- **SC-003**: Key rotation latency is minimized by immediately selecting healthy keys rather than incurring sequential network timeout/error delays.
- **SC-004**: 100% pass rate on all automated tests (`npm run lint`, `npm test`, `npm run build`) with zero regressions in existing translation pipelines.

## Assumptions

- Personal quota limits are stored in browser `localStorage` under `gemini_quota_custom_limits` as JSON keyed by `keyHash`.
- The application operates in client-direct mode ("Zero Backend") using `directGeminiClient.ts` and `localQuotaTracker.ts`.
- In the event of a conflict between a user's lower personal limit and Google's higher provider quota, the user's stricter limit always takes precedence.
