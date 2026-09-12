# Tasks: Hako Bulk Raw Hydration

**Input**: Design documents from `specs/121-hako-bulk-raw-hydration/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/)
**Branch**: `121-hako-bulk-raw-hydration`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Define bulk hydration data models and extend hook interfaces

- [x] T001 Define BulkHydrationResult interface and extend UseHakoReviewSessionReturn in src/hooks/useHakoReviewSession.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core batch querying mechanism to fetch all chapters' sourceText from IndexedDB

⚠️ **CRITICAL**: Batch retrieval must be available before automatic or manual hydration can be wired

- [x] T002 Implement project-wide batch raw fetching using getChaptersByProjectFromDB in src/hooks/useHakoReviewSession.ts

**Checkpoint**: Core batch fetching logic ready for session orchestration

---

## Phase 3: User Story 1 - Automatic Project-Wide Raw Chinese Hydration on Load (Priority: P1) 🎯 MVP

**Goal**: Automatically hydrate `rawChineseContent` from `sourceText` in IndexedDB for all project chapters when opening or selecting a project, without requiring manual clicks on individual chapter cards.

**Independent Test**: Load a project where chapters have `sourceText` in IndexedDB; verify that `selectProject` populates `rawChineseContent` for all chapters and `HakoChapterSelector` renders `Đã có Raw (X ký tự)` on chapter cards immediately.

### Tests for User Story 1
- [x] T003 [P] [US1] Add unit tests for automatic raw hydration on selectProject in src/hooks/__tests__/useHakoReviewSession.test.ts

### Implementation for User Story 1
- [x] T004 [US1] Update selectProject in src/hooks/useHakoReviewSession.ts to query getChaptersByProjectFromDB and populate rawChineseContent for all chapters
- [x] T005 [US1] Add background auto-hydration effect on mount or project change in src/components/hako-checker/HakoChapterSelector.tsx to ensure unpopulated chapters are hydrated

**Checkpoint**: User Story 1 complete — selecting a project automatically populates raw Chinese text for all chapters

---

## Phase 4: User Story 2 - One-Click "Nạp Raw Tất Cả Chương" Toolbar Action (Priority: P1)

**Goal**: Provide an explicit "⚡ Nạp Raw toàn bộ" action button in the chapter selector toolbar to trigger batch raw synchronization on demand with loading state and feedback.

**Independent Test**: Click "⚡ Nạp Raw toàn bộ" in `HakoChapterSelector`; verify loading spinner appears, all chapters update to "Đã có Raw", and a toast/notification confirms hydrated chapter count.

### Tests for User Story 2
- [x] T006 [P] [US2] Add unit tests for hydrateAllChaptersRaw hook action in src/hooks/__tests__/useHakoReviewSession.test.ts
- [x] T009 [P] [US2] Add unit tests for bulk raw button click and loading state in src/components/hako-checker/__tests__/HakoChapterSelector.test.tsx

### Implementation for User Story 2
- [x] T007 [US2] Implement hydrateAllChaptersRaw method in src/hooks/useHakoReviewSession.ts to re-fetch and update session chapter raw text
- [x] T008 [US2] Connect onHydrateAllRaw from useHakoReviewSession to HakoChapterSelector in src/components/hako-checker/HakoCheckerWorkspace.tsx
- [x] T010 [US2] Add "⚡ Nạp Raw toàn bộ" button with Zap icon and loading state in toolbar of src/components/hako-checker/HakoChapterSelector.tsx

**Checkpoint**: User Stories 1 AND 2 work together — raw content is auto-populated and can be refreshed on demand with one click

---

## Phase 5: User Story 3 - Visual Metrics & Mixed-Project Graceful Handling (Priority: P2)

**Goal**: Display live raw text coverage metrics (`Đã có Raw: X/Y chương`) in the chapter selector header and ensure chapters lacking source text retain `+ Thêm Raw` cleanly.

**Independent Test**: Load a project where some chapters lack `sourceText`; verify the header displays `Đã có Raw: X/Y chương`, populated chapters show `Đã có Raw`, and unpopulated chapters show `+ Thêm Raw`.

### Tests for User Story 3
- [x] T011 [P] [US3] Add unit tests for raw coverage counter and mixed-chapter badges in src/components/hako-checker/__tests__/HakoChapterSelector.test.tsx

### Implementation for User Story 3
- [x] T012 [US3] Add raw coverage summary badge (Đã có Raw: X/Y chương) to the header in src/components/hako-checker/HakoChapterSelector.tsx

**Checkpoint**: Complete raw visibility across the entire project with clear coverage feedback

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Execute strict Constitution quality gates across the whole codebase

- [x] T013 [P] Run npm run lint (tsc --noEmit) to verify TypeScript types across all modified files
- [x] T014 [P] Run npm test (vitest run) to verify all test suites pass with 100% success rate
- [x] T015 Run npm run build (tsc && vite build) to verify production bundle generation without errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel or sequentially in priority order (P1 → P2)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Reuses batch fetching mechanism
- **User Story 3 (P2)**: Can start after US1/US2 - Enhances header metrics with raw counts

### Within Each User Story

- Tests written first, verified to fail before implementation
- Hook logic before UI components
- Story complete before marking checkpoint

### Parallel Opportunities

- T003, T006, T009, T011 (unit tests in separate files) can be authored in parallel
- Verification tasks T013 and T014 can run in parallel

---

## Parallel Example: User Story 2

```bash
# Launch test authoring for User Story 2:
Task: "Add unit tests for hydrateAllChaptersRaw hook action in src/hooks/__tests__/useHakoReviewSession.test.ts"
Task: "Add unit tests for bulk raw button click and loading state in src/components/hako-checker/__tests__/HakoChapterSelector.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002)
3. Complete Phase 3: User Story 1 (T003 - T005)
4. **STOP and VALIDATE**: Open a 139-chapter project; verify all chapters automatically display "Đã có Raw" without clicking

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 (MVP) → Automatic background raw hydration operational
3. Add User Story 2 → Toolbar button for on-demand bulk raw reload
4. Add User Story 3 → Coverage count badge and feedback
5. Polish → 100% Constitution quality gates verified

---

## Notes

- `[P]` tasks = different files, no dependencies
- `[Story]` label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Strict adherence to Constitution Principle I (lint, test, build) enforced in Phase 6
