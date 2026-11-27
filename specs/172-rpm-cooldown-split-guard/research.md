# Phase 0 Research: Bảo vệ Hạn mức RPM, Chặn Bão Chia Nhỏ & Đánh giá Chính xác Trạng thái Phục hồi

**Feature**: `172-rpm-cooldown-split-guard` | **Date**: 2026-11-28

## 1. Điều tiết chủ động `RPM`/`TPM` trong cửa sổ trượt 60 giây trước từng lượt gọi (`FR-009`, `FR-003`)

- **Decision**: Thực thi kiểm tra chủ động (`Proactive Gate`) ngay trong `localQuotaTracker.getKeyHealth()` và `geminiClient.executeLogicalGeminiCall()` bằng cách đếm trực tiếp `recentAttempts` (tính `RPM` 60s) và `recentTokens` (tính `TPM` 60s) so với `customLimits[hash].maxRpm` / `maxTpm` (hoặc giới hạn chuẩn an toàn của model khi chưa có custom limit) kết hợp kiểm tra khoảng giãn cách tối thiểu giữa hai request trên cùng khóa. Khi chọn khóa khả dụng tiếp theo, ưu tiên khóa còn trống và có `lastRequestTimestamp` lâu nhất (nguội nhất). Nếu tất cả khóa chỉ bị chặn bởi ngưỡng chủ động (hoặc đang tạm nghỉ `RateLimited`/`Cooldown`), `geminiClient` chờ đúng `minWaitMs` theo `AbortSignal` và thử lại.
- **Rationale**:
  - Trước đây, `getKeyHealth()` chỉ kiểm tra `maxRpd`, còn `maxRpm` chỉ được dùng ở `useTranslationProcess.ts` để `setTimeout` đúng một lần *giữa hai chương*. Một chương chạy 1 lần GĐ1 + 2–3 lần GĐ2 + 1 lần GĐ3 + sửa đoạn QA sẽ bắn 4–6 request (hoặc 15–45 request khi split) không có phanh RPM/TPM nào.
  - Đưa cổng kiểm tra vào tầng `localQuotaTracker` + `geminiClient` bảo vệ mọi caller (`rawTranslation`, `polishTranslation`, `qaCritique`, `targetedRepair`, `useGlossaryScan`) từ một nguồn sự thật duy nhất (Constitution Principle II & III).
- **Alternatives considered**:
  - *Chỉ tăng `pacingDelay` giữa hai chương trong `useTranslationProcess.ts`*: Bị loại vì không kiểm soát được chuỗi nhiều request bên trong cùng 1 chương (GĐ1 → GĐ2 → GĐ3 → QA repair).
  - *Tạo hàng đợi token-bucket riêng ngoài `localQuotaTracker`*: Bị loại vì `localQuotaTracker` đã lưu sẵn `recentAttempts` và `recentTokens` trong cửa sổ 60s; nhân đôi trạng thái sẽ gây lệch số liệu trên `QuotaPanel`.

## 2. Tách biệt bộ đếm chờ chủ động (unlimited) với chờ lỗi bị động 429/503 (bounded) (`FR-003`, `FR-004`, `FR-005`)

- **Decision**:
  - Trong `PoolCooldownAnalysis`, tách rõ hai trạng thái:
    1. `isProactivePacingOnly`: Toàn bộ khóa khỏe (không bị lỗi 429/503 hay RPD), chỉ đang tự hãm để tôn trọng `RPM`/`TPM` 60s đã cài. Nhóm này **không tiêu tốn** ngân sách chờ lỗi (`passiveRecoveryWaits`) và không bị giới hạn số lần chờ trong một chương hay một phiên nhiều chương.
    2. `hasRecoverableCooldown`: Có khóa đang chịu cooldown lỗi thực tế từ nhà cung cấp (`429 RPM` hoặc `503 SERVICE_OVERLOAD`). Nhóm này dùng bộ đếm bị động có trần an toàn (`MAX_COOLDOWN_WAITS_PER_CHAPTER = 2` đối với 429 RPM toàn pool và `MAX_OVERLOAD_RETRIES` ngắn cho `503 high demand`) trên mỗi logical request / chương để tránh treo vô hạn khi hạ tầng lỗi kéo dài.
  - Mọi khoảng thời gian ngủ do chờ chủ động hoặc chờ hồi phục không được ăn vào HTTP `overallDeadlineMs` của lượt gọi tiếp theo (mỗi lượt gọi AI thực tế sau khi thức dậy đều được cấp trọn ngân sách timeout của lượt gọi đó) và phải bắt `AbortSignal` để hủy tức thì trong dưới 1 giây.
- **Rationale**: Đáp ứng trực tiếp yêu cầu của người dùng trong `/speckit-clarify` (Câu 1 & Câu 3): máy có thể chạy xuyên suốt lô 76+ chương qua cửa sổ trượt 60s mà không tự ngắt bắt bấm tay, trong khi vẫn an toàn trước lỗi treo vô hạn khi Google hoặc mạng hỏng thật.
- **Alternatives considered**:
  - *Gộp chung trần 2 lần chờ/chương cho cả chờ chủ động*: Bị loại vì sẽ khiến các chương dài hoặc lô nhiều chương tự ngắt giữa chừng dù toàn bộ khóa còn rất nhiều hạn mức ngày.

