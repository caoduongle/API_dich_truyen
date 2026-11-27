# Tasks: Ổn Định Dịch Thuật, Bảo Toàn Cấu Trúc Đoạn & Chống Hoàn Tác Toàn Chương Cho Mô Hình Tốc Độ Cao

**Input**: Design documents from `/specs/171-resilient-translation-alignment/`

**Prerequisites**: `plan.md` (required), `spec.md` (required for user stories), `research.md`, `data-model.md`, `contracts/resilient-translation-contracts.md`, `quickstart.md`

**Tests**: Bổ sung unit tests và integration tests cho từng User Story (`US1`–`US5`) để kiểm chứng toàn bộ 5 nhóm lỗi từ nhật ký Chương 68–71 và bảo toàn tương thích ngược.

**Organization**: Các tác vụ được chia theo đúng thứ tự phụ thuộc và User Story (`US1`–`US5`), tích hợp sẵn toàn bộ 7 ràng buộc từ bước rà soát thiết kế (`Pre-Implementation Engineering Review`).

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Có thể chạy song song (tệp khác nhau, không phụ thuộc tác vụ chưa xong).
- **[Story]**: Ánh xạ về User Story tương ứng (`[US1]`–`[US5]`).

---

## Phase 1: Setup (Baseline Verification)

**Purpose**: Kiểm tra baseline TypeScript và bộ test dịch thuật/hàng đợi hiện tại trước khi sửa đổi.

- [X] T001 Verify baseline TypeScript and translation test suite pass via `npm run lint` and targeted `vitest run` on `src/services/translation/__tests__/translationValidation.test.ts`, `src/services/translation/__tests__/polishFidelity.test.ts`, `src/services/translation/__tests__/targetedRepair.test.ts`, `src/services/ai/__tests__/prompts.test.ts`, `src/services/__tests__/chapterTranslationService.test.ts`, and `src/hooks/__tests__/useTranslationProcess.test.ts`

---

## Phase 2: Foundational (Shared Internal Types & Pure Paragraph Anchor Module)

**Purpose**: Xây dựng nền tảng kiểu dữ liệu nội bộ (không đụng `src/types.ts` hoặc `src/services/db.ts`) và module neo đoạn tường minh `<<Pk>>` để mọi User Story dùng chung.

**⚠️ CRITICAL**: Cần hoàn thành `T002` và `T003` trước khi triển khai các User Stories (`US1`–`US5`).

- [X] T002 Extend internal translation pipeline types in `src/services/translation/types.ts` (preserving `src/types.ts` and `src/services/db.ts` untouched) with `ParagraphMergeReversion`, `PolishParagraphMergeResult`, optional `rawSourceText` & `useParagraphAnchors` on `DirectRawTranslationParams`, optional `complianceIssuesToFix` & `useParagraphAnchors` on `DirectPolishTranslationParams`, and optional `rejectionReasons` & `recoveredOmissionCount` on `TargetedParagraphRepairResult`
- [X] T003 [P] Create `src/services/translation/paragraphAnchor.ts` implementing `encodeAnchoredParagraphs`, `parseAnchoredParagraphs` (matching `<<P(\d+)>>` ONLY at line start `(?:^|\n)\s*<<P(\d+)>>\s*` for valid `1 <= k <= expectedCount` so mid-sentence `<<...>>` in novel text cannot hijack boundaries), and defensive `stripParagraphAnchors`

**Checkpoint**: Nền tảng kiểu nội bộ và tiện ích neo đoạn an toàn đã sẵn sàng, không phá vỡ module hiện có.

---

## Phase 3: User Story 1 - Bảo toàn ánh xạ đoạn văn 1-1 ổn định ở cả Dịch thô và Chuốt văn (Priority: P1) 🎯 MVP

**Goal**: Neo chặt cấu trúc đoạn 1-1 từ Dịch thô qua Chia nhỏ đến Chuốt văn bằng thẻ `<<P1>>`..`<<PN>>`, xử lý phẫu thuật cục bộ khi chỉ 1–4 đoạn sót chữ Hán hoặc thiếu 1–3 đoạn neo để chặn vòng lặp chia nhỏ đa tầng (`depth 1–3` và `fallbackSinoVietnameseLine`).

