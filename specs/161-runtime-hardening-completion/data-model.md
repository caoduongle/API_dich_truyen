# Data Model: Runtime Hardening Completion & Architecture Polish

**Feature**: `161-runtime-hardening-completion`  
**Date**: 2026-09-23  

## Overview
This document models the in-memory data structures, validation rules, state transitions, and sanitization boundaries for the quota tracker, Gemini error hierarchy, and glossary engine.

---

## 1. Quota Sliding-Window State Model

```text
+--------------------------------------------------------------------------+
|                            LocalQuotaTracker                             |
+--------------------------------------------------------------------------+
| - keyStatsMap: Map<string, InternalKeyStats>                             |
| - summaryStats: SummaryStats                                             |
| - saveTimer: NodeJS.Timeout | null                                       |
+--------------------------------------------------------------------------+
                                    |
                                    v
+--------------------------------------------------------------------------+
|                             InternalKeyStats                             |
+--------------------------------------------------------------------------+
| + keyHash: string                                                        |
| + recentAttempts: CallAttemptEntry[]  (max 100 entries, sliding <= 60s)  |
| + recentTokens: CallTokenEntry[]      (max 100 entries, sliding <= 60s)  |
| + byModel: Map<string, InternalModelStats>                               |
| + healthState: KeyHealthState                                            |
| + circuitBreakerStatus: CircuitBreakerStatus                             |
| + cooldownUntil: number                                                  |
+--------------------------------------------------------------------------+
                                    |
                                    v
+--------------------------------------------------------------------------+
|                            InternalModelStats                            |
+--------------------------------------------------------------------------+
| + model: string                                                          |
| + recentAttempts: CallAttemptEntry[]  (max 100 entries, sliding <= 60s)  |
| + recentTokens: CallTokenEntry[]      (max 100 entries, sliding <= 60s)  |
+--------------------------------------------------------------------------+
```

### Entity Specifications

#### `CallAttemptEntry`
- **Fields**:
  - `timestamp`: `number` (Epoch ms)
- **Validation Invariants**:
  - Must be numeric: `typeof timestamp === 'number' && Number.isFinite(timestamp)`
  - Horizon: `timestamp > (now - 60_000)`
  - Clock skew boundary: `timestamp <= (now + 5_000)`
  - Symmetrical capacity limit: `Array.length <= 100`

#### `CallTokenEntry`
- **Fields**:
  - `timestamp`: `number` (Epoch ms)
  - `tokens`: `number` (Positive integer)
- **Validation Invariants**:
  - Must be numeric: `typeof timestamp === 'number' && typeof tokens === 'number'`
  - Tokens non-negative: `tokens >= 0`
  - Horizon: `timestamp > (now - 60_000)`
  - Clock skew boundary: `timestamp <= (now + 5_000)`
  - Symmetrical capacity limit: `Array.length <= 100`

---

## 2. Gemini Error Taxonomy Model

```text
                        +----------------------+
                        |     Error (native)   |
                        +----------------------+
                                   ^
                                   |
                        +----------------------+
                        |  GeminiRequestError  |
                        +----------------------+
                        | + code: ErrorCode    |
                        | + category: Category |
                        | + status?: number    |
                        | + isRetryable: bool  |
                        +----------------------+
                                   |
         +-------------------------+-------------------------+
         |                         |                         |
+------------------+      +------------------+      +------------------+
| CONTENT_BLOCKED  |      | ALL_KEYS_EXHAUST |      | RESOURCE_NOT_FND |
| isRetryable: F   |      | isRetryable: F   |      | isRetryable: F   |
| status: 200/400  |      | status: 429      |      | status: 404      |
+------------------+      +------------------+      +------------------+
         |                         |                         |
+------------------+      +------------------+      +------------------+
|   BAD_REQUEST    |      |    ETIMEDOUT     |      |   AUTH_FAILURE   |
| isRetryable: F   |      | isRetryable: T   |      | isRetryable: F   |
| status: 400      |      | status: undefined|      | status: 401/403  |
+------------------+      +------------------+      +------------------+
```

### Attributes & Transitions
| Error Code | HTTP Status | Category | Retryable | Rotation Action |
|:---|:---:|:---|:---:|:---|
| `CONTENT_BLOCKED` | 200 / 400 | `CONTENT_BLOCKED` | `false` | Halt immediately, zero retry/rotation |
| `RESOURCE_NOT_FOUND` | 404 | `RESOURCE_NOT_FOUND` | `false` | Halt immediately, non-retryable |
| `BAD_REQUEST` | 400 | `UNRECOGNIZED` | `false` | Halt immediately, invalid payload |
| `ALL_KEYS_EXHAUSTED` | 429 | `QUOTA_EXHAUSTED_RPD` | `false` | Halt after attempting all available keys |
| `ETIMEDOUT` | N/A | `NETWORK_FAILURE` | `true` | Retry if within overall cumulative deadline |
| `AUTH_FAILURE` | 401 / 403 | `AUTH_FAILURE` | `false` | Mark key `AuthFailed`, rotate to next key |
| `UNRECOGNIZED` | Any | `UNRECOGNIZED` | `false` | Standard error propagation |

---

## 3. Storage Persistence State Transition

```text
[API Event: Attempt / Success / Failure / Retry]
                      |
                      v
      +-------------------------------+
      |  Update In-Memory Stats Map   |
      +-------------------------------+
                      |
                      v
      +-------------------------------+
      |   scheduleSave(now) [300ms]   |
      +-------------------------------+
             /                 \
    (300ms expires)      (pagehide / visibilitychange -> hidden)
           /                     \
          v                       v
+-------------------+    +--------------------+
|  flushToStorage() |    |  flushToStorage()  |
+-------------------+    +--------------------+
          |                       |
          +----------+------------+
                     |
                     v
   +------------------------------------+
   |  Sanitize & Cap 100 (.slice(-100)) |
   +------------------------------------+
                     |
                     v
   +------------------------------------+
   |  JSON.stringify() -> sessionStorage|
   +------------------------------------+
```