## 3. Chống khóa oan `"Hết hạn mức ngày"` cho lỗi `429` mơ hồ (`FR-013`)

- **Decision**:
  - Trong `geminiErrorClassifier.ts`, khi HTTP status là `429`/`RESOURCE_EXHAUSTED`, chỉ phân loại ngay thành `QUOTA_EXHAUSTED_RPD` nếu có bằng chứng rõ theo ngày (`DAILY_LIMIT_KEYWORDS_REGEX`: `day`, `daily`, `per_day`, `requestsperday`, `rpd` trong `QuotaFailure`, `ErrorInfo` hoặc `message`). Nếu `message` chỉ chứa từ khóa chung `"quota"` hoặc `"exhausted"` mà không có từ khóa ngày lẫn `retryDelay` phút rõ ràng, gán `reason: 'MessageFallback_AmbiguousQuota'` với category ban đầu là `RATE_LIMIT_RPM` (kèm cờ phân biệt mức độ nghi ngờ).
  - Trong `localQuotaTracker.recordFailure()`, theo dõi `consecutiveAmbiguous429` trên mỗi khóa:
    - Lần đầu gặp `MessageFallback_AmbiguousQuota` khi `requestsToday` vẫn thấp hơn `effectiveMaxRpd` (ví dụ chưa đạt 80% `maxRpd`), đặt khóa vào `RateLimited` tạm nghỉ 45–60 giây.
    - Nếu ngay sau thời gian tạm nghỉ đó, khóa tiếp tục nhận `429` liên tiếp (`consecutiveAmbiguous429 >= 2`) mà chưa có `recordSuccess()` xen giữa (reset về 0 khi thành công), mới nâng cấp lên `QuotaExhausted` tới nửa đêm PST.
- **Rationale**: Giải thích trực tiếp hiện tượng Khóa #2 trong ảnh chụp của người dùng mới gọi `18 / 500` lượt đã bị khóa `"Hết hạn mức ngày"` cả ngày chỉ vì dòng fallback `lowerMsg.includes('quota') || lowerMsg.includes('exhausted')` ở `geminiErrorClassifier.ts:261-262`.
- **Alternatives considered**:
  - *Không bao giờ chuyển sang `QuotaExhausted` nếu không thấy chữ `day`*: Bị loại vì một số API key có quota ngày thấp bất thường hoặc miễn phí cạn thật sự cần dừng gọi để tránh thử lại vô ích cả đêm.

## 4. Cấm `canSplitRetry` cho mọi lỗi hạ tầng ở mọi giai đoạn (`FR-001`, `FR-002`, `FR-006`)

- **Decision**:
  - Sửa `classifyTranslationOutcome()` trong `translationValidation.ts`:
    - `RATE_LIMIT_RPM`, `SERVICE_OVERLOAD`, `NETWORK_FAILURE` chuyển từ `canSplitRetry: true` → **`canSplitRetry: false`** (giữ nguyên `type: 'RETRYABLE', isRetryable: true`).
  - Trong `geminiClient.ts`, khi `503`/`500` (`SERVICE_OVERLOAD`) xảy ra và toàn bộ khóa đã quay vòng hoặc tạm nghỉ ngắn, nâng lỗi thành `GeminiRequestError` với `category: 'SERVICE_OVERLOAD'`, `retryAfterMs` rõ ràng để nhánh chờ hồi phục ngắn (`waitWithAbort`) xử lý thống nhất, thay vì ném `Error` thuần khiến chương bị skip ngay như Chương 34 trong log.
  - Kiểm tra nhánh đệ quy bên trong `rawWithContentSplitDirect()` và `polishWithContentSplitDirect()`: khi một nhánh con đang split (vì lỗi nội dung hợp lệ trước đó) gặp lỗi hạ tầng (`canSplitRetry: false`), nhánh con ném lỗi thẳng lên để tầng `geminiClient` chờ hồi phục rồi thử lại đúng call đó, tuyệt đối không fallback sang `sino-fallback` hay chia nhỏ tiếp.
  - Sửa bộ chuyển đổi `reasonSummary` trong `chapterTranslationService.ts` (`onSplitRetry` cả GĐ1 lẫn GĐ2): mở rộng ánh xạ cho tất cả mã lỗi thực tế và dùng hậu phương trung tính `'Phản hồi bất thường không xác định'` thay vì fallback mù thành `'Phản hồi rỗng'`.
- **Rationale**: Triệt tiêu hoàn toàn bão chia `2 → 4 → 8 → 16` + `16x sino-fallback` ở Chương 35, 44–51 và loại bỏ việc gắn nhãn sai `"Phản hồi rỗng"` cho lỗi 429/503.
- **Alternatives considered**:
  - *Chỉ bắt riêng chuỗi `'Toàn bộ API Key đang tạm nghỉ'` trong `chapterTranslationService.ts`*: Bị loại vì bỏ sót lỗi xảy ra trong `rawWithContentSplitDirect`, `polishWithContentSplitDirect`, `qaCritiqueDirect` và lỗi `503`.

