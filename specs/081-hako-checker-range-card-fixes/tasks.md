# Tasks: Hako Quality Checker Selection UX, Card Numbering & Error Visibility

**Feature**: Hako Quality Checker Selection UX, Card Numbering & Error Visibility  
**Feature Directory**: `specs/081-hako-checker-range-card-fixes`  
**Input**: Design artifacts from `specs/081-hako-checker-range-card-fixes/` (`spec.md`, `plan.md`, `data-model.md`, `contracts/`, `research.md`, `quickstart.md`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify development baseline and environment health

- [x] T001 Verify existing test suite baseline and project linting cleanly pass via `npm test` and `npm run lint`

---

## Phase 2: Foundational (Type Extensions & Data Contracts)

**Purpose**: Core data schema updates required by all subsequent user stories

**⚠️ CRITICAL**: No UI or engine implementation can proceed until types are updated

- [x] T002 [P] Add `chapterNumber: number` to `QualityIssue` interface in `src/types/hakoChecker.ts`
- [x] T003 [P] Update scan signatures and all 5 `QualityIssue` creation points to pass `chapterNumber: chapter.chapterNumber` in `src/services/hakoQualityEngine.ts`

**Checkpoint**: Foundation types and scan engine signatures ready.

---

## Phase 3: User Story 1 - Chapter Number Context on Quality Issue Cards & Reports (Priority: P1) 🎯 MVP

**Goal**: Display `#<chapterNumber> · <chapterTitle>` in issue review cards and sort exported Markdown reports numerically by chapter order.

**Independent Test**: Run quality scan on selected chapters and verify cards show `#134 · 第一百三十四章 装逼` and exported Markdown organizes chapters numerically with formatted headers.

### Tests for User Story 1

- [x] T004 [P] [US1] Add unit tests in `src/services/__tests__/hakoQualityEngine.test.ts` for `chapterNumber` propagation and numerically sorted Markdown report generation

### Implementation for User Story 1

- [x] T005 [US1] Implement ascending chapter sorting by `chapterNumber` and format headers as `### Chương #{chapterNumber} — {chapterTitle}` in `generateQualityReport` in `src/services/hakoQualityEngine.ts`
- [x] T006 [US1] Pass `chapterNumber: chData.chapterNumber` in heuristic scan and `chapterNumber: ch.chapterNumber` in AI scan payload in `src/components/hako-checker/HakoCheckerWorkspace.tsx`
- [x] T007 [US1] Update `HakoIssueCard.tsx` header to render `#${issue.chapterNumber} · ${issue.chapterTitle}` with monospace polish badge styling

**Checkpoint**: User Story 1 complete. Issue cards and exported reports clearly indicate chapter numbers.

---

## Phase 4: User Story 2 - Range-Based Chapter Batch Selection (Priority: P1)

**Goal**: Enable fast chapter range selection ("Từ chương" ... "Đến chương") with auto-swapping min/max and 12-chapter cap integration.

**Independent Test**: Enter `120` and `131` in range inputs, click "Chọn khoảng", and verify 12 chapters are selected.

### Implementation for User Story 2

- [x] T008 [US2] Add `fromChapter` and `toChapter` number inputs, input validation, auto-swapping range logic, and "Chọn khoảng" button in `src/components/hako-checker/HakoChapterSelector.tsx`
- [x] T009 [US2] Integrate range selection with `onSelectRange` and translatable chapter filtering in `src/components/hako-checker/HakoChapterSelector.tsx`

**Checkpoint**: User Story 2 complete. Moderators can select multi-chapter batches in a single click.

---

## Phase 5: User Story 3 - Single Chapter Quick-Select by Chapter Number (Priority: P2)

**Goal**: Enable single chapter jump/toggle by typing chapter number and pressing Enter, with auto-clear and transient warning for missing chapters.

**Independent Test**: Type `134` + Enter to select chapter #134; type `9999` + Enter to see transient inline warning "Không tìm thấy chương #9999".

### Implementation for User Story 3

- [x] T010 [US3] Add `singleChapterInput` number input with Enter key handler (`onKeyDown`) and "Chọn" button in `src/components/hako-checker/HakoChapterSelector.tsx`
- [x] T011 [US3] Implement chapter lookup, selection toggle, input auto-clearing for rapid sequential entry, and 2.5s transient inline warning for non-existent chapters in `src/components/hako-checker/HakoChapterSelector.tsx`

**Checkpoint**: User Story 3 complete. Moderators can rapidly select individual chapters by number.

---

## Phase 6: User Story 4 - Session Error & Warning Visibility Banner (Priority: P1)

**Goal**: Surface `useHakoReviewSession` error and limit warnings in a prominent, dismissible banner inside the workspace.

**Independent Test**: Select >12 chapters via range selection to trigger `CHAPTER_LIMIT_EXCEEDED` and verify styled alert banner appears with working close button.

### Implementation for User Story 4

- [x] T012 [US4] Destructure `error` and `setError` from `useHakoReviewSession()` in `src/components/hako-checker/HakoCheckerWorkspace.tsx`
- [x] T013 [US4] Render styled dismissible error/warning banner with alert icon, message text, and close button calling `setError(null)` in `src/components/hako-checker/HakoCheckerWorkspace.tsx`

**Checkpoint**: User Story 4 complete. Errors and quota limits are immediately visible and actionable.

---

## Phase 7: Polish & Cross-Cutting Verification

**Purpose**: Strict quality gate verification across all updated components

- [x] T014 [P] Run TypeScript compiler type-check gate (`npm run lint` / `npx tsc --noEmit`)
- [x] T015 [P] Run full Vitest test suite (`npm test` / `npx vitest run`)
- [x] T016 Run Vite + esbuild build verification (`npm run build`)
- [x] T017 Execute manual validation scenarios in browser per `specs/081-hako-checker-range-card-fixes/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (Phase 1). Blocks all User Stories.
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2).
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2). Can execute in parallel with or after US1.
- **User Story 3 (Phase 5)**: Depends on Foundational (Phase 2). Integrates alongside US2 controls in `HakoChapterSelector.tsx`.
- **User Story 4 (Phase 6)**: Depends on Foundational (Phase 2). Can execute in parallel with US1/US2/US3.
- **Polish (Phase 7)**: Depends on completion of all User Stories (US1–US4).

### Parallel Opportunities

- `T002` and `T003` can run in parallel.
- `T004` (unit tests) and `T007` (issue card) can be prepared in parallel with service updates.
- `T014` and `T015` can run concurrently during final verification.

---

## Implementation Strategy

### MVP First (User Story 1 & Foundational)
1. Complete Phase 1 (Setup) and Phase 2 (Foundational schemas & engine).
2. Complete Phase 3 (User Story 1 - Issue card chapter numbering & report formatting).
3. Validate issue card display and test suite.

### Incremental Feature Expansion
1. Add Phase 4 (User Story 2 - Range selection).
2. Add Phase 5 (User Story 3 - Single chapter jump & transient warning).
3. Add Phase 6 (User Story 4 - Error banner visibility).
4. Run Phase 7 (Full lint, test, build, and browser verification).
