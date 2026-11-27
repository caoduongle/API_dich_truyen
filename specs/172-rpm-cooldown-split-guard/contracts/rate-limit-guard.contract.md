# Contracts: Rate-Limit Guard, Cooldown Recovery & Pipeline Integrity

**Feature**: `172-rpm-cooldown-split-guard` | **Date**: 2026-11-28

Tài liệu này quy định các hợp đồng giao diện nội bộ (internal module contracts) giữa các tầng `gemini/`, `localQuotaTracker`, `translation/` và `hooks/` để đảm bảo các bên tuân thủ nhất quán khi triển khai và viết test.

---

## 1. Hợp đồng Quota Tracker & Key Scheduler

### 1.1 `localQuotaTracker.getKeyHealth(key, now, customLimit, options?)`
- **Preconditions**: Nhận `key` hợp lệ và `customLimit` (nếu từ `localStorage`, mọi trường `maxRpm`/`maxTpm`/`maxRpd` phải qua chuẩn hóa `Number.isFinite(v) && v > 0`, bỏ qua giá trị hỏng). Mặc định kiểm tra cửa sổ 60s chỉ kích hoạt khi có `customLimit` hợp lệ hoặc `options?.enforceProactiveLimits` được bật, và không chặn cứng `MIN_REQUEST_INTERVAL` 4.6s để giữ tương thích test liên tiếp.
- **Postconditions**:
  1. Kiểm tra `maxRpd` (`requestsToday >= customLimit.maxRpd`) → `isAvailable: false`, `isCustomLimitReached: true`.
  2. Kiểm tra `AuthFailed`, `QuotaExhausted`, cooldown `cooldownUntil > now` → `isAvailable: false`, `isProactivePacing: false`.
  3. Kiểm tra cửa sổ trượt 60s (`recentAttempts` trong `[now - 60_000, now]`): nếu `count >= effectiveMaxRpm`, trả về:
     - `state: stats.healthState` (giữ `'Healthy'`, không gán `'RateLimited'`)
     - `isAvailable: false`
     - `isProactivePacing: true`
     - `cooldownRemainingMs`: thời gian (ms) tới khi bản ghi cũ nhất trong `recentAttempts` rơi khỏi cửa sổ 60s + safety buffer nhỏ (ví dụ `200ms`), bị kẹp trần hữu hạn an toàn.
  4. Kiểm tra cửa sổ trượt 60s token (`recentTokens` trong `[now - 60_000, now]`): nếu `tokensThisMinute >= effectiveMaxTpm`, trả về `state: stats.healthState`, `isAvailable: false`, `isProactivePacing: true`, `cooldownRemainingMs` theo entry token cũ nhất rơi khỏi cửa sổ 60s.
  5. Khi còn đủ ngưỡng RPM/TPM, trả về `isAvailable: true`, `cooldownRemainingMs: 0`, `isProactivePacing: false`.

### 1.2 `localQuotaTracker.findNextAvailableKeyIndex(keys, startIndex, customLimits, now)`
- **Hành vi chọn khóa nguội nhất & chống tranh chấp song song**: Khi có nhiều khóa cùng `isAvailable: true`, ưu tiên chọn khóa nguội nhất (có `lastRequestTimestamp` nhỏ nhất / `requestsThisMinute` thấp nhất) và dùng khoảng cách vòng tròn từ `startIndex` làm tie-breaker khi hai khóa ngang nhau. Trong `geminiClient.ts`, tuyệt đối không chèn `await` giữa bước chọn khóa và `recordProviderAttempt()`.

### 1.3 `localQuotaTracker.getPoolCooldownAnalysis(keys, customLimits, now)`
- Phân biệt rõ:
  - Khi còn ít nhất 1 khóa `isAvailable: true` → trả về `availableKeyIndex >= 0`, `allPermanentlyExhausted: false`.
  - Khi tất cả khóa tạm không khả dụng:
    - Nếu tất cả khóa có thể mở lại đều là `isProactivePacing: true` → `isProactivePacingOnly: true`, `hasRecoverableCooldown: true`, `allPermanentlyExhausted: false`, `minCooldownRemainingMs` theo khóa mở lại sớm nhất.
    - Nếu có cooldown lỗi `RateLimited`/`Cooldown` trong ngưỡng `<= MAX_AUTO_WAIT_COOLDOWN_MS` → `isProactivePacingOnly: false`, `hasRecoverableCooldown: true`, `allPermanentlyExhausted: false`.
    - Chỉ đặt `allPermanentlyExhausted: true` khi mọi khóa đều `AuthFailed`, `QuotaExhausted`, `isCustomLimitReached`, hoặc cooldown dài hơn `MAX_AUTO_WAIT_COOLDOWN_MS`.

---

## 2. Hợp đồng Gemini Client Cooldown & Overload Wait (`geminiClient.ts` + `geminiKeyScheduler.ts`)

### 2.1 `waitWithAbort(ms, signal)`
- Chờ đúng `ms` mili-giây; nếu `signal?.aborted` trước khi gọi hoặc được kích hoạt trong khi chờ, hủy timer ngay lập tức (`< 100ms`, chắc chắn `< 1s`) và ném `AbortError`.

