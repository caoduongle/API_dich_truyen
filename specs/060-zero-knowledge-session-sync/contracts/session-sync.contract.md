# API Contract: Zero-Knowledge Session Sync & AI Routes

**Feature Directory**: `specs/060-zero-knowledge-session-sync`  
**Feature Branch**: `060-zero-knowledge-session-sync`  

---

## 1. Endpoint: `POST /api/session-keys`

Create a new zero-knowledge session containing only cryptographic key hashes.

### Request
```http
POST /api/session-keys HTTP/1.1
Content-Type: application/json
X-Auth-Token: <optional-access-password-token>

{
  "keyHashes": [
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "f2ca1bb6c7e907d06dafe4687e579fce76b37e4e93b7605022da52e6ccc26fd2"
  ]
}
```

### Validation Rules
- `keyHashes`: Array of strings, `1 <= length <= MAX_API_KEYS_PER_REQUEST`.
- Every item MUST match `/^[0-9a-f]{64}$/`. Plaintext API keys will be rejected with HTTP 400.

### Success Response (`200 OK`)
```json
{
  "sessionToken": "session_8f6d7c80-2a9e-4e5c-9c12-ef34b1234567",
  "keyCount": 2,
  "expiresAt": "2026-08-23T23:30:00.000Z",
  "message": "Đã tạo phiên làm việc bảo mật thành công."
}
```

### Error Responses
- `400 Bad Request`: `{ "error": "Mã băm API key thứ 1 không hợp lệ (phải là chuỗi SHA-256 hex 64 ký tự)." }`
- `401 Unauthorized`: `{ "error": "Vui lòng cung cấp mật khẩu truy cập máy chủ.", "authRequired": true }`

---

## 2. Endpoint: `GET /api/session-keys/status`

Verify session validity and key count without revealing key hashes.

### Request
```http
GET /api/session-keys/status HTTP/1.1
X-Session-Token: session_8f6d7c80-2a9e-4e5c-9c12-ef34b1234567
X-Auth-Token: <optional-auth-token>
```

### Response (`200 OK`)
```json
{
  "valid": true,
  "keyCount": 2,
  "expiresAt": "2026-08-23T23:30:00.000Z"
}
```

---

## 3. Endpoint: `DELETE /api/session-keys`

Revoke active session token from server and Redis.

### Request
```http
DELETE /api/session-keys HTTP/1.1
X-Session-Token: session_8f6d7c80-2a9e-4e5c-9c12-ef34b1234567
```

### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Đã thu hồi phiên làm việc thành công."
}
```

---

## 4. Endpoint: `POST /api/quota-status`

Fetch runtime metrics and usage snapshots for provided key hashes.

### Request
```http
POST /api/quota-status HTTP/1.1
Content-Type: application/json
X-Session-Token: session_8f6d7c80-2a9e-4e5c-9c12-ef34b1234567

{
  "keyHashes": [
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  ]
}
```

### Response (`200 OK`)
```json
{
  "timestamp": "2026-08-22T23:30:00.000Z",
  "timezone": "America/Los_Angeles",
  "currentDayPST": "2026-08-22",
  "keys": [
    {
      "keyHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "maskedKey": "e3b0c4...b855",
      "requestsTotal": 142,
      "requestsToday": 35,
      "requestsThisMinute": 2,
      "errorsTotal": 0,
      "runtime": {
        "isRateLimited": false,
        "isBlacklisted": false
      }
    }
  ]
}
```
