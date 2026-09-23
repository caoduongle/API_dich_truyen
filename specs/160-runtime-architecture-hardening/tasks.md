# Implementation Tasks: Runtime Architecture & Security Hardening

**Feature**: [Runtime Architecture & Security Hardening](spec.md)
**Branch**: `160-runtime-architecture-hardening`
**Date**: 2026-09-23

### Phase 1: Setup (Shared Types & Contracts)

**Purpose**: Establish typed data models, error definitions, and interface contracts.

- [X] T001 Define runtime hardening contracts and types in `src/types/runtimeHardening.ts`
- [X] T002 [P] Update Gemini error categories and types to support `CONTENT_BLOCKED` and `GeminiRequestError` in `src/services/gemini/types.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core error taxonomy and concurrency primitives required by user stories.

**⚠️ CRITICAL**: Must complete before user story implementation begins.

- [X] T003 [P] Implement `GeminiRequestError` class and enhance `CONTENT_BLOCKED` detection in `src/services/gemini/geminiErrorClassifier.ts`
- [X] T004 [P] Verify `mapWithConcurrencyLimit` utility in `src/lib/concurrency.ts` for order preservation and error propagation

**Checkpoint**: Foundation ready — user story implementation can proceed independently.

---

## Phase 3: User Story 1 - Uniform Deployment Security Protections (Priority: P1) 🎯 MVP

**Goal**: Ensure containerized Nginx deployments enforce the exact same 8 security headers as Vercel, Render, and static hosting profiles.

**Independent Test**: `npm test -- src/tests/cspParity.test.ts` passes with 5 configuration targets validated.

### Tests for User Story 1
- [X] T005 [P] [US1] Upgrade multi-platform security headers test to Penta-Parity including Nginx in `src/tests/cspParity.test.ts`

### Implementation for User Story 1
- [X] T006 [US1] Add all 8 canonical HTTP security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `COOP`, `CORP`, `Permissions-Policy`, `HSTS`, `CSP`) into `nginx/default.conf.template`

**Checkpoint**: User Story 1 fully functional and testable independently via `cspParity.test.ts`.

---

## Phase 4: User Story 2 - Quota Usage Continuity Across Tab Reloads (Priority: P1)

**Goal**: Preserve 60-second rolling window attempt timestamps and token volume buckets across browser tab reloads.

**Independent Test**: `npm test -- src/services/__tests__/localQuotaTracker.test.ts` passes with sliding window preservation across reload.

### Tests for User Story 2
- [X] T007 [P] [US2] Add unit tests for 60-second sliding window persistence and pruning in `src/services/__tests__/localQuotaTracker.test.ts`

### Implementation for User Story 2
- [X] T008 [US2] Update `saveToStorage()` and `loadFromStorage()` in `src/services/localQuotaTracker.ts` to serialize, restore, and prune `recentAttempts` and `recentTokens`

**Checkpoint**: User Story 2 independently verified; quota counters survive simulated page reloads.

---

## Phase 5: User Story 3 - Preserving Translation Keys on Content Moderation Blocks (Priority: P1)

**Goal**: Halt retries immediately and notify user when AI safety filters trigger, without rotating through remaining API keys.

**Independent Test**: `npm test -- src/services/gemini/__tests__/geminiClient.test.ts` passes with 0 retries on content blocks.

### Tests for User Story 3
- [X] T009 [P] [US3] Add unit test scenarios for prompt safety/content rejection and key rotation prevention in `src/services/gemini/__tests__/geminiClient.test.ts`

### Implementation for User Story 3
- [X] T010 [US3] Update `executeLogicalGeminiCall` in `src/services/gemini/geminiClient.ts` to throw `GeminiRequestError` on `CONTENT_BLOCKED` without rotating keys

**Checkpoint**: User Story 3 verified; blocked prompts halt immediately without burning alternative keys.

---

## Phase 6: User Story 4 - Fresh and Reliable Quality Assurance (QA) Critique State (Priority: P1)

**Goal**: Clear outdated QA issues on chapters when a subsequent QA critique run passes cleanly with 0 issues.

**Independent Test**: `npm test -- src/services/__tests__/chapterTranslationService.test.ts` passes with stale issue cleanup.

### Tests for User Story 4
- [X] T011 [P] [US4] Add test cases in `src/services/__tests__/chapterTranslationService.test.ts` verifying stale QA issue erasure on clean pass
### Implementation for User Story 4
- [X] T012 [US4] Update QA issue resolution logic in `src/services/chapterTranslationService.ts` to track `qaRunSucceeded` and clear stale issues on 0-issue passes

**Checkpoint**: User Story 4 verified; clean QA critique passes eliminate ghost warnings from previous runs.

---

## Phase 7: User Story 5 - Throttled Concurrency for Deep Glossary Term Extraction (Priority: P2)

**Goal**: Constrain recursive multi-part glossary splitting to bounded concurrency (max 2 parallel calls) to prevent 429 rate spikes.

**Independent Test**: `npm test -- src/services/__tests__/directGlossaryEngine.test.ts` passes with bounded concurrency.

### Tests for User Story 5
- [X] T013 [P] [US5] Add unit tests verifying bounded concurrency during glossary split in `src/services/__tests__/directGlossaryEngine.test.ts`

### Implementation for User Story 5
- [X] T014 [US5] Replace `Promise.all` with `mapWithConcurrencyLimit` (concurrency = 2) in `src/services/directGlossaryEngine.ts`

**Checkpoint**: User Story 5 verified; multi-fragment glossary splitting executes smoothly without key bursts.

---

## Phase 8: User Story 6 - Responsive Workspace During High-Frequency Translation (Priority: P2)

**Goal**: Eliminate synchronous storage serialization in the translation hot path using 300ms debouncing and lifecycle flush.

**Independent Test**: `npm test -- src/services/__tests__/localQuotaDebounce.test.ts` passes with debounced storage writes.

### Tests for User Story 6
- [X] T015 [P] [US6] Create unit tests for debounced persistence and `pagehide`/`visibilitychange` flush in `src/services/__tests__/localQuotaDebounce.test.ts`

### Implementation for User Story 6
- [X] T016 [US6] Implement `scheduleSave()`, `flushToStorage()`, and lifecycle event listeners in `src/services/localQuotaTracker.ts`

**Checkpoint**: User Story 6 verified; storage writes are debounced while preserving state on tab close.

---

## Phase 9: Polish & Cross-Cutting Verification

**Purpose**: Verify repository integrity, type safety, test suite pass, and buildability.

- [X] T017 [P] Verify full type-checking pass (`npm run lint`)
- [X] T018 Run complete test suite (`npm test`) ensuring all test files pass without regressions
- [X] T019 [P] Verify production build compilation (`npm run build`)
- [X] T020 Execute `quickstart.md` validation checklist and document in `specs/160-runtime-architecture-hardening/walkthrough.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories.
- **User Stories (Phase 3–8)**: Depend on Foundational phase completion.
  - Can proceed sequentially in priority order (P1 → P2).
  - Can proceed in parallel if multiple developers/threads are allocated.