## 5. Giảm tần suất chia nhỏ dư thừa ở GĐ1 và GĐ2 (`FR-008`, `SC-003`)

- **Decision**:
  - **Ở GĐ1 (`rawTranslation.ts`)**: Sau `realignParagraphStructure()`, nếu số đoạn thân bài lệch nhỏ (`<= 2` đoạn hoặc tỉ lệ `<= 15%`) nhưng không sót chữ Hán (`validateTranslationOutput` đã qua) và tổng độ dài bản dịch vẫn bảo toàn nội dung đầy đủ, áp dụng căn chỉnh đoạn an toàn (như gộp/tách theo ranh giới câu & khoảng trắng hoặc chuẩn hóa dòng tiêu đề) trước khi quyết định ném `PARAGRAPH_STRUCTURE_DIVERGENCE`; chỉ ném lỗi split khi cấu trúc vẫn lệch sau bước căn chỉnh an toàn hoặc có dấu hiệu mất nội dung/thiếu đoạn thực sự.
  - **Ở GĐ2 (`polishTranslation.ts` / `translationValidation.ts`)**: Kiểm tra hàm `validatePolishIntegrity()`: hiện tại việc cảnh báo `POLISH_TRUNCATION_DETECTED` dễ bị kích hoạt giả khi bản chuốt viết gọn từ ngữ hơn bản thô (nhất là trên văn phong hiện đại hoặc chương ngắn) dù số đoạn đã khớp 1-1 đủ 100%. Chỉ ném `POLISH_TRUNCATION_DETECTED` khi bản chuốt thiếu đoạn, cắt dở câu cuối, hoặc tỷ lệ độ dài tụt xuống mức mất nghĩa thực sự kèm kiểm tra tỷ lệ độ dài trên số lượng đoạn thực tế.
- **Rationale**: Trong 35 chương đầu của log, phần lớn lượt gọi thừa xuất phát từ 2 lỗi này; giảm chúng > 60% giúp giữ số lượt gọi tự nhiên nằm gọn dưới trần `15 RPM` mà không cần chờ lâu.
- **Alternatives considered**:
  - *Bỏ hoàn toàn kiểm tra 1-1 hoặc kiểm tra cắt cụt*: Bị loại vì vi phạm nguyên tắc bảo toàn chất lượng chống bỏ sót đoạn.

## 6. Bảo toàn kết quả GĐ2 khi GĐ3 lỗi & đánh giá lại `hasPartialFallback` trên bản dịch cuối (`FR-010`, `FR-011`, `SC-004`)

- **Decision**:
  - **GĐ3 (`qaCritiqueDirect` / `repairChapterCriticalIssuesDirect`)**: `chapterTranslationService.ts` đã bọc GĐ3 trong `try/catch` để không làm mất `currentTextToPolish` từ GĐ2 khi GĐ3 gặp lỗi. Cần đảm bảo lỗi `ALL_KEYS_EXHAUSTED` thật sự (cạn ngày không thể chờ) vẫn có cơ chế thông báo dừng lô sau khi đã lưu bản GĐ2 tốt hoặc rõ ràng hóa thông báo `chưa kiểm duyệt AI do giới hạn hạ tầng`, trong khi lỗi tạm thời đã được `geminiClient` tự chờ + thử lại 1–2 lần trước khi fallback giữ nguyên GĐ2.
  - **Tính lại `hasPartialFallback`**: Thay vì giữ cứng `rawHasPartialFallback || lastPolishIsPartial`, sau khi GĐ2 và GĐ3 hoàn tất trên `finalDraft = cleanPolished || cleanRaw`, thực hiện kiểm tra cuối:
    - Chạy kiểm tra sót chữ Hán thực sự (`countChineseCharacters` / `runDeterministicTranslationChecks` không dùng cờ `isPartialFallback: true` để bịt mắt) và đối chiếu kết quả QA.
    - Nếu bản cuối sạch chữ Hán (`leftoverHanCount === 0`), có `cleanPolished.length > 0` hợp lệ, không còn lỗi nghiêm trọng về thiếu đoạn/sót chữ Hán (hoặc QA đã xác nhận đạt chuẩn/đã sửa sạch), đặt `hasPartialFallback = false`. Ngược lại (ví dụ bản cuối vẫn phải giữ nguyên văn thô GĐ1 có `sino-fallback`, hoặc vẫn còn chữ Hán/lỗi `raw_leak`), giữ `hasPartialFallback = true`.
- **Rationale**: Khắc phục chính xác trường hợp Chương 2, 19, 22, 28, 38 trong log: GĐ2 + QA đã dịch lại sạch hoàn toàn nhưng vẫn bị báo oan `còn đoạn dùng phiên âm dự phòng`.
- **Alternatives considered**:
  - *Tắt hoàn toàn cờ `hasPartialFallback`*: Bị loại vì khi chương thực sự còn câu phiên âm thô hoặc chữ Hán sót ở bản cuối (như Chương 9 đoạn 45), người dùng vẫn cần được cảnh báo để rà soát.
