# Tasks: Moderator Project Quality Checker Workspace

**Feature**: `075-moderator-quality-checker`
**Date**: 2026-08-27
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Setup & Cleanup (Shared Infrastructure)

**Purpose**: Update TypeScript types for project-based chapters and remove deprecated server-side scraping files.

- [X] T001 [P] Update TypeScript types in `src/types/hakoChecker.ts` to replace `HakoNovelMeta`/`HakoChapterMeta` with `ProjectReviewChapter` and `QualityReviewSession` with `projectId`/`projectTitle` per data-model.md
- [X] T002 [P] Remove scraping endpoints from `server/routes/api.ts` and delete `server/routes/hako.ts`, `server/controllers/hakoController.ts`, `server/services/hakoScraperService.ts`, `server/__tests__/hakoScraper.test.ts`, and `src/services/hakoApiService.ts`
- [X] T003 [P] Update persistent session store in `src/services/hakoSessionStore.ts` to support project-linked review sessions in `HakoQualityCheckerDB`

**Checkpoint**: Core types updated, dead scraping code eliminated, session store ready.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Quality engine and session hook updates that all UI flows depend on.

- [X] T004 Adapt `src/services/hakoQualityEngine.ts` to use `ProjectReviewChapter` input format (chapterId, title, vietnameseContent, rawChineseContent) for both heuristic and AI scans
- [X] T005 Update React hook `useHakoReviewSession` in `src/hooks/useHakoReviewSession.ts` to manage project selection, chapter selection (1-12 limit), automatic `sourceText` / `polishedTranslation` / `rawTranslation` binding, and IndexedDB session persistence

**Checkpoint**: Engine and hook ready to accept project-based chapter data.

---

## Phase 3: User Story 1 — Chọn dự án dịch và chọn đợt chương kiểm định (Priority: P1) 🎯 MVP

**Goal**: Moderator selects a translation project from dropdown → chapter list loads instantly with translation status → selects up to 12 chapters.

**Independent Test**: Open Quality Checker tab, select an existing project, see chapter list with status badges, select 1-12 chapters with 13th blocked.

### Implementation for User Story 1

- [X] T006 [P] [US1] Delete deprecated scraping importer component `src/components/hako-checker/HakoNovelImporter.tsx`
- [X] T007 [US1] Refactor `HakoChapterSelector` in `src/components/hako-checker/HakoChapterSelector.tsx` to include project selector dropdown, chapter list with status indicators (Đã biên tập / Đã dịch thô / Chưa dịch), selection counter (`N/12`), and selection controls
- [X] T008 [US1] Update `HakoCheckerWorkspace` in `src/components/hako-checker/HakoCheckerWorkspace.tsx` to consume projects from `useProjectContext()` and delegate selection to `useHakoReviewSession`
- [X] T009 [US1] Verify `src/App.tsx` tab navigation and i18n labels for the Quality Checker tab (Alt+6)

**Checkpoint**: US1 fully functional — moderator can select any project and choose 1-12 translated chapters instantly from local state.

---

## Phase 4: User Story 2 — Rà soát tự động từ dữ liệu dự án và xử lý danh sách lỗi nghi ngờ (Priority: P1)

**Goal**: System automatically extracts raw (`sourceText`) and translated text from selected chapters, runs Heuristic + AI analysis, and lets moderator confirm/review/dismiss issues.

**Independent Test**: Select chapters and start review → issues list appears with severity/category/snippets → change decisions → reload page → decisions preserved.

### Implementation for User Story 2

- [X] T010 [US2] Wire automatic chapter resolution in `HakoCheckerWorkspace.tsx` (bind `polishedTranslation` or `rawTranslation`, extract `sourceText` as raw) and execute Heuristic + AI scan pipeline with progress indicator
- [X] T011 [P] [US2] Update `HakoIssueCard` in `src/components/hako-checker/HakoIssueCard.tsx` to display chapter title, Vietnamese snippet, raw snippet, explanation, suggested fix, moderator notes, and decision buttons
- [X] T012 [US2] Update `HakoIssueReviewPanel` in `src/components/hako-checker/HakoIssueReviewPanel.tsx` to filter by severity, category, decision status, and chapter, with summary statistics and re-analyze trigger
- [X] T013 [US2] Ensure decision persistence in `useHakoReviewSession` updates `HakoQualityCheckerDB` immediately on every decision change