**Independent Test**: Chạy `paragraphAnchor.test.ts` và `prompts.test.ts` để xác nhận gắn/gỡ nhãn neo bảo toàn 1-1 khi có xuống dòng thừa hoặc thiếu nhãn neo; mô phỏng phản hồi GĐ1 sót chữ Hán cục bộ ở 1–2 đoạn và xác nhận được sửa phẫu thuật gọn nhẹ mà vẫn giữ parity trên nhánh retry.

### Implementation for User Story 1

- [X] T004 [US1] Extend `buildRawTranslationPayload` and `buildPolishTranslationPayload` in `src/services/ai/prompts.ts` with opt-in `useParagraphAnchors` (default `false` at pure prompt-builder level to preserve 100% compatibility with existing `prompts.test.ts`) encoding `<<P1>>`..`<<PN>>` with explicit retention rules when enabled on `>= 2` paragraphs
- [X] T005 [US1] Integrate opt-in `useParagraphAnchors` (>= 2 paragraphs), `parseAnchoredParagraphs` + defensive `stripParagraphAnchors` **before** `stripDuplicatedContinuityOverlap` / `separateChapterTitleAndBody` / `ensureChapterTitlePreserved` / `normalizeTranslatedPunctuation` in `src/services/translation/rawTranslation.ts`, enforce parity checks on retry sub-chunks after `realignParagraphStructure`, and add a bounded 1-pass surgical retry at `retryDepth === 0` for `1..4` defective/missing paragraphs (respecting `signal?.aborted` & `cumulativeTimeoutMs`, invoking sub-calls with `useParagraphAnchors: false, isRetry: true`)
- [X] T006 [US1] Integrate opt-in `useParagraphAnchors` (>= 2 paragraphs) and `parseAnchoredParagraphs` + defensive `stripParagraphAnchors` **before** `stripDuplicatedContinuityOverlap` / `ensureChapterTitlePreserved` / `normalizeTranslatedPunctuation` in `src/services/translation/polishTranslation.ts`
- [X] T007 [P] [US1] Create `src/services/translation/__tests__/paragraphAnchor.test.ts` covering `encodeAnchoredParagraphs`, `parseAnchoredParagraphs` (internal newline recovery, missing index detection, anchorless legacy fallback, resistance to mid-sentence `<<P9>>`), and `stripParagraphAnchors`, plus add anchor opt-in assertions in `src/services/ai/__tests__/prompts.test.ts`

**Checkpoint**: User Story 1 hoàn chỉnh và kiểm thử độc lập thành công (MVP ready).

---

## Phase 4: User Story 2 - Hậu kiểm chuốt văn theo từng đoạn thay vì từ chối và hoàn tác toàn bộ chương (Priority: P1)

**Goal**: Thay thế cơ chế hoàn tác toàn bộ chương ở GĐ2 bằng đánh giá và hợp nhất ở cấp độ từng đoạn (`evaluateAndMergePolishRound`), giữ nguyên 1–3 đoạn suy giảm về bản lượt trước kèm lý do tiếng Việt, bảo toàn toàn bộ các đoạn chuốt tốt và tiếp tục các lượt chuốt kế tiếp.

**Independent Test**: Chạy `evaluateAndMergePolishRound` trong `polishFidelity.test.ts` trên mẫu 40 đoạn có 38 đoạn cải thiện và 2 đoạn lỗi (1 đoạn mất ngoặc thoại, 1 đoạn sai từ điển), xác nhận trả `isAcceptable: true`, `isCatastrophicRollback: false`, `acceptedParagraphCount: 38`, `revertedParagraphs` dài `2`; đồng thời xác nhận các fixture nhỏ 1–3 đoạn hồi quy vẫn kích hoạt rollback chuẩn xác.

### Implementation for User Story 2

