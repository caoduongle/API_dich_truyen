# Tasks: QA Critique Target Text Locating Field

**Feature Branch**: `099-qa-critique-target-text`  
**Input**: Design artifacts from `specs/099-qa-critique-target-text/` (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`)

---

## Phase 1: Setup & Environment Validation

**Purpose**: Verify clean baseline environment and test execution readiness

- [X] T001 Verify clean working tree and baseline test suite status via npm test in repository root

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish core TypeScript interface contracts before schema and consumer updates

- [X] T002 Define DirectQaCritiqueIssue interface and update DirectQaCritiqueResult in src/services/directTranslationEngine.ts

---

## Phase 3: User Story 1 - Verbatim Snippet Extraction for QA Issues (Priority: P1) 🎯 MVP

**Goal**: Update `buildQaCritiquePayload` schema to mandate `targetText: string` and instruct Gemini to quote verbatim Vietnamese text (or `""` for omissions).

**Independent Test**: Run `npx vitest run shared/__tests__/sharedTranslationLogic.test.ts` to confirm `targetText` is present in `schema.properties.issues.items.properties`, included in `required`, and documented in `systemInstruction`.

### Tests for User Story 1

- [X] T003 [P] [US1] Update QA critique payload test in shared/__tests__/sharedTranslationLogic.test.ts to verify targetText in schema and systemInstruction

### Implementation for User Story 1

- [X] T004 [US1] Add targetText field and verbatim excerpting instructions to buildQaCritiquePayload in shared/prompts.ts

**Checkpoint**: User Story 1 is functional; prompt payload generates correct Gemini schema with verbatim instruction.

---

## Phase 4: User Story 2 - End-to-End Type Safety for QA Critique Issues (Priority: P1)

**Goal**: Replace loose `any[]` typing with `DirectQaCritiqueIssue[]` across all consumer components and state hooks.

**Independent Test**: Run `npm run lint` (`tsc --noEmit`) to verify clean type checking across all workspace files with zero diagnostic errors.

### Implementation for User Story 2

- [X] T005 [P] [US2] Update QaCritiquePanelProps to use DirectQaCritiqueIssue[] in src/components/translator-workspace/QaCritiquePanel.tsx
- [X] T006 [P] [US2] Update BilingualEditorProps to use DirectQaCritiqueIssue[] in src/components/translator-workspace/BilingualEditor.tsx
- [X] T007 [P] [US2] Update qaIssues state typing to DirectQaCritiqueIssue[] in src/components/translator-workspace/useWorkspaceState.ts
- [X] T008 [P] [US2] Update QA issues iteration typing to DirectQaCritiqueIssue in src/services/chapterTranslationService.ts

**Checkpoint**: End-to-end type safety established; `any[]` eliminated from QA critique data flow.

---

## Phase 5: User Story 3 - Graceful Handling of Omission Errors with Empty Snippets (Priority: P2)

**Goal**: Verify and enforce that omission errors accept `targetText: ""` seamlessly in unit tests and engine parsing.

**Independent Test**: Run `npx vitest run src/services/__tests__/directTranslationEngine.test.ts` to verify mocked omission issue with `targetText: ""` parses and asserts cleanly.

### Implementation for User Story 3

- [X] T009 [US3] Update QA critique engine test with omission mock containing targetText in src/services/__tests__/directTranslationEngine.test.ts

**Checkpoint**: Omission error cases and engine parsing tests are fully verified.

---

## Phase 6: Polish & Verification Quality Gates

**Purpose**: Execute strict multi-gate validation mandated by Constitution Principle I.

- [X] T010 Run TypeScript type-check via npm run lint to ensure zero type diagnostics
- [X] T011 Run unit test suite via npm test to ensure all tests pass
- [X] T012 Run production build via npm run build to ensure clean bundle

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on T001 baseline check; blocks all user stories by providing `DirectQaCritiqueIssue`.
- **User Story 1 (Phase 3)**: Depends on Phase 2; can proceed independently.
- **User Story 2 (Phase 4)**: Depends on Phase 2 (`DirectQaCritiqueIssue` exported); can proceed in parallel with or after US1.
- **User Story 3 (Phase 5)**: Depends on Phase 2 and US1; verifies omission test handling.
- **Polish (Phase 6)**: Depends on completion of all stories.

### Parallel Opportunities

- `T003` (US1 test update) can be developed in parallel with `T002`.
- `T005`, `T006`, `T007`, `T008` (US2 type updates across different files) are completely parallelizable as they touch disjoint files.
- `T010`, `T011`, `T012` run sequentially as progressive quality gates.

---

## Parallel Example: User Story 2

```bash
# Launch type updates in parallel across disjoint consumer files:
Task: "Update QaCritiquePanelProps to use DirectQaCritiqueIssue[] in src/components/translator-workspace/QaCritiquePanel.tsx"
Task: "Update BilingualEditorProps to use DirectQaCritiqueIssue[] in src/components/translator-workspace/BilingualEditor.tsx"
Task: "Update qaIssues state typing to DirectQaCritiqueIssue[] in src/components/translator-workspace/useWorkspaceState.ts"
Task: "Update QA issues iteration typing to DirectQaCritiqueIssue in src/services/chapterTranslationService.ts"
```

---

## Implementation Strategy

### MVP Scope (User Story 1)
1. Complete T001 (baseline check) and T002 (foundational type definition).
2. Complete T003 & T004 (User Story 1 schema and instruction).
3. Validate User Story 1 independently with `vitest run shared/__tests__/sharedTranslationLogic.test.ts`.

### Incremental Rollout
1. Add User Story 2 (T005-T008): Establish strict typing across all consumer components.
2. Add User Story 3 (T009): Validate omission test mock in `directTranslationEngine.test.ts`.
3. Execute Phase 6 (T010-T012): Lint, full test suite, production build.
