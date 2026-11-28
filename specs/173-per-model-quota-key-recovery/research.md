# Phase 0 Research: Cô lập Hạn mức theo Mô hình, Khôi phục Trạng thái Khóa & Minh bạch Nguyên nhân Cạn Quota

**Feature**: `173-per-model-quota-key-recovery`  
**Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/173-per-model-quota-key-recovery/spec.md)  
**Date**: 2026-11-28

---

## D1 — Per-`(Key, Model)` Health & Cooldown Isolation (`FR-001`, `FR-002`, `FR-011`)

- **Decision**:  
  Lưu trữ trạng thái sức khỏe, bộ đếm lỗi liên tiếp, trạng thái circuit breaker, mốc `cooldownUntil`, `transitionReason`, và cờ `isLowUsageDailyExhaustion` trực tiếp trong từng bản ghi `InternalModelStats` thuộc `InternalKeyStats.byModel` (khóa chuẩn hóa bằng `normalizeModelKey` dựa trên `normalizeModelId`), đồng thời giữ nguyên `AuthFailed` (`401/403`) ở cấp `InternalKeyStats` (toàn khóa). Truyền `model` qua `KeyHealthOptions` từ `geminiClient.ts` -> `geminiKeyScheduler.ts` -> `LocalQuotaTracker` (`getKeyHealth`, `findNextAvailableKeyIndex`, `getPoolCooldownAnalysis`) và `getQuotaStatus(..., selectedModel)` -> `useModelObservability`.

- **Rationale**:  
  - Hiện tại `LocalQuotaTracker` đã đếm `requestsToday`/`errorsToday` theo từng `model` trong `byModel`, nhưng toàn bộ trạng thái khóa (`healthState`, `cooldownUntil`, `circuitBreakerStatus`, `consecutiveAmbiguous429`) lại nằm duy nhất ở `InternalKeyStats`. Do đó khi `gemini-3.5-flash-lite` hết 500 RPD, chuyển sang `gemini-2.5-flash` trên cùng API key vẫn bị `isKeyAvailable` chặn oan.
  - Ngược lại, lỗi xác thực `401/403` (`AuthFailed`) chứng tỏ bản thân API key không hợp lệ hoặc bị thu hồi, nên phải tiếp tục khóa toàn cục trên mọi mô hình của khóa đó.
  - Khi người dùng gọi `getKeyHealth(key, now, customLimit)` mà **không** truyền `options.model`, hàm tiếp tục đọc trạng thái tổng hợp ở cấp `InternalKeyStats` để giữ 100% tương thích ngược cho các unit test và caller cũ.
  - Dữ liệu `sessionStorage` (`gemini_local_quota_tracker_v1`) từ phiên cũ không có các trường sức khỏe trong `byModel` sẽ mặc định khởi tạo từng model ở trạng thái `'Healthy'` (trừ khóa đang `AuthFailed`), bảo đảm `FR-011` không làm mất bộ đếm ngày và không chạm `src/types.ts` hay IndexedDB (`src/services/db.ts`).

- **Alternatives Considered**:  
  1. *Tạo `Map` tách biệt `modelHealthMap` ngoài `InternalKeyStats`*: Bị loại vì làm tăng gấp đôi logic serialize/deserialize `sessionStorage` và dễ lệch đồng bộ khi reset ngày PST hoặc xóa khóa.
  2. *Di chuyển hoàn toàn sang IndexedDB*: Vi phạm Constitution Principle IV (Storage Stability) và `FR-011`.

---

## D2 — Eliminate False Daily Quota Lockouts on Ambiguous `429` (`FR-009`, `US2`, `US4`, `SC-003`)

