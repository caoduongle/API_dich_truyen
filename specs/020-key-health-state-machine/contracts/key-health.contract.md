# Contract: Key Health State Machine & Recovery Engine

## 1. Key Health Service Methods (`server/services/quotaService.ts`)

```typescript
export interface IKeyHealthManager {
  getKeyHealth(key: string, now?: number): KeyHealthRecord;
  recordCategorizedError(key: string, modelName: string, error: AIErrorNormalized, timestamp?: number): void;
  recordUsage(key: string, modelName: string, outcome: 'success' | 'error' | 'overloaded', timestamp?: number, tokens?: { promptTokens: number; outputTokens: number; totalTokens: number }): void;
  setKeyDisabled(key: string, disabled: boolean, reason?: string): void;
}
```

### Invariants
1. When `healthState` is `AuthFailed` or `Disabled`, `isAvailable` MUST be `false` and MUST NOT auto-recover.
2. When `healthState` is `RateLimited` or `Cooldown`, if `now >= cooldownUntil`, state transitions to `Healthy` and `isAvailable` becomes `true`.
3. When `healthState` is `QuotaExhausted`, if `lastResetDay !== currentDayPST`, state transitions to `Healthy` and `requestsToday` is reset to 0.
4. Every state transition updates `transitionReason` and `lastTransitionAt`.
