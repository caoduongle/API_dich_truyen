# Tasks: Workspace Audit Scanners & QA Critique Decoupling

**Feature Branch**: `101-workspace-audit-scanners`  
**Input**: Design artifacts from `specs/101-workspace-audit-scanners/` (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`)

---

## Phase 1: Setup & Baseline Check

**Purpose**: Verify clean baseline environment and test execution readiness

- [X] T001 Verify baseline environment and clean test suite status via npm test in repository root

---

## Phase 2: User Story 1 - Decouple Auto QA Critique from Polish Translation (Priority: P1) 🎯 MVP

**Goal**: Remove automatic `qaCritiqueDirect` trigger from `handlePolishTranslation()`.

**Independent Test**: Execute `handlePolishTranslation()` and verify `qaCritiqueDirect()` is not invoked.

### Implementation for User Story 1

- [X] T002 [US1] Remove automatic qaCritiqueDirect invocation from handlePolishTranslation in src/components/translator-workspace/useWorkspaceState.ts

**Checkpoint**: Polish translation completes without executing AI QA critique.

---

## Phase 3: User Story 2 - Explicit Manual AI QA Critique Action (Priority: P1)

**Goal**: Implement `handleRunAiQaCritique()` to allow on-demand AI quality review.

**Independent Test**: Call `handleRunAiQaCritique()` and verify `isCheckingQa` loading cycle and `qaIssues` state update.

### Implementation for User Story 2

- [X] T003 [US2] Implement handleRunAiQaCritique manual action in src/components/translator-workspace/useWorkspaceState.ts

**Checkpoint**: Manual AI QA critique action is operational and safely handles errors.

---

## Phase 4: User Story 3 - Debounced Real-Time Heuristic Quality Scan (Priority: P1)

**Goal**: Add `hakoIssues` state, synchronous `handleRunHakoScan()`, and 500ms debounce effect on `polishedTranslation` changes.

**Independent Test**: Modify `polishedTranslation` and verify `hakoIssues` updates after debounce delay.

### Implementation for User Story 3

- [X] T004 [US3] Implement hakoIssues state, handleRunHakoScan, and debounced scan effect in src/components/translator-workspace/useWorkspaceState.ts
- [X] T005 [US3] Export hakoIssues, handleRunAiQaCritique, and handleRunHakoScan from useWorkspaceState in src/components/translator-workspace/useWorkspaceState.ts

**Checkpoint**: Real-time heuristic scanning and manual actions are fully exposed from the hook.

---

## Phase 5: Test Coverage (Priority: P1)

**Goal**: Add comprehensive unit test coverage for the decoupled hook actions.

- [X] T006 [P] Add unit tests for decoupled polish, handleRunAiQaCritique, and handleRunHakoScan in src/components/translator-workspace/__tests__/useWorkspaceState.test.ts

---

## Phase 6: Polish & Verification Quality Gates

**Purpose**: Multi-gate verification required by Constitution Principle I before delivery.

- [X] T007 Run TypeScript type-check via npm run lint to ensure zero type diagnostics
- [X] T008 Run unit test suite via npm test to ensure all tests pass
- [X] T009 Run production build via npm run build to ensure clean bundle

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Can start immediately.
- **User Story 1 (Phase 2)**: Depends on T001; removes auto-trigger.
- **User Story 2 (Phase 3)**: Depends on Phase 2; adds manual QA handler.
- **User Story 3 (Phase 4)**: Depends on Phase 3; adds heuristic scan and exports.
- **Tests (Phase 5)**: Validates US1, US2, and US3.
- **Polish (Phase 6)**: Runs full verification gates.

---

## Implementation Strategy

### MVP Scope (User Story 1 & 2)
1. Complete T001 baseline verification.
2. Complete T002: Decouple QA trigger from `handlePolishTranslation`.
3. Complete T003: Add `handleRunAiQaCritique`.
4. Complete T004 & T005: Add `hakoIssues`, `handleRunHakoScan`, and debounce effect.
5. Add unit tests in T006.
6. Run full verification gates (T007-T009).
