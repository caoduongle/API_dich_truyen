# Tasks: AI Pipeline Strict Validation and Structural Integrity

**Feature Branch**: `157-ai-pipeline-strict-validation` | **Date**: 2026-09-22 | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify working branch and baseline quality gate status

- [X] T001 Verify baseline type safety and test suite status via `npm run lint` and `npm test` in the repository root

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core schema interfaces, validation guards, and helper predicates in `src/lib/text.ts` required by all user stories

**⚠️ CRITICAL**: Foundational tasks must complete before user story implementation begins

- [X] T002 Update `QaCritiqueResponse` interface in `src/lib/text.ts` to strictly require `isValid: boolean` and `issues: unknown[]`
- [X] T003 [P] Implement `isQaCritiqueIssue` item-level predicate in `src/lib/text.ts` validating non-empty description, string targetText, and category/severity enums
- [X] T004 [P] Implement secondary schema validators (`isQuickTermResponse`, `isGlossarySuggestionsResponse`, `isGuidelinesAnalysisResponse`, `isAlignChapterResponse`, `isHakoQualityScanResponse`) in `src/lib/text.ts`
- [X] T005 Add unit tests for foundational schema validators and predicates in `src/lib/__tests__/text.test.ts`

**Checkpoint**: Foundational interfaces and validator functions verified and passing unit tests.

---

## Phase 3: User Story 1 - Strict QA Critique Response Validation & Empty Payload Rejection (Priority: P1) 🎯 MVP

**Goal**: Prevent empty `{}` or incomplete QA responses from being accepted as valid critiques with 0 issues.

**Independent Test**: Call `isQaCritiqueResponse` with `{}` and verify it returns `false`; call `qaCritiqueDirect` with mocked empty response and verify fallback or error handling activates without assuming uninspected pass.

### Tests for User Story 1

- [X] T006 [P] [US1] Update `src/lib/__tests__/text.test.ts` to assert that `{}` and missing-field objects fail `isQaCritiqueResponse`
- [X] T007 [P] [US1] Add unit tests in `src/services/translation/__tests__/qaCritique.test.ts` verifying that `{}` response triggers schema-invalid handling instead of a clean pass

### Implementation for User Story 1

- [X] T008 [US1] Tighten `isQaCritiqueResponse` in `src/lib/text.ts` to return `false` if `isValid` is not boolean or `issues` is not an array
- [X] T009 [US1] Ensure `qaCritiqueDirect` in `src/services/translation/qaCritique.ts` properly routes schema validation failures to safe fallback `{ isValid: true, issues: [] }` with warning

**Checkpoint**: User Story 1 complete — `{}` is rejected by `isQaCritiqueResponse`, eliminating silent approval of broken QA responses.

---

## Phase 4: User Story 2 - Item-Level QA Issue Filtering & False Alarm Elimination (Priority: P2)

**Goal**: Filter out corrupt or nonsensical issue items from QA critique rather than coercing them into empty warning cards.

**Independent Test**: Supply QA critique responses containing mixed issue items (`123`, `{}`, `{ severity: false }`, and valid items) to `qaCritiqueDirect`; verify that only valid issues appear in the result and no blank warning cards are produced.

### Tests for User Story 2

- [X] T010 [P] [US2] Add unit tests for `isQaCritiqueIssue` in `src/lib/__tests__/text.test.ts` verifying valid issue preservation and malformed item rejection
- [X] T011 [P] [US2] Add tests in `src/services/translation/__tests__/qaCritique.test.ts` verifying that invalid issue items are filtered out of `DirectQaCritiqueResult.issues`

### Implementation for User Story 2

- [X] T012 [US2] Refactor `safeIssues` processing in `src/services/translation/qaCritique.ts` using `.filter(isQaCritiqueIssue).map(...)` to drop invalid items

**Checkpoint**: User Story 2 complete — malformed issue items are filtered out at runtime, eliminating phantom warning cards in the editing workspace.

---

## Phase 5: User Story 3 - Discovered Entity Type Enforcement (Option A) (Priority: P2)

**Goal**: Enforce strict string type constraints on discovered entities, rejecting entities with non-string attributes while permitting omitted optional fields.

**Independent Test**: Call `validateDiscoveredEntity` with payloads having non-string properties (`pinyin: 123`, `vietnamese: null`, `note: {}`); verify each returns `null`, while entities with omitted fields default to empty strings.

### Tests for User Story 3

- [X] T013 [P] [US3] Add unit tests in `src/lib/__tests__/text.test.ts` asserting that entities with non-string fields (`pinyin: 123`, `vietnamese: null`, `note: {}`) return `null`

### Implementation for User Story 3

- [X] T014 [US3] Update `validateDiscoveredEntity` in `src/lib/text.ts` to enforce Option A strict type validation and rejection of non-string values
- [X] T015 [P] [US3] Verify discovered entity integration in `src/services/translation/rawTranslation.ts` and `src/services/translation/polishTranslation.ts`

**Checkpoint**: User Story 3 complete — corrupt non-string entity attributes are strictly rejected, preventing dictionary pollution.

---

## Phase 6: User Story 4 - Hard Cumulative Deadline Ceiling Without Trailing Overshoot (Priority: P2)

**Goal**: Enforce an uncompromising cumulative deadline cap across key rotations by removing the 1000ms attempt floor and immediately aborting when remaining time is depleted.

