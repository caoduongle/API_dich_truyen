# Feature Specification: Project & Quota Group Scheduler Architecture

**Feature Branch**: `032-quota-group-scheduler`

**Created**: 2026-08-20

**Status**: Draft

**Input**: User request: "QUY ƯỚC QUOTA BẮT BUỘC: Không được thiết kế API Key A = quota riêng, API Key B = quota riêng trừ khi chứng minh rõ các key thuộc quota bucket độc lập. Gemini API áp rate limits theo project (RPM, TPM, RPD). Architecture phải ưu tiên: Project / Quota Group -> API Keys -> Scheduler. Phân loại rõ: provider-confirmed quota, user-configured scheduling hint, observed usage, fallback pacing. Task 01: Chuyển từ per-key quota sang Quota Group / Project. Scheduler flow: Request -> Model compatibility -> Quota Group eligibility -> Quota Group scoring -> Key health selection -> Gemini request. Hỗ trợ multiple projects (Project A có keys A1, A2; Project B có keys B1, B2). Tests bắt buộc: two keys same project, two keys different projects, same project quota shared, different project quota independent, key auth failure, key cooldown, group exhausted, group available."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Project-Level Quota Accounting & Shared Group Capacity (Priority: P1) 🎯 MVP

As a translator using multiple Gemini API keys originating from the same Google Cloud / AI Studio project, I want the translation engine to group these keys under a unified Project / Quota Group with shared rate limits (RPM, TPM, RPD), so that making requests with different keys in the same project does not falsely assume additive provider quota or trigger unintended 429 rate limit overruns.

**Why this priority**: Corrects the fundamental architectural flaw where multiple keys from the same project were treated as independent quota buckets, preventing cascading rate limit errors and erratic throttling.

**Independent Test**: Can be fully tested by configuring two API keys (Key A1 and Key A2) belonging to the same project (Project A with configured limit of 15 RPM). Dispatching interleaved requests across Key A1 and Key A2 must increment a single shared usage counter for Project A. When 15 requests occur in a minute, the entire Project A group is recognized as rate-limited, preventing both Key A1 and Key A2 from dispatching further requests until the window slides.

**Acceptance Scenarios**:

1. **Given** Project A containing Key A1 and Key A2 with a configured group limit of 15 RPM, **When** 8 requests are dispatched via Key A1 and 7 requests via Key A2 within 60 seconds, **Then** Project A's observed usage reaches 15/15 RPM, and both Key A1 and Key A2 are temporarily paused for group-level rate pacing.
2. **Given** multiple keys assigned to the same Quota Group, **When** a request completes on any member key, **Then** the sliding-window token consumption (TPM) and daily request count (RPD) are recorded at the Quota Group level, updating the remaining capacity for all sibling keys.
3. **Given** a new API key added without an explicit project identifier, **When** initialized, **Then** the system assigns the key to a default or isolated Quota Group with safe fallback pacing rather than granting unconstrained quota.

---

### User Story 2 - Multi-Project Quota Isolation & Independent Scaling (Priority: P2)

As a power user managing multiple distinct Google Cloud projects (e.g. Project Alpha and Project Beta), I want the system to treat each project as an independent Quota Group with separate rate limits and sliding windows, so that the scheduler can fully utilize the combined throughput of all independent projects without cross-project throttling.

**Why this priority**: Enables genuine throughput scaling across independent Google Cloud projects while preserving strict isolation between different project rate limits.

**Independent Test**: Can be tested by configuring Project Alpha (Keys A1, A2) and Project Beta (Keys B1, B2). Intentionally saturating Project Alpha's 15 RPM quota must leave Project Beta completely unaffected, with requests instantly routing to Project Beta at full speed.

**Acceptance Scenarios**:

1. **Given** Project Alpha (saturated at 15/15 RPM) and Project Beta (0/15 RPM used), **When** a new translation request arrives, **Then** the scheduler identifies Project Alpha as ineligible/exhausted, scores Project Beta as eligible, and routes the request to a healthy key in Project Beta with zero extra queuing delay.
2. **Given** concurrent translation tasks running across multiple independent Quota Groups, **When** requests execute in parallel, **Then** quota tracking for Project Alpha and Project Beta increments strictly in their respective isolated counters.
3. **Given** two projects with different capacity configurations (e.g. Free Tier Project A at 15 RPM, Pay-as-you-go Project B at 60 RPM), **When** scheduling requests, **Then** Project B is prioritized for higher load according to its larger available capacity.

---

### User Story 3 - Hierarchical Scheduler Flow & Key Health Isolation (Priority: P3)

As a translation system handling automated batch jobs, I want the dispatch pipeline to execute a strict hierarchical decision flow (`Request -> Model Compatibility -> Quota Group Eligibility -> Quota Group Scoring -> Key Health Selection -> Upstream Dispatch`), so that individual key failures (such as invalid API key or temporary cooldown) only disable that specific key while allowing healthy sibling keys in the same group—or alternate groups—to continue operating.

