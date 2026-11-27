# Tasks: Bảo vệ Hạn mức RPM, Chặn Bão Chia Nhỏ & Đánh giá Chính xác Trạng thái Phục hồi

**Input**: Design documents from `/specs/172-rpm-cooldown-split-guard/`

**Prerequisites**: [plan.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/172-rpm-cooldown-split-guard/plan.md), [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/172-rpm-cooldown-split-guard/spec.md), [research.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/172-rpm-cooldown-split-guard/research.md), [data-model.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/172-rpm-cooldown-split-guard/data-model.md), [rate-limit-guard.contract.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/172-rpm-cooldown-split-guard/contracts/rate-limit-guard.contract.md), [quickstart.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/172-rpm-cooldown-split-guard/quickstart.md)

**Tests**: Có bao gồm các task viết test đơn vị và tích hợp để xác minh đầy đủ `SC-001`–`SC-007`, cập nhật 2 assertion cũ bị sai hợp đồng trong `translationValidation.test.ts` và kiểm tra baseline `npm run lint`, `npm test`, `npm run build`.

**Organization**: Tasks được nhóm theo từng User Story để triển khai tuần tự/song song rõ ràng và kiểm thử độc lập từng phân hệ.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Có thể chạy song song (khác file, không phụ thuộc task chưa hoàn thành)
- **[Story]**: Ánh xạ User Story (`US1`, `US2`, `US3`, `US4`)
- Mọi task đều ghi chính xác đường dẫn file trong repository

---

## Phase 1: Setup (Shared Contracts & Runtime Types)

**Purpose**: Đồng bộ kiểu mở rộng opt-in và trạng thái runtime trong bộ nhớ trước khi sửa tầng lõi (không đụng `src/types.ts` và không đổi schema IndexedDB).

- [X] T001 Đồng bộ `DirectGeminiRequestOptions` với các cờ opt-in (`enableProactivePacing`, `autoWaitForCooldown`, `maxCooldownWaits`, `maxOverloadRetries`, `onWaitStatus` callback không chứa raw API key) và `timeoutMs` giữa `src/services/gemini/types.ts` và `src/services/directGeminiClient.ts`
- [X] T002 [P] Mở rộng kiểu runtime tương thích ngược (`isProactivePacing` trên `KeyHealthResult`, `isProactivePacingOnly` trên `PoolCooldownAnalysis`, `consecutiveAmbiguous429` trên `InternalKeyStats`, và bổ sung `onWaitStatus` cho params dịch) trong `src/types/quota.ts`, `src/services/localQuotaTracker.ts` và `src/services/translation/types.ts`

---

## Phase 2: Foundational (Error Classifier, Quota Gate & Abortable Cooldown Wait)

**Purpose**: Hạ tầng lõi bắt buộc phải hoàn tất trước khi nối các User Story (`US1`–`US4`).

**⚠️ CRITICAL**: Không bắt đầu triển khai US1–US4 trước khi hoàn thành Phase 2.

- [X] T003 Cập nhật `classifyGeminiError()` trong `src/services/gemini/geminiErrorClassifier.ts` để tách lỗi `429` mơ hồ chứa từ khóa `"quota"`/`"exhausted"` nhưng không có tín hiệu theo ngày (`MessageFallback_AmbiguousQuota`) thành tạm nghỉ `RATE_LIMIT_RPM` thay vì khóa oan `QUOTA_EXHAUSTED_RPD`, đồng thời giữ chuẩn `SERVICE_OVERLOAD` với metadata thử lại cho lỗi `503`/`500`
- [X] T004 Mở rộng `src/services/localQuotaTracker.ts` để: (a) theo dõi `consecutiveAmbiguous429` (tạm nghỉ 45–60s ở lần 1 khi `requestsToday` còn thấp, chỉ nâng lên `QuotaExhausted` ở lần 2 liên tiếp hoặc reset về `0` khi `recordSuccess`), (b) chuẩn hóa an toàn giá trị hữu hạn (`Number.isFinite(v) && v > 0`) cho `customLimits` đọc từ `localStorage`, (c) kiểm tra cửa sổ trượt 60s `maxRpm`/`maxTpm` giữ `state: 'Healthy'` và `isProactivePacing: true` (khi bật/có custom limit, không chặn cứng `MIN_REQUEST_INTERVAL`), (d) ưu tiên khóa nguội nhất kèm `startIndex` tie-breaker trong `findNextAvailableKeyIndex`, và (e) phân biệt `isProactivePacingOnly` trong `getPoolCooldownAnalysis`
- [X] T005 [P] Bổ sung helper `waitWithAbort(ms, signal)` hủy tức thì `< 1s` và chuẩn hóa lỗi `SERVICE_OVERLOAD` có cấu trúc tái sử dụng cho pool recovery trong `src/services/gemini/geminiKeyScheduler.ts`

