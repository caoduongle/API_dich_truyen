# Feature Specification: Quota-Aware Per-Key RPM Scheduler

**Feature Branch**: `017-per-key-rpm-scheduler`

**Created**: 2026-08-20

**Status**: Draft

**Input**: User request: "TASK 04 — QUOTA-AWARE PER-KEY RPM SCHEDULER: Sửa khoảng cách giữa quota dashboard và runtime scheduling. Hiện repo đã có RPM, TPM, RPD, dynamic pacing nhưng scheduler vẫn có logic dùng một RPM/pacing policy chung cho một lần rotation. Mục tiêu: Key A -> RPM A -> interval A; Key B -> RPM B -> interval B; Key C -> RPM C -> interval C. Không thay đổi HTTP 60 requests/minute/IP abuse protection. Desired algorithm: Request -> candidate keys -> remove disabled -> remove cooldown -> remove unsupported model -> check RPM -> check TPM -> check RPD -> score keys -> select best key. Mỗi key phải có pacing riêng. Key score: quota remaining, lastUsedAt, error history, cooldown, model support. Tests: different RPM per key, same RPM all keys, one key exhausted, one key cooldown, one key supports model / another does not, rotation, parallel requests."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Independent Per-Key Pacing & Variable RPM Scheduling (Priority: P1) 🎯 MVP

As a translator using a pool of multiple Gemini API keys with varying capacity tiers (e.g. Free Tier with 15 RPM and Pay-as-you-go Tier with 60 RPM), I want the system to calculate and enforce scheduling intervals individually per key (`Key A -> RPM A -> Interval A`, `Key B -> RPM B -> Interval B`), so that high-throughput keys process translations rapidly without being slowed down by low-tier keys, while low-tier keys are protected from rate limit errors.

**Why this priority**: Eliminates the bottleneck where a single global pacing interval penalizes high-capacity keys or overwhelms lower-capacity keys during multi-key translation rotation.

**Independent Test**: Can be tested by providing two keys with different configured RPMs (e.g. Key 1 at 15 RPM, Key 2 at 60 RPM), executing sequential requests, and asserting that Key 2's pacing interval is ~1.1s while Key 1's pacing interval is ~4.5s without cross-key interval contamination.

**Acceptance Scenarios**:

1. **Given** Key A with 15 RPM (safety interval ~4.5s) and Key B with 60 RPM (safety interval ~1.1s), **When** requests are routed through Key B, **Then** Key B advances its own pacing clock by 1.1s, while Key A's pacing clock remains untouched and ready for immediate use.
2. **Given** multiple keys with identical RPM tiers, **When** sequential requests are processed, **Then** requests interleave across keys without waiting for full single-key cooldown delays.

---

### User Story 2 - Multi-Dimensional Candidate Key Filtering & Model Support Routing (Priority: P2)

As a translation engine dispatching requests for various model families (Gemini Flash, Pro, Gemma, custom fine-tuned models), I want the scheduler to filter candidate keys across health states (disabled, circuit breaker open, active cooldown), model compatibility, and capacity constraints (RPM, TPM, RPD), so that requests are only attempted on capable and unexhausted keys.

**Why this priority**: Prevents wasted upstream network calls and premature errors by preemptively eliminating ineligible or incompatible keys before making requests.

**Independent Test**: Can be tested by setting up a model inspection state where Key 1 supports a model and Key 2 does not, verifying that requests for that model are exclusively routed to Key 1.

**Acceptance Scenarios**:

1. **Given** a request for a specific model, **When** Key 1 is known to support the model and Key 2 is known not to support it, **Then** the scheduler filters out Key 2 and routes the request to Key 1.
2. **Given** a key in active cooldown (e.g. due to a recent 429 rate limit or 503 overload), **When** new translation requests arrive, **Then** the scheduler removes the cooling key from candidate selection until its cooldown expires.
3. **Given** a key that has reached its minute RPM capacity or daily RPD limit, **When** evaluating candidates, **Then** the scheduler marks the key as temporarily capacity-exhausted and selects an alternate unexhausted key.

---

### User Story 3 - Predictive Key Scoring, Automatic Rotation & Parallel Load Balancing (Priority: P3)

As a user running concurrent translation requests (e.g. batch chapter translation or chunked translation), I want candidate keys to be dynamically scored based on remaining quota capacity, idle time (`now - lastUsedAt`), error history, and immediate pacing availability, so that traffic is evenly distributed across keys and transient failures seamlessly rotate to the next best candidate.

**Why this priority**: Maximizes overall translation throughput, achieves natural round-robin load distribution, and provides fault tolerance during transient network spikes.

**Independent Test**: Can be tested by firing parallel concurrent requests across multiple active keys, verifying that requests are distributed proportionally according to idle time and available capacity without race conditions or starvation.

**Acceptance Scenarios**:

1. **Given** multiple available healthy keys with equal capacity, **When** a request arrives, **Then** the key with the longest idle duration (`now - lastUsedAt`) receives the highest score and is selected first, resulting in balanced round-robin rotation.
2. **Given** a transient upstream error on the selected key, **When** the error occurs, **Then** the scheduler logs the error, adjusts the key's health/cooldown, and immediately falls back to the next highest-scoring candidate key.

