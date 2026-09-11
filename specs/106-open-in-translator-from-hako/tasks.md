# Tasks: Direct Jump from Hako Checker to Translator Workspace

**Feature**: Direct Jump from Hako Checker to Translator Workspace (`106-open-in-translator-from-hako`)
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Review existing contracts, components, and test baselines before implementation.

- [x] T001 Verify existing test baselines and props in `src/components/hako-checker/__tests__/HakoIssueReviewPanel.test.tsx` and `src/App.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish type signatures and prop contracts across components.

- [x] T002 Update prop interfaces in `src/components/hako-checker/HakoCheckerWorkspace.tsx` and `src/components/hako-checker/HakoIssueReviewPanel.tsx` to include `onOpenInTranslator?: (chapterId: string) => void` per contract

---

## Phase 3: User Story 1 - One-Click Jump from Chapter Audit Result to Translator Workspace (Priority: P1) 🎯 MVP

**Goal**: Moderator can click "Mở trong Bàn Dịch để sửa" on an audited chapter with issues to immediately open that chapter in BilingualEditor.

**Independent Test**: Load a completed/partial session in Hako Checker, click "Mở trong Bàn Dịch để sửa" on a chapter with issues, verify the application switches to the 'translate' tab and populates `loadedChapter`.

### Implementation for User Story 1

- [x] T003 [US1] Implement `handleOpenChapterFromHakoChecker` in `src/App.tsx` calling `getChapterFromDB` and `handleGoToTranslate`, and pass `onOpenInTranslator` to `<MemoHakoCheckerWorkspace>`
- [x] T004 [US1] Thread `onOpenInTranslator` prop through `src/components/hako-checker/HakoCheckerWorkspace.tsx` into `<HakoIssueReviewPanel>`
- [x] T005 [US1] Compute chapters with detected issues and render `"Mở trong Bàn Dịch để sửa"` button for each chapter with issues in `src/components/hako-checker/HakoIssueReviewPanel.tsx`

**Checkpoint**: User Story 1 is functional: clicking "Mở trong Bàn Dịch để sửa" loads the chapter and switches to the Translator Workspace.

---

## Phase 4: User Story 2 - Graceful Error Handling When Chapter Record Is Missing (Priority: P2)

**Goal**: Display clear error toast notification without crashing if a chapter is not found in IndexedDB or if retrieval fails.

**Independent Test**: Pass a non-existent chapter ID to the handler; verify that an error toast appears with `"Không tìm thấy dữ liệu chương!"` and the tab does not navigate.

### Implementation for User Story 2

- [x] T006 [US2] Wire `useNotifications().showToast` in `handleOpenChapterFromHakoChecker` in `src/App.tsx` for `null` chapter or caught exceptions
- [x] T007 [US2] Add unit test suite in `src/components/hako-checker/__tests__/HakoIssueReviewPanel.test.tsx` asserting button click emits `onOpenInTranslator` with expected `chapterId`

**Checkpoint**: User Story 2 is functional: invalid/missing chapters fail gracefully with toast feedback and 0 crashes.

---

## Phase 5: User Story 3 - Granular Issue-Level Navigation to Translator (Priority: P3)

**Goal**: Allow proofreaders to jump to the Translator workspace directly from individual issue cards.

**Independent Test**: Click "Mở trong Bàn Dịch để sửa" on an individual `HakoIssueCard` and verify navigation triggers for that issue's parent chapter.

### Implementation for User Story 3

- [x] T008 [US3] Add `onOpenInTranslator` prop to `src/components/hako-checker/HakoIssueCard.tsx` and render navigation button in card header

---

## Phase 6: Polish & Verification

**Purpose**: Execute all mandatory quality gates per Constitution Principle I and AGENTS.md.

- [x] T009 Run complete test suite via `npm test` and ensure all tests pass cleanly
- [x] T010 Run TypeScript type check via `npm run lint` (`tsc --noEmit`) and verify 0 type errors
- [x] T011 Run production build via `npm run build` (`vite build` + `esbuild server`) and confirm successful build

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 - blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Phase 2 - delivers core MVP.
- **User Story 2 (Phase 4)**: Depends on Phase 3.
- **User Story 3 (Phase 5)**: Depends on Phase 3.
- **Polish (Phase 6)**: Depends on all user story implementations being completed.

### Implementation Strategy

1. **MVP First**: Complete Phase 1, Phase 2, and Phase 3 (T001–T005). Verify chapter opens in Translator Workspace.
2. **Resilience & Testing**: Complete Phase 4 (T006–T007).
3. **Ergonomics**: Complete Phase 5 (T008).
4. **Final Quality Verification**: Complete Phase 6 (T009–T011).