**Checkpoint**: Nền tảng phân loại lỗi, cổng chặn RPM/TPM 60s và chờ có `AbortSignal` đã sẵn sàng — có thể triển khai từng User Story độc lập.

---

## Phase 3: User Story 1 - Chặn bão chia nhỏ và tự động chờ hồi phục khi chạm hạn mức tốc độ hoặc quá tải tạm thời (Priority: P1) 🎯 MVP

**Goal**: Ngăn chặn tuyệt đối chuỗi chia `2 → 4 → 8 → 16` phần và `sino-fallback` khi gặp `429 RPM` / `503 high demand`, thay bằng cơ chế chờ hồi phục có thể hủy tức thì và thử lại đúng bước ở cả 3 giai đoạn (bao gồm cả nhánh con đang chia nhỏ vì lỗi nội dung).

**Independent Test**: Mô phỏng lỗi `429 RATE_LIMIT_RPM` và `503 SERVICE_OVERLOAD` tại GĐ1, GĐ2, GĐ3 và bên trong nhánh split con: xác minh `canSplitRetry === false`, 0 lần gọi `sino-fallback`, chờ hồi phục theo `AbortSignal` rồi thành công khi khóa mở lại.

- [X] T006 [P] [US1] Sửa `classifyTranslationOutcome()` trong `src/services/translation/translationValidation.ts` để `RATE_LIMIT_RPM`, `SERVICE_OVERLOAD` và `NETWORK_FAILURE` trả về `canSplitRetry: false` (với `isRetryable: true`), và cập nhật 2 assertion cũ tương ứng trong `src/services/translation/__tests__/translationValidation.test.ts`
- [X] T007 [US1] Tích hợp vòng chờ hồi phục opt-in (`enableProactivePacing`, `autoWaitForCooldown`, tách riêng ngân sách chờ chủ động không giới hạn số lần với ngân sách chờ lỗi `429`/`503` bị động có trần an toàn, giữ nguyên không có `await` giữa chọn khóa và `recordProviderAttempt`, giữ default `false` cho caller cũ như `useGlossaryScan`) trong `src/services/gemini/geminiClient.ts`
- [X] T008 [US1] Bật tường minh `enableProactivePacing: true`, `autoWaitForCooldown: true` và truyền `onWaitStatus` qua `callGeminiDirect` trong `src/services/translation/rawTranslation.ts`, `src/services/translation/polishTranslation.ts`, `src/services/translation/qaCritique.ts` và `src/services/translation/targetedRepair.ts`, đồng thời bảo đảm nhánh split đệ quy trong `rawWithContentSplitDirect` và `polishWithContentSplitDirect` ném lại ngay mọi lỗi có `canSplitRetry === false` (không rơi xuống `sino-fallback`)

**Checkpoint**: User Story 1 hoàn chỉnh và có thể kiểm thử độc lập — triệt tiêu hoàn toàn bão chia 16 phần do 429/503.

---

