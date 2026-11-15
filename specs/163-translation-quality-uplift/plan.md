# Implementation Plan: Nâng cao chất lượng dịch truyện (Translation Quality Uplift)

**Branch**: `163-translation-quality-uplift` | **Date**: 2026-11-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/163-translation-quality-uplift/spec.md` & repo review from `/specs/163-translation-quality-uplift/repo-review.md`

## Summary

Nâng cao chất lượng ngữ nghĩa, tính nhất quán xưng hô/thuật ngữ và độ trung thành nguyên tác của luồng dịch 3 giai đoạn (Dịch thô → Chuốt văn → Kiểm duyệt QA) mà không thay đổi kiến trúc Pure Client-Side SPA:
1. **Từ điển thông minh & an toàn (`US1`)**: Lọc từ điển theo ngữ cảnh thực tế xuất hiện trong đoạn văn (kể cả biến thể phồn/giản) cộng các mục được ghim ưu tiên; ngừng thay thế cứng các mục 1 ký tự Hán vào văn bản nguồn để không làm vỡ từ ghép; bổ sung kiểm tra tuân thủ từ điển tất định theo đoạn văn.
2. **Hồ sơ nhân vật & Ngữ cảnh liên tục (`US2`)**: Mở rộng tùy chọn `characterProfile` (giới tính, đại từ ngôi thứ 3, ngôi tự xưng, quy tắc xưng hô theo quan hệ) trên `GlossaryItem` kèm bảo toàn tương thích ngược khi đồng bộ; truyền ngữ cảnh chỉ-đọc giữa các phân đoạn bị tách và giữa các chương liên tiếp.
3. **Chuốt văn trung thành nguyên tác (`US3`)**: Chuẩn hóa chỉ dẫn mặc định theo hướng ưu tiên trung thành nguyên tác, áp dụng đúng nhiệt độ khai báo cho từng lượt chuốt, và bổ sung cổng hậu kiểm tất định sau mỗi lượt chuốt để chặn việc bịa thêm tên riêng hoặc làm rơi thuật ngữ từ điển.
4. **Kiểm duyệt mở rộng & Sửa có mục tiêu theo đoạn (`US4`)**: Mở rộng phân loại lỗi QA (`mistranslation`, `pronoun`, `raw_leak`), hợp nhất/khử trùng lặp lỗi tất định và lỗi AI theo đoạn văn, và bổ sung dịch vụ sửa có mục tiêu chỉ dịch lại đoạn có lỗi nghiêm trọng (mặc định tắt trong dịch hàng loạt, tối đa 1 lượt/chương khi bật).
5. **Chuẩn hóa cấu trúc Prompt & Bộ mẫu đánh giá lặp lại được (`US5`, `US6`)**: Sửa lỗi đánh số và gửi trùng văn bản nguồn trong prompt GĐ1, phát biểu rõ thứ tự ưu tiên chỉ dẫn, đồng thời xây dựng bộ mẫu đánh giá chất lượng tất định chạy trong Vitest.

## Technical Context

**Language/Version**: TypeScript `~5.8.2`, React `19.0.1`, Node.js 20+

**Primary Dependencies**: `@google/genai` (`^2.4.0`), `opencc-js` (`^1.3.1`), `yjs` (`^13.6.32`), `y-indexeddb` (`^9.0.12`), `tailwindcss` (`^4.1.14`), `clsx`, `tailwind-merge`, `motion`, `lucide-react` (Không thêm bất kỳ dependency NPM mới nào)

**Storage**: IndexedDB (`projects`, `chapters`, `crdt_states`, `deletion_manifests`), `localStorage` (cài đặt UI/AI), Google Drive v3 REST API (tùy chọn đồng bộ bundle/granular/monolithic)

**Testing**: Vitest (`^4.1.11`, chạy qua `npm test`), TypeScript compiler (`npm run lint`)

**Target Platform**: Trình duyệt web hiện đại (Pure Client-Side SPA, Vite `^6.2.3`)

**Project Type**: Client-Side Web Application (SPA) theo kiến trúc MVC

**Performance Goals**:
- Kiểm tra tất định (từ điển, đại từ, độ trung thành lượt chuốt) chạy $< 5\text{ms}$ mỗi chương trên luồng client.
- Giảm $\ge 25\%$ độ dài phần từ điển trong prompt đối với dự án có $\ge 200$ mục từ điển (`SC-005`).
- Thời gian dịch trung bình mỗi chương (khi tắt tự động sửa có mục tiêu) tăng không quá $15\%$ so với baseline (`SC-008`).

**Constraints**:
- Zero-backend: mọi xử lý chạy trên trình duyệt và gọi Gemini qua `src/services/directGeminiClient.ts` / `src/services/gemini/`.
- Tương thích ngược 100% với dữ liệu IndexedDB, tệp sao lưu `.json` và đồng bộ Google Drive hiện có (`FR-008a`, `FR-008b`, `SC-010`).
- Với cấu hình mặc định (`enableAutoTargetedRepair = false`), không phát sinh thêm lời gọi AI nào mỗi chương (`SC-011`).

**Scale/Scope**: Dự án tiểu thuyết từ vài chục đến $> 2.000$ chương, bảng từ điển từ vài chục đến $> 1.000$ thuật ngữ/nhân vật.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Nguyên tắc Constitution (v2.0.0) | Đánh giá Pre-Design | Đánh giá Post-Design | Bằng chứng tuân thủ |
|---|---|---|---|
| **I. Strict Quality Gates & Verification** | PASS | PASS | Mọi thay đổi đều đi kèm unit/integration tests và bộ đánh giá chất lượng tất định; bắt buộc vượt qua `npm run lint`, `npm test`, `npm run build` mà không xóa/bỏ qua test nào. |
| **II. Dependency Minimization & Existing Library Reuse** | PASS | PASS | Không cài thêm bất kỳ gói NPM nào; tái sử dụng `opencc-js` (`src/lib/sinoNormalize.ts`), `callGeminiDirect`, và các UI primitives (`Button`, `Badge`, `Seal`, `cn()`). |
| **III. Strict Concern Separation & MVC Domain Boundary** | PASS | PASS | Thuật toán từ điển/kiểm tra tất định nằm ở `src/lib/` và `src/services/translation/`; điều phối state nằm ở `src/hooks/`; giao diện nằm ở `src/components/`. Service không import hook/component. |
| **IV. Immutable Core Schemas & Storage Stability** | PASS (User Authorized) | PASS | Người dùng đã chọn rõ Phương án A (Clarifications 2026-11-15) cho phép bổ sung trường tùy chọn `characterProfile` & `isPinned` vào `GlossaryItem` và mở rộng `QaIssueType`. Không thay đổi IndexedDB store version hay xóa/đổi nghĩa bất kỳ trường cũ nào. |
| **V. Atomic Commits & Documentation Synchronization** | PASS | PASS | Thay đổi được chia theo từng module rõ ràng, đồng bộ với `specs/163-translation-quality-uplift/*`. |

## Migration, Backward Compatibility & Rollback Impact (`AGENTS.md` §9)

1. **Backward Compatibility**:
   - `GlossaryItem.characterProfile`, `GlossaryItem.isPinned`, và các trường mở rộng của `DirectQaCritiqueIssue` (`paragraphIndex`, `source`, `expectedTerm`, `repaired`) đều là **optional (`?`)**.
   - Các dự án đã lưu trong IndexedDB, tệp sao lưu `.json` xuất từ phiên bản cũ, và dữ liệu trên Google Drive không có các trường này được đọc trực tiếp mà không cần bước chuyển đổi phá hủy; mục thiếu `characterProfile` được xử lý là "chưa khai báo" (`FR-008a`).
2. **Cross-Version Sync Protection**:
   - Hàm `mergeGlossaryPreservingProfiles` trong `driveBundleSync.ts` và `driveProjectSync.ts` bảo đảm khi thiết bị chạy phiên bản cũ đẩy bản cập nhật không chứa `characterProfile`/`isPinned`, dữ liệu hồ sơ nhân vật đã khai báo ở thiết bị mới không bị ghi đè mất (`FR-008b`, `SC-010`).
3. **Rollback Impact**:
   - Nếu quay lui về phiên bản code trước, các trường tùy chọn thêm mới trong JSON/IndexedDB được bỏ qua một cách an toàn mà không làm hỏng việc đọc `chinese`, `pinyin`, `vietnamese`, `type`, `note`, `variants` hay nội dung chương.

## Project Structure

### Documentation (this feature)

```text
specs/163-translation-quality-uplift/
├── spec.md                                    # Đặc tả yêu cầu tính năng
├── repo-review.md                             # Bằng chứng rà soát code (F1-F10)
├── plan.md                                    # Kế hoạch triển khai (file này)
├── research.md                                # Quyết định kỹ thuật Phase 0
├── data-model.md                              # Mô hình dữ liệu & quy tắc tương thích ngược Phase 1
├── quickstart.md                              # Hướng dẫn chạy kiểm chứng Phase 1
├── contracts/
│   └── translation-quality-contracts.md       # Hợp đồng giao tiếp giữa các module Phase 1
└── checklists/
    └── requirements.md                        # Checklist chất lượng đặc tả (16/16 PASS)
```

### Source Code (repository root)

```text
src/
├── types.ts                                   # Mở rộng tùy chọn CharacterProfile, isPinned, QaIssueType
├── lib/
│   ├── glossaryMatch.ts                       # [MỚI] Lọc từ điển liên quan, thay thế >=2 ký tự, giải quyết xung đột, hợp nhất profile, chuẩn hóa thực thể mới
│   ├── text.ts                                # Cập nhật validator QaCritiqueIssue, dải nhiệt độ getPolishStrategyForRound, helper cắt lặp ngữ cảnh
│   └── __tests__/
│       └── glossaryMatch.test.ts              # [MỚI] Kiểm thử đơn vị cho lọc từ điển, từ 1 ký tự vs từ ghép, xung đột, hợp nhất profile
├── services/
│   ├── ai/
│   │   ├── prompts.ts                         # Sửa đánh số GĐ1, gửi 1 khối nguồn, lọc từ điển liên quan cả 3 giai đoạn, chèn CharacterProfile & ContinuityContext, thứ tự ưu tiên chỉ dẫn, chỉ dẫn chuốt văn trung thành
│   │   └── __tests__/
│   │       └── prompts.test.ts                # Cập nhật & bổ sung kiểm thử cấu trúc prompt mới
│   ├── translation/
│   │   ├── types.ts                           # Bổ sung ContinuityContext, PolishFidelityReport, mở rộng DirectQaCritiqueIssue
│   │   ├── rawTranslation.ts                  # Truyền ContinuityContext giữa các phân đoạn, cập nhật fallbackSinoVietnameseLine an toàn
│   │   ├── polishTranslation.ts               # Áp dụng đúng strategy.temperature, truyền ContinuityContext giữa các phân đoạn
│   │   ├── qaCritique.ts                      # Định vị paragraphIndex và hỗ trợ các loại lỗi QA mới
│   │   ├── translationValidation.ts           # Bổ sung runDeterministicTranslationChecks, evaluatePolishRoundFidelity, mergeAndDeduplicateQaIssues
│   │   ├── targetedRepair.ts                  # [MỚI] Dịch vụ sửa có mục tiêu theo đoạn văn cho lỗi nghiêm trọng
│   │   ├── qualityEvaluator.ts                # [MỚI] Bộ chấm điểm các chỉ số chất lượng tất định và so sánh baseline
│   │   └── __tests__/
│   │       ├── fixtures/
│   │       │   └── qualityEvalCorpus.ts       # [MỚI] Bộ mẫu chuẩn đánh giá chất lượng dịch
│   │       ├── continuityAndProfile.test.ts   # [MỚI] Kiểm thử ngữ cảnh liên tục & hồ sơ nhân vật
│   │       ├── polishFidelity.test.ts         # [MỚI] Kiểm thử cổng hậu kiểm độ trung thành lượt chuốt
│   │       ├── targetedRepair.test.ts         # [MỚI] Kiểm thử sửa có mục tiêu theo đoạn văn
│   │       └── qualityEvaluation.test.ts      # [MỚI] Kiểm thử bộ mẫu đánh giá chất lượng so với baseline
│   ├── chapterTranslationService.ts           # Tích hợp ContinuityContext chương trước, cổng hậu kiểm lượt chuốt, kiểm tra tất định + hợp nhất QA, và tự động sửa có mục tiêu (khi bật)
│   ├── auditBridgeService.ts                  # Ánh xạ tiêu đề tiếng Việt cho các loại lỗi QA mới (mistranslation, pronoun, raw_leak)
│   └── google-drive/
│       ├── driveBundleSync.ts                 # Sử dụng mergeGlossaryPreservingProfiles khi pullBundle
│       └── driveProjectSync.ts                # Sử dụng mergeGlossaryPreservingProfiles khi pull dự án
├── hooks/
│   ├── useAIConfig.ts                         # Quản lý & lưu trữ tùy chọn enableAutoTargetedRepair (mặc định false)
│   ├── useGlossaryApply.ts                    # Áp dụng ngưỡng >= 2 ký tự Hán và thay thế an toàn khi tạo processedSourceText
│   ├── useAutoTranslationQueue.ts             # Truyền enableAutoTargetedRepair xuống useTranslationProcess
│   ├── useTranslationProcess.ts               # Truyền enableAutoTargetedRepair và thông tin chương trước xuống executeSingleChapterTranslation
│   └── useWorkspaceState.ts                   # Đồng bộ kiểm tra trùng thực thể, ngữ cảnh chương trước, kiểm tra tất định và sửa có mục tiêu ở màn hình dịch đơn chương
└── components/
    ├── api-settings/
    │   └── TranslationQualitySection.tsx      # Bổ sung công tắc bật/tắt "Tự động sửa đoạn lỗi nghiêm trọng"
    └── glossary-manager/
        ├── AddGlossaryForm.tsx                # Bổ sung nhập tùy chọn Hồ sơ nhân vật & ghim ưu tiên (isPinned)
        └── GlossaryDetailSidebar.tsx          # Bổ sung xem/sửa/xóa Hồ sơ nhân vật & ghim ưu tiên (isPinned)
```

**Structure Decision**: Giữ nguyên cấu trúc một dự án SPA (`src/lib/`, `src/services/`, `src/hooks/`, `src/components/`) theo đúng quy ước hiện hành của repository. Chỉ tách 3 file mô-đun nhỏ có trách nhiệm đơn nhất (`src/lib/glossaryMatch.ts`, `src/services/translation/targetedRepair.ts`, `src/services/translation/qualityEvaluator.ts`) để tránh làm phình `src/lib/text.ts` và `src/services/chapterTranslationService.ts`.

## Complexity Tracking

Không có vi phạm Constitution nào cần ngoại lệ.
