# Feature Specification: Key Health State Machine & Recovery Engine

**Feature Branch**: `020-key-health-state-machine`

**Created**: 2026-08-20

**Status**: Draft

**Input**: User request: "TASK 07 — ĐỔI BLACKLIST/COOLDOWN THÀNH KEY HEALTH STATE. Mục tiêu: Hiện blacklistedKeys thực chất gần với temporary cooldown/quarantine hơn circuit breaker chuẩn. Không cần viết circuit breaker quá phức tạp. Hãy chuẩn hóa thành state machine rõ ràng: HEALTHY, DEGRADED, RATE_LIMITED, QUOTA_EXHAUSTED, AUTH_FAILED, COOLDOWN, DISABLED. Requirements: Mỗi transition phải có nguyên nhân: 429, 401/403, 5xx, network, quota, manual disable, recovery. State phải có recovery policy: AUTH_FAILED -> không tự quay lại Healthy; COOLDOWN -> tự recover sau TTL; RATE_LIMITED -> recover sau cooldown; QUOTA_EXHAUSTED -> recover theo quota window. UI: Nếu key health UI đã tồn tại, hiển thị state thực. Không tạo một bộ màu/design mới ngoài design system. Tests: Test state transition và recovery."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Deterministic Key Health State Machine Transitions (Priority: P1) 🎯 MVP

As an AI translation scheduler managing multiple Gemini API keys, I want each key to be governed by an explicit State Machine (`HEALTHY`, `DEGRADED`, `RATE_LIMITED`, `QUOTA_EXHAUSTED`, `AUTH_FAILED`, `COOLDOWN`, `DISABLED`) with every transition recording a specific triggering cause (e.g. 429 RPM/TPM, 401/403 Auth, 5xx Overload, Network failure, Daily quota, Manual disable), so that key health is transparent, deterministic, and free of redundant ad-hoc blacklist maps.

**Why this priority**: Consolidates multiple disconnected cooldown/blacklist tracking mechanisms into a single source of truth in `quotaService.ts`, ensuring predictable rotation and preventing deadlocks.

**Independent Test**: Simulate each failure trigger (401, 429, 503, RPD exhaustion, network timeout, manual disable) and assert that the key transitions to the exact corresponding health state and records the correct transition cause and cooldown timestamp.

**Acceptance Scenarios**:

1. **Given** a `HEALTHY` key receiving a 401/403 `AUTH_FAILED` error, **When** recorded, **Then** state transitions to `AUTH_FAILED`, `isAvailable = false`, and records `reason = '401/403: API Key Invalid / Permission Denied'`.
2. **Given** a `HEALTHY` key receiving a 429 `RATE_LIMITED` error, **When** recorded, **Then** state transitions to `RATE_LIMITED`, `isAvailable = false`, and sets `cooldownUntil = timestamp + retryAfterMs`.
3. **Given** a `HEALTHY` key receiving daily quota exhaustion (RPD), **When** recorded, **Then** state transitions to `QUOTA_EXHAUSTED`, `isAvailable = false`, with recovery bound to the PST daily reset window.
4. **Given** a `HEALTHY` key encountering a 503 `OVERLOADED` or network timeout, **When** recorded, **Then** state transitions to `COOLDOWN`, setting a short TTL cooldown (3–8s).
5. **Given** a key with isolated transient errors below the failure threshold, **When** recorded, **Then** state transitions to `DEGRADED` but remains `isAvailable = true` with lower candidate score.

---

### User Story 2 - State Machine Recovery Policies (Priority: P2)

As a background translation worker, I want each non-terminal health state to execute its designated recovery policy upon cooldown expiry or success probes, so that keys return to `HEALTHY` automatically when safe while permanently invalid keys remain disabled.

**Why this priority**: Prevents unusable keys from polluting rotations while allowing transiently rate-limited or overloaded keys to seamlessly resume processing without manual intervention.

**Independent Test**: Advance time or trigger events for each state and verify that:
- `COOLDOWN` and `RATE_LIMITED` recover to `HEALTHY` once their TTL has elapsed.
- `QUOTA_EXHAUSTED` recovers to `HEALTHY` when the midnight America/Los_Angeles rollover occurs.
- `AUTH_FAILED` and `DISABLED` do NOT automatically recover until explicitly updated or re-enabled.
- `DEGRADED` recovers to `HEALTHY` after successful consecutive requests.

**Acceptance Scenarios**:

1. **Given** a key in `COOLDOWN` or `RATE_LIMITED` with `cooldownUntil = T`, **When** queried at time $t \ge T$, **Then** state automatically recovers to `HEALTHY` and `isAvailable = true`.
2. **Given** a key in `AUTH_FAILED`, **When** queried at any subsequent time $t \gg T$, **Then** state remains `AUTH_FAILED` and does not auto-recover.
3. **Given** a key in `QUOTA_EXHAUSTED` from Day 1, **When** evaluated on Day 2 in `America/Los_Angeles`, **Then** state transitions to `HEALTHY`.
4. **Given** a key in `DEGRADED`, **When** a successful translation request is processed on that key, **Then** consecutive success counter increments and returns state to `HEALTHY`.

