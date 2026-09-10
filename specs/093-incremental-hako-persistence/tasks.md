# Tasks: Incremental Quality Review Session Persistence & Partial State Handling

**Feature**: `093-incremental-hako-persistence`  
**Input**: Design documents from `specs/093-incremental-hako-persistence/`  
**Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/093-incremental-hako-persistence/spec.md) | **Plan**: [plan.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/093-incremental-hako-persistence/plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify active feature directory and workspace status before starting code changes

- [x] T001 Verify active feature configuration and workspace status in .specify/feature.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core types and hook interfaces that MUST be updated before user stories can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 [P] Extend QualityReviewSession status type with 'partial' in src/types/hakoChecker.ts
- [x] T003 [P] Add optional status parameter (defaulting to 'completed') to updateSessionChaptersAndIssues in src/hooks/useHakoReviewSession.ts

**Checkpoint**: Core type and session persistence contract updated. User story implementation can now proceed.

---

## Phase 3: User Story 1 - Incremental Chapter-by-Chapter Issue Persistence (Priority: P1) 🎯 MVP

**Goal**: Persist review issues and chapter review statuses incrementally after each chapter completes (both heuristic scan and AI scan) rather than once at the end of the entire batch.

**Independent Test**: Initiate analysis on 3 chapters; verify that when Chapter 1 completes its heuristic and AI critique, `updateSessionChaptersAndIssues` is called immediately with Chapter 1's issues and Chapter 1 marked `'done'` in IndexedDB, while the batch continues.

### Implementation for User Story 1

- [x] T004 [US1] Refactor handleStartAnalysis to execute heuristic and AI scans in a sequential per-chapter loop in src/components/hako-checker/HakoCheckerWorkspace.tsx
- [x] T005 [US1] Invoke updateSessionChaptersAndIssues with accumulated issues after each chapter completes in src/components/hako-checker/HakoCheckerWorkspace.tsx

**Checkpoint**: Issues and chapter statuses persist incrementally to IndexedDB as each chapter finishes.

---

## Phase 4: User Story 2 - Resilient Issue Retention on Cancellation or Error (Priority: P1)

**Goal**: Guarantee that user cancellation ("Hủy phân tích") or unexpected errors immediately save all issues accumulated up to that moment with session status set to `'partial'` without data loss.

**Independent Test**: Trigger an analysis across multiple chapters, cancel or throw an error during Chapter 2, and verify that the session retains Chapter 1 issues and Chapter 2 heuristic issues with status set to `'partial'`.

### Tests for User Story 2

- [x] T006 [P] [US2] Add unit test simulating mid-run analysis cancellation and asserting partial session issue retention in src/hooks/__tests__/useHakoReviewSession.test.ts

### Implementation for User Story 2

- [x] T007 [US2] Implement catch-block fail-safe persistence saving all accumulated issues with status 'partial' on AbortError or exception in src/components/hako-checker/HakoCheckerWorkspace.tsx

**Checkpoint**: Mid-run aborts and runtime exceptions preserve all captured issues in IndexedDB with status `'partial'`.

---

## Phase 5: User Story 3 - Partial Review State Indication & UI Review Panel Access (Priority: P2)

**Goal**: When a session is in `'partial'` status, render the Issue Review Panel and display a clear notification banner showing the completed chapter count vs total selected chapters.

**Independent Test**: Load a session with status `'partial'`; verify that the workspace displays an informative banner and renders the `HakoIssueReviewPanel` populated with the preserved issues.

### Implementation for User Story 3

- [x] T008 [US3] Update HakoCheckerWorkspace condition to render HakoIssueReviewPanel when session status is 'completed' or 'partial' in src/components/hako-checker/HakoCheckerWorkspace.tsx
- [x] T009 [US3] Add informative partial progress banner displaying completed vs total chapters when status is 'partial' in src/components/hako-checker/HakoCheckerWorkspace.tsx

**Checkpoint**: Moderators can clearly see partial status and review/confirm/dismiss all issues collected before the stop.

---

## Phase 6: User Story 4 - Unaffected Happy-Path Analysis (Priority: P3)

**Goal**: Ensure uninterrupted runs across all selected chapters transition cleanly to `'completed'` and retain 100% output parity with the previous implementation.

**Independent Test**: Run analysis to completion without interruption; verify that status transitions to `'completed'` and all issues across all chapters are presented.

### Tests for User Story 4

- [x] T010 [P] [US4] Add unit test verifying full uninterrupted analysis run sets status 'completed' in src/hooks/__tests__/useHakoReviewSession.test.ts
- [x] T011 [US4] Verify and ensure uninterrupted happy-path runs conclude with status 'completed' and full issue set in src/components/hako-checker/HakoCheckerWorkspace.tsx

**Checkpoint**: Happy-path operations work identically to before, with zero regression.

---

## Phase 7: Polish & Quality Verification

**Purpose**: Complete verification across quality gates and constitutional constraints

- [x] T012 Run TypeScript type check via npm run lint to ensure zero type errors
- [x] T013 Run full unit test suite via npm test to ensure 100% test pass rate
- [x] T014 Run production build via npm run build to verify production bundle generation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) - **BLOCKS all user stories**.
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2).
- **User Story 2 (Phase 4)**: Depends on US1 (Phase 3) - Catch fail-safe relies on per-chapter accumulator.
- **User Story 3 (Phase 5)**: Depends on US2 (Phase 4) - UI presentation of `'partial'` state.
- **User Story 4 (Phase 6)**: Depends on US1-US3 - Verifies happy-path parity and test coverage.
- **Polish & Verification (Phase 7)**: Depends on all user stories being complete.

### Parallel Opportunities

- **Phase 2**: `T002` (`src/types/hakoChecker.ts`) and `T003` (`src/hooks/useHakoReviewSession.ts`) can be modified independently.
- **Phase 4**: `T006` (unit test in `useHakoReviewSession.test.ts`) can be authored alongside `T007` (`HakoCheckerWorkspace.tsx`).
- **Phase 6**: `T010` (happy path test) can be authored in parallel with `T011`.

---

## Implementation Strategy

### MVP First (User Story 1 & 2)
1. Complete Phase 1 (Setup) and Phase 2 (Foundational types/hooks).
2. Complete Phase 3 (US1: per-chapter persistence) and Phase 4 (US2: catch fail-safe sweep & test).
3. **Validate**: Abort mid-run, verify issues are preserved in IndexedDB.
4. Complete Phase 5 (US3: UI presentation for partial status) and Phase 6 (US4: happy-path parity).
5. Run full quality gates (`npm run lint`, `npm test`, `npm run build`).
