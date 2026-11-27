# Research & Root-Cause Decisions: Feature 168

**Feature**: `specs/168-rate-limit-cooldown-wait-recovery`  
**Date**: 2026-11-27

## 1. Phân loại RPM vs. RPD & Trích xuất `retryDelay` (`src/services/gemini/geminiErrorClassifier.ts`)

- **Root Cause**:
  Thông điệp lỗi Free Tier 15 RPM thực tế của Google bắt đầu bằng `"You exceeded your current quota... * Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 15... Generate content requests per minute limit exceeded on Free Tier... Please retry in 36.580235449s."`.
  Trong `classifyGeminiError`, khi `details` không có `@type: ErrorInfo` với `RATE_LIMIT_EXCEEDED`, nhánh fallback kiểm tra `lowerMsg.includes('quota')` **trước** khi kiểm tra từ khóa theo phút (`per minute`, `requests per minute`, `please retry in ...s`), khiến lỗi 15 RPM thực tế bị phân loại nhầm thành `QUOTA_EXHAUSTED_RPD` (`recommendedCooldownMs: -1` → khóa key tới nửa đêm PST!). Đồng thời `RetryInfo.retryDelay` trong `details` và chuỗi `Please retry in Xs` chưa được trích xuất.
- **Decision**:
  - Thêm hàm thuần `extractRetryDelayMs(message: string, details?: unknown[]): number | undefined` hỗ trợ phân tích cả `RetryInfo.retryDelay` (`"36s"`, `"36.580235449s"`, `"1200ms"`) lẫn các mẫu chuỗi trong thông báo lỗi (`Please retry in 36.580235449s`, `retry after 45s`), làm tròn lên mili-giây và cộng đệm an toàn `+1500ms` (tối thiểu `2000ms` khi có giá trị hợp lệ).
  - Trong `classifyGeminiError` (mục HTTP 429 / `RESOURCE_EXHAUSTED`), ưu tiên kiểm tra chỉ dấu RPM/TPM (`per minute`, `per_minute`, `requestsperminute`, `tokensperminute`, `generate_content_free_tier_requests` kèm `limit: 15`/`per minute`, `RATE_LIMIT_EXCEEDED`, hoặc có `retryDelay` ngắn `<= 120_000ms` mà không có từ khóa theo ngày `day`/`daily`/`per_day`/`requestsperday`) **trước** nhánh fallback `quota`/`exhausted`. Khi khớp RPM, trả về `category: 'RATE_LIMIT_RPM'`, `recommendedCooldownMs: extractedRetryDelayMs ?? 45_000`.
  - Vẫn bảo toàn 100% hành vi phân loại `QUOTA_EXHAUSTED_RPD` (`recommendedCooldownMs: -1`) khi xuất hiện dấu hiệu theo ngày hoặc lỗi `'Daily limit exceeded'` / `'Quota exhausted'` thuần không kèm chỉ dấu phút hay `retryDelay` ngắn.
- **Alternatives considered**:
  - *Giữ cứng 45 giây cho mọi 429*: Khi Google yêu cầu 36,58s thì thừa chờ, còn khi Google yêu cầu 55–58s thì lại hết hạn quá sớm và dính 429 kép. Dùng chính xác `retryDelay + 1.5s` giải quyết triệt để cả hai trường hợp.

## 2. Thời gian Cooldown động & Phân tích Khả năng Hồi phục của Pool Khóa (`src/services/localQuotaTracker.ts`, `src/services/gemini/geminiKeyScheduler.ts`, `src/services/gemini/geminiClient.ts`)

- **Root Cause**:
  1. `localQuotaTracker.recordFailure` gán cứng `now + 45 * 1000` cho trạng thái `RateLimited` thay vì lấy `classified.recommendedCooldownMs`.
  2. `initKeySchedule` và `executeLogicalGeminiCall` khi thấy `findNextAvailableKeyIndex === -1` lập tức ném lỗi `ALL_KEYS_EXHAUSTED` với `category: 'QUOTA_EXHAUSTED_RPD'`, `isRetryable: false`, bất kể thực tế các khóa chỉ đang `RateLimited` trong 37 giây hay đã hết hạn mức ngày `QuotaExhausted`.
