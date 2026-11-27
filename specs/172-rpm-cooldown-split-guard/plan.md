# Implementation Plan: Bảo vệ Hạn mức RPM, Chặn Bão Chia Nhỏ & Đánh giá Chính xác Trạng thái Phục hồi

**Branch**: `172-rpm-cooldown-split-guard` | **Date**: 2026-11-28 | **Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/172-rpm-cooldown-split-guard/spec.md)

**Input**: Feature specification from `/specs/172-rpm-cooldown-split-guard/spec.md`

## Summary

Feature 172 giải quyết đồng bộ 5 lỗ hổng vận hành được xác nhận từ nhật ký dịch tự động 76 chương trên `gemini-3.5-flash-lite` và cấu hình quota đa khóa của người dùng:

1. **Điều tiết chủ động trước từng lượt gọi (`Proactive Per-Request RPM/TPM Gate`) & xoay khóa nguội nhất (`FR-009`, `FR-003`, `SC-007`)**: Mở rộng `localQuotaTracker.ts` và `geminiClient.ts` (opt-in qua cờ `enableProactivePacing` / `autoWaitForCooldown` trên `DirectGeminiRequestOptions` ở `gemini/types.ts` và `directGeminiClient.ts`, giữ mặc định `false` để tương thích ngược tuyệt đối với `geminiClient.test.ts` và không gây chờ lặp kép trong `useGlossaryScan.ts`) để kiểm tra mức tiêu thụ trong cửa sổ trượt 60 giây gần nhất (`requestsThisMinute`, `tokensThisMinute`) so với `customLimits[hash].maxRpm` và `maxTpm` ngay trước mỗi lượt gọi của luồng dịch (GĐ1, GĐ2, GĐ3 và mọi lượt thử lại). Khi khóa hiện tại chạm ngưỡng RPM/TPM, giữ nguyên `state: 'Healthy'` trên UI nhưng đặt `isProactivePacing: true` và xoay sang khóa nguội nhất; nếu toàn bộ khóa đều đang trong cửa sổ trượt 60s chủ động, tự động chờ đúng thời gian mở cửa sổ với bộ đếm tách biệt (không giới hạn số lần cho nhịp chờ chủ động, hủy tức thì `< 1s` qua `AbortSignal`).
2. **Chống khóa oan `"Hết hạn mức ngày"` cho lỗi `429` mơ hồ (`FR-013`, `SC-007`)**: Trong `geminiErrorClassifier.ts` và `localQuotaTracker.ts`, tách lỗi `429` chứa từ khóa chung `"quota"` / `"exhausted"` nhưng không có tín hiệu theo ngày rõ ràng (`per day` / `RPD`) khi `requestsToday` còn thấp hơn nhiều so với `maxRpd`: đặt trạng thái tạm nghỉ RPM ngắn (45–60 giây) ở lần đầu và chỉ nâng lên `QuotaExhausted` (đến nửa đêm PST) nếu thông báo nêu rõ giới hạn ngày, chạm `maxRpd` người dùng cài, hoặc khóa tiếp tục dính `429` liên tiếp ngay sau chu kỳ hồi phục mà không có lượt thành công xen giữa.
3. **Cấm chia nhỏ phân đoạn và phiên âm dự phòng với mọi lỗi hạ tầng (`FR-001`–`FR-005`, `FR-012`, `SC-001`, `SC-005`)**: Trong `translationValidation.ts`, sửa `classifyTranslationOutcome()` để `RATE_LIMIT_RPM`, `SERVICE_OVERLOAD` và `NETWORK_FAILURE` trả về `canSplitRetry: false` (kèm cập nhật 2 assertion cũ trong `translationValidation.test.ts`); đồng thời bật `autoWaitForCooldown: true` và `enableProactivePacing: true` trên toàn bộ tầng dịch (`rawTranslation.ts`, `polishTranslation.ts`, `qaCritique.ts`, `targetedRepair.ts`) đi qua `directGeminiClient.ts` → `geminiClient.ts`, đảm bảo lỗi `429 RPM` / `503 high demand` chờ thử lại có giới hạn an toàn đúng bước (kể cả bên trong nhánh chia nhỏ do lỗi nội dung) thay vì rơi thành bão chia `2 → 4 → 8 → 16` phần + `sino-fallback`.
4. **Giảm tần suất chia nhỏ dư thừa ở GĐ1/GĐ2 & chuẩn hóa ghi nhãn (`FR-006`, `FR-008`, `FR-010`, `FR-012`, `SC-002`, `SC-003`)**:
   - Sửa ánh xạ nhãn lý do `onSplitRetry` trong `chapterTranslationService.ts` để chỉ hiển thị `'Phản hồi rỗng'` cho đúng lỗi rỗng thực sự và luôn hiển thị nhãn đúng cho mọi loại lỗi.
   - Bảo toàn kết quả GĐ2 đã hoàn thiện nếu GĐ3 (`qaCritiqueDirect`) lỗi hạn mức/quá tải (`FR-010`).
   - Giảm các lần chia nhỏ GĐ1/GĐ2 không cần thiết bằng căn chỉnh chuẩn hóa an toàn trước `PARAGRAPH_STRUCTURE_DIVERGENCE` trong `rawTranslation.ts` (chỉ bỏ qua split khi `realignParagraphStructure` khớp lại 1-1 hoặc lệch `<= 1` đoạn trên chương `>= 8` đoạn mà không sót chữ Hán/không hụt độ dài), và tại `polishTranslation.ts` truyền `minRatio = 0.72` theo ngữ cảnh khớp 1-1 tới `validatePolishIntegrity` trong `src/lib/text.ts` (giữ nguyên default `0.80` của `text.ts` để bảo toàn `text.test.ts`).
