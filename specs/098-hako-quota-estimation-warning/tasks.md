# Tasks: Hako Checker AI Quota Estimation & Advisory Warning

**Input**: Design documents from `specs/098-hako-quota-estimation-warning/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/chapter-selector-quota-advisory.contract.md`, `quickstart.md`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify baseline component contracts and dependencies

- [X] T001 Verify baseline props and imports in `src/components/hako-checker/HakoChapterSelector.tsx`

---

## Phase 2: Foundational (Prerequisites)

**Purpose**: Safe API key resolution and quota tracking wiring

- [X] T002 Add optional `apiKeys?: string[]` to `HakoChapterSelectorProps` and wire safe key resolution via `migrateAndLoadApiKeys` in `src/components/hako-checker/HakoChapterSelector.tsx`

**Checkpoint**: Component can safely access configured API keys without breaking existing callers or tests.

---

## Phase 3: User Story 1 - AI Call Estimation Annotation (Priority: P1) [MVP]

**Goal**: Display an estimation badge `"~N lượt gọi AI"` next to the start button / readiness indicator when $N > 0$ chapters are selected.

**Independent Test**: Select $N$ chapters ($1 \le N \le 12$) in `HakoChapterSelector` and verify that `"~N lượt gọi AI"` renders synchronously.

### Implementation for User Story 1

- [X] T003 [US1] Implement dynamic AI call estimate badge (`"~N lượt gọi AI"`) adjacent to the selection status in `src/components/hako-checker/HakoChapterSelector.tsx`

**Checkpoint**: Reviewers see accurate estimation reflecting 1 call per selected chapter.

---

## Phase 4: User Story 2 - Advisory Quota Warning (Priority: P1)

**Goal**: Display an unobtrusive amber advisory warning if available quota is exhausted or insufficient, without disabling the Start button.

**Independent Test**: Mock `localQuotaTracker` with exhausted/insufficient quota, verify amber alert is displayed, and confirm Start button remains enabled and clickable.

### Implementation for User Story 2

- [X] T004 [US2] Implement quota health evaluation memo in `src/components/hako-checker/HakoChapterSelector.tsx` using `localQuotaTracker.getQuotaStatus()`
- [X] T005 [US2] Render non-blocking amber advisory box (`text-amber-300`, `bg-amber-950/30`, `border-amber-800/50`) when quota risk is detected in `src/components/hako-checker/HakoChapterSelector.tsx`
- [X] T006 [US2] Verify and enforce that the Start button disabled condition strictly remains `isAnalyzing || selectedChapterIds.length === 0` in `src/components/hako-checker/HakoChapterSelector.tsx`

**Checkpoint**: Quota warning displays gracefully when appropriate without blocking workflow.

---

## Phase 5: Verification & Polish

**Purpose**: Unit testing, design system token validation, and complete quality checks

- [X] T007 [P] Create unit test suite in `src/components/hako-checker/__tests__/HakoChapterSelector.test.tsx` verifying call estimation, advisory warning rendering, and non-blocking button behavior
- [X] T008 Execute quality verification gates (`npm run lint`, `npm test`, `npm run build`) to ensure 0 errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Can start immediately
- **Foundational (Phase 2)**: Depends on T001
- **User Story 1 (Phase 3)**: Depends on Phase 2
- **User Story 2 (Phase 4)**: Depends on Phase 2 and Phase 3
- **Verification & Polish (Phase 5)**: Depends on all implementation tasks (T001-T006)

---

## Parallel Opportunities

- T007 (unit tests) can be written and iteratively refined alongside T003-T006.

---

## Implementation Strategy

### MVP First (User Story 1 & 2)
1. Complete T001 and T002 for props and key resolution.
2. Complete T003 for `"~N lượt gọi AI"` badge.
3. Complete T004-T006 for quota risk computation and non-blocking amber warning.
4. Complete T007-T008 for Vitest test coverage and build/lint verification.
