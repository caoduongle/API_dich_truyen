# Phase 1: Data Model & State Specifications

**Feature**: `098-hako-quota-estimation-warning`  
**Date**: 2026-09-10

## 1. Internal Quota Advisory State

```typescript
export interface ChapterQuotaAdvisory {
  /** Estimated number of Gemini API calls required (equal to selectedChapterIds.length) */
  estimatedCalls: number;

  /** True if available quota across keys may not suffice for estimatedCalls */
  hasQuotaRisk: boolean;

  /** Human-readable advisory warning message in Vietnamese */
  warningMessage: string | null;

  /** Count of currently active, non-exhausted API keys */
  availableKeysCount: number;

  /** Total configured keys detected */
  totalKeysCount: number;
}
```

## 2. Evaluation Logic

Given:
- $N = \text{selectedChapterIds.length}$
- `keys = effectiveApiKeys`
- `quotaSnapshot = localQuotaTracker.getQuotaStatus(keys)`

Attributes:
1. `estimatedCalls`: $N$
2. `totalKeysCount`: `quotaSnapshot.keys.length`
3. `availableKeysCount`: Count of keys where `k.runtime.isBlacklisted === false` and `k.healthState !== 'QuotaExhausted' && k.healthState !== 'AuthFailed'`
4. `hasQuotaRisk`:
   - If $N == 0 \implies \text{false}$
   - If `totalKeysCount == 0` or `availableKeysCount == 0` $\implies \text{true}$
   - If any key has `k.healthState === 'QuotaExhausted'` $\implies \text{true}$
   - If sum of remaining estimated calls across available keys $< N \implies \text{true}$
5. `warningMessage`:
   - If `hasQuotaRisk`: `"Quota khả dụng có thể không đủ cho toàn bộ " + N + " chương đã chọn"`
   - Else: `null`

## 3. Component State Integration in `HakoChapterSelector`

- Derived purely via `useMemo` based on `selectedChapterIds.length` and `effectiveApiKeys`:
  ```typescript
  const quotaAdvisory = useMemo<ChapterQuotaAdvisory>(() => {
    // computes advisory state synchronously
  }, [selectedChapterIds.length, effectiveApiKeys]);
  ```
- No extra state variables needed; zero asynchronous lag.