5. **Đánh giá lại cờ `hasPartialFallback` trên bản dịch cuối cùng & dừng lô sạch sẽ (`FR-007`, `FR-011`, `SC-004`, `SC-006`)**: Sau khi hoàn tất GĐ2 + GĐ3 trong `chapterTranslationService.ts`, đánh giá lại xem bản dịch cuối (`cleanPolished || cleanRaw`) có thực sự còn sót chữ Hán hoặc đoạn chưa phục hồi hay không; nếu bản cuối sạch chữ Hán, khớp cấu trúc và `qaRunSucceeded && unresolvedCriticals.length === 0`, tự động gỡ cờ `hasPartialFallback`. Khi toàn bộ khóa cạn hạn mức không thể hồi phục trong khung chờ cho phép, `useTranslationProcess.ts` dừng lô hàng loạt ngay lập tức.

## Technical Context

**Language/Version**: TypeScript 5.x (Strict Mode) trên nền React 19 + Vite

**Primary Dependencies**: `@google/genai` (chỉ qua `geminiClient.ts` / REST client hiện hữu), `lucide-react`, không thêm dependency NPM mới

**Storage**: `localStorage` (`gemini_quota_custom_limits`, `localQuotaTracker` snapshot) và IndexedDB hiện có (`src/services/db.ts` — không thay đổi schema)

**Testing**: Vitest (`npm test` -> `vitest run`) và TypeScript (`npm run lint` -> `tsc --noEmit`), Vite bundle (`npm run build` -> `tsc && vite build`)

**Target Platform**: Trình duyệt web (Pure Client-Side SPA)

**Project Type**: Pure Client-Side Web Application (MVC Client Architecture)

**Performance Goals**: Giảm ít nhất 60% số lần kích hoạt chia nhỏ đa tầng không cần thiết ở GĐ1/GĐ2 (`SC-003`), 0% chia nhỏ khi gặp 429/503 (`SC-001`), phản hồi hủy tức thì dưới 1 giây khi người dùng bấm dừng giữa lúc chờ (`SC-005`)

**Constraints**: Tuân thủ tuyệt đối ranh giới MVC (`services/` không import `hooks/` hoặc `components/`), giữ nguyên `src/types.ts` và `src/services/db.ts`, không thay đổi nhãn UI tiếng Việt ngoài phạm vi nhật ký/thông báo lỗi chính xác