- [X] T008 [US2] Implement `evaluateAndMergePolishRound` in `src/services/translation/translationValidation.ts` (preserving backward-compatible `evaluatePolishRoundFidelity`) checking per-paragraph glossary compliance, ungrounded proper nouns (round >= 2), CJK punctuation leak, dialogue quotes, and structure penalty, with `isCatastrophicRollback = true` when `(paragraphCountDelta > 0) || (revertedCount / totalCount > 0.4) || (acceptedChangedCount === 0 && revertedCount > 0)`
- [X] T009 [US2] Wire `evaluateAndMergePolishRound` into `src/services/chapterTranslationService.ts` (logging `[Hậu kiểm GĐ2 Lượt j]` selective merge counts & Vietnamese reasons and continuing polishing unless `isCatastrophicRollback`) and into `src/hooks/useWorkspaceState.ts` (`handlePolishTranslation`) for single-chapter consistency
- [X] T010 [P] [US2] Extend `src/services/translation/__tests__/polishFidelity.test.ts` with tests verifying selective paragraph merge on mixed 40-paragraph rounds vs catastrophic rollback when `> 40%` paragraphs regress or `acceptedChangedCount === 0` on small 1–3 paragraph fixtures

**Checkpoint**: User Story 2 hoàn chỉnh; không còn hiện tượng 1–2 đoạn lỗi phá hỏng toàn bộ công sức chuốt văn cả chương.

---

## Phase 5: User Story 3 - Đồng bộ ngữ cảnh từ điển & truyền danh sách lỗi tuân thủ giữa các giai đoạn (Priority: P1)

**Goal**: Bảo đảm khi dịch từ `processedSourceText` vẫn đối chiếu từ điển/hồ sơ nhân vật dựa trên `rawSourceText` gốc (không tạo chú thích kép dư chữ Hán), và truyền danh sách lỗi tuân thủ GĐ1 (`rawComplianceIssues`) sang GĐ2 Lượt 1 dưới dạng chỉ dẫn mục tiêu đã làm sạch.

**Independent Test**: Kiểm thử `buildRawTranslationPayload` với `processedSourceText` + `rawSourceText` trong `prompts.test.ts` để xác nhận đủ từ điển & `CharacterProfile` (0 chú thích kép `Chữ_Hán[Tên_Việt]`); kiểm thử `buildPolishTranslationPayload` Lượt 1 nhận `complianceIssuesToFix` được sanitize và giới hạn tối đa 15 mục / <= 160 ký tự.

### Implementation for User Story 3

- [X] T011 [US3] Extend `buildRawTranslationPayload` (matching glossary on `rawSourceText || cleanText` and skipping double inline `Chữ_Hán[Tên_Việt]` annotation when `[Tên_Việt]` brackets already exist) and `buildPolishTranslationPayload` (injecting `sanitizePromptInput`-cleaned `complianceIssuesToFix` capped at 15 items / <= 160 chars on Round 1) in `src/services/ai/prompts.ts`, and forward `rawSourceText` / `complianceIssuesToFix` through `src/services/translation/rawTranslation.ts` and `src/services/translation/polishTranslation.ts`
- [X] T012 [US3] Pass `rawSourceText: chapter.sourceText` into `translateRawDirect` and hand off GĐ1 `rawComplianceIssues` (`terminology`, `pronoun`, `raw_leak`) into GĐ2 Round 1 `polishTranslationDirect` in `src/services/chapterTranslationService.ts`, and align `handleTranslateRaw` (`rawSourceText: sourceText`) + `handlePolishTranslation` (`complianceIssuesToFix`) in `src/hooks/useWorkspaceState.ts`
- [X] T013 [P] [US3] Extend `src/services/ai/__tests__/prompts.test.ts` verifying glossary/character-profile matching on `processedSourceText` via `rawSourceText` without double annotation and sanitized `complianceIssuesToFix` handoff in Polish Round 1

**Checkpoint**: User Story 3 hoàn chỉnh; GĐ1 không đánh mất từ điển trên văn bản tiền xử lý và GĐ2 Lượt 1 chủ động sửa các lỗi tuân thủ GĐ1 để lại.

---

