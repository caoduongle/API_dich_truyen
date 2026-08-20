# API Contract: Verify Model Endpoint (`POST /api/verify-model`)

**Feature**: `specs/035-custom-model-verification/spec.md`  
**Created**: 2026-08-20  

---

## 1. Endpoint Overview

- **Path**: `POST /api/verify-model`
- **Purpose**: Verify existence, access permissions, and translation capabilities (`generateContent`) for a specific model ID against Google AI Studio with server-side caching.
- **Middleware**: `resolveApiKeysMiddleware` (extracts session / body API keys).

---

## 2. Request Schema

### Request Body

```json
{
  "modelId": "tunedModels/my-custom-model",
  "label": "Tên gợi nhớ tùy chọn",
  "apiKeys": ["AIzaSyD-sample-key-1", "AIzaSyD-sample-key-2"]
}
```

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `modelId` | `string` | **Yes** | Model identifier (e.g. `gemini-2.5-flash`, `tunedModels/novel-v1`). Max 128 chars. |
| `label` | `string` | No | Custom friendly display label. |
| `apiKeys` | `string[]` | No | List of API keys (defaults to session keys if omitted). |

---

## 3. Response Schema

### 3.1 Success Response (HTTP 200 OK)

```json
{
  "success": true,
  "verified": true,
  "model": {
    "id": "tunedModels/my-custom-model",
    "label": "Tên gợi nhớ tùy chọn",
    "source": "custom",
    "status": "active",
    "verified": true,
    "verificationState": "verified",
    "lastVerifiedAt": "2026-08-20T06:00:00.000Z",
    "capabilities": {
      "generateContent": true,
      "vision": true,
      "thinking": false
    },
    "limits": {
      "defaultRpm": 15,
      "defaultTpm": 1000000,
      "defaultRpd": 1500
    },
    "description": "Model description from provider",
    "inputTokenLimit": 1048576,
    "outputTokenLimit": 8192,
    "addedAt": "2026-08-20T06:00:00.000Z"
  },
  "checkedAt": "2026-08-20T06:00:00.000Z"
}
```

### 3.2 Failure Responses (HTTP 400 / 404 / 504)

```json
{
  "success": false,
  "verified": false,
  "error": "Mô hình \"text-embedding-004\" không hỗ trợ phương thức tạo nội dung (generateContent). Không thể dùng để dịch thuật.",
  "errorCode": "UNSUPPORTED_METHODS",
  "checkedAt": "2026-08-20T06:00:00.000Z"
}
```

| Error Code | HTTP Status | Description |
| :--- | :--- | :--- |
| `INVALID_FORMAT` | 400 | Model ID contains invalid characters or path traversal. |
| `NO_API_KEYS` | 400 | No valid API keys provided to probe Google AI Studio. |
| `MODEL_NOT_FOUND` | 400 / 404 | Model not found on Google AI Studio or API key lacks permission. |
| `UNSUPPORTED_METHODS` | 400 | Model exists but lacks `generateContent` capability. |
| `TIMEOUT` | 504 | Google AI Studio request timed out after 15 seconds. |
| `API_ERROR` | 400 | General upstream provider error. |
