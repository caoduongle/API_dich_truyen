# Interface Contract: Translation Resilience & Error Taxonomy

**Contract ID**: `translation-resilience-contract-v1`  
**Feature**: `013-model-quota-resilience`  

---

## 1. Error Response Envelope

Khi xảy ra lỗi tại bất kỳ endpoint dịch thuật hoặc xử lý nào:

```json
{
  "error": "Mô tả lỗi an toàn và dễ hiểu cho người dùng",
  "code": "RATE_LIMITED",
  "requestId": "req_1724089200_a8f9",
  "isRetryable": true,
  "retryAfterSec": 5,
  "details": {
    "keyIndex": 1,
    "model": "gemini-2.5-flash"
  }
}
```

---

## 2. Error Code Mapping

| `AIErrorCode` | HTTP Status | Retryable? | Recommended Client/Scheduler Action |
|---|---|---|---|
| `RATE_LIMITED` | 429 | Yes | Chờ `retryAfterSec` hoặc xoay sang API key khác |
| `QUOTA_EXCEEDED` | 429 | No (for current key) | Đánh dấu key QuotaExhausted, chuyển key tiếp theo |
| `AUTH_FAILED` | 401 | No (for current key) | Đánh dấu key AuthFailed/Disabled, thông báo người dùng |
| `MODEL_NOT_FOUND` | 400 / 404 | No | Đánh dấu model shutdown, chuyển sang model thay thế |
| `MODEL_UNSUPPORTED`| 400 | No | Kiểm tra capabilities, từ chối thực thi |
| `INVALID_REQUEST` | 400 | No | Hiệu chỉnh tham số đầu vào |
| `SAFETY_BLOCKED` | 400 | No | Hiển thị chi tiết bộ lọc cho người dùng chỉnh sửa văn bản gốc |
| `SERVER_ERROR` | 503 | Yes | Tạm hoãn và thử lại với exponential backoff |
| `NETWORK_ERROR` | 502 / 504 | Yes | Thử lại request |
| `TIMEOUT` | 504 | Yes | Thử lại hoặc chia nhỏ đoạn văn bản |
