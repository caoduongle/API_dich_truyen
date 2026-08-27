# Tasks: Upsert Chapter Save in Translator Workspace

**Input**: Design artifacts from `specs/082-upsert-chapter-save/` (`spec.md`, `plan.md`, `data-model.md`, `contracts/`, `research.md`, `quickstart.md`)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify repository health and baseline build/test state before modifications.

- [X] T001 Verify project baseline and environment readiness via `npm run lint` and `npm test`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Set up testing infrastructure for workspace save and state management.

**⚠️ CRITICAL**: Foundational test harness must be prepared before implementing user stories.

- [X] T002 Create test harness file in `src/components/translator-workspace/__tests__/useWorkspaceState.test.ts` for workspace save and lifecycle operations

**Checkpoint**: Foundation ready - user story implementation can begin.

---

## Phase 3: User Story 1 - Update Existing Chapter In-Place (Priority: P1) 🎯 MVP

**Goal**: When saving a chapter loaded from history (`currentChapterId` exists in `activeProject.chapters`), update it in-place preserving `id` and `createdAt` with updated fields, timestamps, and an update toast notification.

**Independent Test**: Load existing chapter, edit text, trigger `handleSaveChapter` -> chapter updated in-place in `activeProject.chapters`, total chapter count unchanged, `updatedAt` refreshed.

### Tests for User Story 1
- [X] T003 [US1] Write unit tests for in-place chapter update in `src/components/translator-workspace/__tests__/useWorkspaceState.test.ts`

### Implementation for User Story 1
- [X] T004 [US1] Implement in-place chapter update logic with existence check in `src/components/translator-workspace/useWorkspaceState.ts`

**Checkpoint**: User Story 1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - Create New Chapter with Immediate Session Binding (Priority: P1)

**Goal**: When saving a new draft (`currentChapterId` is null/unmatched), create a new chapter, prepend it to `activeProject.chapters`, and immediately set `currentChapterId(newChapter.id)` so subsequent saves update the record.

**Independent Test**: Save a new chapter draft twice in succession -> exactly 1 new chapter is created in `activeProject.chapters`, and the second save updates the created chapter without increasing count.

### Tests for User Story 2
- [X] T005 [US2] Write unit tests for new chapter creation and consecutive re-saving in `src/components/translator-workspace/__tests__/useWorkspaceState.test.ts`

### Implementation for User Story 2
- [X] T006 [US2] Implement immediate `setCurrentChapterId` binding upon new chapter creation in `src/components/translator-workspace/useWorkspaceState.ts`

**Checkpoint**: User Stories 1 AND 2 both work independently and prevent duplicate chapter creation.

---

## Phase 5: User Story 3 - Clean Workspace Chapter ID Reset (Priority: P2)

**Goal**: Ensure `currentChapterId` is reset to `null` when switching active projects or loading sample example data.

**Independent Test**: Load an existing chapter in Project A, switch to Project B or load sample text -> verify `currentChapterId` is reset to `null` and does not leak cross-project.

### Tests for User Story 3
- [X] T007 [US3] Write unit tests for `currentChapterId` reset on project switch and example loading in `src/components/translator-workspace/__tests__/useWorkspaceState.test.ts`

### Implementation for User Story 3
- [X] T008 [US3] Implement `setCurrentChapterId(null)` on project switch effect (`useEffect([activeProject.id])`) and in `handleLoadExample` in `src/components/translator-workspace/useWorkspaceState.ts`

**Checkpoint**: All user stories are independently functional with clean state lifecycles.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Complete verification across type safety, test suite, and bundle builds.

- [X] T009 Run complete lint, test suite, and build verification via `npm run lint`, `npm test`, and `npm run build`
- [X] T010 Validate end-to-end scenarios per `specs/082-upsert-chapter-save/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) - BLOCKS user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) - Core MVP logic.
- **User Story 2 (Phase 4)**: Depends on US1 completion - Extends upsert branching to creation with session ID binding.
- **User Story 3 (Phase 5)**: Depends on US2 completion - Implements clean lifecycle resets on project change and sample loading.
- **Polish (Phase 6)**: Depends on all user stories being completed.

### User Story Dependencies
- **User Story 1 (P1)**: Independent in-place update logic.
- **User Story 2 (P1)**: Complements US1 by binding new chapter ID to the active workspace session.
- **User Story 3 (P2)**: Resets state cleanly when switching context.

---

## Parallel Opportunities

- Tests and test helpers in `src/components/translator-workspace/__tests__/useWorkspaceState.test.ts` can be drafted alongside implementation review.
- US1, US2, and US3 unit tests can be grouped in a single comprehensive test suite file.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Setup (T001) & Foundational harness (T002).
2. Complete US1 tests and in-place update implementation (T003, T004).
3. Validate US1 independently: existing chapters update in-place without duplicating.

### Incremental Delivery
1. Add US2 (T005, T006) to bind new chapter IDs on first save -> test consecutive saves.
2. Add US3 (T007, T008) to reset `currentChapterId` on project change and example loading -> test state isolation.
3. Run full verification suite (T009, T010).
