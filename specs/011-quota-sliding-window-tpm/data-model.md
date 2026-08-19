# Data Model: Sliding Window Token & Request Quota Observability

**Feature**: `011-quota-sliding-window-tpm`  
**Created**: 2026-08-19  

---

## 1. Server-Side Data Structures (`server/services/quotaService.ts`)

```typescript
export interface TokenStats {
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface CallLogEntry {
  timestamp: number;
  tokens: number;
}

export interface ModelUsageRecord {
  requestsTotal: number;
  requestsTodayCount: number;
  requestsTodayDateKey: string;
  recentCalls: CallLogEntry[];
  errorsTotal: number;
  tokensTotal: number;
  tokensTodayCount: number;
  tokensTodayDateKey: string;
}

export interface KeyUsageRecord {
  keyHash: string;
  maskedKey: string;
  requestsTotal: number;
  requestsTodayCount: number;
  requestsTodayDateKey: string;
  recentCalls: CallLogEntry[];
  errorsTotal: number;
  tokensTotal: number;
  tokensTodayCount: number;
  tokensTodayDateKey: string;
  byModel: Record<string, ModelUsageRecord>;
}

export interface ModelUsageSnapshot {
  requestsTotal: number;
  requestsToday: number;
  requestsThisMinute: number;
  errorsTotal: number;
  tokensTotal: number;
  tokensToday: number;
  tokensThisMinute: number;
}

export interface KeyUsageSnapshot {
  keyHash: string;
  maskedKey: string;
  requestsTotal: number;
  requestsToday: number;
  requestsThisMinute: number;
  errorsTotal: number;
  tokensTotal: number;
  tokensToday: number;
  tokensThisMinute: number;
  byModel: Record<string, ModelUsageSnapshot>;
  runtime: {
    isBlacklisted: boolean;
    blacklistRemainingMs: number;
    isRateLimited: boolean;
    nextAllowedRemainingMs: number;
  };
}
```

---

## 2. Client-Side Data Models (`src/utils/apiClient.ts` & `src/utils/modelRegistry.ts`)

```typescript
export interface ModelUsageStats {
  requestsTotal: number;
  requestsToday: number;
  requestsThisMinute: number;
  errorsTotal: number;
  tokensTotal: number;
  tokensToday: number;
  tokensThisMinute: number;
}

export interface ModelStatsSummary {
  modelId: string;
  displayName: string;
  totalRequests: number;
  requestsToday: number;
  requestsThisMinute: number;
  errorsTotal: number;
  totalTokens: number;
  tokensToday: number;
  tokensThisMinute: number;
  totalKeys: number;
  checkedKeyCount: number;
  availableKeyCount: number;
  supportingKeyIndices: number[];
  hasChecked: boolean;
  isUnavailable: boolean;
}

export interface CustomLimit {
  maxRpm: number;
  maxRpd: number;
  maxTpm: number;
}
```
