# Data Model: Error Taxonomy & Smart Retry Engine

## 1. Entities & Type Definitions

### 1.1 AIErrorCode & AIRecommendedAction

```typescript
export enum AIErrorCode {
  RATE_LIMITED = 'RATE_LIMITED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  AUTH_FAILED = 'AUTH_FAILED',
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  MODEL_UNSUPPORTED = 'MODEL_UNSUPPORTED',
  INVALID_REQUEST = 'INVALID_REQUEST',
  SAFETY_BLOCKED = 'SAFETY_BLOCKED',
  OVERLOADED = 'OVERLOADED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN = 'UNKNOWN',
}

export type AIRecommendedAction =
  | 'retry'
  | 'rotate_key'
  | 'cooldown_key'
  | 'disable_key'
  | 'fail_immediately';
```

---

### 1.2 AIErrorNormalized

```typescript
export interface AIErrorNormalized {
  code: AIErrorCode;
  message: string;
  isRetryable: boolean;
  recommendedAction: AIRecommendedAction;
  httpStatus: number;
  retryAfterSec?: number;
  details?: Record<string, unknown>;
}
```

---

### 1.3 Standardized ApiErrorResponse

```typescript
export interface ApiErrorResponse {
  error: string;
  code: AIErrorCode;
  isRetryable: boolean;
  retryAfterSec?: number;
  details?: Record<string, unknown>;
}
```
