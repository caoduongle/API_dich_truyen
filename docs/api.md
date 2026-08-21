# Backend API Reference & Contract Specifications

## 1. Overview & Standard Headers

Tất cả các API endpoints của hệ thống được phục vụ trên tiền tố `/api` và hỗ trợ các HTTP headers tiêu chuẩn:

### Request Headers
- `x-session-token`: Token phiên làm việc tạm thời để server tra cứu API keys đã cấu hình trong `SessionStore`.
- `x-request-id`: Chuỗi định danh duy nhất của request (tạo bởi client hoặc server) được bảo toàn xuyên suốt các lần retry.
- `Content-Type`: `application/json`.

### Response Headers (HTTP Rate Limiting)
- `X-RateLimit-Limit`: Số lượng request tối đa cho phép trong cửa sổ trượt (mặc định: `60`).
- `X-RateLimit-Remaining`: Số lượng request còn lại của client IP trong cửa sổ hiện tại.
- `X-RateLimit-Reset`: Thời điểm timestamp (epoch seconds) cửa sổ được làm mới.
- `Retry-After`: Số giây client cần chờ trước khi thử lại khi bị trả về mã `HTTP 429 Too Many Requests`.

---

## 2. API Endpoints

### 2.1 Quản lý Phiên & Khóa API (Session & Credentials)

#### `POST /api/auth/session`
Khởi tạo phiên làm việc tạm thời và lưu trữ an toàn các API keys vào Server SessionStore.
- **Request Body**: `{ "apiKeys": ["AIzaSy...", "AIzaSy..."] }`
- **Response**: `{ "sessionToken": "uuid4...", "expiresIn": 86400, "keyCount": 2 }`

#### `GET /api/auth/session`
Kiểm tra trạng thái phiên làm việc hiện tại.
- **Headers**: `x-session-token: <token>`
- **Response**: `{ "valid": true, "keyCount": 2, "expiresIn": 82000 }`

---

### 2.2 Dịch thuật & Biên tập (Translation Services)

> **Lưu ý Kiến trúc (Direct Client Translation vs. Server Fallback)**:
> - **Người dùng có API key riêng**: Client trình duyệt gọi thẳng Google Gemini REST API (`https://generativelanguage.googleapis.com/v1beta/models/...:generateContent`) bằng header `x-goog-api-key`. Hoàn toàn không đi qua các endpoints máy chủ dưới đây, giải phóng 100% tài nguyên CPU và không bị chặn bởi ngưỡng `MAX_CONCURRENT_REQUESTS = 50`.
> - **Người dùng chưa có key (Server Fallback)**: Client tự động phân luồng tới các endpoints `/api/translate-raw`, `/api/polish-translation`, `/api/qa-critique` bên dưới để máy chủ dịch qua key dự phòng.

#### `POST /api/translate-raw` (Phase 1: Dịch thô & Trích xuất)
Thực hiện dịch thô bảo toàn cấu trúc câu và tự động phân tích phát hiện thực thể/thuật ngữ mới.
- **Request Body**:
  ```json
  {
    "text": "Văn bản tiếng Trung...",
    "model": "gemini-2.5-flash",
    "genre": "Tiên Hiệp",
    "tone": "Trầm ổn, cổ kính",
    "glossary": [{ "source": "王林", "target": "Vương Lâm" }]
  }
  ```
- **Response**:
  ```json
  {
    "text": "Bản dịch thô tiếng Việt...",
    "discoveredEntities": [{ "source": "...", "target": "...", "type": "character" }],
    "tokenStats": { "promptTokens": 120, "outputTokens": 180, "totalTokens": 300 }
  }
  ```

#### `POST /api/polish-translation` (Phase 2: Chuốt văn phong)
Biên tập và mượt mà hóa bản dịch theo ngữ cảnh thể loại.
- **Request Body**: `{ "rawText": "...", "originalText": "...", "genre": "Tiên Hiệp", "tone": "..." }`
- **Response**: `{ "text": "Bản dịch đã chuốt mượt mà..." }`

---

