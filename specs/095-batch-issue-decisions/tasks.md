# Tasks: Batch Issue Decisions & Shared Connection Caching

**Feature**: `095-batch-issue-decisions`  
**Input**: Design documents from `specs/095-batch-issue-decisions/`  
**Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/095-batch-issue-decisions/spec.md) | **Plan**: [plan.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/095-batch-issue-decisions/plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify active feature directory configuration

- [x] T001 Verify active feature configuration in .specify/feature.json

---

## Phase 2: Foundational & User Story 2 (P1) - Shared Database Connection Caching

**Goal**: In `hakoSessionStore.ts`, cache the `IDBDatabase` promise at module level so repeated operations reuse the active connection, with automatic invalidation on `onclose` or `onversionchange`.

**Independent Test**: Execute store operations; verify that repeated calls reuse the cached promise without calling `indexedDB.open()` again, and connection closure resets the cache.

### Implementation for User Story 2

- [x] T002 [US2] Implement module-level `dbPromise` caching and `onclose`/`onversionchange` cleanup in src/services/hakoSessionStore.ts

**Checkpoint**: `hakoSessionStore.ts` reuses open IndexedDB connection cleanly across calls.

---

## Phase 3: User Story 1 (P1) - Batch Decision Update with Single DB Write 🎯 MVP

**Goal**: In `useHakoReviewSession.ts`, implement `updateMultipleIssueDecisions(issueIds, decision)` to mutate all matching issues in a single state pass and persist to IndexedDB exactly ONCE.

**Independent Test**: Setup a session with 20 `'pending'` issues, call `updateMultipleIssueDecisions` with all 20 IDs and decision `'confirmed'`. Assert all 20 issues are `'confirmed'` and `saveSession` is called exactly 1 time.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they fail or pass properly upon implementation**

- [x] T003 [US1] Add unit test verifying updateMultipleIssueDecisions updates 20 pending issues and invokes saveSession exactly once in src/hooks/__tests__/useHakoReviewSession.test.ts

### Implementation for User Story 1

- [x] T004 [US1] Implement updateMultipleIssueDecisions with Set lookup and single persistSession call in src/hooks/useHakoReviewSession.ts

**Checkpoint**: `useHakoReviewSession` can batch update any list of issue IDs with exactly 1 storage write.

---

## Phase 4: User Story 3 (P2) - UI Batch Action Integration & Workspace Wiring

**Goal**: Update `HakoIssueReviewPanel.tsx` batch handlers to call `onBatchDecisionChange` in one go, and wire the new hook method in `HakoCheckerWorkspace.tsx`.

**Independent Test**: Click "Xác nhận tất cả" in the review panel with filtered issues; assert `onBatchDecisionChange` is called with the array of pending IDs.

### Implementation for User Story 3

- [x] T005 [US3] Add onBatchDecisionChange prop and update handleBatchConfirm/handleBatchDismiss in src/components/hako-checker/HakoIssueReviewPanel.tsx
- [x] T006 [US3] Destructure updateMultipleIssueDecisions from useHakoReviewSession and pass as onBatchDecisionChange in src/components/hako-checker/HakoCheckerWorkspace.tsx

**Checkpoint**: Clicking batch action buttons in the UI dispatches a single batch operation rather than 30–50 individual calls.

---

## Phase 5: Polish & Quality Verification

**Purpose**: Verify all quality gates and constitutional constraints pass cleanly

- [x] T007 Run TypeScript type check via npm run lint to ensure zero type errors
- [x] T008 Run full unit test suite via npm test to ensure 100% test pass rate
- [x] T009 Run production build via npm run build to verify bundle compilation

---

## Dependencies & Execution Order

- **Phase 1 (Setup)**: No dependencies.
- **Phase 2 (US2)**: Prerequisite for safe connection handling in tests and runtime.
- **Phase 3 (US1)**: Test first (`T003`), then implementation (`T004`).
- **Phase 4 (US3)**: Depends on US1 hook method being available.
- **Phase 5 (Polish)**: Runs after all implementation tasks.

---

## Implementation Strategy

### MVP First (User Story 2 + User Story 1)
1. Complete Phase 1: Setup (`T001`).
2. Complete Phase 2: Foundational Connection Caching (`T002`).
3. Complete Phase 3: Batch Decision Hook & Verification Test (`T003`, `T004`).
4. Validate test passes with exact 1-time `saveSession` call count.

### Incremental Delivery
1. Complete Phase 4: Wire UI Batch Action in Review Panel and Workspace (`T005`, `T006`).
2. Run full test suite & quality gates (`T007`, `T008`, `T009`).
