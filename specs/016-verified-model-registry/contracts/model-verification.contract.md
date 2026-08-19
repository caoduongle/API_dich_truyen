# Contract: Model Verification Endpoint

**Endpoint**: `POST /api/verify-model`  
**Authentication**: Requires Session Token (`X-Session-Token`) or API Keys in request payload.

## Request Payload

```json
{
  "modelId": "gemini-2.5-flash",
  "label": "Gemini 2.5 Custom",
  "apiKeys": ["AIzaSy..."],
  "sessionToken": "sess_abc123"
}
```

## Success Response (HTTP 200)

```json
{
  "success": true,
  "verified": true,
  "model": {
    "id": "gemini-2.5-flash",
    "label": "Gemini 2.5 Custom",
    "source": "custom",
    "status": "active",
    "verified": true,
    "lastVerifiedAt": "2026-08-20T06:30:00.000Z",
    "capabilities": {
      "generateContent": true,
      "structuredOutput": true,
      "vision": true,
      "thinking": true
    },
    "limits": {
      "defaultRpm": 15,
      "defaultTpm": 1000000,
      "defaultRpd": 1500
    },
    "inputTokenLimit": 1048576,
    "outputTokenLimit": 8192
  },
  "checkedAt": "2026-08-20T06:30:00.000Z"
}
```

## Failure Response - Model Not Found / Incompatible (HTTP 400 / 422)

```json
{
  "success": false,
  "verified": false,
  "error": "Mô hình \"text-embedding-004\" không hỗ trợ phương thức tạo nội dung văn bản (generateContent). Không thể dùng cho dịch thuật.",
  "errorCode": "UNSUPPORTED_METHODS",
  "checkedAt": "2026-08-20T06:30:00.000Z"
}
```

## Failure Response - Invalid Format (HTTP 400)

```json
{
  "success": false,
  "verified": false,
  "error": "ID Model không hợp lệ. Chỉ chấp nhận chữ cái, số, gạch ngang, gạch dưới, dấu chấm và gạch chéo (tối đa 128 ký tự).",
  "errorCode": "INVALID_FORMAT",
  "checkedAt": "2026-08-20T06:30:00.000Z"
}
```