- **Decision**:
  - Trong `localQuotaTracker.recordFailure`, sử dụng `classified.recommendedCooldownMs > 0 ? classified.recommendedCooldownMs : 45_000` cho `RateLimited` (và tương tự với `Cooldown` 503).
  - Bổ sung phương thức `getPoolCooldownAnalysis(keys, customLimits, now)` trên `LocalQuotaTracker` (và tái xuất qua `geminiKeyScheduler.ts`) trả về `availableKeyIndex`, `minCooldownRemainingMs`, `nextRecoveringKeyIndex`, `hasRecoverableCooldown` (chỉ true khi không có key sẵn sàng ngay nhưng có ít nhất 1 key ở trạng thái `RateLimited`/`Cooldown` với `cooldownRemainingMs > 0`), và `allPermanentlyExhausted`.
  - Mở rộng `GeminiRequestError` thêm trường tùy chọn `retryAfterMs?: number`. Khi toàn bộ key đang tạm nghỉ RPM trong ngưỡng ngắn (`minCooldownRemainingMs <= 120_000`), `initKeySchedule` / `executeLogicalGeminiCall` gắn `category: 'RATE_LIMIT_RPM'`, `isRetryable: true`, `retryAfterMs: minCooldownRemainingMs` thay vì gán nhầm `QUOTA_EXHAUSTED_RPD`.
- **Alternatives considered**:
  - *Tự `sleep` bên trong `callGemini` mọi lúc*: Nếu `callGemini` tự ngủ 37s mặc định có thể đụng `overallDeadlineMs = 60_000` khi chương có nhiều chunk split, và khó báo log nhật ký chi tiết cho người dùng ở tầng UI quét. Để tầng điều phối `useGlossaryScan` (và/hoặc `directGeminiClient`) chủ động đọc `retryAfterMs` để ghi log đếm ngược và chờ có kiểm soát sẽ an toàn, minh bạch và dễ hủy tức thì hơn.

## 3. Chờ Hồi phục An toàn (Abort-Safe), Thử lại Đúng Chương 47 & Giãn nhịp trong `useGlossaryScan` (`src/hooks/useGlossaryScan.ts`)

- **Root Cause**:
  1. `useGlossaryScan.ts` kiểm tra `String(chapErr.message).startsWith("ALL_KEYS_EXHAUSTED")`, trong khi `GeminiRequestError.message` là `"Toàn bộ API Key đã hết hạn mức..."` còn `"ALL_KEYS_EXHAUSTED"` nằm ở `.code` → điều kiện không bao giờ khớp!
  2. Vì không nhận diện được dừng do hết hạn mức và không chờ RPM cooldown, vòng lặp lao qua toàn bộ 28 chương còn lại (48–75), rồi chạy lại 29 chương lỗi, rồi chạy Vòng 2 qua đủ 29 chương, cuối cùng in `"=== ĐÃ HOÀN TẤT TOÀN BỘ QUY TRÌNH QUÉT LỌC TỰ ĐỘNG THÀNH CÔNG ==="` sai hoàn toàn.
- **Decision**:
  - Tạo helper thuần có kiểm soát hủy `waitForCooldownWithAbort(waitMs: number, signal?: AbortSignal): Promise<void>` (giải phóng ngay với `AbortError` khi `signal` abort).
  - Nhận diện chính xác cả lỗi RPM tạm thời (`err.code === 'ALL_KEYS_EXHAUSTED' && err.category === 'RATE_LIMIT_RPM'` hoặc `retryAfterMs <= 120_000`) lẫn cạn hạn mức thực sự (`err.code === 'ALL_KEYS_EXHAUSTED' || err.message.includes('Toàn bộ API Key đã hết hạn mức')`).
  - Khi còn có thể hồi phục RPM (`retryAfterMs <= 120_000`) và số lần chờ của chương hiện tại `< 2`: ghi log rõ ràng đang tạm chờ hồi phục (~`Math.ceil(waitMs / 1000)`s), gọi `waitForCooldownWithAbort`, và **thử lại đúng chương `i`** mà không đánh dấu lỗi.
  - Bổ sung giãn nhịp chủ động giữa các chương (dùng `getDynamicPacingInterval` và phân tích `localQuotaTracker`) theo số lượng key khả dụng để tránh spam vượt trần 15 RPM.
  - Khi chạm ngưỡng hết hạn mức thực sự (RPD hết, `retryAfterMs > 120_000`, hoặc quá 2 lần chờ không hồi phục): thu thập toàn bộ các chương chưa hoàn thành từ `i` đến cuối `scopedChaps` vào `failedIds`, thoát **cả vòng lặp chương lẫn vòng lặp `extractionLoops`**, và ghi log kết thúc dừng do hết hạn mức thay vì thông báo hoàn tất thành công.

## 4. Không thay đổi Core Schema (`src/types.ts` & IndexedDB)

- **Decision**: Giữ nguyên `StoryProject` và `glossaryScanQueueState.failedIds` trong `src/types.ts` và IndexedDB. Tuân thủ Hiến pháp Nguyên tắc IV.
