# Contract: Model Discovery API Endpoint

**Status**: Approved | **Date**: 2026-08-19

## 1. POST `/api/models-for-key`

Truy vấn danh sách các mô hình Google AI thực tế hỗ trợ sinh văn bản (`generateContent`) cho một khóa API cụ thể.

### Request

- **Headers**:
  - `Content-Type: application/json`
  - `X-Session-Token`: string (optional)
  - `X-Auth-Token`: string (optional)
- **Body**:
  ```json
  {
    "keyIndex": 0,
    "sessionToken": "optional-session-token",
    "apiKeys": ["AIzaSy..."]
  }
  ```

### Response

- **Status**: `200 OK`
- **Content-Type**: `application/json`
- **Body**:
  ```json
  {
    "keyHash": "a1b2c3d4e5f6...",
    "maskedKey": "AIzaSy...4xQ",
    "cached": false,
    "models": [
      {
        "name": "models/gemini-2.5-flash",
        "displayName": "Gemini 2.5 Flash",
        "description": "Fast and versatile model for coding and content creation",
        "supportedGenerationMethods": ["generateContent", "countTokens"],
        "inputTokenLimit": 1048576,
        "outputTokenLimit": 8192
      },
      {
        "name": "models/gemini-2.5-pro",
        "displayName": "Gemini 2.5 Pro",
        "description": "Top-tier model for high complexity reasoning and code",
        "supportedGenerationMethods": ["generateContent", "countTokens"],
        "inputTokenLimit": 2097152,
        "outputTokenLimit": 8192
      }
    ]
  }
  ```

---

## 2. Error Scenarios

- `400 Bad Request`: `keyIndex` không hợp lệ hoặc nằm ngoài phạm vi mảng khóa.
- `504 Gateway Timeout`: Upstream Google API không phản hồi trong 15 giây (`AbortController` timeout).
- `502 Bad Gateway`: Lỗi kết nối hoặc khóa API không hợp lệ phía Google.
