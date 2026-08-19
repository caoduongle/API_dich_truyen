# Contract: Quota Tracking API Endpoints

**Status**: Approved | **Date**: 2026-08-19

## 1. POST `/api/quota-status`

Truy vấn snapshot mức sử dụng và trạng thái vận hành thời gian thực của các khóa API.

### Request

- **Headers**:
  - `Content-Type: application/json`
  - `X-Session-Token`: string (optional, nếu sử dụng session)
  - `X-Auth-Token`: string (optional, nếu server bật `ACCESS_PASSWORD`)
- **Body**:
  ```json
  {
    "sessionToken": "optional-session-token",
    "apiKeys": ["AIzaSy...", "AIzaSy..."]
  }
  ```
  *(Lưu ý: `resolveApiKeysMiddleware` sẽ trích xuất danh sách key từ session hoặc body)*

### Response

- **Status**: `200 OK`
- **Content-Type**: `application/json`
- **Body**:
  ```json
  {
    "timestamp": "2026-08-19T20:30:00.000Z",
    "timezone": "America/Los_Angeles",
    "currentDayPST": "2026-08-19",
    "keys": [
      {
        "index": 0,
        "keyHash": "a1b2c3d4e5f6...",
        "maskedKey": "AIzaSy...4xQ",
        "requestsTotal": 42,
        "requestsToday": 15,
        "requestsThisMinute": 2,
        "errorsTotal": 0,
        "byModel": {
          "models/gemini-2.5-flash": {
            "requestsTotal": 30,
            "requestsToday": 10,
            "requestsThisMinute": 1,
            "errorsTotal": 0
          }
        },
        "runtime": {
          "isBlacklisted": false,
          "blacklistRemainingMs": 0,
          "isRateLimited": false,
          "nextAllowedRemainingMs": 0
        },
        "lastRequestTimestamp": 1771415400000
      }
    ]
  }
  ```

---

## 2. Error Responses

- `400 Bad Request`: Khi không có API key nào được cấu hình và server fallback bị tắt.
- `401 Unauthorized`: Khi session hết hạn hoặc server yêu cầu mật khẩu truy cập.