- **Decision**:  
  Loại bỏ hoàn toàn nhánh leo thang từ lỗi `MessageFallback_AmbiguousQuota` lần thứ 2 sang `QuotaExhausted` trong `LocalQuotaTracker.recordFailure` khi lượt dùng ngày của cặp `(Key, Model)` vẫn nhỏ hơn ngưỡng ngày tham chiếu (`effectiveRequestsToday < dailyReference`). Thay vào đó, áp dụng tạm nghỉ ngắn hạn tăng dần có kiểm soát (`RateLimited` với `CircuitBreaker = 'Open'`):
  - Lần 1 liên tiếp: `dynamicCooldownMs ?? 50_000` (~50s).
  - Lần 2 liên tiếp: `Math.max(dynamicCooldownMs ?? 0, 60_000)` (~60s).
  - Lần 3+ liên tiếp: `Math.min(RATE_LIMIT_RECOVERY_CONFIG.MAX_AUTO_WAIT_COOLDOWN_MS, Math.max(dynamicCooldownMs ?? 0, 120_000))` (~120s).
  Chỉ chuyển sang `QuotaExhausted` khi: (a) nhà cung cấp trả lỗi `QUOTA_EXHAUSTED_RPD` có tín hiệu ngày tường minh (`per day` / `RPD`), hoặc (b) `effectiveRequestsToday >= dailyReference` (hoặc chạm `customLimit.maxRpd`). Khi gặp `QUOTA_EXHAUSTED_RPD` tường minh lúc lượt đếm cục bộ còn thấp (`< 25%` ngưỡng ngày), đánh dấu `isLowUsageDailyExhaustion = true` kèm ghi chú tiếng Việt giải thích khả năng khóa đã tiêu hao ở ứng dụng khác hoặc dùng chung dự án Google Cloud.

- **Rationale**:  
  Xác nhận từ người dùng (`Session 2026-11-28`: *không cùng project*) chứng minh Khóa #1 (`16/500, Lỗi: 2`) và Khóa #2 (`18/500, Lỗi: 2`) bị khóa oan `Hết hạn mức ngày` thuần túy do quy tắc `nextAmbiguousCount >= 2 => QuotaExhausted` hiện tại ở `src/services/localQuotaTracker.ts` (dòng 744–762). Bỏ leo thang sai giúp khóa chỉ nghỉ 60s–120s rồi tự quay lại phục vụ nốt ~480 lượt/ngày còn lại.

- **Test Migration Pitfall**:  
  `src/services/__tests__/rpmProactiveGateAndRecovery.test.ts` (khoảng dòng 414–425) đang có assertion cũ kiểm tra lần `MessageFallback_AmbiguousQuota` thứ 2 chuyển thành `QuotaExhausted`. Cần cập nhật assertion đó theo hợp đồng mới (`RateLimited` với backoff có trần `<= 120_000ms` khi `requestsToday < dailyReference`) trong giai đoạn implementation.

- **Alternatives Considered**:  
  1. *Nâng ngưỡng leo thang từ 2 lên 5 lần*: Vẫn tiềm ẩn khóa oan cả ngày nếu mạng hoặc burst concurrency gây 5 lần `429` RPM trong một phiên. Không chấp nhận vì `FR-009` yêu cầu chỉ khóa ngày khi có tín hiệu tường minh hoặc đạt ngưỡng ngày.
  2. *Khóa cứng ngay ở `nextAmbiguousCount = 1`*: Làm trầm trọng thêm lỗi khóa oan.

---

## D3 — Compound `retryDelay` Parsing & Accurate Daily Reset Timestamp (`FR-006`)

- **Decision**:  
  Mở rộng `parseDurationTokenToMs` trong `src/services/gemini/geminiErrorClassifier.ts` để phân tích chuỗi thời lượng ghép từ Google (như `12h5m53.421929668s`, `2h30m`, `1h15s`, `45m10s`, `36.5s`, `500ms`) và cập nhật regex nhận diện trong `extractRetryDelayMs`. Trên `QUOTA_EXHAUSTED_RPD`, gán `recommendedCooldownMs: extractedRetryDelayMs ?? -1`. Tại `LocalQuotaTracker.recordFailure`, nếu `dynamicCooldownMs` hợp lệ ở thang dài ngày (`> 60_000 && <= 48 * 3_600_000`), ưu tiên đặt `cooldownUntil = now + dynamicCooldownMs`; ngược lại giữ fallback `getNextPstMidnight(now)`.