**Why this priority**: Ensures granular fault tolerance and high availability by separating quota capacity decisions (group-level) from physical credential health and circuit breaking (key-level).

**Independent Test**: Can be tested by registering Project A with Key A1 (invalid/auth-failed) and Key A2 (healthy). When a request targets Project A, the scheduler filters out Key A1 due to auth failure, selects healthy Key A2, and successfully executes the request without failing the entire Quota Group.

**Acceptance Scenarios**:

1. **Given** a Quota Group with Key A1 and Key A2, **When** Key A1 encounters an authentication error (401/403 Invalid API Key), **Then** Key A1 is placed in `AuthFailed` / `Disabled` state, while Key A2 remains active and available for subsequent dispatches within the same Quota Group.
2. **Given** Key A1 is placed in a short temporary cooldown (e.g. transient 503 network timeout), **When** a request arrives for that Quota Group, **Then** the scheduler selects Key A2 if it is out of cooldown, without marking the entire group as unavailable.
3. **Given** all keys within a Quota Group are either in cooldown or disabled, **When** the scheduler evaluates the group, **Then** the Quota Group is marked as temporarily unavailable (`NoHealthyKeys`), and the scheduler falls back to alternate eligible Quota Groups.
4. **Given** an upstream 429 response indicates project-wide rate limit exhaustion, **When** handled, **Then** the Quota Group enters group cooldown, and the scheduler rotates to the next highest-scoring Quota Group.

---

### User Story 4 - Strict Four-Tier Quota Data Classification & Observability (Priority: P4)

As an administrator or developer inspecting the system, I want all quota and pacing metrics to be strictly categorized into four non-overlapping tiers (`providerQuota`, `configuredQuota`, `observedUsage`, `schedulingHint`), so that manual user configurations or heuristic pacing rules are never falsely reported or treated as provider-verified limits.

**Why this priority**: Eliminates ambiguity between real Google API limits, user input values, observed empirical counts, and internal pacing heuristics, ensuring transparent diagnostics and trustworthy telemetry.

**Independent Test**: Can be tested by inspecting the quota telemetry API and UI state when a user enters custom RPM limits: verify that `configuredQuota` holds the user-entered value, `schedulingHint` holds the calculated interval, `observedUsage` tracks actual calls, and `providerQuota` remains explicitly flagged as unverified unless confirmed by provider metadata.

**Acceptance Scenarios**:

1. **Given** a user inputs a custom rate limit (e.g. 60 RPM) for a Quota Group, **Then** the system persists this under `configuredQuota`, derives the pacing interval under `schedulingHint`, and does not claim `providerQuota.isVerified = true`.
2. **Given** the Quota Status API endpoint (`/api/quota-status`), **When** queried, **Then** the response provides a structured hierarchy separating Quota Group aggregate metrics (RPM/TPM/RPD usage, group state) from individual key health records (health state, cooldown remaining, last used timestamp, error count).
3. **Given** the frontend Quota Panel, **When** rendered, **Then** visual metrics clearly label whether quota limits are default tier heuristics, user configurations, or verified provider constraints.

---

### Edge Cases

- **Unassigned / Single-Key Legacy Configurations**: When keys are provided without explicit group metadata (e.g. legacy plain key list), the system MUST auto-assign each distinct key to a standalone Quota Group (or synthesize a default group) with conservative default limits (15 RPM) to guarantee backward compatibility without crashing.
- **Total Quota Exhaustion Across All Groups**: When all Quota Groups have exceeded RPM/TPM/RPD or are in cooldown, the scheduler MUST return a structured, non-fatal retryable response indicating `retryAfterSec` derived from the earliest recovering Quota Group.
- **Empty Quota Groups**: If a Quota Group contains zero keys or only permanently disabled keys, it MUST be excluded during the Quota Group Eligibility phase without causing unhandled exceptions.
- **Dynamic Group Reconfiguration**: If a user reassigns a key from Project A to Project B at runtime, the system MUST cleanly migrate key health tracking to the new group without corrupting existing sliding window counters.
- **Gateway Abuse Rate Limiter Isolation**: The Express gateway rate limiter (60 requests/minute/IP) MUST remain strictly decoupled from the internal Gemini Quota Group scheduling engine.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST introduce a first-class `QuotaGroup` abstraction that aggregates one or more API keys under a shared project identity with unified quota tracking (RPM, TPM, RPD).
- **FR-002**: Quota usage accounting (sliding-window RPM, sliding-window TPM, and daily PST midnight RPD) MUST be recorded and enforced at the `QuotaGroup` level rather than assuming per-key independent capacity.
- **FR-003**: The system MUST strictly classify all quota and rate limit data into four distinct categories without conflating them:
  - `providerQuota`: Official, provider-confirmed quota limits from Google API documentation or metadata.
  - `configuredQuota`: Limits explicitly entered or customized by the user.
  - `observedUsage`: Empirical request counts, token volumes, and error occurrences observed at runtime.
  - `schedulingHint`: Internal pacing intervals, safety floors, and scheduling delays derived by the system.
