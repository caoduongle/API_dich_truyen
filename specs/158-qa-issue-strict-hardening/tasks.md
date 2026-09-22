# Tasks: Strict QA Issue Validation and Secondary Pipeline Hardening

**Feature Branch**: `158-qa-issue-strict-hardening` | **Date**: 2026-09-22 | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify repository baseline and working state

- [X] T001 Verify baseline type safety and test suite status via `npm run lint` and `npm test` in the project root

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core schema interfaces, validation guards, and helper predicates in `src/lib/text.ts` required by all user stories

**⚠️ CRITICAL**: Foundational tasks must complete before user story implementation begins

- [X] T002 Define `GlossarySuggestion` interface in `src/lib/text.ts`
- [X] T003 Define `HakoQualityScanRawIssue` interface in `src/lib/text.ts`
- [X] T004 [P] Implement `isHakoQualityScanIssue` item-level predicate in `src/lib/text.ts`
- [X] T005 [P] Update `QaCritiqueIssue` interface declaration in `src/lib/text.ts` to require non-optional `type`, `severity`, and `targetText`

**Checkpoint**: Foundational interfaces and validator functions verified in `src/lib/text.ts`.

---

## Phase 3: User Story 1 - Strict QA Critique Issue Required Fields Validation (Priority: P1) 🎯 MVP

**Goal**: Require all 4 primary fields (`type`, `severity`, `targetText`, `description`/`message`) in `isQaCritiqueIssue` and drop incomplete issues from critique responses.

**Independent Test**: Supply AI responses containing issues missing `type`, missing `severity`, missing `targetText`, or with non-string fields; verify `isQaCritiqueIssue` returns `false` and `qaCritiqueDirect` excludes them.

### Tests for User Story 1

- [X] T006 [P] [US1] Add unit tests in `src/lib/__tests__/text.test.ts` asserting that issues missing `type`, `severity`, `targetText`, or with empty description return `false` in `isQaCritiqueIssue`
- [X] T007 [P] [US1] Add unit tests in `src/services/translation/__tests__/qaCritique.test.ts` verifying that `qaCritiqueDirect` drops incomplete issue items from the AI response

### Implementation for User Story 1

- [X] T008 [US1] Tighten `isQaCritiqueIssue` in `src/lib/text.ts` to enforce mandatory presence and validity for `type`, `severity`, `targetText`, and `description`/`message`
- [X] T009 [US1] Refactor `safeIssues` processing in `src/services/translation/qaCritique.ts` to map strictly validated fields from `isQaCritiqueIssue` without fallback coercion

**Checkpoint**: User Story 1 complete — incomplete AI issue objects are rejected and filtered out, eliminating phantom warning cards.

---

## Phase 4: User Story 2 - Item-Level Validation for Hako Quality Scan Issues (Priority: P2)

**Goal**: Validate individual issue items within `HakoQualityScanResponse.issues` at runtime using `isHakoQualityScanIssue`, eliminating unsafe type assertions.

**Independent Test**: Pass AI scan responses containing malformed items (`category: 123`, `explanation: true`, or missing required fields) to Hako scanner; verify invalid items are filtered out and only valid issues are mapped.

### Tests for User Story 2

- [X] T010 [P] [US2] Add unit tests in `src/lib/__tests__/text.test.ts` verifying `isHakoQualityScanIssue` validates required explanation, category, severity, and string snippets
- [X] T011 [P] [US2] Add unit tests in `src/services/__tests__/hakoQualityEngine.test.ts` verifying that malformed scan items are discarded during AI quality scan

### Implementation for User Story 2

- [X] T012 [US2] Wire `isHakoQualityScanIssue` into `runAiQualityScan` in `src/services/hakoQualityEngine.ts` to filter raw issue items before constructing `QualityIssue` entities

**Checkpoint**: User Story 2 complete — 100% of Hako quality scan issues are validated at item level.

---

## Phase 5: User Story 3 - Strongly-Typed Glossary Pipeline and Elimination of `any[]` (Priority: P2)

**Goal**: Replace `any[]` in `directGlossaryEngine.ts` with `GlossarySuggestion[]`, ensuring compile-time and runtime type integrity.

**Independent Test**: Verify TypeScript compilation via `npm run lint` (`tsc --noEmit`) and verify that glossary analysis returns typed `GlossarySuggestion[]`.

### Tests for User Story 3

- [X] T013 [P] [US3] Add unit tests in `src/services/__tests__/directGlossaryEngine.test.ts` verifying strongly-typed glossary analysis and extraction results

### Implementation for User Story 3

