# Data Model: Logical vs Provider Metrics

## 1. Entities & Schema

### 1.1 LogicalSummaryStats

```typescript
export interface LogicalSummaryStats {
  logicalRequestsTotal: number;
  logicalRequestsToday: number;
  successfulRequestsTotal: number;
  successfulRequestsToday: number;
  failedRequestsTotal: number;
  failedRequestsToday: number;
  retriesTotal: number;
  retriesToday: number;
  providerAttemptsTotal: number;
  providerAttemptsToday: number;
  successfulAttemptsTotal: number;
  successfulAttemptsToday: number;
  failedAttemptsTotal: number;
  failedAttemptsToday: number;
  lastResetDay: string;
}
```

---

### 1.2 ModelLogicalStats

```typescript
export interface ModelLogicalStats {
  logicalRequestsTotal: number;
  logicalRequestsToday: number;
  successfulRequestsTotal: number;
  successfulRequestsToday: number;
  failedRequestsTotal: number;
  failedRequestsToday: number;
  retriesTotal: number;
  retriesToday: number;
  lastResetDay: string;
}
```

---

### 1.3 KeyQuotaSnapshot (Enhanced with Provider Semantics)

```typescript
export interface KeyQuotaSnapshot {
  keyHash: string;
  maskedKey: string;
  healthState: KeyHealthState;
  circuitBreakerState: CircuitBreakerStatus;
  cooldownRemainingMs: number;
  
  // Provider Attempt Metrics (Aliased with requestsTotal/requestsToday for compatibility)
  providerAttemptsTotal: number;
  providerAttemptsToday: number;
  providerAttemptsThisMinute: number;
  requestsTotal: number;          // Backward-compatible alias
  requestsToday: number;          // Backward-compatible alias
  requestsThisMinute: number;     // Backward-compatible alias
  
  errorsTotal: number;
  consecutiveErrors: number;
  tokensTotal: number;
  tokensToday: number;
  tokensThisMinute: number;
  byModel: Record<string, ModelUsageStats>;
  lastRequestTimestamp?: number;
}
```

---

### 1.4 QuotaStatusResponsePayload

```typescript
export interface QuotaStatusResponse {
  keys: KeyQuotaSnapshot[];
  summary: LogicalSummaryStats;
  byModel: Record<string, ModelUsageStats>;
  timestamp: number;
}
```
