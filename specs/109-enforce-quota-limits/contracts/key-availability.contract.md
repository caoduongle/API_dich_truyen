# Contract: Key Availability & Quota Enforcement API

**Module**: `src/services/localQuotaTracker.ts`

---

## 1. Interface Definitions

```typescript
import { CustomLimit } from '../components/quota-panel/CustomLimitsPanel';
import { KeyHealthState, CircuitBreakerStatus } from '../utils/apiClient';

export interface KeyHealthResult {
  state: KeyHealthState;
  circuitBreaker: CircuitBreakerStatus;
  cooldownRemainingMs: number;
  transitionReason?: string;
  isAvailable: boolean;
  isCustomLimitReached?: boolean;
}
```

## 2. Functions

### 2.1 `getKeyHealth`
```typescript
/**
 * Evaluates the live health and availability of an API key,
 * incorporating both runtime circuit-breaker state and personal custom limits.
 *
 * @param key - The raw API key string or key hash
 * @param now - Current epoch timestamp in milliseconds (defaults to Date.now())
 * @param customLimit - Optional custom limit thresholds (maxRpm, maxRpd, maxTpm)
 * @returns KeyHealthResult with availability flag and diagnostic reason
 */
public getKeyHealth(
  key: string,
  now?: number,
  customLimit?: CustomLimit
): KeyHealthResult;
```

**Semantics & Invariants**:
1. If `stats.healthState === 'AuthFailed'`, returns `isAvailable: false`, `state: 'AuthFailed'`.
2. If `customLimit?.maxRpd && stats.requestsToday >= customLimit.maxRpd`, returns `isAvailable: false`, `state: 'QuotaExhausted'`, `isCustomLimitReached: true`, `transitionReason: 'Đã chạm ngưỡng giới hạn cá nhân trong ngày (Max RPD)'`.
3. If `stats.cooldownUntil > now`, returns `isAvailable: false`, `state: stats.healthState`, `cooldownRemainingMs: stats.cooldownUntil - now`.
4. If `stats.healthState === 'QuotaExhausted'` from an upstream 429 and `lastResetDay === currentDayPST`, returns `isAvailable: false`.
5. Otherwise, if `stats.healthState === 'Healthy'` or `'Degraded'`, returns `isAvailable: true`.

---

### 2.2 `findNextAvailableKeyIndex`
```typescript
/**
 * Scans a list of candidate API keys starting from startIndex and locates
 * the first key that satisfies isAvailable === true.
 *
 * @param keys - Array of raw API keys
 * @param startIndex - Preferred starting key index (0-based)
 * @param customLimits - Dictionary of custom limits keyed by keyHash
 * @param now - Current epoch timestamp in milliseconds
 * @returns Index of the first available key, or -1 if ALL keys are unavailable
 */
public findNextAvailableKeyIndex(
  keys: string[],
  startIndex: number,
  customLimits?: Record<string, CustomLimit>,
  now?: number
): number;
```

**Semantics & Invariants**:
1. Searches cyclic range `[startIndex, startIndex + keys.length - 1] % keys.length`.
2. Evaluates `getKeyHealth(key, now, customLimits[hash])` for each candidate.
3. Returns immediately on the first available key.
4. Returns `-1` if and only if all keys are unavailable (quota exhausted, cooling down, or invalid).
