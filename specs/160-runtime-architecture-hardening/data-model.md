# Data Model & State Transitions: Runtime Architecture & Security Hardening

**Feature**: [Runtime Architecture & Security Hardening](spec.md)
**Branch**: `160-runtime-architecture-hardening`
**Date**: 2026-09-23

## Entities & Type Definitions

### 1. Rolling Quota Window State (Session Storage Schema)

Represents the compact in-memory and serialized structure for retaining rolling rate-limit consumption over a 60-second window across browser tab reloads.

```typescript
export interface CompactRecentAttempt {
  /** Timestamp in milliseconds of the provider attempt */
  timestamp: number;
}

export interface CompactRecentTokens {
  /** Timestamp in milliseconds of the successful request completion */
  timestamp: number;
  /** Total token consumption (prompt + completion) */
  tokens: number;
}

export interface SerializedModelUsageStats {
  requestsTotal: number;
  requestsToday: number;
  errorsTotal: number;
  errorsToday: number;
  tokensTotal: number;
  tokensToday: number;
  totalLatencyMs: number;
  lastResetDay: string;
  /** Serialized rolling attempt history within the last 60 seconds */
  recentAttempts?: CompactRecentAttempt[];
  /** Serialized rolling token history within the last 60 seconds */
  recentTokens?: CompactRecentTokens[];
}

export interface SerializedKeyStats {
  keyHash: string;
  maskedKey: string;
  requestsTotal: number;
  requestsToday: number;
  errorsTotal: number;
  consecutiveErrors: number;
  consecutiveSuccesses: number;
  tokensTotal: number;
  tokensToday: number;
  lastResetDay: string;
  healthState: KeyHealthState;
  circuitBreakerStatus: CircuitBreakerStatus;
  cooldownUntil: number;
  transitionReason?: string;
  lastTransitionAt: number;
  /** Serialized key-level rolling attempt history (<= 60s) */
  recentAttempts?: CompactRecentAttempt[];
  /** Serialized key-level rolling token history (<= 60s) */
  recentTokens?: CompactRecentTokens[];
  byModel: Record<string, SerializedModelUsageStats>;
}
```

#### Validation & Invariant Rules
1. **Window Limit**: Any entry where `entry.timestamp <= now - 60_000` MUST be pruned during both serialization (`saveToStorage`) and deserialization (`loadFromStorage`).
2. **Clock Skew Guard**: Any entry with `entry.timestamp > now + 5_000` (skewed future timestamp) MUST be discarded during deserialization.
3. **Array Bounds**: Maximum array size is capped at 100 entries per key/model to prevent memory and storage bloat.

---

### 2. Structured Gemini Error Hierarchy

Replaces loosely typed error mutations (`Object.assign(new Error(...), { code, isOverload })`) with a clean error class and taxonomy.

```typescript
export type GeminiErrorCode =
  | 'CONTENT_BLOCKED'
  | 'ALL_KEYS_EXHAUSTED'
  | 'RESOURCE_NOT_FOUND'
  | 'BAD_REQUEST'
  | 'ETIMEDOUT'
  | 'AUTH_FAILURE'
  | 'UNRECOGNIZED';

export class GeminiRequestError extends Error {
  public readonly code: GeminiErrorCode;
  public readonly category: ClassifiedErrorCategory;
  public readonly status?: number;
  public readonly isRetryable: boolean;

  constructor(
    message: string,
    options: {
      code: GeminiErrorCode;
      category: ClassifiedErrorCategory;
      status?: number;
      isRetryable: boolean;
      cause?: unknown;
    }
  ) {
    super(message);
    this.name = 'GeminiRequestError';
    this.code = options.code;
    this.category = options.category;
    this.status = options.status;
    this.isRetryable = options.isRetryable;
    if (options.cause) {
      this.cause = options.cause;
    }
    Object.setPrototypeOf(this, GeminiRequestError.prototype);
  }
}
```

#### State Transition on AI Request Error

```text
[API Request Dispatched]
         │
         ├─── Status 200 OK ───────────► Check Content:
         │                                  ├── Has Text ────────► Record Success, Return Response
         │                                  └── finishReason=SAFETY or blockReason=SAFETY
         │                                           │
         │                                           ▼
         │                                    [GeminiRequestError: CONTENT_BLOCKED]
         │                                    - isRetryable: false
         │                                    - NO KEY ROTATION
         │                                    - Propagate directly to UI / caller
         │
         ├─── Status 429 / 503 ────────► Classify Quota/Overload:
         │                                  - isRetryable: true
         │                                  - Find Next Available Key
         │                                  - Rotate & Retry if keys remaining
         │
         └─── Status 401 / 403 ────────► Classify Auth Failure:
                                            - Mark Key AuthFailed
                                            - Rotate to next valid key
```

---

### 3. QA Critique State Lifecycle

Manages transitions between chapter QA audit findings across translation passes.

```typescript
export interface QaAuditOutcome {
  runAttempted: boolean;
  runSucceeded: boolean;
  detectedIssues: DirectQaCritiqueIssue[];
}
```

#### Lifecycle State Transitions

| Initial State | Event / Trigger | Condition | Next State | Notes |
|:---|:---|:---|:---|:---|
| Existing issues `[A, B]` | User triggers translation | QA toggle OFF (`enableAiQaCritique = false`) | Existing issues `[A, B]` | Previous audit retained |
| Existing issues `[A, B]` | User triggers translation | QA toggle ON, QA network fails | Existing issues `[A, B]` | Failure preserves existing issues |
| Existing issues `[A, B]` | User triggers translation | QA toggle ON, QA succeeds with 0 issues | Empty list `[]` | Stale issues cleared |
| Existing issues `[A, B]` | User triggers translation | QA toggle ON, QA succeeds with issue `[C]` | New list `[C]` | Replaces prior audit with fresh findings |