- **Rationale**:  
  Log thực tế từ Google trả `Please retry in 12h5m53.421929668s.` nhưng regex hiện tại chỉ khớp số đơn `(ms|s|m)`. Phân tích đúng chuỗi `12h5m53...s` giúp đếm ngược chính xác thời điểm Google mở lại khóa dù chênh lệch nhỏ với `getNextPstMidnight` hoặc múi giờ DST.

- **Alternatives Considered**:  
  1. *Chỉ dùng cố định `getNextPstMidnight(now)`*: Có thể sai lệch vài phút đến vài giờ so với mốc Google trả trong thông báo lỗi thực tế.

---

## D4 — Manual Unlock Controls & Explicit Lock-Reason Display (`FR-003`, `FR-004`, `FR-005`)

- **Decision**:  
  - Bổ sung `unlockKey(key, model?, options?, now?)` và `unlockAllKeys(keys, model?, now?)` vào `LocalQuotaTracker` (có gọi `this.flushToStorage(now)` ngay lập tức để tab không lưu lại trạng thái cũ).
  - **Bảo vệ giới hạn cá nhân (`FR-005`)**: Mặc định `unlockKey` đặt lại cờ lỗi (`healthState = 'Healthy'`, `circuitBreakerStatus = 'Closed'`, `cooldownUntil = 0`, `consecutiveErrors = 0`, `consecutiveAmbiguous429 = 0`, `isLowUsageDailyExhaustion = false`) nhưng **bảo toàn `requestsToday`**. Nếu khóa vẫn bị chặn chỉ vì `requestsToday >= customLimit.maxRpd`, giao diện hiển thị badge `Đạt giới hạn ngày (Tự đặt)` kèm thông báo/hướng dẫn rõ ràng để người dùng tăng ngưỡng `Max RPD` trong `Ngưỡng cá nhân` (hoặc xác nhận đặt lại bộ đếm tự đặt nếu chọn tùy chọn xác nhận).
  - Mở rộng `ModelObservabilityState` trong `src/hooks/useModelObservability.ts` (nhận `selectedModel`, cung cấp `unlockKey`, `unlockAllKeys` và gọi `loadQuotaStatus(true)` sau khi mở khóa).
  - Cập nhật UI trong `QuotaPanel.tsx` (nút **Mở khóa tất cả** khi có ít nhất 1 khóa bị khóa/tạm dừng trên model hiện tại) và `KeyCardItem.tsx` (nút **Mở khóa**, dải hiển thị lý do khóa + thời gian chờ còn lại tường minh bằng token `amber-950/amber-300`, và badge trạng thái riêng theo model trong danh sách accordion `byModel`), tuân thủ `.agents/rules/design-system.md` ("Mực & Chu Sa", `rounded-[2px]`, `Button`/`Badge`, `lucide-react`, không emoji).

- **Rationale**:  
  Khi một khóa bị kẹt từ phiên trước hoặc người dùng vừa nạp billing / đổi khóa mới ở tab Cấu hình, 1 thao tác bấm giúp giải phóng khóa ngay không cần đóng tab trình duyệt. Đồng thời tách biệt khóa bị chặn do tự đặt ngưỡng (`isCustomLimitReached`) giúp tuân thủ `FR-005`.

- **Alternatives Considered**:  
  1. *Nút Mở khóa xóa luôn `requestsToday` về 0 âm thầm*: Bị loại vì vi phạm `FR-005` (tự ý phá vỡ giới hạn an toàn người dùng đã cài đặt).

---

## D5 — Accurate Model Reference Limits & Model-Aware Availability Banner (`FR-007`, `FR-008`)

