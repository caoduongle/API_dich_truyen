# Contract: Session Authentication Protocols

## 1. `GET /api/session-keys/status`

- **Headers**: `X-Session-Token: <token>` (optional, checks status if present)
- **Query**: MUST NOT contain `token` (returns HTTP 400 `DISALLOWED_URL_CREDENTIALS` if present)
- **Response**:
  - `200 OK`: `{ valid: boolean, keyCount: number, expiresAt?: string }`
  - `400 Bad Request`: `{ code: 'DISALLOWED_URL_CREDENTIALS', error: string }`

---

## 2. `DELETE /api/session-keys`

- **Headers**: `X-Session-Token: <token>` (required)
- **Query**: MUST NOT contain `token` (returns HTTP 400 `DISALLOWED_URL_CREDENTIALS` if present)
- **Response**:
  - `200 OK`: `{ success: true, message: string }`
  - `400 Bad Request`: `{ code: 'DISALLOWED_URL_CREDENTIALS', error: string }`
  - `401 Unauthorized`: `{ code: 'MISSING_SESSION_TOKEN', error: string }`