## Phase 4: User Story 2 - Ghi nhãn nguyên nhân sự cố chính xác và bảo vệ tiến trình dịch hàng loạt (Priority: P1)

**Goal**: Hiển thị chính xác nguyên nhân sự cố trong nhật ký tiến trình (tuyệt đối không gắn nhãn sai `"Phản hồi rỗng"` cho `429`/`503`/mạng), bảo toàn bản chuốt GĐ2 khi GĐ3 gặp lỗi hạ tầng, và dừng lô dịch hàng loạt ngay khi toàn bộ khóa cạn hạn mức không thể hồi phục.

**Independent Test**: Kiểm tra log sinh ra cho từng loại lỗi (429 RPM, 503 high demand, phản hồi rỗng thực sự, cạn RPD) và xác nhận vòng lặp hàng loạt dừng ngay sau chương gặp `ALL_KEYS_EXHAUSTED` không thể hồi phục.

- [X] T009 [US2] Chuẩn hóa helper gán nhãn sự cố trong `src/services/chapterTranslationService.ts` (không dùng fallback `"Phản hồi rỗng"` cho nguyên nhân chưa nhận diện hoặc lỗi hạ tầng), kết nối log `onWaitStatus` (chỉ hiển thị số thứ tự khóa & thời gian chờ ước tính) cho GĐ1/GĐ2/GĐ3, và đảm bảo lỗi `429`/`503` ở GĐ3 (`qaCritiqueDirect` / `repairChapterCriticalIssuesDirect`) giữ nguyên kết quả GĐ2 đã hoàn thành kèm cảnh báo rõ ràng
- [X] T010 [US2] Cập nhật xử lý `ALL_KEYS_EXHAUSTED` và lỗi hạ tầng cuối cùng trong `src/hooks/useTranslationProcess.ts` để dừng tiến trình dịch hàng loạt ngay lập tức khi toàn bộ khóa đã cạn hạn mức thật sự hoặc vượt trần chờ bị động không thể hồi phục, tránh chạy dây chuyền sang các chương tiếp theo

**Checkpoint**: User Story 2 hoàn chỉnh — nhật ký phản ánh đúng nguyên nhân thực tế và hàng đợi dừng sạch khi hết hạn mức.

---

## Phase 5: User Story 3 - Giảm tần suất chia nhỏ dư thừa ở giai đoạn dịch thô và chuốt văn để bảo toàn hạn mức tốc độ (Priority: P1)

**Goal**: Giảm >= 60% số lần kích hoạt chia nhỏ đa tầng không cần thiết do sai khác trình bày nhỏ ở GĐ1 (`PARAGRAPH_STRUCTURE_DIVERGENCE`) và dao động độ dài tự nhiên ở GĐ2 (`POLISH_TRUNCATION_DETECTED`) để giữ tổng RPM ổn định dưới trần miễn phí.

**Independent Test**: Chạy kiểm thử trên chương có sai khác ngắt dòng nhẹ (khớp lại sau căn chỉnh hoặc lệch `<= 1` đoạn trên chương `>= 8` đoạn đủ nghĩa, 0 chữ Hán sót) và chương chuốt gọn đạt đủ số đoạn 1-1 (`ratio >= 0.72`) mà không kích hoạt split đa tầng.

- [X] T011 [P] [US3] Siết ngưỡng & bổ sung bước căn chỉnh chuẩn hóa an toàn trước khi ném `PARAGRAPH_STRUCTURE_DIVERGENCE` trong `src/services/translation/rawTranslation.ts` (chỉ bỏ qua split khi `realignParagraphStructure` đưa về đúng 1-1, hoặc lệch tối đa `<= 1` đoạn trên chương `>= 8` đoạn kèm 0 chữ Hán sót và độ phủ độ dài khỏe)
- [X] T012 [P] [US3] Cập nhật `src/services/translation/polishTranslation.ts` để truyền `minRatio = 0.72` theo ngữ cảnh vào `validatePolishIntegrity()` (giữ nguyên default `0.80` trong `src/lib/text.ts` để tương thích ngược `text.test.ts`) khi số đoạn đã khớp 1-1 hoàn toàn và không có đoạn rỗng