- **Decision**:  
  - Bổ sung helper `getModelReferenceLimits(modelId: string): CustomLimit` vào `src/utils/modelRegistry.ts` chuẩn hóa hạn mức tham chiếu mặc định sát thực tế Free Tier cho từng dòng mô hình:
    - Dòng Flash Lite (`*flash-lite*`, gồm `gemini-3.1-flash-lite`, `gemini-3.5-flash-lite`, ...): `maxRpm: 15`, `maxTpm: 250_000`, `maxRpd: 500`.
    - Dòng Flash chuẩn (`*2.5-flash*`, `*flash*` không phải lite): `maxRpm: 15`, `maxTpm: 250_000`, `maxRpd: 500`.
    - Dòng Pro (`*pro*`): `maxRpm: 10`, `maxTpm: 250_000`, `maxRpd: 100`.
    - Fallback: dùng `def.limits` từ `getModelDefinition(modelId)` nếu có, hoặc `DEFAULT_CUSTOM_LIMIT`.
  - Cập nhật `AVAILABLE_MODELS` trong `src/config/models.ts` cho `gemini-3.1-flash-lite` (`defaultTpm: 250000`, `defaultRpd: 500`) và các preset tương ứng để đồng bộ scheduler & UI.
  - Giữ nguyên export `DEFAULT_CUSTOM_LIMIT` hiện tại để không phá vỡ test tương thích ngược, nhưng trong `QuotaPanel`, `KeyCardItem`, và `CustomLimitsPanel` dùng `getModelReferenceLimits(selectedModel)` làm fallback hiển thị khi khóa chưa được người dùng lưu custom limit riêng.
  - Mở rộng `ModelStatsSummary` / `computeModelStatsSummary` để tính `runtimeAvailableKeyCount` và `runtimeExhaustedKeyCount` từ `snapshotKeys` trên `selectedModel`, hiển thị đúng `X / N key khả dụng` và banner hành động khi `0 / N` khả dụng ngay cả khi người dùng chưa bấm `Kiểm tra Model`.

- **Rationale**:  
  Tránh hiển thị sai `0 / 1M` TPM như trong 2 ảnh chụp thực tế của người dùng khi mô hình thực tế chỉ có `250K TPM / 500 RPD`, đồng thời cho thấy ngay toàn bộ pool của model đang chọn đã hết hay còn bao nhiêu key trước khi bấm dịch.

- **Alternatives Considered**:  
  1. *Thay đổi trực tiếp `DEFAULT_CUSTOM_LIMIT` thành `250K / 500`*: Không ổn vì khác biệt giữa các dòng model (`gemma`, `pro`, `flash-lite`) và dễ gây sai khác cho custom limit tests hiện có phụ thuộc giá trị mặc định tĩnh.

---

## D6 — GĐ1 Structure-Alignment RPD Reduction (`FR-010`, `SC-005`)

- **Decision**:  
  Mở rộng điều kiện nới lỏng an toàn `canTolerateMinorVariance` trong `src/services/translation/rawTranslation.ts` cho chương dài nhiều thoại ngắn khi `realignParagraphStructure` không tự căn khớp hết:
  - `srcCount >= 8 && delta <= 1` (đã có từ Feature 172)
  - Mở rộng cho chương vừa/dài: `srcCount >= 12 && delta <= 2` hoặc `srcCount >= 15 && delta <= Math.min(3, Math.floor(srcCount * 0.08))`
  với điều kiện bắt buộc **không thay đổi tiêu chuẩn toàn vẹn**: `countChineseCharacters(finalRawTranslation) === 0`, `finalRawTranslation.trim().length >= minHealthyLength`, và khi nguồn có dòng tiêu đề chương thì bản dịch vẫn giữ tiêu đề hợp lệ (hoặc dùng `realignParagraphStructure` cho các mẫu tách/gộp an toàn).

- **Rationale**:  
  Trong log của người dùng, Chương 2 bị kích hoạt cứu nguy chia nhỏ cấp 1 hai lần liên tiếp chỉ vì `Lệch cấu trúc đoạn 1-1`, làm tốn gấp nhiều lần RPD cho một chương. Mở rộng ngưỡng nới lỏng an toàn có điều kiện kiểm soát sạch Hán & đủ độ dài giúp giảm mạnh số lần gọi API thừa ở GĐ1 mà không hy sinh độ đầy đủ nội dung (GĐ3 vẫn giữ check đối chiếu).

- **Alternatives Considered**:  
  1. *Bỏ hoàn toàn `validateStrictStructureParity` ở GĐ1*: Rủi ro sót đoạn nghiêm trọng hoặc gộp nát toàn bộ chương ngắn (`< 8` đoạn).