---

### Edge Cases

- **All Keys Cooldown / Exhausted**: When all candidate keys are temporarily exhausted (RPM/TPM/RPD limit reached) or in cooldown, the scheduler MUST throw a clear, structured retryable error with `retryAfterSec` calculated from the earliest available key's remaining cooldown/interval.
- **Uninspected Model Support**: If a key's model support has not yet been inspected from Google API, the scheduler MUST allow the key with a neutral score rather than aggressively blocking it, avoiding false rejections for new keys.
- **Abuse Protection Isolation**: The HTTP server gateway rate limit (60 requests/minute/IP) MUST remain strictly independent and unaltered; per-key RPM scheduling only manages the downstream Gemini API dispatch layer.
- **Concurrent Request Collisions**: In parallel multi-threaded request scenarios, the pacing reservation for a key MUST be atomically advanced when selected to prevent overlapping parallel requests on the same key violating RPM limits.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST implement an isolated, per-key rate pacing manager where each API key maintains its own independent `nextAllowedTime` and `effectiveIntervalMs` derived from its specific RPM tier.
- **FR-002**: The scheduler MUST support individual RPM configuration per key (e.g. Free Tier 15 RPM -> ~4.5s interval, Tier 1 60 RPM -> ~1.1s interval, Tier 2 120 RPM -> ~569ms interval), with a strict safety floor of 400ms on the backend.
- **FR-003**: The candidate key selection pipeline MUST execute the following deterministic filter sequence:
  1. Filter out `Disabled` or `AuthFailed` keys (e.g. invalid credentials).
  2. Filter out keys with active `cooldownUntil > now` or `CircuitBreakerStatus === 'Open'`.
  3. Filter out keys with verified incompatibility for the requested model.
  4. Check per-key sliding window RPM usage (`requestsThisMinute < keyRpm`).
  5. Check per-key sliding window TPM usage (`tokensThisMinute + estimatedTokens < maxTpm * 0.95`).
  6. Check per-key daily RPD usage (`requestsToday < maxRpd`).
- **FR-004**: If multiple candidate keys pass the filtering phase, the scheduler MUST compute a composite `KeyScore` incorporating:
  - **Quota Capacity Score**: Proportion of remaining RPM, TPM, and RPD capacity.
  - **Idle Time Score**: Time elapsed since `lastRequestTimestamp` (`now - lastUsedAt`), prioritizing least-recently-used keys.
  - **Pacing Readiness**: Bonus for keys with `nextAllowedTime <= now` (zero wait time) vs keys requiring a pending delay.
  - **Error History Penalty**: Deductions for consecutive errors or recent failures.
  - **Model Verification Bonus**: Bonus for keys explicitly verified to support the requested model.
- **FR-005**: The scheduler MUST select the candidate key with the highest score, advance that key's `nextAllowedTime`, and record request dispatch.
- **FR-006**: If an upstream call fails with a retryable error (e.g. 429 rate limit or 503 overload), the scheduler MUST record the categorized error in `quotaService`, trigger appropriate cooldown, and automatically rotate to the next best candidate in the sorted candidate list.
- **FR-007**: When all candidate keys are temporarily busy, the scheduler MUST either wait for the shortest key delay (if within tolerable threshold <= 5s) or throw a descriptive error containing the earliest retry delay.
- **FR-008**: The gateway IP-level rate limiter (`express-rate-limit` with 60 req/min/IP) MUST remain unchanged and decoupled from per-key Gemini scheduling.
- **FR-009**: The quota telemetry snapshot (`/api/quota-status`) MUST reflect accurate per-key runtime statistics, health state, RPM usage, TPM window metrics, and cooldown remaining timers.

### Key Entities *(include if feature involves data)*

- **PerKeyScheduleConfig**: Key identifier/hash, configured RPM, effective interval in milliseconds, and model capabilities.
- **KeyEvaluationCandidate**: Key string, original index, health state, filter status (`isEligible`), rejection reason, calculated composite score, and immediate wait delay in milliseconds.
- **SchedulerFilterResult**: Array of eligible candidates sorted by score descending, alongside lists of filtered/cooldown/exhausted keys with diagnostic reasons.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Keys with different configured RPMs (e.g. Key A at 15 RPM, Key B at 60 RPM) operate on strictly independent intervals (Key A at ~4.5s, Key B at ~1.1s) without cross-key pacing interference.
- **SC-002**: 100% of candidate keys that are in cooldown, auth-failed, or capacity-exhausted are filtered out prior to upstream API invocation.
- **SC-003**: In multi-key rotation scenarios with identical healthy keys, requests are distributed evenly across keys according to idle time.
- **SC-004**: 100% of unit and integration tests covering per-key RPM scheduling, capacity filtering, model compatibility routing, and parallel request execution pass cleanly.
- **SC-005**: Server abuse rate limiting (`60 req/min/IP`) remains fully functional and unaffected.

## Assumptions

- Free tier Gemini API keys default to 15 RPM, 1,000,000 TPM, and 1,500 RPD unless configured with custom RPM tiers.
- Pro models default to 10 RPM, 1,000,000 TPM, and 1,000 RPD.
- The system operates in single-server or distributed environment where memory-based sliding window and Redis-backed state track key metrics.
