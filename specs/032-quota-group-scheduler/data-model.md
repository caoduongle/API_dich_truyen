# Data Model: Project & Quota Group Scheduler Architecture

## Phase 1: Entity Definitions & Data Architecture

### 1. Entity Hierarchy & Schemas

```text
┌────────────────────────────────────────────────────────┐
│                      QuotaGroup                        │
│  - id: string (unique identifier)                      │
│  - projectId?: string (Google Cloud project ID/label)  │
│  - name?: string (User-friendly label)                 │
│  - keyIds: string[] (Member API key hashes/IDs)        │
│  - configuredLimits: ConfiguredQuota                   │
│  - providerQuota: ProviderQuota                        │
│  - observedUsage: GroupObservedUsage                   │
│  - schedulingHint: GroupSchedulingHint                 │
│  - healthState: GroupHealthState                       │
│  - cooldownUntilMs: number                             │
│  - nextAllowedTimeMs: number                           │
└───────────────────────────┬────────────────────────────┘
                            │ 1 : N
                            ▼
┌────────────────────────────────────────────────────────┐
│                      ApiKeyEntity                      │
│  - id: string (Key hash or masked identifier)          │
│  - groupId: string (Associated QuotaGroup ID)          │
│  - rawKeyMasked: string                                │
│  - healthState: KeyHealthState                         │
│  - circuitBreaker: CircuitBreakerStatus                │
│  - cooldownUntilMs: number                             │
│  - lastUsedAtMs: number                                │
│  - observedAttempts: KeyObservedAttempts               │
└────────────────────────────────────────────────────────┘
```

---

### 2. Detailed TypeScript Interfaces

```typescript
/** 4-Tier Quota Data Classification */

export interface ProviderQuota {
  rpm: number;
  tpm: number;
  rpd?: number;
  isVerified: boolean; // Must be false unless verified via official provider API metadata
  verifiedAt?: string;
}

export interface ConfiguredQuota {
  configuredRpm?: number;
  configuredTpm?: number;
  configuredRpd?: number;
  customPacingFloorMs?: number;
}

export interface GroupObservedUsage {
  requestsTotal: number;
  requestsToday: number;
  requestsThisMinute: number;
  tokensTotal: number;
  tokensToday: number;
  tokensThisMinute: number;
  errorsTotal: number;
  errorsToday: number;
  lastRequestTimestamp: number;
}

export interface GroupSchedulingHint {
  effectiveIntervalMs: number;
  safetyFloorMs: number;
  isCustom: boolean;
  estimatedThroughputRpm: number;
}

/** Group & Key Health State Enums */

export type GroupHealthState =
  | 'Available'
  | 'RateLimited'
  | 'Exhausted'
  | 'InCooldown'
  | 'NoHealthyKeys'
  | 'Disabled';

export type KeyHealthState =
  | 'Healthy'
  | 'Degraded'
  | 'RateLimited'
  | 'QuotaExhausted'
  | 'AuthFailed'
  | 'Cooldown'
  | 'Disabled';

export type CircuitBreakerStatus = 'Closed' | 'Open' | 'HalfOpen';

/** Core QuotaGroup Structure */

export interface QuotaGroup {
  id: string;
  projectId?: string;
  name?: string;
  keyIds: string[];
  configuredLimits: ConfiguredQuota;
  providerQuota: ProviderQuota;
  observedUsage: GroupObservedUsage;
  schedulingHint: GroupSchedulingHint;
  healthState: GroupHealthState;
  cooldownUntilMs: number;
  nextAllowedTimeMs: number;
  callLog: Array<{ timestamp: number; tokens: number }>;
}

/** Individual API Key Entity */

export interface KeyObservedAttempts {
  attemptsTotal: number;
  attemptsToday: number;
  successfulAttempts: number;
  failedAttempts: number;
  lastErrorCode?: string | null;
  consecutiveFailures: number;
}

export interface ApiKeyEntity {
  id: string; // key hash / identifier
  groupId: string;
  maskedKey: string;
  healthState: KeyHealthState;
  circuitBreaker: CircuitBreakerStatus;
  circuitBreakerFailures: number;
  cooldownUntilMs: number;
  lastUsedAtMs: number;
  transitionReason?: string;
  observedAttempts: KeyObservedAttempts;
}
```

---

### 3. Scheduler Data Structures

```typescript
export interface GroupScoreCandidate {
  group: QuotaGroup;
  isEligible: boolean;
  rejectReason?: string;
  remainingRpm: number;
  remainingTpm: number;
  idleDurationMs: number;
  score: number;
}

export interface KeyScoreCandidate {
  key: ApiKeyEntity;
  rawKey: string;
  isEligible: boolean;
  rejectReason?: string;
  idleDurationMs: number;
  score: number;
}

export interface SchedulerDecision {
  selectedGroupId: string;
  selectedKeyId: string;
  selectedRawKey: string;
  pacingDelayMs: number;
  groupScore: number;
  keyScore: number;
  evaluatedGroups: Array<{ id: string; isEligible: boolean; score: number; rejectReason?: string }>;
}
```

---

### 4. State Transitions

#### A. QuotaGroup Lifecycle
- `Available` $\xrightarrow{\text{Minute requests} \ge \text{RPM}}$ `RateLimited` (recovers when 60s sliding window passes).
- `Available` $\xrightarrow{\text{Tokens} \ge \text{TPM} \times 0.95}$ `RateLimited` (recovers when 60s sliding window passes).
- `Available` $\xrightarrow{\text{Daily requests} \ge \text{RPD}}$ `Exhausted` (recovers at PST midnight).
- `Available` $\xrightarrow{\text{Upstream 429 Quota Exceeded}}$ `InCooldown` (recovers when `groupCooldownUntil <= now`).
- `Available` $\xrightarrow{\text{All member keys disabled/cooling}}$ `NoHealthyKeys` (recovers when a member key becomes healthy).

#### B. ApiKeyEntity Lifecycle
- `Healthy` $\xrightarrow{\text{Consecutive errors} \ge 2}$ `Degraded`.
- `Healthy` / `Degraded` $\xrightarrow{401 / 403 \text{ Invalid Key}}$ `AuthFailed` (permanent until user updates key).
- `Healthy` / `Degraded` $\xrightarrow{\text{Transient } 503 / \text{Timeout}}$ `Cooldown` (temporary, e.g. 10s - 30s).
- `Cooldown` $\xrightarrow{\text{cooldown expired}}$ `Healthy` (or HalfOpen circuit test).
- `Healthy` / `Degraded` $\xrightarrow{\text{User toggles off}}$ `Disabled`.