### 2.2 Vòng lặp hồi phục opt-in trong `callGemini` / `directGeminiClient`
- **Tương thích ngược & bảo mật log**:
  - `DirectGeminiRequestOptions` đồng bộ giữa `gemini/types.ts` và `directGeminiClient.ts` với `enableProactivePacing?: boolean` (mặc định `false`), `autoWaitForCooldown?: boolean` (mặc định `false`), `maxCooldownWaits?: number`, `maxOverloadRetries?: number`, `onWaitStatus?: (info) => void`.
  - Mọi thông điệp `onWaitStatus` chỉ chứa chỉ số khóa (`Key #1..#N`) hoặc số khóa nguội, tuyệt đối không ghi raw API key.
  - Các caller dịch thuật (`rawTranslation`, `polishTranslation`, `qaCritique`, `targetedRepair`) bật tường minh `enableProactivePacing: true` và `autoWaitForCooldown: true`; `useGlossaryScan` giữ nguyên vòng chờ ngoài để không bị chờ lặp kép.
- **Tách riêng 2 ngân sách chờ**:
  1. **Proactive Pacing Wait (`isProactivePacingOnly === true`)**: Không giới hạn số lần chờ trong phiên hay chương; chờ đúng `minCooldownRemainingMs`, ghi thông báo qua callback `onWaitStatus` (nếu có), sau đó thử chọn lại khóa và thực hiện request với full `overallDeadlineMs` mới.
  2. **Passive Recovery Wait (`429 RPM` toàn pool hoặc `503 SERVICE_OVERLOAD`)**:
     - Cho phép chờ tối đa `maxCooldownWaits ?? MAX_COOLDOWN_WAITS_PER_CHAPTER` lần (mặc định `2`) cho pool cooldown 429 RPM, và tối đa `maxOverloadRetries ?? MAX_OVERLOAD_RETRIES` lần (mặc định `2`) cho `503 SERVICE_OVERLOAD` (exponential backoff ngắn hoặc cooldown khóa).
     - Nếu người dùng abort trong lúc chờ → ném `AbortError` ngay lập tức.
     - Nếu hết ngân sách chờ bị động mà vẫn lỗi → ném `GeminiRequestError` mang đúng `category` (`RATE_LIMIT_RPM`, `QUOTA_EXHAUSTED_RPD`, `SERVICE_OVERLOAD`).

---

## 3. Hợp đồng `translationValidation.ts` & `chapterTranslationService.ts`

### 3.1 `classifyTranslationOutcome(err)`
- **BẤT BIẾN**: Mọi `GeminiRequestError` (hoặc lỗi mang category tương ứng) có `category` thuộc `'RATE_LIMIT_RPM' | 'SERVICE_OVERLOAD' | 'NETWORK_FAILURE' | 'QUOTA_EXHAUSTED_RPD' | 'AUTH_FAILURE' | 'RESOURCE_NOT_FOUND'` **BẮT BUỘC** trả về **`canSplitRetry: false`**.
- Chỉ các lỗi nội dung sau mới được phép trả về `canSplitRetry: true`:
  - `CONTENT_BLOCKED`
  - `UNTRANSLATED_CHINESE_LEFTOVER`
  - `PARAGRAPH_STRUCTURE_DIVERGENCE`
  - `POLISH_TRUNCATION_DETECTED`
  - Phản hồi rỗng thực sự (`'phản hồi rỗng'`, `'kết quả trả về trống'`, `'EMPTY_RESPONSE'`)

### 3.2 Hợp đồng nhãn `onSplitRetry` & lỗi GĐ3
- Trong `chapterTranslationService.ts`, ánh xạ lý do hiển thị cho GĐ1 & GĐ2 phải phân biệt rạch ròi mọi mã nội dung và không dùng `'Phản hồi rỗng'` cho trường hợp chưa nhận diện.
- Khi GĐ3 (`qaCritiqueDirect`) gặp lỗi `429`/`503` sau khi đã hoàn tất GĐ2, **không** hủy bỏ kết quả `currentTextToPolish`; vẫn lưu bản GĐ2 tốt vào chương và ghi cảnh báo GĐ3 rõ nguyên nhân hạ tầng (chỉ dừng lô nếu lỗi xác định toàn bộ khóa cạn hạn mức ngày thật sự).

### 3.3 Hợp đồng tính `hasPartialFallback` cuối cùng
- Không lấy trực tiếp `rawHasPartialFallback || lastPolishIsPartial` làm kết quả cuối nếu GĐ2/GĐ3 đã chạy trên `cleanPolished`.
- Gọi hàm đánh giá lại `evaluateFinalPartialFallback({ sourceText, finalText, rawHasPartialFallback, lastPolishIsPartial, qaRunSucceeded, unresolvedCriticals })` trả về `{ isPartialFallback: boolean; reason?: string }` trước khi trả `SingleChapterResult.hasPartialFallback`.
