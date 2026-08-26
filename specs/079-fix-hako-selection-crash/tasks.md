# Tasks: Fix Hako Chapter Selection Runtime Crash

**Branch**: `079-fix-hako-selection-crash` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish parameter type definitions and prepare test fixtures.

- [X] T001 Update hook interface signatures in `src/hooks/useHakoReviewSession.ts` to accept polymorphic `chapterId: string | number` and `chapterIds: (string | number)[]`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish automated test fixtures for string vs numeric ID matching, sparse arrays, and boundary selection.

- [X] T002 [P] Add unit test suite verifying string vs numeric chapter ID matching, sparse array filtering, and aggregate word count calculation in `src/hooks/__tests__/useHakoReviewSession.test.ts`

**Checkpoint**: Foundation ready — Test cases define expected boundary behavior and ID normalization.

---

## Phase 3: User Story 1 - Safe Selection and Scrolling on Large Chapter Lists (Priority: P1) 🎯 MVP

**Goal**: Eliminate unhandled `TypeError` exceptions and blank screen crashes when scrolling down and selecting late-stage chapters (e.g. #118 - #127) in long novel projects.

**Independent Test**: Load a 139-chapter project in the Quality Checker, scroll to the bottom, toggle checkboxes on chapters #118 - #127; verify instant selection feedback, accurate `Đã chọn: X / 12` counter, and zero unhandled exceptions.

### Implementation for User Story 1
- [X] T003 [US1] Normalize `chapterId` and `selectedChapterIds` to `String(id)` in `toggleChapterSelection`, `selectChapterRange`, and `updateChapterRawText` inside `src/hooks/useHakoReviewSession.ts`
- [X] T004 [US1] Add defensive row guards (`if (!ch) return null;`), fallback labels (`ch.title || 'Chương không có tiêu đề'`), fallback numbers (`ch.chapterNumber ?? (index + 1)`), and stable keys in `src/components/hako-checker/HakoChapterSelector.tsx`
- [X] T005 [US1] Implement safe aggregate calculations (`selectedChapters` and `totalSelectedWords` via `.filter(Boolean)` and `?.`) in `src/components/hako-checker/HakoCheckerWorkspace.tsx`

**Checkpoint**: User Story 1 complete — Late-stage chapters (#118 - #127) can be selected and scrolled smoothly without crashing.

---

## Phase 4: User Story 2 - Robust Data Type Harmonization & Boundary Defense (Priority: P2)

**Goal**: Guarantee that heterogeneous ID types (numeric vs string) and out-of-bounds array indices never cause `undefined` lookups during list rendering or analysis startup.

**Independent Test**: Select chapters in projects with numeric IDs and string IDs, verify `Set.has(String(id))` and range bounds work seamlessly.

### Implementation for User Story 2
- [X] T006 [US2] Harmonize ID type matching in `src/components/hako-checker/HakoChapterSelector.tsx` using `const chapterIdStr = String(ch.chapterId || (ch as any).id); const isSelected = selectedChapterIds.some(id => String(id) === chapterIdStr)`
- [X] T007 [US2] Guard against missing or sparse chapter records in JIT chapter loading in `src/components/hako-checker/HakoCheckerWorkspace.tsx` (`handleStartAnalysis`)

**Checkpoint**: User Story 2 complete — Heterogeneous ID formats and sparse arrays resolve safely across all components.

---

## Phase 5: User Story 3 - Localized Fault Isolation via Error Boundary (Priority: P3)

**Goal**: Wrap the Quality Checker workspace in an `ErrorBoundary` to prevent any unexpected rendering errors from unmounting the whole application.

**Independent Test**: Trigger an unexpected error within `HakoCheckerWorkspace`; verify localized error fallback is shown with "Khôi phục phân vùng" while parent navigation tabs remain interactive.

### Implementation for User Story 3
- [X] T008 [US3] Wrap internal workspace components with `<ErrorBoundary fallbackTitle="Đã xảy ra lỗi tại phân vùng Kiểm Định Chất Lượng">` in `src/components/hako-checker/HakoCheckerWorkspace.tsx`

**Checkpoint**: User Story 3 complete — Localized fault isolation guarantees 100% parent application uptime.

---

## Phase 6: Polish & Cross-Cutting Verification

**Purpose**: Run full quality gates and verify manual user journeys.

- [X] T009 Run TypeScript static type checking via `npm run lint` (`tsc --noEmit`)
- [X] T010 Run all test suites via `npm test` (`vitest run`)
- [X] T011 Run production bundle compilation via `npm run build`
- [X] T012 [P] Validate manual verification scenarios against `quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Phase 1 (Setup)**: Can start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 — blocks story validation.
- **Phase 3 (User Story 1 - MVP)**: Depends on Phase 1 & 2.
- **Phase 4 (User Story 2)**: Can run with or after Phase 3.
- **Phase 5 (User Story 3)**: Can run in parallel with UI tasks.
- **Phase 6 (Polish)**: Depends on all User Stories completion.

### Parallel Opportunities
- T002 and T003 can be prepared in parallel.
- T004 and T005 can be implemented in parallel.
- T008 and T007 can run in parallel.
- T009, T010, T011, T012 run in the final verification phase.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Normalize ID types in `src/hooks/useHakoReviewSession.ts`.
2. Add defensive row guards in `src/components/hako-checker/HakoChapterSelector.tsx`.
3. Safe-guard `selectedChapters` and `totalSelectedWords` in `src/components/hako-checker/HakoCheckerWorkspace.tsx`.
4. Validate selection on chapters #118 - #127.

### Incremental Delivery
1. Add data type harmonization across JIT loading and selector (User Story 2).
2. Wrap workspace with localized ErrorBoundary (User Story 3).
3. Run full quality gates (`lint`, `test`, `build`).
