# Data Model: Key Health State Machine & Recovery Engine

## 1. Entities & Type Definitions

### 1.1 `KeyHealthState`

```typescript
export type KeyHealthState =
  | 'Healthy'
  | 'Degraded'
  | 'RateLimited'
  | 'QuotaExhausted'
  | 'AuthFailed'
  | 'Cooldown'
  | 'Disabled';
```

---

### 1.2 `KeyHealthRecord` & `KeyRuntimeStatus`

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

export interface KeyRuntimeStatus {
  isBlacklisted: boolean;          // Backward compatible alias for !isAvailable
  blacklistRemainingMs: number;    // Backward compatible alias for cooldownRemainingMs
  isRateLimited: boolean;
  nextAllowedRemainingMs: number;
  healthState: KeyHealthState;
  transitionReason?: string;
}
```

---

### 1.3 Per-Key Internal Stats (`KeyUsageStatsInternal`)

```typescript
export interface KeyUsageStatsInternal {
  requestsTotal: number;
  requestsToday: number;
  errorsTotal: number;
  tokensTotal: number;
  tokensToday: number;
  lastResetDay: string;
  byModel: Map<string, ModelUsageStatsInternal>;
  slidingWindow: SlidingWindowRequest[];
  lastUsedAt: number;
  healthState: KeyHealthState;
  transitionReason?: string;
  lastTransitionAt: number;
  cooldownUntil: number;
  consecutiveErrors: number;
  consecutiveSuccesses: number;
  disabledReason?: string;
}
```
