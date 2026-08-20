# Data Model & Metrics Specifications

**Feature**: `047-clean-legacy-metrics`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Cấu Trúc Dữ Liệu TypeScript Trong `shared/models.ts`

### 1.1 Hoạt Động Khóa Chuẩn Tắc (`KeyActivityMetrics`)
```typescript
export interface KeyActivityMetrics {
  keyAttempts: number;
  keyFailures: number;
  keyCooldowns: number;
}
```

### 1.2 Yêu Cầu Logic Chuẩn Tắc (`LogicalUsageStats`)
```typescript
export interface LogicalUsageStats {
  logicalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  consecutiveFailures: number;
  lastFailureAt: number;
  lastErrorCode?: string;
}
```

### 1.3 Cuộc Gọi Provider Chuẩn Tắc (`ProviderUsageStats`)
```typescript
export interface ProviderUsageStats {
  providerAttempts: number;
  retries: number;
  providerFailures: number;
}
```

### 1.4 Snapshot Khóa Kèm Tương Thích Ngược (`KeyQuotaSnapshot`)
```typescript
export interface KeyQuotaSnapshot {
  keyHash: string;
  maskedKey: string;
  healthState: KeyHealthState;
  transitionReason?: string;
  circuitBreakerState: CircuitBreakerStatus;
  cooldownRemainingMs: number;

  // Canonical Key Activity Metrics
  keyAttempts: number;
  keyFailures: number;
  keyCooldowns: number;

  // Backward Compatibility Aliases (@deprecated)
  /** @deprecated Sử dụng `keyAttempts` thay thế */
  requestsTotal: number;
  /** @deprecated Sử dụng `keyAttempts` thay thế */
  requestsToday: number;
  /** @deprecated Sử dụng `keyAttempts` thay thế */
  requestsThisMinute: number;
  /** @deprecated Sử dụng `keyAttempts` thay thế */
  providerAttemptsTotal: number;
  /** @deprecated Sử dụng `keyAttempts` thay thế */
  providerAttemptsToday: number;
  /** @deprecated Sử dụng `keyAttempts` thay thế */
  providerAttemptsThisMinute: number;

  errorsTotal: number;
  consecutiveErrors: number;
  quotaEventsTotal: number;
  cooldownEventsTotal: number;
  tokensTotal: number;
  tokensToday: number;
  tokensThisMinute: number;
  byModel: Record<string, ModelUsageStats>;
}
```
