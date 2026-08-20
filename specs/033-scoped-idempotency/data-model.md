# Data Model: Scoped Idempotency & Conflict Prevention (TASK 02)

**Feature**: Scoped Idempotency & Conflict-Safe Replay Engine  
**Spec**: `specs/033-scoped-idempotency/spec.md`  
**Date**: 2026-08-20

---

## 1. Entities & Core Types

### 1.1 `IdempotencyScopeKey` (Composite String)
```text
Format: idemp:{identityHash}:{endpointMethodAndPath}:{clientKey}
Example: idemp:a9f8c12e:POST:/api/translate-raw:batch_chap1_part1
```

### 1.2 `IdempotencyEntry`
Represents an in-flight or completed idempotent request lifecycle object.

```typescript
export type IdempotencyStatus = 'pending' | 'completed' | 'failed';

export interface IdempotencyListenerResult {
  statusCode: number;
  body: any;
}

export interface IdempotencyEntry {
  /**
   * Khóa định danh tổng hợp duy nhất cho request (Identity + Endpoint + ClientKey)
   */
  key: string;

  /**
   * Mã băm SHA-256 (hex) của canonical JSON request body
   */
  fingerprint: string;

  /**
   * Trạng thái vòng đời hiện tại của request
   */
  status: IdempotencyStatus;

  /**
   * Thời điểm khởi tạo request (epoch ms)
   */
  createdAt: number;

  /**
   * Mã trạng thái HTTP khi hoàn thành (e.g. 200)
   */
  statusCode?: number;

  /**
   * Nội dung phản hồi được lưu trữ để replay
   */
  responseBody?: any;

  /**
   * Danh sách listener callbacks chờ kết quả của in-flight request
   */
  listeners: Array<(result: IdempotencyListenerResult) => void>;
}
```

---

## 2. State Machine Transitions

```text
[Incoming Request with Idempotency Key]
        │
        ▼
   Does entry exist in store?
   ├── NO  ─► Create entry (status: 'pending', fingerprint: H_req) ─► Execute next()
   └── YES
        │
        ├── Check Fingerprint:
        │   └── H_req !== entry.fingerprint ─► Reject with HTTP 409 Conflict (IDEMPOTENCY_CONFLICT)
        │
        ├── Check Status:
        │   ├── 'pending'   ─► Attach to entry.listeners, wait for broadcast
        │   ├── 'completed' ─► Check TTL (< 5m?):
        │   │                  ├── YES ─► Replay response immediately (x-idempotent-replay: true)
        │   │                  └── NO  ─► Evict expired entry, treat as new request
        │   └── 'failed'    ─► Evicted immediately, treat as new request
```

---

## 3. Storage Abstraction Interface

```typescript
export interface IdempotencyStore {
  get(key: string): IdempotencyEntry | undefined;
  set(key: string, entry: IdempotencyEntry): void;
  delete(key: string): boolean;
  clear(): void;
  cleanupStale(ttlMs?: number): number;
}
```

---

## 4. Conflict Error Entity (`IdempotencyConflictError`)

```json
{
  "error": "Khóa Idempotency đã được sử dụng với nội dung yêu cầu khác. Vui lòng tạo khóa mới.",
  "errorCode": "IDEMPOTENCY_CONFLICT",
  "idempotencyKey": "KEY123",
  "endpoint": "/api/translate-raw",
  "timestamp": "2026-08-20T12:56:00.000Z"
}
```
