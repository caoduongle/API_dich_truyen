# Contract: Key Scheduler & Candidate Evaluation Engine

## 1. Key Scheduling Service Interfaces (`server/services/quotaService.ts` & `server/services/geminiService.ts`)

```typescript
export interface KeyScheduleOptions {
  modelName: string;
  estimatedTokens?: number;
  perKeyRpm?: Record<string, number>;
  customRpm?: number;
  now?: number;
}

export function evaluateAndScheduleKey(
  apiKeys: string[],
  options: KeyScheduleOptions
): KeySchedulerResult;
```

### Invariants
1. If `apiKeys` has keys with varying RPM configurations (e.g. Key A at 15 RPM, Key B at 60 RPM), each key calculates and tracks its own `nextAllowedTime` independently.
2. Incompatible keys (unsupported model, open circuit breaker, auth failure, RPM/TPM/RPD limit reached) are marked `isEligible: false` with explicit `rejectReason`.
3. Eligible keys are sorted by composite `score` descending. Top scoring key is returned as `selectedKey`.
4. If all keys are ineligible, the scheduler throws/returns an informative `AllKeysExhaustedError` with `retryAfterSec`.
