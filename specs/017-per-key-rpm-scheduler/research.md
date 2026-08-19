# Research: Quota-Aware Per-Key RPM Scheduler & Adaptive Load Balancer

## Phase 0: Technical Outline & Investigation

### 1. Problem Space Analysis

Previously, multi-key rotation had two major discrepancies between the quota telemetry model and runtime request scheduling:
1. **Uniform Pacing Interval Contamination**: When multiple API keys with different RPM capacities (e.g. Key 1 at 15 RPM Free Tier and Key 2 at 60 RPM Pay-as-you-go) were provided, the scheduler used a single uniform `customRpm` / `MIN_REQUEST_INTERVAL_MS` for all keys. High-capacity keys were artificially throttled by low-capacity intervals, and low-capacity keys risked 429 rate limit spikes if scheduled at high-capacity speeds.
2. **Coarse Key Scoring**: Candidate key evaluation ignored per-key RPM sliding window capacity, daily RPD limits, and explicit model capability verification.

---

### 2. Architectural Design Decisions

#### Decision 1: Per-Key Pacing Clocks (`nextAllowedTimeByKey`) with Variable Intervals
- **Design**: Each key maintains its own `nextAllowedTime` timestamp. The effective interval is derived from each key's individual RPM capacity or model limits:
  $$\text{Interval}_{\text{key}} = \max\left(400\text{ ms}, \left\lceil \frac{60000}{\text{RPM}_{\text{key}} \times 0.9} \right\rceil\right)$$
- **Behavior**:
  - Key A (15 RPM) -> Interval ~4,445 ms
  - Key B (60 RPM) -> Interval ~1,112 ms
  - When Key B executes, only Key B's `nextAllowedTime` advances by 1,112 ms. Key A remains immediately available (`waitDelay = 0`).

#### Decision 2: Multi-Stage Deterministic Candidate Filtering
- **Design**: Candidate keys pass through a 6-stage filter before scoring:
  1. `Disabled` / `AuthFailed` filter (401/403 status).
  2. Active cooldown & open circuit breaker filter (`cooldownUntil > now`).
  3. Model capability filter (filters out keys verified not to support requested model).
  4. Per-key sliding window RPM limit (`requestsThisMinute >= keyRpm`).
  5. Per-key sliding window TPM limit (`tokensThisMinute + estimatedTokens >= maxTpm * 0.95`).
  6. Per-key daily RPD limit (`requestsToday >= maxRpd`).

#### Decision 3: Multi-Factor Composite Scoring for Natural Load Balancing
- **Design**: Remaining eligible keys are scored using:
  - **Remaining Capacity**: Proportional remaining RPM and TPM in the current 60s sliding window.
  - **Idle Duration (`now - lastUsedAt`)**: Rewards least-recently-used keys to ensure natural round-robin load distribution across equal-tier keys.
  - **Pacing Readiness**: Prioritizes keys ready immediately (`nextAllowedTime <= now`) over keys with pending pacing delays.
  - **Error History**: Penalizes keys with recent consecutive errors.

#### Decision 4: Gateway Abuse Protection Decoupling
- **Design**: Maintain `express-rate-limit` (60 req/min/IP) unchanged at the HTTP gateway layer. Per-key RPM scheduling strictly controls downstream Google Gemini API dispatches.
