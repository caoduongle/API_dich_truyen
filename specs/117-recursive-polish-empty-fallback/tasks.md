---
description: "Task list for Recursive Divide & Conquer Polish and Empty Response Resilience"
---

# Tasks: Recursive Divide & Conquer Polish and Empty Response Resilience

**Input**: Design documents from `/specs/117-recursive-polish-empty-fallback/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/translation-resilience.contract.md`, `quickstart.md`  
**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `- [ ] [TaskID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., [US1], [US2], [US3])
- Includes exact file paths in all descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Review and verify existing text primitives and token utilities

- [ ] T001 Inspect text splitting primitives and token thresholds in src/lib/text.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data structures and error classifiers that MUST be complete before user story implementation

**⚠️ CRITICAL**: Foundational contracts for error detection and return types

- [ ] T002 Extend DirectPolishTranslationResult interface with isPartial flag in src/services/directTranslationEngine.ts
- [ ] T003 Implement isSafetyOrEmptyErrorDirect error classifier in src/services/directTranslationEngine.ts

**Checkpoint**: Foundation ready - user story implementation can proceed

---

## Phase 3: User Story 1 - Recursive Polish for Blocked or Empty Content (Priority: P1) 🎯 MVP

**Goal**: When Gemini returns an empty response or safety filter on a long chapter, the engine automatically divides the text recursively (Divide & Conquer) into smaller chunks and polishes each part, falling back to raw chunk if a leaf segment cannot be polished.

**Independent Test**: Mock an empty response on full text and verify that `polishTranslationDirect` executes recursive splitting (`depth = 1`) and successfully returns combined polished text, or falls back to raw text with `isPartial = true`.

### Tests for User Story 1

- [ ] T004 [P] [US1] Add unit tests for recursive splitting on empty response in src/services/__tests__/directTranslationEngine.test.ts
- [ ] T005 [P] [US1] Add unit tests for leaf fallback to raw chunk with isPartial flag in src/services/__tests__/directTranslationEngine.test.ts

### Implementation for User Story 1

- [ ] T006 [US1] Extract callPolishDirectCore helper from polishTranslationDirect in src/services/directTranslationEngine.ts
- [ ] T007 [US1] Implement polishWithContentSplitDirect recursive divide-and-conquer algorithm with adaptive splitting in src/services/directTranslationEngine.ts
- [ ] T008 [US1] Implement leaf fallback returning raw chunk when recursion limit is reached in src/services/directTranslationEngine.ts
- [ ] T009 [US1] Wire polishTranslationDirect to route through polishWithContentSplitDirect in src/services/directTranslationEngine.ts

**Checkpoint**: User Story 1 is fully functional and independently testable via unit tests.

---

## Phase 4: User Story 2 - Iterative Polish Prior-Round Preservation (Priority: P1)

**Goal**: If multi-cycle polishing completes Round 1 and Round 2 successfully but fails at Round 3 due to an unrecoverable empty response, preserve the Round 2 result and complete the chapter instead of aborting.

**Independent Test**: Execute `executeSingleChapterTranslation` with `polishCycles = 3` where Round 1 and Round 2 succeed but Round 3 fails with an empty response; verify the chapter completes with status `completed` and contains Round 2 text.

### Tests for User Story 2

- [ ] T010 [P] [US2] Add unit tests for round 3 empty response fallback preserving round 2 text in src/services/__tests__/chapterTranslationService.test.ts
- [ ] T011 [P] [US2] Add unit tests for round 1 failure falling back to firstDraft in src/services/__tests__/chapterTranslationService.test.ts

### Implementation for User Story 2

- [ ] T012 [US2] Update iterative polish loop in src/services/chapterTranslationService.ts to catch non-quota errors
- [ ] T013 [US2] Implement prior-round preservation (currentTextToPolish from round j - 1) and warning log in src/services/chapterTranslationService.ts
- [ ] T014 [US2] Implement first-draft fallback when round 1 polish fails completely in src/services/chapterTranslationService.ts

**Checkpoint**: User Stories 1 AND 2 work together, eliminating chapter failures from empty AI responses.

---

## Phase 5: User Story 3 - Transparent API Key Rotation Observability (Priority: P2)

**Goal**: Ensure accurate queue completion summary reporting when chapters encounter errors or retries.

**Independent Test**: Verify queue completion summary distinguishes between full success and partial failures with failed chapters.

### Implementation for User Story 3

- [ ] T015 [US3] Track accumulatedFailedIds across batch translation iterations in src/hooks/useTranslationProcess.ts
- [ ] T016 [US3] Fix queue completion summary log in src/hooks/useTranslationProcess.ts to check actual failed IDs instead of stale state ref

**Checkpoint**: Queue logs accurately reflect individual and batch chapter completion statuses.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates, static typing, and automated test suite verification

- [ ] T017 [P] Run typecheck and linting via npm run lint
- [ ] T018 [P] Run full automated test suite via npm test
- [ ] T019 Run production build validation via npm run build
- [ ] T020 Run quickstart validation scenarios per specs/117-recursive-polish-empty-fallback/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1; blocks User Story phases.
- **User Story 1 (Phase 3)**: Depends on Phase 2; establishes direct recursive split capabilities.
- **User Story 2 (Phase 4)**: Depends on Phase 3; integrates round preservation in chapter translation service.
- **User Story 3 (Phase 5)**: Depends on Phase 4; verifies hook queue state handling.
- **Polish (Phase 6)**: Depends on all user stories being implemented.

### User Story Dependencies

- **User Story 1 (P1)**: Core resilience engine (`directTranslationEngine.ts`). Independent.
- **User Story 2 (P1)**: Workflow orchestration (`chapterTranslationService.ts`). Depends on US1 concepts.
- **User Story 3 (P2)**: UI queue summary (`useTranslationProcess.ts`). Independent of engine internals.

### Parallel Opportunities

- T004 and T005 (US1 tests) can run in parallel.
- T010 and T011 (US2 tests) can run in parallel.
- T017 and T018 (lint and tests) can run in parallel during the polish phase.

---

## Parallel Example: User Story 1

```bash
# Run tests for User Story 1:
npm test -- src/services/__tests__/directTranslationEngine.test.ts
```

## Parallel Example: User Story 2

```bash
# Run tests for User Story 2:
npm test -- src/services/__tests__/chapterTranslationService.test.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (User Story 1: Recursive divide-and-conquer).
3. Validate US1 with `npm test -- src/services/__tests__/directTranslationEngine.test.ts`.

### Incremental Delivery

1. Setup + Foundational -> Foundation ready.
2. User Story 1 -> Direct engine divide-and-conquer functional (MVP).
3. User Story 2 -> Multi-round polish preserves earlier rounds.
4. User Story 3 -> Queue status logging accurate.
5. Polish -> Strict quality gates pass: `npm run lint`, `npm test`, `npm run build`.