**Independent Test**: Execute multi-key translation where remaining budget is under 500ms; verify the attempt timeout matches remaining budget exactly and aborts immediately when `remainingMs <= 50`.

### Tests for User Story 4

- [X] T016 [P] [US4] Add unit tests in `src/services/gemini/__tests__/geminiClient.test.ts` verifying exact attempt timeout when remaining budget is sub-second and immediate abort when budget <= 50ms

### Implementation for User Story 4

- [X] T017 [US4] Remove `Math.max(1000, ...)` floor in `src/services/gemini/geminiClient.ts` and enforce immediate `TimeoutError` when `remainingMs <= 50`

**Checkpoint**: User Story 4 complete — multi-key requests strictly terminate within the configured cumulative deadline ceiling.

---

## Phase 7: User Story 5 - Unified Structured Output Validation Across Secondary Services (Option A) (Priority: P2)

**Goal**: Eliminate technical debt by adding runtime schema validation to Quick Term lookup, Glossary Extraction/Analysis, and Hako Quality Engine.

**Independent Test**: Send malformed JSON payloads to `generateQuickTermDetailsDirect`, `extractGlossaryDirect`, and `runAiQualityScan`; verify each service handles structural mismatches via validated fallbacks without uncaught exceptions.

### Tests for User Story 5

- [X] T018 [P] [US5] Add unit tests for Quick Term schema validation in `src/services/__tests__/directGeminiClient.test.ts`
- [X] T019 [P] [US5] Add unit tests for glossary extraction and analysis schema validation in `src/services/__tests__/directGlossaryEngine.test.ts`
- [X] T020 [P] [US5] Add unit tests for Hako quality scan schema validation and issue filtering in `src/services/__tests__/hakoQualityEngine.test.ts`

### Implementation for User Story 5

- [X] T021 [P] [US5] Wire `isQuickTermResponse` validator into `generateQuickTermDetailsDirect` in `src/services/directGeminiClient.ts`
- [X] T022 [P] [US5] Wire structured validators (`isGlossarySuggestionsResponse`, `isGuidelinesAnalysisResponse`, `isAlignChapterResponse`) into `src/services/directGlossaryEngine.ts`
- [X] T023 [P] [US5] Wire `isHakoQualityScanResponse` validator and issue filtering into `runAiQualityScan` in `src/services/hakoQualityEngine.ts`

**Checkpoint**: User Story 5 complete — 100% of structured AI outputs across the repository validate schemas at runtime.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Quality gate verification across all updated services and test suites

- [X] T024 [P] Run full automated test suite via `npm test` verifying 100% pass rate
- [X] T025 Run TypeScript type-check via `npm run lint` verifying 0 type errors
- [X] T026 Run production bundle build via `npm run build` verifying clean compilation
- [X] T027 Validate all verification scenarios in `specs/157-ai-pipeline-strict-validation/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories.
- **User Story 1 (Phase 3 - P1 MVP)**: Depends on Phase 2 — can be verified independently.
- **User Story 2 (Phase 4 - P2)**: Depends on Phase 2 and US1 validator.
- **User Story 3 (Phase 5 - P2)**: Depends on Phase 2 entity validator.
- **User Story 4 (Phase 6 - P2)**: Depends on Phase 2; independent of translation schemas.
- **User Story 5 (Phase 7 - P2)**: Depends on Phase 2 schema guards.
- **Polish (Phase 8)**: Depends on completion of all user stories.

### User Story Dependencies

- **US1 (P1)**: Independent of other stories.
- **US2 (P2)**: Extends US1 QA critique pipeline by filtering parsed issues.
- **US3 (P2)**: Independent entity validation logic.
- **US4 (P2)**: Independent transport client deadline logic.
- **US5 (P2)**: Independent secondary service parsing logic.

### Parallel Opportunities

- Within Phase 2: T003, T004 can be implemented in parallel in `src/lib/text.ts`.
- User Story tests (T006, T007, T010, T011, T013, T016, T018, T019, T020) can be created in parallel.
- US3, US4, and US5 can be developed in parallel once Foundational (Phase 2) is complete.

---

## Parallel Example: User Stories 3, 4, 5

```bash
# Developer A (Entity Validation - US3):
Task: T013 Add unit tests for Option A entity validation in src/lib/__tests__/text.test.ts
Task: T014 Update validateDiscoveredEntity in src/lib/text.ts

# Developer B (Cumulative Deadline - US4):
Task: T016 Add unit tests for cumulative deadline in src/services/gemini/__tests__/geminiClient.test.ts
Task: T017 Remove 1000ms floor in src/services/gemini/geminiClient.ts

# Developer C (Secondary Services - US5):
Task: T021 Wire isQuickTermResponse in src/services/directGeminiClient.ts
Task: T022 Wire structured validators in src/services/directGlossaryEngine.ts
Task: T023 Wire isHakoQualityScanResponse in src/services/hakoQualityEngine.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (P1: Reject `{}` in QA critique)
4. **STOP and VALIDATE**: Run `npx vitest run src/lib/__tests__/text.test.ts`
5. MVP achieved: No more silent passes on empty/broken QA responses.

### Incremental Delivery
1. Add User Story 2: Filter out malformed QA issue items.
2. Add User Story 3: Strict entity validation (Option A).
3. Add User Story 4: Hard cumulative deadline ceiling.
4. Add User Story 5: Unify secondary structured AI outputs across repo.
5. Final Polish: Run `npm run lint`, `npm test`, `npm run build`.
