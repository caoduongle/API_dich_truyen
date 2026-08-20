# Research: Project & Quota Group Scheduler Architecture

## Phase 0: Technical Outline & Architecture Investigation

### 1. Problem Space Analysis & Current Limitations

The existing codebase was originally built around the assumption that each API key represents an isolated quota bucket with independent RPM, TPM, and RPD limits. However, according to official Google Gemini API architecture:
1. **Rate Limits Are Enforced Per Project**: Gemini API rate limits (RPM, TPM, RPD) are enforced at the Google Cloud / AI Studio **Project level**, not per individual API key.
2. **False Scaling Hazard**: Having 4 API keys from the same project does NOT provide $4 \times 15 = 60$ RPM. Attempting to schedule them as 4 independent 15 RPM keys leads to burst congestion and frequent `429 RESOURCE_EXHAUSTED` errors.
3. **Data Conflation**: User-configured limits, default model heuristics, empirical request counts, and internal pacing hints were previously mixed or conflated as "provider limits".

---

### 2. Architectural Design Decisions

#### Decision 1: Project / Quota Group Abstraction Hierarchy
- **Design**: Introduce a first-class `QuotaGroup` abstraction representing a Google Cloud Project / Quota Bucket.
  ```text
  Project / Quota Group (Shared RPM, TPM, RPD, sliding windows, group pacing)
          │
          ├── API Key 1 (Health State, Cooldown, Auth Status, Last Used, Attempts)
          └── API Key 2 (Health State, Cooldown, Auth Status, Last Used, Attempts)
  ```
- **Rationale**: Multiple keys created within the same project share that project's quota. Quota accounting must occur at the group level, while health and authentication remain key-specific.
- **Alternatives Considered**:
  - *Keep per-key quota and add a project label*: Rejected because it maintains the flawed assumption that keys have independent quota counters.
  - *Strict 1 key per project only*: Rejected because users legitimately have multiple keys for redundancy, rotation, or key rollover.

#### Decision 2: Strict Four-Tier Quota Data Classification
- **Design**: All quota and rate limit data in the backend, API contracts, and frontend must be strictly partitioned into four categories:
  1. `providerQuota`: Official limits confirmed by Google API documentation/metadata (`rpm`, `tpm`, `rpd`, `isVerified: boolean`). `isVerified` is `false` by default.
  2. `configuredQuota`: Limits explicitly entered or customized by the user (`configuredRpm`, `configuredTpm`, `configuredRpd`).
  3. `observedUsage`: Empirical runtime metrics (`requestsThisMinute`, `tokensThisMinute`, `requestsToday`, `errorsTotal`).
  4. `schedulingHint`: Internal derived pacing intervals (`effectiveIntervalMs`, `safetyFloorMs`, `isCustom`).
- **Rule**: User-configured RPM is NEVER treated as confirmed provider quota (`providerQuota.isVerified` remains `false`).

#### Decision 3: Hierarchical Scheduler Dispatch Pipeline
- **Design**: The dispatch pipeline executes a 5-step hierarchical algorithm:
  $$\text{Request} \longrightarrow \text{Model Compatibility} \longrightarrow \text{Quota Group Eligibility} \longrightarrow \text{Quota Group Scoring} \longrightarrow \text{Key Health Selection} \longrightarrow \text{Dispatch}$$
  1. **Model Compatibility**: Match request with available model capabilities.
  2. **Quota Group Eligibility**:
     - Check group sliding window RPM (`groupRequestsThisMinute < groupRpm`).
     - Check group sliding window TPM (`groupTokensThisMinute + estimatedTokens < groupTpm * 0.95`).
     - Check group daily RPD (`groupRequestsToday < groupRpd`).
     - Check group cooldown (`groupCooldownUntil <= now`).
     - Check that group contains at least one healthy/available key.
  3. **Quota Group Scoring**:
     - Score based on remaining RPM/TPM capacity, idle time (`now - groupLastUsedAt`), and group error penalties.
  4. **Key Health Selection (Within Top Group)**:
     - Filter candidate keys in the group: exclude `AuthFailed`, `Disabled`, or active key `Cooldown`.
     - Score keys by health tier (`Healthy` > `Degraded`) and idle time (`now - keyLastUsedAt`).
  5. **Dispatch & Pacing**:
     - Atomically advance `groupNextAllowedTime`.
     - Dispatch request to Gemini SDK.
     - On success: Record tokens and requests to group observed usage; update key's `lastUsedAt`.
     - On 401/403: Mark specific key as `AuthFailed`/`Disabled`; keep sibling keys and group active.
     - On 429: Mark Quota Group as in group cooldown; rotate to next eligible Quota Group.

#### Decision 4: Multi-Project Support & Isolation
- **Design**: The scheduler supports $N$ distinct Quota Groups (e.g. Project Alpha with Keys A1, A2; Project Beta with Keys B1, B2).
- **Behavior**:
  - Independent project groups maintain independent sliding windows and pacing clocks.
  - Saturated or exhausted groups are bypassed, allowing healthy groups to process requests immediately without cross-project throttling.
  - Multi-project setups achieve genuine linear throughput scaling ($\sum \text{RPM}_{\text{group}}$).

---

### 3. Verification & Test Strategy

To satisfy all mandatory test cases:
1. **Two keys same project**: Both keys share sliding window RPM/TPM; exhausting limit blocks both.
2. **Two keys different projects**: Independent sliding windows; saturating Project A leaves Project B unblocked.
3. **Key auth failure**: Key A1 gets 401/403 -> Key A1 disabled; Key A2 in Project A continues successfully.
4. **Key temporary cooldown**: Key A1 gets transient 503 -> Key A1 cooling; Key A2 handles next request.
5. **Group exhausted**: Group A hits 15 RPM -> Group A marked exhausted; scheduler selects Group B.
6. **Group available**: When Group A's 60s sliding window clears, it becomes available again.
