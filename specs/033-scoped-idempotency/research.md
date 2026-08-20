# Phase 0: Technical Research & Architecture Decisions (TASK 02)

**Feature**: Scoped Idempotency & Conflict-Safe Replay Engine  
**Spec**: `specs/033-scoped-idempotency/spec.md`  
**Date**: 2026-08-20

---

## 1. Research Topic 1: Composite Key Scoping Strategy

### Decision
Construct a deterministic composite key combining three orthogonal dimensions:
```text
CompositeKey = "idemp:" + {IdentityHash} + ":" + {EndpointPath} + ":" + {ClientKey}
```

### Technical Details:
- **`IdentityHash`**: Derived from:
  1. `req.headers['x-session-token']` (if present, sha256 prefix 16-hex chars).
  2. `req.headers['x-auth-token']` (if present).
  3. Client IP (`req.ip` or `req.socket.remoteAddress`) as anonymous fallback.
- **`EndpointPath`**: Normalized HTTP method and path (`${req.method}:${req.baseUrl || ''}${req.path}`).
- **`ClientKey`**: Trimmed value of `req.headers['idempotency-key']` or `req.headers['x-idempotency-key']`.

### Rationale:
- Guarantees strict multi-tenant isolation: User A's key cannot collide with or replay User B's response.
- Guarantees endpoint isolation: Calling `/api/translate-raw` and `/api/polish-translation` with the same key produces independent, correct results.

---

## 2. Research Topic 2: Request Payload Fingerprinting & Conflict Rejection

### Decision
Compute a SHA-256 hash of the canonicalized request payload (`req.body`). When a matching composite key is encountered in the store:
- If `incomingFingerprint === storedEntry.fingerprint`: Replay cached response with `x-idempotent-replay: true`.
- If `incomingFingerprint !== storedEntry.fingerprint`: Immediately reject with **HTTP 409 Conflict**:
  ```json
  {
    "error": "Khóa Idempotency đã được sử dụng với nội dung yêu cầu khác. Vui lòng tạo khóa mới.",
    "errorCode": "IDEMPOTENCY_CONFLICT",
    "key": "KEY123",
    "timestamp": "2026-08-20T12:56:00.000Z"
  }
  ```

### Canonicalization Algorithm:
```typescript
function computeRequestFingerprint(body: any): string {
  if (!body || typeof body !== 'object') {
    return crypto.createHash('sha256').update(String(body || '')).digest('hex');
  }
  // Sort object keys deterministically to avoid false-positive mismatches from property ordering
  const sortedKeys = Object.keys(body).sort();
  const canonicalObj: Record<string, any> = {};
  for (const k of sortedKeys) {
    canonicalObj[k] = body[k];
  }
  return crypto.createHash('sha256').update(JSON.stringify(canonicalObj)).digest('hex');
}
```

### Rationale:
Prevents silent data corruption when a client changes the text or translation settings but fails to rotate the idempotency key.

---

## 3. Research Topic 3: In-Flight Concurrency & Lifecycle State Machine

### Decision
Model idempotency lifecycle as an explicit state machine:
```text
                 ┌──────────┐
                 │  NEW REQ │
                 └────┬─────┘
                      │
                      ▼
               ┌─────────────┐
               │   PENDING   │ ◄── [Concurrent duplicate requests attach listeners]
               └──────┬──────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
   [Status 200-299]        [Status 4xx/5xx / Error]
          │                       │
          ▼                       ▼
   ┌─────────────┐         ┌─────────────┐
   │  COMPLETED  │         │   FAILED    │
   │ (Cached 5m) │         │ (Evicted)   │
   └─────────────┘         └─────────────┘
```

### Lifecycle Rules:
1. **Pending**: Concurrent duplicates wait on an array of resolver callbacks.
2. **Completed**: Cached for 5 minutes (`IDEMPOTENCY_TTL_MS = 300,000`). Replays set `res.setHeader('x-idempotent-replay', 'true')`.
3. **Failed**: HTTP status $\ge 400$ or unhandled exception immediately clears the entry from the store, allowing subsequent retries to execute freshly without being stuck.

---

## 4. Research Topic 4: Multi-Instance Deployment Architecture Audit

### Audit Findings:
- **Current Runtime Profile**: The application is deployed and operated as a single Node.js Express process in standard local and Docker environments.
- **In-Memory Store**: A structured `Map<string, IdempotencyEntry>` provides microsecond access, zero network latency, and precise concurrency coordination for single-instance deployments.
- **Distributed Store Architecture**: When Redis is available via `redisManager.getClient()`, completed idempotency entries and fingerprints can be persisted to Redis keys `idemp:{compositeKey}` with 300s TTL.
- **Unified Interface**:
  ```typescript
  export interface IdempotencyStore {
    get(key: string): Promise<IdempotencyEntry | undefined> | IdempotencyEntry | undefined;
    set(key: string, entry: IdempotencyEntry): Promise<void> | void;
    delete(key: string): Promise<void> | void;
    clear(): void;
  }
  ```

---

## 5. Summary of Architecture Decisions Table

| Component | Choice | Rationale | Alternatives Evaluated |
| :--- | :--- | :--- | :--- |
| **Key Scoping** | `idemp:{identity}:{endpoint}:{key}` | Absolute user and endpoint isolation | Plain key (caused cross-user leaks) |
| **Conflict Handling** | SHA-256 fingerprint + 409 Conflict | Prevents returning mismatched translations | Silent replay (data corruption risk) |
| **In-Flight Duplicate** | Listener queue broadcast | Zero duplicate upstream AI calls | Parallel execution (wasted quota) |
| **Error Handling** | Evict failed entries immediately | Enables instant client retry | Cache errors (blocks retries) |
| **TTL** | 5 minutes (300s) | Optimal for retry loops and batch tasks | 1 hour (excessive memory) |