- **FR-004**: The system MUST NEVER set `providerQuota.isVerified = true` or treat user-configured RPM/TPM values as confirmed upstream provider limits.
- **FR-005**: The request dispatch pipeline MUST follow the strict sequential scheduler lifecycle:
  1. **Model Compatibility**: Verify model availability and capabilities.
  2. **Quota Group Eligibility**: Filter out groups with exhausted RPM/TPM/RPD, active group cooldown, or no healthy keys.
  3. **Quota Group Scoring**: Rank eligible groups based on remaining quota capacity, idle duration, and error penalty.
  4. **Key Health Selection**: Within the top-scoring Quota Group, select the best candidate key based on health state (`Healthy` > `Degraded`), cooldown status, and least-recently-used timestamp.
  5. **Upstream Dispatch & Telemetry**: Dispatch the request to Google GenAI, update group usage counters, and record key-level attempt statistics.
- **FR-006**: The scheduler MUST support multiple distinct Quota Groups (multi-project architecture) and allow independent parallel capacity utilization across groups.
- **FR-007**: Individual API keys MUST retain dedicated health tracking, including `KeyHealthState` (`Healthy`, `Degraded`, `RateLimited`, `QuotaExhausted`, `AuthFailed`, `Cooldown`, `Disabled`), circuit breaker status, cooldown expiration timestamps, last used timestamps, and attempt counts.
- **FR-008**: An authentication failure (401/403 Invalid API Key) or transient network error on a specific key MUST only transition that specific key's health state, leaving sibling keys in the same Quota Group active.
- **FR-009**: A 429 RateLimit response indicating project-wide capacity exhaustion MUST trigger group-level cooldown and immediate failover rotation to an alternate eligible Quota Group if available.
- **FR-010**: The server Quota Telemetry API (`/api/quota-status`) and frontend Quota Panel MUST expose metrics organized by Quota Group with nested individual key health details.

### Key Entities *(include if feature involves data)*

- **QuotaGroup**: Represents a project or quota bucket. Contains `id`, `projectId` (optional label/id), `name`, `keyIds` (list of key identifiers associated with this group), `configuredLimits` (user-configured RPM, TPM, RPD), `observedUsage` (requestsThisMinute, tokensThisMinute, requestsToday, errorsToday), `groupHealthState` (`Available`, `RateLimited`, `Exhausted`, `InCooldown`, `NoHealthyKeys`), and `nextAllowedTimeMs`.
- **ApiKeyEntry**: Represents an individual API key credential. Contains `id` (hash or masked identifier), `groupId` (associated Quota Group), `healthState` (`Healthy`, `Degraded`, `RateLimited`, `QuotaExhausted`, `AuthFailed`, `Cooldown`, `Disabled`), `circuitBreaker` (`Closed`, `Open`, `HalfOpen`), `cooldownUntilMs`, `lastUsedAtMs`, and `observedAttempts`.
- **QuotaDataClassification**: Structured breakdown containing:
  - `providerQuota`: Provider limits (`rpm`, `tpm`, `rpd`, `isVerified`).
  - `configuredQuota`: User inputs (`configuredRpm`, `configuredTpm`, `configuredRpd`).
  - `observedUsage`: Runtime metrics (`requestsThisMinute`, `tokensThisMinute`, `requestsToday`, `errorsTotal`).
  - `schedulingHint`: Pacing heuristics (`effectiveIntervalMs`, `safetyFloorMs`, `isCustom`).
- **SchedulerDecision**: Result of the scheduling pipeline containing `selectedGroupId`, `selectedKeyId`, `groupScore`, `pacingDelayMs`, `evaluatedGroupsCount`, `rejectedGroups` with reasons, and `retryAfterMs` if all groups are unavailable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Multiple keys assigned to the same Quota Group share 100% of their sliding-window RPM and TPM consumption; exhausting the group limit correctly halts dispatch on all member keys without causing upstream 429 errors.
- **SC-002**: Independent Quota Groups operate with 100% quota isolation; saturating one group does not degrade or delay request dispatching on other healthy groups.
- **SC-003**: 100% of individual key authentication failures (401/403) isolate the specific failed key without disabling sibling keys in the same group.
- **SC-004**: In all telemetry snapshots and API contracts, 100% of quota values are strictly partitioned into `providerQuota`, `configuredQuota`, `observedUsage`, and `schedulingHint`.
- **SC-005**: All unit, integration, and regression test suites covering multi-key shared project quota, multi-project independence, hierarchical scheduling, and key health transitions pass with 0 failures.

## Assumptions

- Free Tier Gemini projects default to 15 RPM, 1,000,000 TPM, and 1,500 RPD per Quota Group unless configured otherwise by user input.
- Pay-as-you-go / Tier 1 projects default to 60 RPM, 1,000,000 TPM, and 10,000 RPD per Quota Group.
- If the user enters a plain list of keys without specifying project IDs, the system will group keys conservatively (e.g. 1 key per group by default or assign them to a single default project group based on user preference, with 15 RPM safe default).
- Redis (when available) or in-memory sliding windows will maintain shared atomic state for Quota Group usage counters.