### 2.3 Quản lý Từ điển (Glossary Operations)

#### `POST /api/analyze-glossary`
Phân tích văn bản tiếng Trung để trích xuất danh sách thực thể/thuật ngữ chuyên ngành.
- **Request Body**: `{ "text": "Đoạn văn tiếng Trung..." }`
- **Response**: `{ "terms": [...] }`

---

### 2.4 Quản lý Mô hình & Hạn mức (Models & Quota Telemetry)

#### `GET /api/list-models`
Lấy danh sách các mô hình khả dụng từ Google Gemini (áp dụng bộ đệm SWR).
- **Query Params**: `?force=true` (ép buộc làm mới bỏ qua cache)
- **Response**: `{ "models": [...], "cached": true, "lastRefreshedAt": "2026-08-20T..." }`

#### `POST /api/verify-model`
Xác minh quyền truy cập và khả năng dịch thuật của một mô hình cụ thể.
- **Request Body**: `{ "modelId": "gemini-2.5-flash" }`
- **Response**: `{ "valid": true, "displayName": "Gemini 2.5 Flash", "supportedMethods": ["generateContent"] }`

#### `GET /api/quota`
Truy vấn dữ liệu hạn mức và sức khỏe thời gian thực của các API keys.
- **Response**:
  ```json
  {
    "keys": [
      {
        "maskedKey": "AIzaSy...4f2a",
        "healthState": "Healthy",
        "requestsToday": 42,
        "requestsThisMinute": 3,
        "tokensThisMinute": 1400,
        "circuitBreakerState": "Closed"
      }
    ],
    "aggregated": { "totalRequestsToday": 42, "totalTokensToday": 18500 }
  }
  ```

---

### 2.5 Giám sát Hệ thống & Sức khỏe (Health & Readiness)

#### `GET /api/health`
Kiểm tra sức khỏe tổng quan của máy chủ.
- **Response**: `{ "status": "ok", "uptime": 3600, "timestamp": 1700000000000 }`

#### `GET /api/health/ready`
Kiểm tra mức độ sẵn sàng phục vụ lưu lượng (Kubernetes/Docker readiness probe).
- **Response**:
  ```json
  {
    "ready": true,
    "redis": { "status": "connected", "isDegraded": false },
    "rateLimiter": { "algorithm": "sliding-window-counter", "localEntriesCount": 12 },
    "quotaScheduler": { "ready": true }
  }
  ```

---

## 3. Quy chuẩn Mã lỗi Hệ thống (Error Contracts)

Mọi phản hồi lỗi đều tuân thủ cấu trúc JSON đồng nhất:
```json
{
  "error": "Mô tả lỗi chi tiết bằng tiếng Việt hoặc tiếng Anh",
  "code": "MÃ_LỖI_CHUẨN",
  "retryAfterSec": 15,
  "requestId": "req-1700000000-abcd"
}
```

| Mã lỗi (`code`) | HTTP Status | Nguyên nhân | Hành động khuyến nghị |
|:---|:---|:---|:---|
| `RATE_LIMITED` | `429` | IP client gửi quá 60 request / 60s (HTTP Abuse Limiter) | Chờ theo giá trị `retryAfterSec` |
| `QUOTA_EXHAUSTED` | `429` | Tất cả API keys Gemini đã hết hạn mức ngày (RPD) | Chờ reset lúc nửa đêm PST hoặc thêm API key mới |
| `AUTH_FAILED` | `401` | Session token hết hạn hoặc API key không hợp lệ | Đăng nhập lại hoặc cập nhật API key |
| `MODEL_UNAVAILABLE` | `400` | Mô hình không tồn tại hoặc đã ngừng hoạt động | Hệ thống tự động chuyển sang mô hình thay thế |
| `TIMEOUT` | `504` | Lượt gọi API Google vượt quá thời gian chờ (15s/60s) | Hệ thống tự động retry với exponential backoff |
| `SERVER_DEGRADED` | `503` | Máy chủ đang trong trạng thái bảo trì hoặc quá tải | Thử lại sau ít phút |
