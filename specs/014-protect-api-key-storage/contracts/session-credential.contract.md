# API Contract: Session Credential Lifecycle & Delegation

## 1. POST `/api/session-keys`
Creates or replaces an active credential session on the server.

### Request
- **Headers**:
  - `Content-Type: application/json`
  - `X-Auth-Token: <string>` *(Optional, if server password enabled)*
- **Body**:
```json
{
  "apiKeys": [
    "AIzaSyD-sample-key-1",
    "AIzaSyD-sample-key-2"
  ]
}
```

### Response
- **Status**: `200 OK`
```json
{
  "sessionToken": "d3b07384-d113-40e1-95c5-349f45447b9d",
  "keyCount": 2,
  "expiresAt": "2026-08-20T23:00:00.000Z",
  "message": "Đã tạo phiên làm việc bảo mật thành công."
}
```
- **Error Responses**:
  - `400 Bad Request`: `{"error": "Danh sách API key không hợp lệ hoặc rỗng."}`
  - `401 Unauthorized`: `{"error": "Yêu cầu mật khẩu xác thực máy chủ.", "authRequired": true}`

---

## 2. GET `/api/session-keys/status`
Checks if the current session token is valid and returns metadata without leaking keys.

### Request
- **Headers**:
  - `X-Session-Token: <sessionToken>`
  - `X-Auth-Token: <string>` *(Optional)*

### Response
- **Status**: `200 OK`
```json
{
  "valid": true,
  "keyCount": 2,
  "expiresAt": "2026-08-20T23:00:00.000Z"
}
```

---

## 3. DELETE `/api/session-keys`
Revokes the session and clears all associated API keys from server memory/Redis.

### Request
- **Headers**:
  - `X-Session-Token: <sessionToken>`

### Response
- **Status**: `200 OK`
```json
{
  "success": true,
  "message": "Đã thu hồi phiên làm việc thành công."
}
```

---

## 4. Protected API Route Session Resolution (`resolveApiKeysMiddleware`)
Applies to `/api/translate-raw`, `/api/polish-translation`, `/api/qa-critique`, `/api/quota-status`, `/api/models-for-key`, etc.

### Request
- **Headers**:
  - `X-Session-Token: <sessionToken>`
- **Body**: Routine operation payload (e.g. `text`, `model`, `genre` - **no `apiKeys` in body**)

### Session Expiration Error (401)
When the session token has expired or is unrecognized:
- **Status**: `401 Unauthorized`
```json
{
  "error": "Phiên làm việc API key đã hết hạn hoặc không tồn tại. Hệ thống sẽ tự động đồng bộ lại.",
  "sessionExpired": true
}
```
*Client `apiFetch` intercepts `sessionExpired: true` and triggers automated re-sync from active memory.*
