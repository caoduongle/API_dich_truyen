# Module & Behavioral Contracts: Feature 168

**Feature**: `specs/168-rate-limit-cooldown-wait-recovery`  
**Date**: 2026-11-27

---

## 1. Error Classifier Contract (`src/services/gemini/geminiErrorClassifier.ts`)

### `extractRetryDelayMs(message: string, details?: unknown[]): number | undefined`
- Kiểm tra `details` để tìm phần tử có `@type` chứa `'RetryInfo'` và trường `retryDelay` dạng chuỗi (ví dụ `"36s"`, `"36.580235449s"`, `"1200ms"`, `"1.5m"`).
- Nếu không có trong `details`, quét `message` theo các mẫu chuẩn của Google Gemini API:
  - `Please retry in <num>(ms|s|m)`
  - `retry after <num>(ms|s|m)`
- Quy đổi sang mili-giây, làm tròn lên (`Math.ceil`), cộng `RETRY_DELAY_SAFETY_BUFFER_MS` (`1500ms`), và đảm bảo ít nhất `2000ms` nếu trích được giá trị dương. Trả về `undefined` nếu không tìm thấy.

### `classifyGeminiError(httpStatus, responseBody, rawError)`
- Với `httpStatus === 429 || rpcStatus === 'RESOURCE_EXHAUSTED'`:
  1. Kiểm tra dấu hiệu ngày (`day`, `daily`, `per_day`, `requestsperday`) trong `QuotaFailure.violations` và `ErrorInfo.metadata` → `QUOTA_EXHAUSTED_RPD` (`recommendedCooldownMs: -1`).
  2. Kiểm tra dấu hiệu phút (`minute`, `per_minute`, `requestsperminute`, `tokensperminute`, `RATE_LIMIT_EXCEEDED`, `generate_content_free_tier_requests` kèm giới hạn RPM trong message, hoặc có `retryDelay <= 120_000ms` mà không có dấu hiệu ngày) → `RATE_LIMIT_RPM` (`recommendedCooldownMs: retryDelayMs ?? 45_000`).
  3. Sau đó mới fallback sang `QUOTA_EXHAUSTED_RPD` nếu message chỉ ghi chung `quota`/`daily`/`exhausted`.

---

## 2. Quota Tracker & Key Scheduler Contract (`localQuotaTracker.ts`, `geminiKeyScheduler.ts`, `geminiClient.ts`)

- `localQuotaTracker.recordFailure` phải dùng `classified.recommendedCooldownMs` (> 0) cho `RateLimited` và `Cooldown` thay vì hằng số cố định 45s.
- `localQuotaTracker.getPoolCooldownAnalysis(keys, customLimits, now)` xác định chính xác xem có key nào đang hồi phục ngắn hạn hay toàn bộ đã cạn hạn mức dài hạn.
- `initKeySchedule` & `executeLogicalGeminiCall`:
  - Khi không còn key sẵn sàng ngay nhưng `hasRecoverableCooldown && minCooldownRemainingMs <= 120_000`, ném `GeminiRequestError` với:
    - `code: 'ALL_KEYS_EXHAUSTED'`
    - `category: 'RATE_LIMIT_RPM'`
    - `isRetryable: true`
    - `retryAfterMs: minCooldownRemainingMs`
  - Khi `allPermanentlyExhausted` hoặc `minCooldownRemainingMs > 120_000`, ném `GeminiRequestError` với:
    - `code: 'ALL_KEYS_EXHAUSTED'`
    - `category: 'QUOTA_EXHAUSTED_RPD'`
    - `isRetryable: false`

---

## 3. Bulk Glossary Scan Contract (`src/hooks/useGlossaryScan.ts`)

- **Nhận diện dừng/chờ**: kiểm tra đồng thời `err?.code === 'ALL_KEYS_EXHAUSTED'` lẫn chuỗi message quen thuộc (`Toàn bộ API Key đã hết hạn mức` / `ALL_KEYS_EXHAUSTED`).
- **Tự động chờ hồi phục RPM**:
  - Kiểm tra cả trước khi chạy chương và trong nhánh `catch` khi nhận `RATE_LIMIT_RPM` kèm `retryAfterMs <= 120_000`.
  - Giới hạn tối đa `2` lần chờ tự động trên mỗi chương (`chapterCooldownWaits < 2`).
  - Dùng `waitForCooldownWithAbort(waitMs, signal)` để hủy tức thì (< 500ms) khi người dùng bấm Dừng hoặc component unmount.
  - Khi hết thời gian chờ, chạy lại đúng chương `i` (giảm `i--` / `continue` vòng lặp mà không đẩy `chap.id` vào `newlyFailedIds`).
- **Dừng sạch khi hết hạn mức thực sự**:
  - Lưu `chap.id` hiện tại và mọi `scopedChaps.slice(i)` chưa hoàn thành vào `failedIds` của `glossaryScanQueueState`.
  - Ngừng cả vòng lặp `for (i)` lẫn vòng lặp `for (loop)` và bỏ qua mọi vòng sau.
  - Ghi log kết thúc rõ ràng: `"=== TIẾN TRÌNH QUÉT LỌC TẠM DỪNG DO HẾT HẠN MỨC QUOTA ==="` thay vì `"=== ĐÃ HOÀN TẤT TOÀN BỘ QUY TRÌNH QUÉT LỌC TỰ ĐỘNG THÀNH CÔNG ==="`.
- **Giãn nhịp chủ động**: giữa các chương liên tiếp (`i > 0` hoặc từ vòng 2), áp dụng khoảng nghỉ tối thiểu dựa trên `getDynamicPacingInterval` chia theo số lượng key khả dụng khi pool key nhỏ để tránh spam chạm ngưỡng 15 RPM.