## Phase 6: User Story 4 - Nâng cấp tự động sửa lỗi QA có mục tiêu: phục hồi đoạn bị thiếu/lệch, sửa an toàn hơn và giải thích rõ lý do (Priority: P2)

**Goal**: Cho phép tối đa 1 lượt thử sửa bổ sung có phản hồi cụ thể khi lần sửa đầu rớt kiểm tra an toàn, hỗ trợ khôi phục an toàn khi `omission` làm thiếu nguyên đoạn gốc (`sourceParas.length > transParas.length`), và trả về `rejectionReasons` tiếng Việt chi tiết cho từng đoạn bị từ chối.

**Independent Test**: Chạy `targetedRepair.test.ts` xác nhận: đoạn mất ngoặc thoại trượt lần 1 được sửa thành công ở lần thử lại có phản hồi; đoạn vẫn vi phạm trả về `rejectionReasons[pIdx]` tiếng Việt rõ ràng; và trường hợp thiếu đoạn gốc chèn đúng vị trí giúp giảm `paragraphCountDelta` mà không làm đổi bất kỳ ký tự nào ở đoạn lân cận.

### Implementation for User Story 4

- [X] T014 [US4] Upgrade `repairChapterCriticalIssuesDirect` in `src/services/translation/targetedRepair.ts` with (a) up to 1 bounded corrective retry per failed paragraph passing sanitized specific constraint feedback, (b) per-paragraph Vietnamese `rejectionReasons`, and (c) a separate post-repair omission insertion pass only when `sourceParas.length > transParas.length` with a unique source-paragraph match and verified `paragraphCountDelta` reduction; update `[Sửa đoạn QA]` logging in `src/services/chapterTranslationService.ts` to log `rejectionReasons`
- [X] T015 [P] [US4] Extend `src/services/translation/__tests__/targetedRepair.test.ts` testing 1-retry dialogue-quote recovery, detailed Vietnamese `rejectionReasons`, and safe second-pass omitted-paragraph insertion with exact invariance of untouched paragraphs

**Checkpoint**: User Story 4 hoàn chỉnh; bước Sửa đoạn QA sửa được lỗi hình thức phổ biến, phục hồi đoạn thiếu và giải thích rõ khi từ chối.

---

## Phase 7: User Story 5 - Phân loại minh bạch trạng thái chương lỗi & nhật ký cứu nguy gọn gàng sau khi dịch hàng loạt (Priority: P2)

**Goal**: Khắc phục lỗi kẹt `failedIds` do stale ref và cộng dồn một chiều trong `useTranslationProcess.ts`: chỉ giữ chương vào danh sách lỗi khi thực sự còn lỗi nghiêm trọng chưa khắc phục hoặc phân đoạn dự phòng, kèm tóm tắt ngắn gọn theo nhóm lỗi.

**Independent Test**: Chạy `chapterTranslationService.test.ts` & `useTranslationProcess.test.ts` mô phỏng chạy lại 2 chương lỗi (1 chương sửa sạch sau QA → 0 critical, 1 chương còn 2 critical), xác nhận `translationQueueState.failedIds` chỉ còn đúng 1 ID chương chưa sạch ngay cả khi `handleRetryFailedChapters` gọi `runQueue` đồng bộ.

### Implementation for User Story 5

- [X] T016 [US5] Compute post-QA `unresolvedCriticalCount`, `unresolvedIssueSummary`, and `hasPartialFallback` on `ProcessChapterResult` in `src/services/chapterTranslationService.ts`; fix stale `accumulatedFailedIds` race condition in `src/hooks/useTranslationProcess.ts` by passing `initialFailedIds` into `runQueue` (`[]` on start/retry), subtracting cleanly resolved chapters from `failedIds`, and keeping only chapters with unresolved critical issues or partial fallback with a concise log summary
- [X] T017 [P] [US5] Extend `src/services/__tests__/chapterTranslationService.test.ts` and `src/hooks/__tests__/useTranslationProcess.test.ts` covering post-QA critical issue counting, `failedIds` clearing on `handleRetryFailedChapters`, and retention of chapters with remaining critical blockers