**Scale/Scope**: Hỗ trợ lô dịch dài hàng chục tới hàng trăm chương liên tiếp qua 1–N khóa API (ví dụ 8 khóa miễn phí `15 RPM / 250K TPM / 500–1500 RPD`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc | Đánh giá Pre-Design | Đánh giá Post-Design | Ghi chú |
|---|---|---|---|
| **I. Strict Quality Gates & Verification** | PASS | PASS | Đã lên kế hoạch đầy đủ cho `npm run lint`, `npm test`, `npm run build` và unit/integration tests mới |
| **II. Dependency Minimization & Existing Library Reuse** | PASS | PASS | Zero dependencies mới; tái sử dụng `RATE_LIMIT_RECOVERY_CONFIG`, `inspectKeyPoolCooldown`, `getStoredCustomLimits`, `runDeterministicTranslationChecks`, `realignParagraphStructure` |
| **III. Strict Concern Separation & MVC Domain Boundary Preservation** | PASS | PASS | Toàn bộ gate quota, phân loại lỗi, cooldown wait và đánh giá `hasPartialFallback` nằm trong `src/services/`; `src/hooks/useTranslationProcess.ts` chỉ điều phối vòng lặp hàng loạt và nhật ký |
| **IV. Immutable Core Schemas & Storage Stability** | PASS | PASS | Không sửa `src/types.ts` và không đổi schema IndexedDB (`src/services/db.ts`) |
| **V. Atomic Commits & Documentation Synchronization** | PASS | PASS | Thiết kế chia rõ từng module ảnh hưởng và hợp đồng kiểm thử trước khi sinh `tasks.md` |

## Project Structure

### Documentation (this feature)

```text
specs/172-rpm-cooldown-split-guard/
├── spec.md                              # Đã hoàn thành & clarify (3/3 câu hỏi)
├── checklists/
│   └── requirements.md                  # 16/16 PASS
├── plan.md                              # Tài liệu này (/speckit-plan)
├── research.md                          # Phase 0: Quyết định kiến trúc & trade-offs
├── data-model.md                        # Phase 1: Mô hình trạng thái runtime & state machine
├── contracts/
│   └── rate-limit-guard.contract.md     # Phase 1: Hợp đồng nội bộ giữa Scheduler, Validation & Pipeline
├── quickstart.md                        # Phase 1: Kịch bản kiểm thử xác minh SC-001..SC-007
└── tasks.md                             # Phase 2 (/speckit-tasks - chưa tạo ở bước này)
```

### Source Code (repository root)

```text
src/
├── config/
│   └── constants.ts                                      # Mở rộng tham số chờ 503 / ngưỡng an toàn RPM/TPM nếu cần
├── types/
│   └── quota.ts                                          # Mở rộng kiểu KeyHealthResult / runtime status (tương thích ngược, không đụng src/types.ts)
├── services/
│   ├── directGeminiClient.ts                             # Đồng bộ DirectGeminiRequestOptions với gemini/types.ts (chuyển tiếp recovery/proactive flags + onWaitStatus)
│   ├── localQuotaTracker.ts                              # Proactive RPM/TPM gate 60s (giữ Healthy), chọn khóa nguội nhất, bộ đếm 429 mơ hồ
│   ├── gemini/
│   │   ├── types.ts                                      # Thêm enableProactivePacing, autoWaitForCooldown, maxCooldownWaits, maxOverloadRetries, onWaitStatus
│   │   ├── geminiErrorClassifier.ts                      # Chống phân loại nhầm 429 mơ hồ thành QUOTA_EXHAUSTED_RPD; chuẩn hóa SERVICE_OVERLOAD
│   │   ├── geminiKeyScheduler.ts                         # Helper phân tích pool & waitWithAbort tái sử dụng cho cả translation + scan
│   │   └── geminiClient.ts                               # Tích hợp opt-in proactive gate + cooldown/overload auto-wait vào executeLogicalGeminiCall
│   ├── translation/
│   │   ├── types.ts                                      # Bổ sung onWaitStatus cho params GĐ1/GĐ2/GĐ3/repair
│   │   ├── translationValidation.ts                      # Cấm canSplitRetry cho 429/503/network; thêm evaluateFinalPartialFallback
│   │   ├── rawTranslation.ts                             # Giảm split dư thừa GĐ1 an toàn; bật opt-in proactive gate + recovery; chặn sino-fallback với lỗi hạ tầng
│   │   ├── polishTranslation.ts                          # Truyền minRatio=0.72 theo ngữ cảnh khớp 1-1 tới validatePolishIntegrity; bật proactive gate + recovery
│   │   ├── qaCritique.ts                                 # Bật opt-in proactive gate + recovery cho bước kiểm duyệt GĐ3
│   │   ├── targetedRepair.ts                             # Bật opt-in proactive gate + recovery cho bước sửa đoạn QA
│   │   └── __tests__/translationValidation.test.ts       # Cập nhật 2 assertion cũ canSplitRetry=false cho RATE_LIMIT_RPM & SERVICE_OVERLOAD
│   ├── chapterTranslationService.ts                      # Sửa nhãn onSplitRetry, log onWaitStatus, bảo toàn GĐ2 khi GĐ3 lỗi hạ tầng, tính lại hasPartialFallback cuối
│   └── __tests__/
│       └── rpmProactiveGateAndRecovery.test.ts           # Test mới: gate RPM/TPM 60s, 429 mơ hồ, 503 retry, hủy <1s, gán nhãn & hasPartialFallback
└── hooks/
    └── useTranslationProcess.ts                          # Dừng lô sạch sẽ khi cạn hạn mức thật sự; truyền callback trạng thái chờ vào nhật ký
```

**Structure Decision**: Giữ nguyên cấu trúc client-side MVC hiện có của repository. Toàn bộ logic chặn chủ động `RPM`/`TPM`, phân loại lỗi `429`/`503`, chờ hồi phục có thể hủy và đánh giá toàn vẹn bản cuối nằm gọn trong `src/services/`, giúp tái sử dụng trực tiếp cho cả luồng dịch chương (`chapterTranslationService.ts`) và các luồng gọi AI khác qua `geminiClient.ts` (`qaCritique`, `targetedRepair`, `useGlossaryScan`) mà không trùng lặp vòng lặp chờ ở từng nơi.

## Complexity Tracking

> Không có vi phạm Constitution nào cần giải trình ngoại lệ. Mọi mở rộng kiểu nằm trong `src/types/quota.ts` và nội bộ `src/services/`; `src/types.ts` và `src/services/db.ts` giữ nguyên hoàn toàn.