**Checkpoint**: User Story 3 hoàn chỉnh — giảm mạnh lượt gọi split dư thừa ở cả GĐ1 và GĐ2 mà không làm suy giảm kiểm soát sót đoạn.

---

## Phase 6: User Story 4 - Đánh giá chính xác trạng thái cần rà soát lại trên bản dịch cuối cùng (Priority: P2)

**Goal**: Loại bỏ cảnh báo giả `"còn đoạn dùng phiên âm dự phòng"` khi GĐ2 và GĐ3 đã phục hồi bản dịch cuối sạch chữ Hán, đúng cấu trúc và đạt chuẩn QA, trong khi vẫn giữ cảnh báo nếu bản cuối thực sự còn chữ Hán sót.

**Independent Test**: Đối chứng hai kịch bản đều có `rawHasPartialFallback = true`: kịch bản (a) GĐ2 + QA phục hồi sạch trả về `hasPartialFallback` tắt; kịch bản (b) bản cuối còn sót chữ Hán hoặc `omission`/`raw_leak` giữ `hasPartialFallback = true`.

- [X] T013 [US4] Thêm helper `evaluateFinalPartialFallback()` vào `src/services/translation/translationValidation.ts` và tích hợp tại cuối `translateSingleChapter()` trong `src/services/chapterTranslationService.ts` để tính `hasPartialFallback` dựa trên bản dịch cuối (`cleanPolished || cleanRaw`), kết quả kiểm tra sót chữ Hán thực sự và trạng thái `qaRunSucceeded` / `unresolvedCriticals`

**Checkpoint**: Cả 4 User Story đều hoạt động và kiểm thử độc lập được.

---

## Phase 7: Polish & Verification (Regression Suites & Quality Gates)

**Purpose**: Bao phủ kiểm thử tự động toàn bộ `SC-001`–`SC-007`, rà soát bảo mật/edge cases và chạy đủ baseline quality gates.

- [X] T014 [P] Tạo bộ test tích hợp & đơn vị mới trong `src/services/__tests__/rpmProactiveGateAndRecovery.test.ts` bao phủ đầy đủ `SC-001`–`SC-007` (429/503 không split và không fallback Hán-Việt, hủy chờ `< 1s`, log đúng nhãn, GĐ3 lỗi vẫn giữ GĐ2, gate 60s xoay khóa nguội nhất & chờ không giới hạn số lần, 429 mơ hồ ở `18/500` không khóa oan RPD, và `evaluateFinalPartialFallback`)
- [X] T015 [P] Bổ sung regression test cho `MessageFallback_AmbiguousQuota` và `waitWithAbort` trong `src/services/gemini/__tests__/geminiErrorClassifier.test.ts` và `src/services/gemini/__tests__/geminiKeyScheduler.test.ts`
- [X] T016 Chạy toàn bộ baseline quality gates (`npm run lint`, `npm test`, `npm run build`), đối chiếu kết quả theo `specs/172-rpm-cooldown-split-guard/quickstart.md`, kiểm tra `git diff` xác nhận không đụng `src/types.ts` hoặc `src/services/db.ts` và không có secret leak

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1: T001–T002)**: Bắt đầu ngay lập tức; `T001` và `T002` chạy song song được vì chạm các file khác nhau.
- **Foundational (Phase 2: T003–T005)**: Phụ thuộc Phase 1; khóa toàn bộ `US1`–`US4`. Trong Phase 2, `T003` và `T005` có thể chạy trước/song song, `T004` phụ thuộc `T003` (cách phân biệt `MessageFallback_AmbiguousQuota`) và `T002`.
- **User Story 1 (Phase 3: T006–T008)**: Phụ thuộc Phase 2; là MVP cốt lõi chặn bão chia nhỏ khi 429/503.
- **User Story 2 (Phase 4: T009–T010)**: Phụ thuộc `T007`–`T008` của US1 (nhận callback `onWaitStatus` và lỗi chuẩn hóa từ `geminiClient` / translation pipeline).
- **User Story 3 (Phase 5: T011–T012)**: Có thể chạy ngay sau Phase 2 hoặc song song với US2 (`T011` và `T012` chạy song song được trên 2 file khác nhau).
- **User Story 4 (Phase 6: T013)**: Độc lập về mặt logic sau Phase 2 (tránh đụng đồng thời `chapterTranslationService.ts` với `T009` bằng cách chạy sau `T009`).
- **Polish (Phase 7: T014–T016)**: Chạy sau khi hoàn tất toàn bộ `T001`–`T013`.

