# Quickstart: Scoped Idempotency & Conflict Prevention Validation (TASK 02)

**Feature**: Scoped Idempotency & Conflict-Safe Replay Engine  
**Spec**: `specs/033-scoped-idempotency/spec.md`  
**Date**: 2026-08-20

---

## 1. Quick Validation Commands

### Run Idempotency Test Suite
```bash
npx vitest run server/middleware/__tests__/idempotency.test.ts
```

### Run Full Test Suite
```bash
npm test
```

---

## 2. Test Scenarios Covered

1. **Same user + same key + same body**:
   - Request 1: Executes upstream, returns status 200, caches response.
   - Request 2: Replays cached response in $\le 5$ms with `x-idempotent-replay: true`.
2. **Same user + different key**:
   - Both requests execute independently.
3. **Different users + same key**:
   - User A and User B use key `KEY123` $\to$ both execute independently with zero cross-user response leakage.
4. **Same key + different endpoint**:
   - User A calls `/api/translate-raw` with `KEY123`.
   - User A calls `/api/polish-translation` with `KEY123` $\to$ executes independently with zero cross-endpoint collision.
5. **Same key + different body (Payload conflict)**:
   - Request 1: `prompt: "Original text"` $\to$ status 200.
   - Request 2: `prompt: "Altered text"` with same key $\to$ returns **HTTP 409 Conflict** (`IDEMPOTENCY_CONFLICT`).
6. **Concurrent duplicate requests**:
   - Request 1 (in-flight pending) and Request 2 arrive simultaneously $\to$ Request 2 queues on listener $\to$ both receive single upstream result.
7. **Expired entry (> 5 minutes TTL)**:
   - Request 1 at $t=0$.
   - Request 2 at $t = 301$s $\to$ entry expired, triggers fresh upstream execution.
8. **Failed entry (HTTP 4xx / 5xx / exception)**:
   - Upstream fails $\to$ entry evicted immediately $\to$ retry request succeeds freshly.
