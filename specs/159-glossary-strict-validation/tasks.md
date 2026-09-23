# Tasks: Strict Glossary Runtime Validation and End-to-End Typing Hardening

**Feature Branch**: `159-glossary-strict-validation` | **Date**: 2026-09-23 | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify repository baseline and working state

- [X] T001 Verify baseline type safety and test suite status via `npm run lint` and `npm test` in the project root

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core validation guards and predicates in `src/lib/text.ts` and `src/lib/sinoNormalize.ts` required by all user stories

**⚠️ CRITICAL**: Foundational tasks must complete before user story implementation begins

- [X] T002 Implement `isGlossarySuggestionItem` item-level predicate in `src/lib/text.ts`
- [X] T003 Implement empty/whitespace string guard in `validateAndSnapBackEntities` in `src/lib/sinoNormalize.ts`

**Checkpoint**: Foundational guards and predicates verified in `src/lib/`.

---

## Phase 3: User Story 1 - Item-Level Runtime Validation for Glossary Suggestions (Priority: P1) 🎯 MVP

**Goal**: Filter AI glossary suggestion objects at the item level using `isGlossarySuggestionItem`, dropping corrupt/empty items (`{}`, `chinese: 123`, `vietnamese: null`, `chinese: ""`) rather than coercing them into blank cards.

**Independent Test**: Supply AI responses containing `{}` or non-string fields; verify `isGlossarySuggestionItem` returns `false` and `analyzeGlossaryDirect` / `extractGlossaryDirect` exclude them from the resulting suggestions.

### Tests for User Story 1

- [X] T004 [P] [US1] Add unit tests in `src/lib/__tests__/text.test.ts` asserting that `isGlossarySuggestionItem` strictly validates required non-empty `chinese`/`term`, string `vietnamese`, enum `type`, and string `pinyin`/`note`
- [X] T005 [P] [US1] Add unit test in `src/lib/__tests__/sinoNormalize.test.ts` verifying that `validateAndSnapBackEntities` filters out entities with empty or missing `chinese` strings without matching `rawText.includes("")`
- [X] T006 [P] [US1] Add unit tests in `src/services/__tests__/directGlossaryEngine.test.ts` verifying that `analyzeGlossaryDirect` and `extractGlossaryDirect` discard malformed/empty items from AI responses

### Implementation for User Story 1

- [X] T007 [US1] Wire `isGlossarySuggestionItem` into `callGlossaryAnalysisDirect` in `src/services/directGlossaryEngine.ts` to parse as `unknown[]` and filter invalid items before mapping
- [X] T008 [US1] Wire `isGlossarySuggestionItem` into `extractGlossaryDirect` in `src/services/directGlossaryEngine.ts` to parse as `unknown[]` and filter invalid items before mapping

**Checkpoint**: User Story 1 complete — corrupt and empty AI glossary suggestion items are discarded, eliminating phantom blank cards.

---

## Phase 4: User Story 2 - End-to-End Type Safety & Internal `any[]` Elimination (Priority: P2)

**Goal**: Replace all remaining `any[]` declarations across `directGlossaryEngine.ts`, `chapterTranslationService.ts`, and `translation/types.ts` with strongly-typed interfaces.

**Independent Test**: Verify via `npm run lint` (`tsc --noEmit`) that all variables and interfaces are strongly typed without `any[]`.

### Tests for User Story 2

- [X] T009 [P] [US2] Update unit tests in `src/services/__tests__/chapterTranslationService.test.ts` verifying that `detectedQaIssues` passes typed `DirectQaCritiqueIssue[]` to chapter records

### Implementation for User Story 2

- [X] T010 [US2] Replace `as any[]` internal type assertions in `src/services/directGlossaryEngine.ts` with `unknown[]` and strongly-typed filtering
- [X] T011 [US2] Update `let detectedQaIssues: any[] = []` in `src/services/chapterTranslationService.ts` to `DirectQaCritiqueIssue[]`
- [X] T012 [US2] Update `glossary?: any[]` in `DirectQaCritiqueParams` in `src/services/translation/types.ts` to `GlossaryItem[]`

**Checkpoint**: User Story 2 complete — 0 occurrences of `any[]` across glossary and translation services.

---

## Phase 5: User Story 3 - Specification & Data Model Alignment (Priority: P3)

**Goal**: Ensure `specs/159-glossary-strict-validation/data-model.md` and related contracts accurately describe `GlossarySuggestion extends Omit<GlossaryItem, 'id'>`.

**Independent Test**: Inspect design artifacts to ensure 100% synchronization with `src/lib/text.ts`.

### Implementation for User Story 3

- [X] T013 [US3] Verify and confirm alignment of `data-model.md`, `contracts/internal-contracts.md`, and `spec.md` in `specs/159-glossary-strict-validation/` with `GlossarySuggestion extends Omit<GlossaryItem, 'id'>`

**Checkpoint**: User Story 3 complete — design documents and production codebase are in 1:1 synchronization.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Quality gate verification across all updated services and test suites

- [X] T014 [P] Run full automated test suite via `npm test` verifying 100% pass rate
- [X] T015 Run TypeScript type-check via `npm run lint` verifying 0 type errors
- [X] T016 Run production bundle build via `npm run build` verifying clean compilation
- [X] T017 Validate all verification scenarios in `specs/159-glossary-strict-validation/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories.
- **User Story 1 (Phase 3 - P1 MVP)**: Depends on Phase 2 (`isGlossarySuggestionItem`, empty string guard).
- **User Story 2 (Phase 4 - P2)**: Depends on Phase 2 (`isGlossarySuggestionItem`) and can run after or in parallel with US1.
- **User Story 3 (Phase 5 - P3)**: Independent documentation check.
- **Polish (Phase 6)**: Depends on completion of all user stories.

### User Story Dependencies

- **US1 (P1)**: Core item validation; independent of US2/US3.
- **US2 (P2)**: Type hardening; relies on US1 for typed glossary pipeline.
- **US3 (P3)**: Documentation alignment; independent of code changes.

### Parallel Opportunities

- Tests within User Story 1 (T004, T005, T006) can be written in parallel.
- User Story 2 tasks (T011, T012) can be implemented in parallel with User Story 1.

---

## Parallel Example: User Story 1 & User Story 2

```bash
# Developer A (Glossary Validation - US1):
Task: T004 Add unit tests for isGlossarySuggestionItem in src/lib/__tests__/text.test.ts
Task: T007 Wire isGlossarySuggestionItem into callGlossaryAnalysisDirect in src/services/directGlossaryEngine.ts

# Developer B (Type Hardening - US2):
Task: T011 Update detectedQaIssues in src/services/chapterTranslationService.ts
Task: T012 Update glossary in DirectQaCritiqueParams in src/services/translation/types.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (P1: Item-level glossary validation)
4. **STOP and VALIDATE**: Run `npx vitest run src/services/__tests__/directGlossaryEngine.test.ts`
5. MVP achieved: No more coercion of corrupt AI suggestions into `{ chinese: "" }` phantom cards.

### Incremental Delivery
1. Add User Story 2: Full type hardening and removal of `any[]`.
2. Add User Story 3: Design document synchronization.
3. Final Polish: Run `npm run lint`, `npm test`, `npm run build`.
