# Tasks: Polish Truncation Prevention and 1:1 Paragraph Structure Parity

**Feature Branch**: `125-polish-structure-parity-guard`
**Date**: 2026-09-13
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish test harness and initial baseline for paragraph structure and truncation validation.

- [x] T001 Review and establish baseline test harness for paragraph counting and truncation detection in `src/lib/__tests__/text.test.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core validation functions and error classification required by all user stories.

**⚠️ CRITICAL**: Must be completed before User Story implementation begins.

- [x] T002 [P] Implement `countParagraphs(text)` in `src/lib/text.ts`
- [x] T003 [P] Implement `validatePolishIntegrity(rawText, polishedText, minRawLength, minRatio)` throwing `POLISH_TRUNCATION_DETECTED` in `src/lib/text.ts`
- [x] T004 [P] Implement `validateParagraphParity(referenceText, targetText, maxDivergenceRatio, minParagraphs)` throwing `PARAGRAPH_STRUCTURE_DIVERGENCE` in `src/lib/text.ts`
- [x] T005 Update `isAdaptiveSplitRetryableError` in `src/services/directTranslationEngine.ts` to recognize `POLISH_TRUNCATION_DETECTED` and `PARAGRAPH_STRUCTURE_DIVERGENCE`

**Checkpoint**: Foundation ready - core validation functions and error classifier ready for story implementation.

---

## Phase 3: User Story 1 - Anti-Truncation & Completeness Guard for Polish Phase (Priority: P1) 🎯 MVP

**Goal**: Guarantee that polished translations are complete and never truncated or missing the latter half of a chapter compared to raw translations.

**Independent Test**: Provide a 1,500-word chapter with a valid raw translation. Simulate a Gemini response that only polishes the first 40% of the text. Verify that the system automatically detects `POLISH_TRUNCATION_DETECTED`, triggers Adaptive Split Retry, and produces a complete polished translation.

### Implementation for User Story 1

- [x] T006 [P] [US1] Add unit tests for `validatePolishIntegrity` detecting length and paragraph count drop in `src/lib/__tests__/text.test.ts`
- [x] T007 [US1] Implement Stage 2 pre-split logic in `polishWithContentSplitDirect` in `src/services/directTranslationEngine.ts` when token count $> 1800$
- [x] T008 [US1] Integrate `validatePolishIntegrity(rawTranslation, finalPolishedTranslation)` in `callPolishDirectCore` in `src/services/directTranslationEngine.ts`
- [x] T009 [US1] Add integration test for Stage 2 truncation detection and adaptive split recovery in `src/services/__tests__/directTranslationEngine.test.ts`

**Checkpoint**: User Story 1 complete - Polished translations are protected against output truncation and automatically recover via Divide & Conquer.

---

## Phase 4: User Story 2 - 1:1 Paragraph and Line Structure Parity (Priority: P1)

**Goal**: Preserve 100% of the author's original paragraph and line break structure, preventing AI from merging dialogue lines or collapsing multiple short paragraphs.

**Independent Test**: Translate and polish a chapter containing 20 distinct short paragraphs and dialogue lines. Verify that both resulting raw translation and polished translation contain exactly 20 distinct paragraphs separated by `\n\n`.

### Implementation for User Story 2

- [x] T010 [P] [US2] Add unit tests for `validateParagraphParity` verifying tolerance thresholds in `src/lib/__tests__/text.test.ts`
- [x] T011 [P] [US2] Harden Phase 1 raw prompt in `buildRawTranslationPayload` in `src/services/ai/prompts.ts` with strict 1:1 paragraph parity directive
- [x] T012 [P] [US2] Harden Phase 2 polish prompt in `buildPolishTranslationPayload` in `src/services/ai/prompts.ts` strictly prohibiting paragraph merging
- [x] T013 [US2] Integrate `validateParagraphParity(sourceText, finalPolishedTranslation)` into `callPolishDirectCore` in `src/services/directTranslationEngine.ts`
- [x] T014 [US2] Ensure stitched chunks in `polishWithContentSplitDirect` and `rawWithContentSplitDirect` preserve clean `\n\n` boundaries in `src/services/directTranslationEngine.ts`

**Checkpoint**: User Story 2 complete - Paragraph counts and line structure between source, raw, and polished translations match 1:1.

---

## Phase 5: User Story 3 - Visual Structure & Metrics Transparency in Workspace (Priority: P2)

**Goal**: Provide translators with immediate visual visibility into paragraph counts and character length across Source, Raw, and Polish tabs in the editor.

**Independent Test**: Open a chapter in the workspace editor, toggle between "Bản gốc", "Dịch thô", và "Dịch biên tập", and confirm paragraph count and character count badges are displayed with divergence indicators when appropriate.

### Implementation for User Story 3

- [x] T015 [P] [US3] Create `ParagraphMetricsBadge` component in `src/components/workspace/ParagraphMetricsBadge.tsx` displaying paragraph and character metrics
- [x] T016 [US3] Integrate paragraph and character metrics badge into the draft preview header in `src/components/auto-translator/HistoryChapterDetailModal.tsx` and workspace editor
- [x] T017 [US3] Add divergence warning badge with tooltip when polished paragraph count diverges by $> 15\%$ from source/raw

**Checkpoint**: User Story 3 complete - Translators have complete visual transparency of structural fidelity in the UI.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verification against project constitution quality gates and build validation.

- [x] T018 Run type check with `npm run lint` (`tsc --noEmit`) and fix any type discrepancies
- [x] T019 Run full test suite with `npm test` (`vitest run`) and ensure 100% pass rate
- [x] T020 Run production build with `npm run build` (`tsc && vite build`) and verify bundle buildability

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1: Setup (T001)
     │
     ▼
Phase 2: Foundational (T002, T003, T004, T005) ── [CRITICAL GATE]
     │
     ├───────────────────────────────┐
     ▼                               ▼
Phase 3: User Story 1 (P1 MVP)  Phase 4: User Story 2 (P1)
(T006 ──► T007 ──► T008 ──► T009) (T010, T011, T012 ──► T013 ──► T014)
     │                               │
     └───────────────┬───────────────┘
                     ▼
        Phase 5: User Story 3 (P2)
        (T015 ──► T016 ──► T017)
                     │
                     ▼
        Phase 6: Polish & Gates
        (T018 ──► T019 ──► T020)
```

### Parallel Opportunities

- **Phase 2**: T002, T003, T004 can run in parallel (different functions in `src/lib/text.ts`).
- **Phase 3 & Phase 4**: T006, T010, T011, T012 can run in parallel across tests and prompt templates.
- **Phase 5**: T015 can be developed in parallel with service integrations.

---

## Implementation Strategy (MVP First)

1. **MVP Scope (Phase 1 to Phase 3)**:
   - Complete Setup, Foundational, and User Story 1.
   - At this point, no chapter will ever be truncated during the Polish phase again.
2. **Increment 2 (Phase 4)**:
   - Add 1:1 paragraph parity enforcement and prompt hardening to eliminate paragraph collapsing.
3. **Increment 3 (Phase 5)**:
   - Add visual metrics badge to the workspace UI for translator feedback.
4. **Final Gate (Phase 6)**:
   - Verify lint, all test suites, and production build.
