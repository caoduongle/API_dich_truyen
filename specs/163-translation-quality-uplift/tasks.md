---

description: "Task list for feature 163-translation-quality-uplift"
---

# Tasks: Nâng cao chất lượng dịch truyện (Translation Quality Uplift)

**Input**: Design documents from `/specs/163-translation-quality-uplift/` (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/translation-quality-contracts.md`, `quickstart.md`)

**Prerequisites**: `plan.md` (required), `spec.md` (required), `research.md`, `data-model.md`, `contracts/translation-quality-contracts.md`

**Tests**: Included per `spec.md` (`FR-020`, `SC-001`–`SC-011`) and `Constitution Principle I`.

**Organization**: Tasks are grouped by user story (`US1`–`US6`) to enable independent implementation and testing of each increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (`[US1]`..`[US6]`)
- Exact repository file paths are included in every task description

---

## Phase 1: Setup (Shared Types & Pipeline Interfaces)

**Purpose**: Extend shared TypeScript definitions and pipeline interfaces with additive, backward-compatible types required across stories.

- [X] T001 Extend `GlossaryItem`, `PendingGlossaryItem`, `ChapterMetadata`, and `Chapter` with optional `CharacterGender`, `CharacterRelationRule`, `CharacterProfile`, `isPinned`, and expanded `QaIssueType` (`mistranslation`, `pronoun`, `raw_leak`) in `src/types.ts`
- [X] T002 [P] Extend pipeline types with `ContinuityContext`, `PolishFidelityReport`, `QualityEvaluationMetrics`, and optional `paragraphIndex` / `source` / `expectedTerm` / `repaired` fields on `DirectQaCritiqueIssue`, `DirectRawTranslationParams`, and `DirectPolishTranslationParams` in `src/services/translation/types.ts`
- [X] T003 [P] Update `GlossaryEntry`, `BuildRawTranslationPromptParams`, and `BuildPolishTranslationPromptParams` interfaces to accept `characterProfile`, `isPinned`, and `continuity?: ContinuityContext` in `src/services/ai/prompts.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core glossary matching, profile sanitization, entity deduplication, and paragraph alignment primitives that User Stories 1–6 depend on.

**⚠️ CRITICAL**: Complete this phase before starting User Story phases.

- [X] T004 Create `src/lib/glossaryMatch.ts` implementing `normalizeCharacterProfile` (with `sanitizePromptInput`, newline stripping, and length caps), `resolveGlossaryConflicts`, `selectRelevantGlossary` (exact + canonical Han matching via `src/lib/sinoNormalize.ts` + `isPinned` support), `substituteGlossaryTermsSafely` ($\ge 2$ Han character threshold, longest-match-first, non-overlapping), `mergeGlossaryPreservingProfiles`, and `classifyDiscoveredEntitiesForGlossary`
- [X] T005 [P] Update `isQaCritiqueIssue` validator to accept the 8 `QaIssueType` values (`omission`, `addition`, `repetition`, `terminology`, `mistranslation`, `pronoun`, `raw_leak`, `other`) and add `stripDuplicatedContinuityOverlap` helper in `src/lib/text.ts`
- [X] T006 [P] Update `QA_TYPE_TITLES` mapping in `src/services/auditBridgeService.ts` to provide Vietnamese titles for `mistranslation`, `pronoun`, and `raw_leak`
- [X] T007 Implement `mapTranslatedParagraphToSourceWindow` (accounting for `isChapterTitleLine` offset) in `src/services/translation/translationValidation.ts`

**Checkpoint**: Foundation ready — User Story phases can now be executed.

---

## Phase 3: User Story 1 - Tên riêng & thuật ngữ được áp dụng đúng, không làm vỡ câu chữ xung quanh (Priority: P1) 🎯 MVP

**Goal**: Chỉ đưa vào prompt các thuật ngữ xuất hiện trong văn bản nguồn (cộng các mục ghim `isPinned`), ngừng thay thế cứng các mục 1 ký tự Hán vào giữa từ ghép, giải quyết xung đột từ điển tất định, và kiểm tra tuân thủ từ điển theo đoạn văn sau khi dịch (`FR-001`–`FR-005`).

**Independent Test**: Chạy `npx vitest run src/lib/__tests__/glossaryMatch.test.ts` — xác nhận mục 1 ký tự (`林` → `Lâm`) không làm biến dạng `森林`, từ điển 250+ mục được lọc đúng các mục xuất hiện trong đoạn văn, và `checkGlossaryCompliance` phát hiện chính xác đoạn dịch sai thuật ngữ.

### Tests for User Story 1

- [X] T008 [P] [US1] Create unit tests for `selectRelevantGlossary`, `substituteGlossaryTermsSafely` (1-char Han vs compound words, longest-match-first, traditional/simplified variants), and `resolveGlossaryConflicts` in `src/lib/__tests__/glossaryMatch.test.ts`

### Implementation for User Story 1

- [X] T009 [US1] Implement `checkGlossaryCompliance` inside `runDeterministicTranslationChecks` (with `isPartialFallback` guard) in `src/services/translation/translationValidation.ts`
- [X] T010 [US1] Update `buildRawTranslationPayload`, `buildPolishTranslationPayload`, and `buildQaCritiquePayload` to filter glossary via `selectRelevantGlossary` and apply safe inline annotation `Chữ_Hán[Tên_Việt]` for $\ge 2$-character Han terms in `src/services/ai/prompts.ts`
- [X] T011 [P] [US1] Update `fallbackSinoVietnameseLine` in `src/services/translation/rawTranslation.ts` to enforce the $\ge 2$ Han character threshold and longest-match-first replacement via `src/lib/glossaryMatch.ts`
- [X] T012 [P] [US1] Update `handleApplyGlossaryToAllChapters` in `src/hooks/useGlossaryApply.ts` to skip 1-character Han terms (`Array.from(form).length >= 2`) so `processedSourceText` never corrupts Chinese compound words
- [X] T013 [US1] Ensure `executeSingleChapterTranslation` in `src/services/chapterTranslationService.ts` and `useWorkspaceState` in `src/hooks/useWorkspaceState.ts` share `classifyDiscoveredEntitiesForGlossary` (`FR-021`) and pass `chapter.sourceText` as the reference source for glossary matching even when `processedSourceText` is present

**Checkpoint**: User Story 1 is functional and independently testable.

---

## Phase 4: User Story 2 - Xưng hô, giới tính và ngôi kể nhất quán giữa các phân đoạn và giữa các chương (Priority: P1)

**Goal**: Cho phép khai báo `characterProfile` (giới tính, đại từ ngôi thứ 3, ngôi tự xưng, quy tắc xưng hô theo quan hệ) trên mục từ điển nhân vật với bảo toàn tương thích ngược khi đồng bộ; truyền ngữ cảnh chỉ-đọc (`ContinuityContext`) giữa các phân đoạn bị tách và giữa các chương liên tiếp (`FR-006`–`FR-009`).

**Independent Test**: Chạy `npx vitest run src/services/__tests__/bundleSyncMerge.test.ts src/services/translation/__tests__/continuityAndProfile.test.ts` — xác nhận hồ sơ nhân vật không bị mất khi đồng bộ từ bản cũ, ngữ cảnh phân đoạn trước/chương trước được truyền vào prompt và không bị dịch lặp, và kiểm tra đại từ giới tính phát hiện đúng câu dùng sai đại từ.

### Tests for User Story 2

- [X] T014 [P] [US2] Create unit and integration tests for `ContinuityContext` propagation, overlap stripping, `CharacterProfile` prompt formatting, and `checkCharacterPronounConsistency` in `src/services/translation/__tests__/continuityAndProfile.test.ts`
- [X] T015 [P] [US2] Add backward-compatibility and cross-version profile preservation tests for `mergeGlossaryPreservingProfiles` in `src/services/__tests__/bundleSyncMerge.test.ts`

### Implementation for User Story 2

- [X] T016 [US2] Implement `checkCharacterPronounConsistency` inside `runDeterministicTranslationChecks` in `src/services/translation/translationValidation.ts`
- [X] T017 [US2] Format `characterProfile` (`gender`, `defaultNarrativePronoun`, `defaultSelfPronoun`, `relations`) and `ContinuityContext` (placed strictly before `--- VĂN BẢN TIẾNG TRUNG GỐC ---`) in `buildRawTranslationPayload` and `buildPolishTranslationPayload` in `src/services/ai/prompts.ts`
- [X] T018 [P] [US2] Pass intra-chapter chunk `ContinuityContext` (`previousSourceTail`) across split chunks and strip accidental overlap via `stripDuplicatedContinuityOverlap` in `src/services/translation/rawTranslation.ts` and `src/services/translation/polishTranslation.ts`
- [X] T019 [US2] Extract preceding chapter `ContinuityContext` (when the previous chapter in `project.chapters` is already translated in IndexedDB) in `src/services/chapterTranslationService.ts`, `src/hooks/useTranslationProcess.ts`, and `src/hooks/useWorkspaceState.ts`
- [X] T020 [P] [US2] Integrate `mergeGlossaryPreservingProfiles` into `pullBundle` in `src/services/google-drive/driveBundleSync.ts` and monolithic pull in `src/services/google-drive/driveProjectSync.ts`
- [X] T021 [P] [US2] Add optional `CharacterProfile` fields (`gender`, `defaultNarrativePronoun`, `defaultSelfPronoun`, `relations`) and `isPinned` toggle when `type === 'character'` in `src/components/glossary-manager/AddGlossaryForm.tsx`
- [X] T022 [P] [US2] Add viewing, editing, and clearing of `CharacterProfile` fields and `isPinned` toggle in `src/components/glossary-manager/GlossaryDetailSidebar.tsx`

**Checkpoint**: User Stories 1 and 2 are both functional and independently testable.

---

## Phase 5: User Story 3 - Chuốt văn mượt hơn nhưng vẫn trung thành với nguyên tác (Priority: P2)

**Goal**: Áp dụng đúng nhiệt độ khai báo cho từng lượt chuốt văn (`strategy.temperature`), đặt ràng buộc trung thành nguyên tác ở mức ưu tiên cao nhất, và bổ sung cổng hậu kiểm `evaluatePolishRoundFidelity` sau mỗi lượt chuốt để tự động bác bỏ lượt chuốt làm rơi thuật ngữ từ điển hoặc bịa thêm tên riêng (`FR-010`–`FR-012`).

**Independent Test**: Chạy `npx vitest run src/services/translation/__tests__/polishFidelity.test.ts` — xác nhận nhiệt độ từng lượt chuốt khớp `getPolishStrategyForRound`, và lượt chuốt bịa thêm tên riêng ngoài nguồn hoặc làm tăng vi phạm từ điển bị bác bỏ và giữ lại kết quả lượt trước.

### Tests for User Story 3

- [X] T023 [P] [US3] Create unit tests for `evaluatePolishRoundFidelity` (glossary regression rejection, case-insensitive syllable grounding for proper nouns on round $\ge 2$, and legitimate capitalization allowance) and round temperature propagation in `src/services/translation/__tests__/polishFidelity.test.ts`

### Implementation for User Story 3

- [X] T024 [US3] Implement `evaluatePolishRoundFidelity` and `detectUngroundedProperNouns` in `src/services/translation/translationValidation.ts`
- [X] T025 [P] [US3] Update `callPolishDirectCore` in `src/services/translation/polishTranslation.ts` to use `getPolishStrategyForRound(roundIndex, totalRounds).temperature` when `params.roundIndex !== undefined`
- [X] T026 [US3] Enforce top-priority source fidelity and anti-hallucination directives in `buildPolishTranslationPayload` (while preserving backward-compatible prompt sections) in `src/services/ai/prompts.ts`
- [X] T027 [US3] Integrate `evaluatePolishRoundFidelity` into the multi-round polish loop in `src/services/chapterTranslationService.ts` and re-polish flow in `src/hooks/useWorkspaceState.ts` to revert to `previousRoundText` and stop early on fidelity regression

**Checkpoint**: User Story 3 is functional and independently testable.

---

## Phase 6: User Story 4 - Kiểm duyệt phát hiện đủ loại lỗi và hỗ trợ sửa có mục tiêu (Priority: P2)

**Goal**: Mở rộng kiểm duyệt AI với các loại lỗi `mistranslation`, `pronoun`, `raw_leak`; hợp nhất và khử trùng lặp lỗi tất định + lỗi AI kèm định vị `paragraphIndex`; hỗ trợ sửa có mục tiêu chỉ dịch lại đoạn văn có lỗi nghiêm trọng (mặc định tắt trong dịch hàng loạt, tối đa 1 lượt/chương khi bật) (`FR-013`–`FR-018`, `FR-023`–`FR-025`).

**Independent Test**: Chạy `npx vitest run src/services/translation/__tests__/qaCritique.test.ts src/services/translation/__tests__/targetedRepair.test.ts` — xác nhận 8 loại lỗi QA, khử trùng lặp lỗi tất định + AI, giữ nguyên 100% các đoạn không liên quan khi sửa có mục tiêu, và giữ nguyên đoạn cũ khi bản sửa tạo lỗi mới hoặc gặp lỗi API/hủy.

### Tests for User Story 4

- [X] T028 [P] [US4] Expand `src/services/translation/__tests__/qaCritique.test.ts` to test `mistranslation`, `pronoun`, and `raw_leak` issue types and `mergeAndDeduplicateQaIssues` compatibility with `resolveChapterQaIssues`
- [X] T029 [P] [US4] Create unit tests for `repairChapterCriticalIssuesDirect` (single-paragraph splice, unchanged surrounding paragraphs, rollback on new deterministic violation or API/Abort error, max 1 pass) in `src/services/translation/__tests__/targetedRepair.test.ts`

### Implementation for User Story 4

- [X] T030 [US4] Implement `mergeAndDeduplicateQaIssues` (attaching `paragraphIndex` only when `idx >= 0` without mutating unmatched AI issue shapes) in `src/services/translation/translationValidation.ts`
- [X] T031 [P] [US4] Update `buildQaCritiquePayload` in `src/services/ai/prompts.ts` and `qaCritiqueDirect` in `src/services/translation/qaCritique.ts` to include `mistranslation`, `pronoun`, and `raw_leak` in system instructions and JSON schema
- [X] T032 [US4] Create `src/services/translation/targetedRepair.ts` implementing `repairChapterCriticalIssuesDirect` using `callGeminiDirect`, `mapTranslatedParagraphToSourceWindow`, and post-repair deterministic validation, and export it from `src/services/translation/index.ts` and `src/services/directTranslationEngine.ts`
- [X] T033 [P] [US4] Add `enableAutoTargetedRepair` state (default `false`, persisted in `localStorage` under `'enable_auto_targeted_repair'`) in `src/hooks/useAIConfig.ts` and expose the toggle in `src/components/api-settings/TranslationQualitySection.tsx`, `src/components/ApiSettings.tsx`, and `src/components/layout/ApiSettingsModal.tsx`
- [X] T034 [US4] Wire `enableAutoTargetedRepair` through `src/components/layout/TabContent.tsx`, `src/components/AutoTranslator.tsx`, `src/hooks/useAutoTranslationQueue.ts`, and `src/hooks/useTranslationProcess.ts` into `executeSingleChapterTranslation` in `src/services/chapterTranslationService.ts`
- [X] T035 [US4] Integrate `runDeterministicTranslationChecks`, `mergeAndDeduplicateQaIssues`, and optional 1-pass `repairChapterCriticalIssuesDirect` (when `enableAiQaCritique && qaRunSucceeded`) in `src/services/chapterTranslationService.ts` and `src/hooks/useWorkspaceState.ts`

**Checkpoint**: User Story 4 is functional and independently testable.

---

## Phase 7: User Story 5 - Chỉ dẫn gửi AI rõ ràng, không mâu thuẫn, không trùng lặp (Priority: P3)

**Goal**: Chuẩn hóa đánh số mục chỉ dẫn trong GĐ1, loại bỏ gửi lặp văn bản nguồn, và phát biểu tường minh thứ tự ưu tiên chỉ dẫn xuyên suốt cả 3 giai đoạn (`FR-019`).

**Independent Test**: Chạy `npx vitest run src/services/ai/__tests__/prompts.test.ts` — xác nhận các mục đánh số trong `systemInstruction` tách dòng rõ ràng, văn bản nguồn chỉ xuất hiện 1 lần trong `prompt` của GĐ1, và bảng thứ tự ưu tiên có mặt trong cả 3 giai đoạn.

### Tests for User Story 5

- [X] T036 [P] [US5] Add unit tests in `src/services/ai/__tests__/prompts.test.ts` verifying clean numbered rules in `buildRawTranslationPayload`, single source text block emission, and explicit priority hierarchy across Phase 1, Phase 2, and Phase 3 prompts

### Implementation for User Story 5

- [X] T037 [US5] Fix rule numbering/newlines (separating entity extraction, foreign name restoration, script preservation, bracket removal, genre style, and guideline rules) and inject the explicit instruction priority hierarchy block across `buildRawTranslationPayload`, `buildPolishTranslationPayload`, and `buildQaCritiquePayload` in `src/services/ai/prompts.ts`

**Checkpoint**: User Story 5 is functional and independently testable.

---

## Phase 8: User Story 6 - Đo được chất lượng trước và sau thay đổi (Priority: P3)

**Goal**: Xây dựng bộ mẫu đánh giá cố định và bộ chấm điểm chất lượng tất định chạy lặp lại được trong Vitest để chứng minh định lượng các tiêu chí `SC-001`–`SC-011` (`FR-020`).

**Independent Test**: Chạy `npx vitest run src/services/translation/__tests__/qualityEvaluation.test.ts` — xác nhận báo cáo chất lượng xuất đầy đủ các chỉ số tất định, kết quả giống hệt nhau qua nhiều lần chạy, và vượt toàn bộ ngưỡng mục tiêu so với baseline.

### Implementation & Tests for User Story 6

- [X] T038 [P] [US6] Create the fixed evaluation corpus covering 1-char surname vs compound words, 250-item glossary scaling, chunk-boundary dialogue pronouns, multi-round polish fidelity, and planted QA issues in `src/services/translation/__tests__/fixtures/qualityEvalCorpus.ts`
- [X] T039 [US6] Implement `evaluateTranslationQualitySample` and `runQualityEvaluationSuite` (computing `glossaryComplianceRate`, `falseSubstitutionCount`, `chineseLeftoverRatio`, `paragraphParityPassed`, `pronounConsistencyRate`, `ungroundedProperNounCount`, and `promptGlossaryCharCount` vs baseline) in `src/services/translation/qualityEvaluator.ts`
- [X] T040 [US6] Create automated benchmark and baseline comparison test suite verifying `SC-001` through `SC-011` in `src/services/translation/__tests__/qualityEvaluation.test.ts`

**Checkpoint**: All 6 User Stories are complete and independently verifiable.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final regression verification across all quality gates and git diff hygiene.

- [X] T041 Run `npm run lint` (`tsc --noEmit`), `npm test` (`vitest run`), and `npm run build` (`tsc && vite build`) to verify zero type, test, or bundle regressions across the repository
- [X] T042 Review `git status` and `git diff` to ensure no unrelated files or secrets are modified and all scenarios in `specs/163-translation-quality-uplift/quickstart.md` pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — starts immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 — blocks all User Stories.
- **Phase 3 (`US1`, P1 🎯 MVP)**: Depends on Phase 2.
- **Phase 4 (`US2`, P1)**: Depends on Phase 2 and integrates with `US1` prompt/validation helpers.
- **Phase 5 (`US3`, P2)**: Depends on Phase 2 and `US1` (`checkGlossaryCompliance`).
- **Phase 6 (`US4`, P2)**: Depends on Phase 2, `US1`, and `US2` (`runDeterministicTranslationChecks`).
- **Phase 7 (`US5`, P3)**: Depends on Phase 2 and `US1`/`US2` prompt updates.
- **Phase 8 (`US6`, P3)**: Depends on `US1`–`US5` to evaluate the full uplifted pipeline against baseline.
- **Phase 9 (Polish)**: Depends on all phases completing.

### Parallel Opportunities

- **Phase 1**: `T002` and `T003` can run in parallel after `T001`.
- **Phase 2**: `T005`, `T006`, and `T007` touch distinct files (`src/lib/text.ts`, `src/services/auditBridgeService.ts`, `src/services/translation/translationValidation.ts`) and can run in parallel with `T004` (`src/lib/glossaryMatch.ts`).
- **Phase 3 (`US1`)**: `T008` (tests), `T011` (`rawTranslation.ts`), and `T012` (`useGlossaryApply.ts`) can run in parallel once `T004` is complete.
- **Phase 4 (`US2`)**: `T014`, `T015`, `T018`, `T020`, `T021`, and `T022` operate on separate files and can run in parallel.
- **Phase 6 (`US4`)**: `T028`, `T029`, `T031`, and `T033` operate on separate files and can run in parallel.

---

## Parallel Example: User Story 1 & User Story 2

```bash
# Example parallel batch in User Story 1 after T004 completes:
Task T008: "Create unit tests in src/lib/__tests__/glossaryMatch.test.ts"
Task T011: "Update fallbackSinoVietnameseLine in src/services/translation/rawTranslation.ts"
Task T012: "Update handleApplyGlossaryToAllChapters in src/hooks/useGlossaryApply.ts"

# Example parallel batch in User Story 2:
Task T020: "Integrate mergeGlossaryPreservingProfiles in src/services/google-drive/driveBundleSync.ts & driveProjectSync.ts"
Task T021: "Add optional CharacterProfile fields in src/components/glossary-manager/AddGlossaryForm.tsx"
Task T022: "Add CharacterProfile editor in src/components/glossary-manager/GlossaryDetailSidebar.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (`T001`–`T003`) and Phase 2 (`T004`–`T007`).
2. Complete Phase 3 (`US1`: `T008`–`T013`).
3. **STOP and VALIDATE**: Run `npx vitest run src/lib/__tests__/glossaryMatch.test.ts src/services/ai/__tests__/prompts.test.ts` to verify 0 false compound-word corruptions and context-filtered glossary prompts.

### Incremental Delivery

1. **Foundation (`T001`–`T007`)** → Shared types, safe glossary matcher, and paragraph alignment ready.
2. **US1 (`T008`–`T013`)** → Accurate glossary application & compliance check (MVP).
3. **US2 (`T014`–`T022`)** → Character profiles, Drive sync preservation, and chunk/chapter continuity context.
4. **US3 (`T023`–`T027`)** → Multi-round polish fidelity guard and accurate round temperatures.
5. **US4 (`T028`–`T035`)** → Expanded QA taxonomy, deterministic + AI deduplication, and targeted paragraph repair.
6. **US5 & US6 (`T036`–`T040`)** → Prompt priority hierarchy verification and reproducible benchmark suite.
7. **Final Verification (`T041`–`T042`)** → Full `npm run lint`, `npm test`, and `npm run build` gates.