---

### User Story 3 - Unification of Runtime Status & UI Dashboard Telemetry (Priority: P3)

As a developer or user monitoring API keys in the Quota dashboard, I want the UI to display the exact live health state of each key (`HEALTHY`, `DEGRADED`, `RATE_LIMITED`, `QUOTA_EXHAUSTED`, `AUTH_FAILED`, `COOLDOWN`, `DISABLED`) along with transition reasons and countdown timers using existing Design System badges, with zero ad-hoc "blacklist" terminology.

**Why this priority**: Eliminates confusing and legacy "blacklisted" labels in favor of standard operational telemetry and clear status feedback.

**Independent Test**: Render `QuotaPanel` with keys in various health states (`Healthy`, `Cooldown`, `RateLimited`, `QuotaExhausted`, `AuthFailed`), verify that each key renders the corresponding Design System Badge and countdown without style regressions.

**Acceptance Scenarios**:

1. **Given** a key in `RateLimited` state, **When** rendered in `QuotaPanel`, **Then** it displays a warning Badge with remaining cooldown and reason.
2. **Given** a key in `AuthFailed` state, **When** rendered in `QuotaPanel`, **Then** it displays an error Badge indicating invalid credentials.
3. **Given** a key in `Healthy` state, **When** rendered in `QuotaPanel`, **Then** it displays the standard "Hoạt động" polish Badge.

---

### Edge Cases

- **Manual Key Update / Reset**: If user replaces an invalid API key with a new valid string, its state must immediately reset to `HEALTHY`.
- **Clock Skew / Future Timestamps**: If timestamps are shifted or invalid, cooldown calculation defaults safely to minimum safety floors without throwing exceptions.
- **Simultaneous Multiple Errors**: The most severe state takes precedence (`AUTH_FAILED` > `QUOTA_EXHAUSTED` > `RATE_LIMITED` > `COOLDOWN` > `DEGRADED`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `KeyHealthState` MUST be standardized to the canonical states:
  - `'Healthy'`
  - `'Degraded'`
  - `'RateLimited'`
  - `'QuotaExhausted'`
  - `'AuthFailed'`
  - `'Cooldown'`
  - `'Disabled'`
- **FR-002**: Every health state transition in `quotaService.ts` MUST record a transition cause (`transitionReason`) and transition timestamp (`lastTransitionAt`).
- **FR-003**: The following transition triggers MUST be supported:
  - `401 / 403` -> `AuthFailed` (permanent, non-auto-recovering)
  - `429 (RPM/TPM)` -> `RateLimited` (auto-recovers after `retryAfterSec` or 5s)
  - `429 (RPD Daily)` -> `QuotaExhausted` (auto-recovers at midnight America/Los_Angeles)
  - `503 / 5xx / Network / Timeout` -> `Cooldown` (auto-recovers after short TTL 3–8s)
  - `Consecutive Successes` -> `Healthy`
  - `Manual Disable / Enable` -> `Disabled` / `Healthy`
- **FR-004**: `geminiService.ts` MUST remove the legacy `blacklistedKeys` map and delegate 100% of key availability and cooldown checks to `quotaService.getKeyHealth(key)`.
- **FR-005**: `getKeyRuntimeStatus(key)` in `geminiService.ts` MUST query `quotaService.getKeyHealth(key)` and return `{ state, reason, cooldownRemainingMs, isAvailable }` with backward-compatible aliases.
- **FR-006**: `QuotaPanel.tsx` MUST display the actual live state (`Healthy`, `Degraded`, `RateLimited`, `QuotaExhausted`, `AuthFailed`, `Cooldown`, `Disabled`) using existing Design System badge components (`Badge` with tones `polish`, `warning`, `neutral`).
- **FR-007**: Zero new styling frameworks or colors outside `.agents/rules/design-system.md` may be introduced.

### Key Entities

- **KeyHealthRecord**:
  ```typescript
  export interface KeyHealthRecord {
    state: KeyHealthState;
    isAvailable: boolean;
    transitionReason?: string;
    lastTransitionAt: number;
    cooldownUntil: number;
    cooldownRemainingMs: number;
    consecutiveErrors: number;
    consecutiveSuccesses: number;
  }
  ```

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of key availability and cooldown checks in `geminiService.ts` are sourced from `quotaService.getKeyHealth(key)` (0 references to legacy `blacklistedKeys` map).
- **SC-002**: Every state transition records its specific cause (`transitionReason`) and timestamp.
- **SC-003**: Unit tests verify 100% of state transitions and recovery policies (including non-recovery of `AUTH_FAILED`).
- **SC-004**: Full test suite (`npm test`), lint (`npm run lint`), and build (`npm run build`) pass with 0 errors.