- **Polish (Phase 9)**: Depends on completion of all desired user stories.

### User Story Dependencies
- **User Story 1 (P1)**: Independent of other stories. Modifies Nginx template and parity tests.
- **User Story 2 (P1)**: Independent of US1. Modifies `localQuotaTracker.ts`.
- **User Story 3 (P1)**: Depends on Foundational error taxonomy (T003). Modifies `geminiClient.ts`.
- **User Story 4 (P1)**: Independent of US1–US3. Modifies `chapterTranslationService.ts`.
- **User Story 5 (P2)**: Depends on Foundational concurrency utility (T004). Modifies `directGlossaryEngine.ts`.
- **User Story 6 (P2)**: Builds upon `localQuotaTracker.ts` enhancements from US2.

### Parallel Opportunities

```bash
# Foundational tasks in parallel:
Task: "T003 [P] Implement GeminiRequestError class in src/services/gemini/geminiErrorClassifier.ts"
Task: "T004 [P] Verify mapWithConcurrencyLimit utility in src/lib/concurrency.ts"

# Tests across independent user stories in parallel:
Task: "T005 [P] [US1] Upgrade multi-platform security headers test in src/tests/cspParity.test.ts"
Task: "T007 [P] [US2] Add unit tests for 60-second sliding window persistence in src/services/__tests__/localQuotaTracker.test.ts"
Task: "T009 [P] [US3] Add unit test scenarios in src/services/gemini/__tests__/geminiClient.test.ts"
Task: "T011 [P] [US4] Add test cases in src/services/__tests__/chapterTranslationService.test.ts"
Task: "T013 [P] [US5] Add unit tests in src/services/__tests__/directGlossaryEngine.test.ts"
Task: "T015 [P] [US6] Create unit tests in src/services/__tests__/localQuotaDebounce.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1: Setup (`T001`, `T002`)
2. Complete Phase 2: Foundational (`T003`, `T004`)
3. Complete Phase 3: User Story 1 (`T005`, `T006`)
4. **STOP and VALIDATE**: Run `npm test -- src/tests/cspParity.test.ts` to confirm Nginx parity.

### Incremental Delivery
1. Phase 1 + 2 → Foundational ready.
2. Phase 3 (US1) → Deployment Security Parity (MVP).
3. Phase 4 (US2) → Quota Window Continuity.
4. Phase 5 (US3) → Safety Filter Key Protection.
5. Phase 6 (US4) → Stale QA Issue Cleanup.
6. Phase 7 (US5) → Glossary Split Concurrency Limiter.
7. Phase 8 (US6) → Debounced Storage Persistence.
8. Phase 9 → Quality Gate pass (`lint`, `test`, `build`).
