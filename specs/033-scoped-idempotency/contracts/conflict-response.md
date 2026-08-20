# Contract: 409 Idempotency Conflict Response Format

**Feature**: Scoped Idempotency & Conflict-Safe Replay Engine  
**Date**: 2026-08-20

---

## 1. HTTP Status & Headers

- **HTTP Status Code**: `409 Conflict`
- **Content-Type**: `application/json; charset=utf-8`

---

## 2. Response JSON Body Schema

```json
{
  "error": "Khóa Idempotency đã được sử dụng với nội dung yêu cầu khác. Vui lòng tạo khóa mới.",
  "errorCode": "IDEMPOTENCY_CONFLICT",
  "idempotencyKey": "batch_chap_1_p1",
  "endpoint": "POST /api/translate-raw",
  "timestamp": "2026-08-20T12:56:00.000Z"
}
```

### Fields:
- `error` (string): Human-readable Vietnamese explanation of the conflict.
- `errorCode` (string): Fixed enum `IDEMPOTENCY_CONFLICT`.
- `idempotencyKey` (string): The client key that triggered the conflict.
- `endpoint` (string): The method and path of the endpoint.
- `timestamp` (string): ISO 8601 UTC timestamp.