### Parallel Opportunities

- **Phase 1**: `T001` || `T002`
- **Phase 2**: `T003` || `T005` → sau đó `T004`
- **Phase 3**: `T006` || `T007` → sau đó `T008`
- **Phase 5**: `T011` || `T012` (song song với Phase 4 nếu làm nhiều luồng)
- **Phase 7**: `T014` || `T015` → sau đó `T016`

---

## Parallel Example: User Story 1 & Phase 1

```text
# Phase 1 parallel:
T001: Sync DirectGeminiRequestOptions in src/services/gemini/types.ts & src/services/directGeminiClient.ts
T002: Extend quota runtime types in src/types/quota.ts, src/services/localQuotaTracker.ts & src/services/translation/types.ts

# Phase 3 parallel before wiring callers (T008):
T006: Forbid canSplitRetry for infrastructure errors in src/services/translation/translationValidation.ts & update translationValidation.test.ts
T007: Implement opt-in proactive pacing + cooldown/overload recovery in src/services/gemini/geminiClient.ts
```

---

## Implementation Strategy

### MVP First (Phase 1 → Phase 3 / User Story 1)

1. Hoàn thành Phase 1 (`T001`–`T002`) và Phase 2 (`T003`–`T005`) để chuẩn hóa classifier, 60s proactive gate và `waitWithAbort`.
2. Hoàn thành Phase 3 (`T006`–`T008`) — **MVP**: triệt tiêu hoàn toàn bão chia `2→4→8→16` phần + `sino-fallback` khi gặp `429 RPM` / `503`.
3. Chạy `npm test` cục bộ trên `geminiClient.test.ts`, `geminiErrorClassifier.test.ts`, `translationValidation.test.ts` để xác nhận MVP sạch xanh.

### Incremental Delivery

1. Tiếp tục Phase 4 (`T009`–`T010`): chuẩn hóa nhãn nhật ký, bảo toàn GĐ2 khi GĐ3 lỗi hạ tầng và dừng lô sạch sẽ.
2. Tiếp tục Phase 5 (`T011`–`T012`): cắt giảm chia nhỏ dư thừa ở GĐ1/GĐ2 để không chạm trần `15 RPM`.
3. Tiếp tục Phase 6 (`T013`): đánh giá lại `hasPartialFallback` trên bản dịch cuối cùng.
4. Kết thúc Phase 7 (`T014`–`T016`): thêm trọn bộ test `SC-001`–`SC-007` và chạy đầy đủ `npm run lint`, `npm test`, `npm run build`.

---

## Notes

- Toàn bộ thay đổi giới hạn trong phạm vi Feature 172; tuyệt đối không sửa `src/types.ts`, `src/services/db.ts`, hay thêm dependency mới.
- Không sửa giá trị mặc định `minRatio = 0.80` trong `src/lib/text.ts`; chỉ truyền `minRatio = 0.72` theo ngữ cảnh tại `src/services/translation/polishTranslation.ts`.
- Mọi log chờ hồi phục và log chia nhỏ chỉ in chỉ số khóa (`#1..#N`), tuyệt đối không log raw API key.
