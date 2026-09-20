# Implementation Tasks: AI Pipeline Safety & Validation Hardening

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Branch**: `155-ai-pipeline-safety-hardening`

## Phase 1: Setup & Baseline Verification

**Purpose**: Verify existing environment and baseline test pass status before applying changes.

- [X] T001 Verify baseline repository health before changes via `npm run lint` and `npm test`

---

## Phase 2: Foundational (Type Guard Validators)

**Purpose**: Core type guard validators in `src/lib/text.ts` required by downstream translation services.

- [X] T002 [P] Implement response type guard validators (`isRawTranslationResponse`, `isPolishTranslationResponse`, `isQaCritiqueResponse`, `isSentenceRewriteResponse`) in `src/lib/text.ts`

---

## Phase 3: User Story 1 - UI Privacy Transparency & Prompt Input Sanitization (Priority: P1) 🎯 MVP

**Goal**: Remove misleading "100% riêng tư" copy from key management UI and sanitize inputs entering `sentenceRewrite.ts` to block prompt injection and invisible formatting.

**Independent Test**:
- Inspect `src/components/api-settings/KeyListSection.tsx` to verify accurate copy.
- Run `vitest run src/services/translation/__tests__/sentenceRewrite.test.ts` to verify prompt input sanitization.

### Implementation for User Story 1

- [X] T003 [P] [US1] Remove misleading '100% riêng tư' claim in `src/components/api-settings/KeyListSection.tsx`
- [X] T004 [P] [US1] Sanitize targetText, context, and issueMessage inputs in `src/services/translation/sentenceRewrite.ts`
- [X] T005 [P] [US1] Add unit tests for sentence rewrite input sanitization in `src/services/translation/__tests__/sentenceRewrite.test.ts`

**Checkpoint**: User Story 1 is fully functional and independently testable. UI disclosures are accurate and sentence rewrite inputs are sanitized.

---

## Phase 4: User Story 2 - Resilient Structured Output Validation Across Translation Services (Priority: P1)

**Goal**: Standardize structured parsing with schema validation across `sentenceRewrite.ts`, `rawTranslation.ts`, `polishTranslation.ts`, and `qaCritique.ts` via `parseGeminiStructuredResponse`.

**Independent Test**:
- Run `vitest run src/lib/__tests__/text.test.ts` and `vitest run src/services/translation/__tests__/` to verify type guards and resilient fallback handling on malformed JSON.

### Implementation for User Story 2

- [X] T006 [US2] Update sentenceRewrite.ts to use `parseGeminiStructuredResponse` with `isSentenceRewriteResponse` in `src/services/translation/sentenceRewrite.ts`
- [X] T007 [P] [US2] Update rawTranslation.ts to use `parseGeminiStructuredResponse` with `isRawTranslationResponse` in `src/services/translation/rawTranslation.ts`
- [X] T008 [P] [US2] Update polishTranslation.ts to use `parseGeminiStructuredResponse` with `isPolishTranslationResponse` in `src/services/translation/polishTranslation.ts`
- [X] T009 [P] [US2] Update qaCritique.ts to use `parseGeminiStructuredResponse` with `isQaCritiqueResponse` in `src/services/translation/qaCritique.ts`
- [X] T010 [P] [US2] Add unit tests for translation structured output validators in `src/lib/__tests__/text.test.ts`
- [X] T011 [P] [US2] Add unit tests verifying malformed structured payload resilience in `src/services/translation/__tests__/sentenceRewrite.test.ts`

**Checkpoint**: User Stories 1 AND 2 are complete. All AI structured outputs are safely validated against type predicates before domain consumption.

---

## Phase 5: User Story 3 - General Transport Timeout & Connection Liveness Safeguards (Priority: P2)

**Goal**: Add a 60-second default timeout to `executeGeminiFetch` in `geminiTransport.ts`, chained to caller abort signals, preventing zombie connections.

**Independent Test**:
- Run `vitest run src/services/gemini/__tests__/geminiTransport.test.ts` to verify timeout abortion and cancellation cleanup.

### Implementation for User Story 3

- [X] T012 [P] [US3] Add 60-second default timeout with signal chaining to `executeGeminiFetch` in `src/services/gemini/geminiTransport.ts`
- [X] T013 [P] [US3] Add unit tests for `executeGeminiFetch` timeout and cancellation in `src/services/gemini/__tests__/geminiTransport.test.ts`

**Checkpoint**: All network requests dispatched through `geminiTransport` are guaranteed to terminate within 60s.

---

## Phase 6: User Story 4 - Model Subsystem Documentation & Pipeline Maintenance (Priority: P2)

**Goal**: Synchronize `docs/model-system.md` with active header authentication and Gemma quota limits.

**Independent Test**:
- Inspect `docs/model-system.md` to confirm alignment with `src/config/models.ts` and `src/services/directGeminiClient.ts`.

### Implementation for User Story 4

- [X] T014 [P] [US4] Update header authentication and Gemma quota metadata in `docs/model-system.md`

---

## Phase 7: Polish & Cross-Cutting Verification

**Purpose**: End-to-end verification, regression checks, and quality gate assurance.

- [X] T015 Run quickstart validation test scenarios per `specs/155-ai-pipeline-safety-hardening/quickstart.md`
- [X] T016 Run full automated quality gate (`npm run lint`, `npm test`, `npm run build`) to confirm zero regressions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — executes first.
- **Foundational (Phase 2)**: Type guards in `src/lib/text.ts` — blocks User Story 2.
- **User Story 1 (Phase 3)**: Independent UI copy update and prompt sanitization in `sentenceRewrite.ts`.
- **User Story 2 (Phase 4)**: Depends on Foundational completion.
- **User Story 3 (Phase 5)**: Independent transport timeout update.
- **User Story 4 (Phase 6)**: Independent documentation update.
- **Polish (Phase 7)**: Depends on all user story implementations being completed.

### Parallel Opportunities

```bash
# Parallel Foundations & US1:
Task T002: Implement response type guards in src/lib/text.ts
Task T003: Update copy in src/components/api-settings/KeyListSection.tsx
Task T004: Sanitize inputs in src/services/translation/sentenceRewrite.ts

# Parallel Translation Services Update (US2):
Task T007: Update rawTranslation.ts
Task T008: Update polishTranslation.ts
Task T009: Update qaCritique.ts

# Parallel Transport & Docs:
Task T012: Timeout in src/services/gemini/geminiTransport.ts
Task T014: Update docs/model-system.md
```

---

## Implementation Strategy

### MVP First (User Story 1 Focus)
1. Complete T001 (Baseline check).
2. Complete T003 (UI privacy copy) and T004–T005 (sentence rewrite input sanitization).
3. Validate User Story 1 independently.

### Incremental Delivery
1. Add User Story 2 (T002, T006–T011) to guarantee structured output validation across all translation stages.
2. Add User Story 3 (T012–T013) for transport timeout liveness.
3. Add User Story 4 (T014) for doc synchronization.
4. Execute Polish (T015–T016) to verify the full suite passes cleanly.
