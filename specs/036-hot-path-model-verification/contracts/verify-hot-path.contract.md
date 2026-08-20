# Contract: Hot Path Validation & Single-Flight Verification

## 1. Hot Path Validation Error Contract

When `validateModelMiddleware` encounters an unverified model in a translation request:

- **Endpoint**: Any translation endpoint (`/api/translate-raw`, `/api/polish-translation`, `/api/qa-critique`, `/api/align-chapter`, etc.)
- **Status**: `400 Bad Request`
- **Response Format**:
  ```json
  {
    "error": "Mô hình AI \"custom-model-id\" chưa được xác minh hoặc không tương thích với quy trình dịch thuật. Vui lòng kiểm tra và xác minh mô hình trong Cấu hình AI.",
    "code": "MODEL_UNVERIFIED",
    "model": "custom-model-id"
  }
  ```
- **Performance Requirement**: Latency $\le 5$ms. Total external network calls $= 0$.

---

## 2. Explicit Verification Endpoint Contract

- **Endpoint**: `POST /api/verify-model`
- **Request Body**:
  ```json
  {
    "modelId": "tunedModels/my-novel-v1",
    "label": "Tên Tùy Chỉnh",
    "apiKeys": ["AIzaSy..."]
  }
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "verified": true,
    "model": {
      "id": "tunedModels/my-novel-v1",
      "label": "Tên Tùy Chỉnh",
      "source": "custom",
      "status": "active",
      "verified": true,
      "verificationState": "verified",
      "lastVerifiedAt": "2026-08-20T06:30:00.000Z",
      "capabilities": {
        "generateContent": true,
        "structuredOutput": true,
        "vision": true,
        "thinking": false
      },
      "limits": {
        "defaultRpm": 15,
        "defaultTpm": 1000000,
        "defaultRpd": 1500
      }
    },
    "checkedAt": "2026-08-20T06:30:00.000Z"
  }
  ```
- **Error Response (`400 Bad Request`)**:
  ```json
  {
    "success": false,
    "verified": false,
    "error": "Mô hình \"text-embedding-004\" không hỗ trợ phương thức tạo nội dung (generateContent). Không tương thích với quy trình dịch thuật.",
    "errorCode": "UNSUPPORTED_METHODS",
    "checkedAt": "2026-08-20T06:30:00.000Z"
  }
  ```
- **Concurrency Behavior**: If $N$ clients send identical requests concurrently, the server processes exactly 1 outbound Google API fetch and resolves all $N$ client responses with the same result.