- [X] T014 [US3] Replace `any[]` in `AnalyzeGlossaryDirectResult`, `ExtractGlossaryDirectResult`, and internal helper signatures in `src/services/directGlossaryEngine.ts` with `GlossarySuggestion[]`
- [X] T015 [US3] Verify and adapt downstream consumers in `src/hooks/useGlossaryScan.ts` to ensure clean TypeScript compilation with typed suggestions

**Checkpoint**: User Story 3 complete — 0 occurrences of `any[]` across glossary service interfaces.

---

## Phase 6: User Story 4 - Comprehensive AI Prompt Sanitization for Metadata & Title Inputs (Priority: P2)

**Goal**: Sanitize `options.genre` in Quick Term lookup and `projectTitle` / `chapter.title` in Hako quality scan using `sanitizePromptInput`.

**Independent Test**: Call `quickTranslateTermDirect` and Hako quality scan with test strings containing potential prompt injection tokens; verify that `sanitizePromptInput` is executed on all interpolated metadata.

### Tests for User Story 4

- [X] T016 [P] [US4] Add unit tests in `src/services/__tests__/directTranslationEngine.test.ts` verifying that `options.genre` passed to `quickTranslateTermDirect` is sanitized
- [X] T017 [P] [US4] Add unit tests in `src/services/__tests__/hakoQualityEngine.test.ts` verifying that `projectTitle` and `chapter.title` passed to AI quality scan are sanitized

### Implementation for User Story 4

- [X] T018 [US4] Pass `options.genre` through `sanitizePromptInput` before prompt interpolation in `src/services/directGeminiClient.ts`
- [X] T019 [US4] Pass `projectTitle` and `chapter.title` through `sanitizePromptInput` before prompt interpolation in `src/services/hakoQualityEngine.ts`

**Checkpoint**: User Story 4 complete — 100% of user metadata interpolated into AI prompts is sanitized.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Quality gate verification across all updated services and test suites

- [X] T020 [P] Run full automated test suite via `npm test` verifying 100% pass rate
- [X] T021 Run TypeScript type-check via `npm run lint` verifying 0 type errors
- [X] T022 Run production bundle build via `npm run build` verifying clean compilation
- [X] T023 Validate all verification scenarios in `specs/158-qa-issue-strict-hardening/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories.
- **User Story 1 (Phase 3 - P1 MVP)**: Depends on Phase 2 — can be verified independently.
- **User Story 2 (Phase 4 - P2)**: Depends on Phase 2 (`isHakoQualityScanIssue`).
- **User Story 3 (Phase 5 - P2)**: Depends on Phase 2 (`GlossarySuggestion`).
- **User Story 4 (Phase 6 - P2)**: Depends on Phase 2; independent of QA/Hako validators.
- **Polish (Phase 7)**: Depends on completion of all user stories.

### User Story Dependencies

- **US1 (P1)**: Independent of other stories.
- **US2 (P2)**: Independent of US1; depends on foundational Hako types.
- **US3 (P2)**: Independent of US1/US2; depends on foundational glossary types.
- **US4 (P2)**: Independent transport/prompt sanitization tasks.

### Parallel Opportunities

- Within Phase 2: T004, T005 can be implemented in parallel in `src/lib/text.ts`.
- Tests for User Stories (T006, T007, T010, T011, T013, T016, T017) can be created in parallel.
- User Stories 2, 3, 4 can be implemented in parallel once Foundational (Phase 2) is complete.

---

## Parallel Example: User Stories 1, 2, 4

```bash
# Developer A (QA Issue Validation - US1):
Task: T006 Add unit tests for strict isQaCritiqueIssue in src/lib/__tests__/text.test.ts
Task: T008 Tighten isQaCritiqueIssue in src/lib/text.ts

# Developer B (Hako Item Validation - US2):
Task: T010 Add unit tests for isHakoQualityScanIssue in src/lib/__tests__/text.test.ts
Task: T012 Wire isHakoQualityScanIssue in src/services/hakoQualityEngine.ts

# Developer C (Prompt Sanitization - US4):
Task: T018 Sanitize options.genre in src/services/directGeminiClient.ts
Task: T019 Sanitize projectTitle and chapter.title in src/services/hakoQualityEngine.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (P1: Strict QA Issue Validation)
4. **STOP and VALIDATE**: Run `npx vitest run src/services/translation/__tests__/qaCritique.test.ts`
5. MVP achieved: No more coercion of incomplete QA issues into default warning cards.

### Incremental Delivery
1. Add User Story 2: Hako item-level issue validation.
2. Add User Story 3: Strongly-typed glossary pipeline.
3. Add User Story 4: Metadata prompt sanitization.
4. Final Polish: Run `npm run lint`, `npm test`, `npm run build`.
