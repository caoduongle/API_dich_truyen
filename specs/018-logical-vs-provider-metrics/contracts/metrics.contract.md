# Contract: Logical Requests & Provider Attempts API

## 1. Recording Contract (`quotaService.ts`)

```typescript
export interface RecordLogicalParams {
  modelName: string;
  status: 'success' | 'failure';
  attemptsCount: number;
  retriesCount: number;
  timestamp?: number;
}

export function recordLogicalRequest(
  modelName: string,
  status: 'success' | 'failure',
  attemptsCount: number,
  retriesCount: number,
  timestamp?: number
): void;
```

### Invariants
1. For any logical translation request: $\text{retriesCount} = \max(0, \text{attemptsCount} - 1)$.
2. For single attempt success: `logicalRequests = 1`, `providerAttempts = 1`, `retries = 0`, `successfulRequests = 1`.
3. For rotation success after 3 attempts: `logicalRequests = 1`, `providerAttempts = 3`, `retries = 2`, `successfulRequests = 1`.
4. For all attempts fail (e.g. 3 attempts): `logicalRequests = 1`, `providerAttempts = 3`, `retries = 2`, `failedRequests = 1`.
5. Midnight reset in `America/Los_Angeles` timezone resets both logical `*Today` and provider `*Today` counters.
