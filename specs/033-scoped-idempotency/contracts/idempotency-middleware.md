# Contract: Idempotency Middleware Interface & Behavior

**Feature**: Scoped Idempotency & Conflict-Safe Replay Engine  
**Module**: `server/middleware/idempotencyMiddleware.ts`  
**Date**: 2026-08-20

---

## 1. Request Headers

| Header | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `Idempotency-Key` / `x-idempotency-key` | String | No | Client-generated unique operation key (e.g. UUID, timestamp hash, batch key) |
| `X-Session-Token` | String | No | Session identifier used to scope the idempotency cache |
| `X-Auth-Token` | String | No | Authentication token used as fallback identity scope |

---

## 2. Response Headers

| Header | Type | Condition | Description |
| :--- | :--- | :--- | :--- |
| `x-idempotent-replay` | `'true'` | When replaying cached or in-flight duplicate response | Informs client that response was retrieved from idempotency cache |

---

## 3. Middleware Pipeline Lifecycle

```typescript
export function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void;
```

### Invariants:
1. If no `Idempotency-Key` is provided $\to$ call `next()` immediately with 0 delay.
2. If `Idempotency-Key` exists:
   - Compute `scopeKey = buildCompositeIdempotencyKey(req, clientKey)`.
   - Compute `fingerprint = computeRequestFingerprint(req.body)`.
   - If entry exists and fingerprint matches:
     - If `status === 'completed'`: Replay stored status code and response payload with header `x-idempotent-replay: true`.
     - If `status === 'pending'`: Queue listener and wait for completion broadcast.
   - If entry exists and fingerprint differs:
     - Return `409 Conflict` (`IDEMPOTENCY_CONFLICT`).
   - If entry does not exist:
     - Create `pending` entry with `fingerprint`.
     - Hook `res.status` and `res.json`.
     - On status $200..299$: transition to `completed`, save body, broadcast listeners.
     - On status $\ge 400$ or error: transition to `failed`, evict entry immediately, broadcast listeners.
