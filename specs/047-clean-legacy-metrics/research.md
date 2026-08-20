# Phase 0 Research: Canonical Metrics Hierarchy & Backward Compatibility

**Feature**: `047-clean-legacy-metrics`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Phân Tích Hiện Trạng & Xung Đột Ngữ Nghĩa (Semantic Overlap)

### Vấn Đề
Trước đây, trong `KeyQuotaSnapshot` và `KeyObservedAttempts`:
- `requestsTotal` và `providerAttemptsTotal` cùng tồn tại song song nhưng không phân định rõ ràng giữa yêu cầu logic của người dùng, số lần gọi upstream HTTP tới Google, và số lần một key được kích hoạt.
- Điều này dẫn đến sự nhầm lẫn khi 1 logical request có 3 retries qua 3 keys khác nhau.

---

## 2. Mô Hình Phân Tầng Số Liệu Chuẩn Tắc (Canonical Metrics Hierarchy)

```
                            LOGICAL LEVEL (Client / User Request)
                            ┌──────────────────────────────────────┐
                            │ logicalRequests: 1                   │
                            │ successfulRequests: 1                │
                            │ failedRequests: 0                    │
                            └──────────────────┬───────────────────┘
                                               │
                                               ▼
                           PROVIDER LEVEL (Google GenAI Upstream)
                           ┌──────────────────────────────────────┐
                           │ providerAttempts: 3                  │
                           │ retries: 2                           │
                           │ providerFailures: 2                  │
                           └──────────────────┬───────────────────┘
                                              │
                     ┌────────────────────────┼────────────────────────┐
                     ▼                        ▼                        ▼
              KEY 1 (Attempt 1)        KEY 2 (Attempt 2)        KEY 3 (Attempt 3)
           ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
           │ keyAttempts: 1      │  │ keyAttempts: 1      │  │ keyAttempts: 1      │
           │ keyFailures: 1      │  │ keyFailures: 1      │  │ keyFailures: 0      │
           │ keyCooldowns: 1     │  │ keyCooldowns: 1     │  │ keyCooldowns: 0     │
           └─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

---

## 3. Kịch Bản Kiểm Thử Bắt Buộc

1. `1 request / 1 attempt`: 1 logical request thành công ngay lần thử đầu $\to$ `logicalRequests = 1`, `successfulRequests = 1`, `failedRequests = 0`, `providerAttempts = 1`, `retries = 0`, `keyAttempts = 1`.
2. `1 request / 3 attempts`: 1 logical request retry qua 3 keys (key1 fail, key2 fail, key3 success) $\to$ `logicalRequests = 1`, `successfulRequests = 1`, `failedRequests = 0`, `providerAttempts = 3`, `retries = 2`, `providerFailures = 2`.
3. `multiple logical requests`: 5 logical requests (3 thành công, 2 thất bại) $\to$ `logicalRequests = 5`, `successfulRequests = 3`, `failedRequests = 2`.
4. `all retries fail`: 1 logical request thử toàn bộ $N$ keys và fail hết $\to$ `logicalRequests = 1`, `successfulRequests = 0`, `failedRequests = 1`, `providerAttempts = N`, `retries = N - 1`, `providerFailures = N`.