**Checkpoint**: User Story 5 hoàn chỉnh; danh sách chương lỗi phản ánh chính xác trạng thái thực tế sau QA.

---

## Phase 8: Polish & Verification (Quality Gates)

**Purpose**: Kiểm chứng toàn bộ mã nguồn sau khi hoàn tất bằng đầy đủ cổng chất lượng của dự án.

- [X] T018 Run full quality gates (`npm run lint`, `npm test`, `npm run build`), verify `quickstart.md` scenarios, and confirm `src/types.ts` and `src/services/db.ts` remain untouched via `git status -s -- src/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Chạy đầu tiên (`T001`).
- **Phase 2 (Foundational)**: Phụ thuộc `T001` — `T002` (`types.ts`) và `T003` (`paragraphAnchor.ts`) có thể chạy song song nhưng bắt buộc xong trước `US1`–`US5`.
- **Phase 3 (`US1` — Neo đoạn & Sửa phẫu thuật GĐ1)**: `T004` (`prompts.ts`) → `T005` (`rawTranslation.ts`), `T006` (`polishTranslation.ts`) → `T007` (tests).
- **Phase 4 (`US2` — Hợp nhất GĐ2 cấp đoạn)**: `T008` (`translationValidation.ts`) → `T009` (`chapterTranslationService.ts`, `useWorkspaceState.ts`) → `T010` (tests). Có thể làm song song với `T005`/`T006` trên tệp khác nhau.
- **Phase 5 (`US3` — Đồng bộ từ điển & Bàn giao lỗi)**: Nối tiếp sau `T004`–`T006` trên `prompts.ts`, `rawTranslation.ts`, `polishTranslation.ts` (`T011` → `T012` → `T013`).
- **Phase 6 (`US4` — Nâng cấp Sửa đoạn QA)**: `T014` (`targetedRepair.ts`, `chapterTranslationService.ts`) → `T015` (tests); nên chạy sau `T009`/`T012` trên `chapterTranslationService.ts`.
- **Phase 7 (`US5` — Đối soát hàng đợi lỗi)**: `T016` (`chapterTranslationService.ts`, `useTranslationProcess.ts`) → `T017` (tests).
- **Phase 8 (Polish)**: Chạy sau khi hoàn tất toàn bộ `T001`–`T017`.

### Parallel Opportunities

- Phase 2: `T002` (`src/services/translation/types.ts`) || `T003` (`src/services/translation/paragraphAnchor.ts`)
- Sau Phase 2: `T008` (`translationValidation.ts`) || `T004` (`prompts.ts`) || `T014` phần `targetedRepair.ts`
- Tests độc lập: `T007` (`paragraphAnchor.test.ts`), `T010` (`polishFidelity.test.ts`), `T015` (`targetedRepair.test.ts`) có thể chạy song song ngay khi implementation tương ứng hoàn tất.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Hoàn thành `T001`–`T003` (Baseline + Types + `paragraphAnchor.ts`).
2. Hoàn thành `T004`–`T007` (`US1` — Neo đoạn 1-1 & Sửa phẫu thuật GĐ1).
3. Chạy kiểm thử `paragraphAnchor.test.ts` và `prompts.test.ts` để xác nhận khóa chặt cấu trúc đoạn 1-1.

### Incremental Delivery

1. `T001`–`T003`: Foundation (Types + `paragraphAnchor.ts`).
2. `T004`–`T007` (`US1`): Chặn vỡ đoạn & split đa tầng GĐ1/GĐ2.
3. `T008`–`T010` (`US2`): Bỏ rollback oan toàn chương, hợp nhất chuốt văn theo đoạn.
4. `T011`–`T013` (`US3`): Giữ nguyên ngữ cảnh từ điển trên `processedSourceText` & truyền lỗi GĐ1 → GĐ2.
5. `T014`–`T015` (`US4`): Sửa đoạn QA 1 lượt nhắc lại + phục hồi đoạn thiếu + lý do tiếng Việt.
6. `T016`–`T017` (`US5`): Dọn sạch `failedIds` sau QA.
7. `T018`: Full `npm run lint`, `npm test`, `npm run build` & `git status -s -- src/`.