**Checkpoint**: US2 fully functional — moderator gets heuristic + AI issues from project chapters and decisions persist across page reloads.

---

## Phase 5: User Story 3 — Tùy chỉnh hoặc dán đè văn bản raw đối chiếu khi cần thiết (Priority: P2)

**Goal**: Moderator can view pre-filled `sourceText` in the chapter raw drawer and optionally paste an alternative raw text for variant comparison.

**Independent Test**: Open chapter raw drawer, verify `sourceText` is pre-filled, edit/override raw text, run scan → AI uses overridden raw for bilingual critique without modifying project data.

### Implementation for User Story 3

- [X] T014 [US3] Update raw text input drawer in `HakoChapterSelector.tsx` to pre-fill with `sourceText` from project chapter and allow moderator override without mutating original `sourceText`
- [X] T015 [US3] Verify AI scan prompt in `hakoQualityEngine.ts` checks bilingual fidelity (mistranslations, omissions, hallucinations) when raw is present

**Checkpoint**: US3 fully functional — bilingual comparison works seamlessly with project raw or custom override.

---

## Phase 6: User Story 4 — Xuất báo cáo kiểm định và tổng kết sai sót (Priority: P3)

**Goal**: Moderator copies a structured quality report of confirmed issues to clipboard in Markdown format.

**Independent Test**: Confirm issues, click "Xuất báo cáo", view Markdown preview, click copy → report copied to clipboard.

### Implementation for User Story 4

- [X] T016 [US4] Update `generateQualityReport` in `src/services/hakoQualityEngine.ts` to format confirmed issues grouped by chapter with project title
- [X] T017 [US4] Update `HakoReportExportModal` in `src/components/hako-checker/HakoReportExportModal.tsx` to display dashboard statistics and 1-click clipboard copy with toast feedback

**Checkpoint**: US4 fully functional — moderator can copy formatted Markdown report with 1 click.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verification, tests, and quality gates.

- [X] T018 [P] Update unit tests in `src/services/__tests__/hakoQualityEngine.test.ts` for `ProjectReviewChapter` input and report generation
- [X] T019 Run `npm run lint` (tsc --noEmit), `npm test` (vitest run), and `npm run build` (vite build + esbuild) to verify zero regressions — all 3 commands MUST pass cleanly
- [X] T020 Run quickstart.md validation scenarios end-to-end — verify Scenarios 1–4 from `specs/075-moderator-quality-checker/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup & Cleanup (Phase 1)**: Can start immediately. T001, T002, T003 are parallelizable.
- **Foundational (Phase 2)**: Depends on Phase 1 completion. T004 depends on T001. T005 depends on T001, T003, T004.
- **US1 (Phase 3)**: Depends on Phase 2. T006 and T007 can proceed. T008 depends on T007, T005. T009 verifies integration.
- **US2 (Phase 4)**: Depends on Phase 3. T010 wires pipeline. T011 and T012 can be verified/updated. T013 verifies persistence.
- **US3 (Phase 5)**: Depends on US2. T014 updates raw drawer; T015 verifies bilingual prompt.
- **US4 (Phase 6)**: Depends on US2. T016 updates report generator; T017 updates export modal.
- **Polish (Phase 7)**: Depends on all user stories being complete.

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup & Cleanup (T001–T003)
2. Complete Phase 2: Foundational (T004–T005)
3. Complete Phase 3: User Story 1 (T006–T009)
4. Complete Phase 4: User Story 2 (T010–T013)
5. **STOP and VALIDATE**: Test project selection + chapter quality analysis end-to-end.
6. Complete US3 (T014–T015) & US4 (T016–T017)
7. Run Phase 7 Polish & Quality Gates (T018–T020).
