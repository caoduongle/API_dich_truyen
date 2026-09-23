# Implementation Tasks: Runtime Hardening Completion & Architecture Polish

**Feature**: [Runtime Hardening Completion & Architecture Polish](spec.md)
**Branch**: `161-runtime-hardening-completion`
**Date**: 2026-09-23

## Phase 1: Setup (Shared Types & Contracts)

**Purpose**: Establish typed sanitization helpers, error contracts, and data models.

- [x] T001 Define sliding-window sanitization signatures and helper contracts in `src/types/runtimeHardening.ts`
- [x] T002 [P] Verify error codes and ensure `GeminiRequestError` exports in `src/services/gemini/types.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared sanitization and error extraction primitives required across user stories.

**⚠️ CRITICAL**: Must complete before user story implementation begins.

- [x] T003 [P] Implement `sanitizeRecentAttempts` and `sanitizeRecentTokens` helpers in `src/services/localQuotaTracker.ts`
- [x] T004 [P] Implement `getErrorMessage(error: unknown)` and `isGeminiRequestError` helper in `src/services/gemini/geminiErrorClassifier.ts`

**Checkpoint**: Foundation ready — user story implementation can proceed independently.

---

## Phase 3: User Story 1 - Bounded and Memory-Safe Quota Storage Ingestion (Priority: P1) 🎯 MVP

**Goal**: Symmetrically cap sliding-window entries (`recentAttempts` and `recentTokens`) at 100 items on `loadFromStorage` as well as `saveToStorage`.

**Independent Test**: `npm test -- src/services/__tests__/localQuotaTracker.test.ts` passes with deserialization cap 100 validation.

### Tests for User Story 1
- [x] T005 [P] [US1] Add unit tests verifying 100-entry deserialization cap and sanitization on bloated storage in `src/services/__tests__/localQuotaTracker.test.ts`

### Implementation for User Story 1
- [x] T006 [US1] Apply `sanitizeRecentAttempts` and `sanitizeRecentTokens` with `.slice(-100)` to keys and models in `loadFromStorage` and `saveToStorage` in `src/services/localQuotaTracker.ts`

**Checkpoint**: User Story 1 fully functional and testable independently.

---

## Phase 4: User Story 2 - True Asynchronous Quota Storage on Error Hot Path (Priority: P1)

**Goal**: Debounce storage persistence on `recordFailure` (300ms) instead of executing synchronous `flushToStorage` in the error hot path.

**Independent Test**: `npm test -- src/services/__tests__/localQuotaDebounce.test.ts` passes with debounced failure writes.

### Tests for User Story 2
- [x] T007 [P] [US2] Update unit tests in `src/services/__tests__/localQuotaDebounce.test.ts` to assert `recordFailure()` debounces persistence and flushes on lifecycle events
- [x] T008 [US2] Update `recordFailure()` in `src/services/localQuotaTracker.ts` to call `this.scheduleSave(now)` instead of synchronous `this.flushToStorage(now)`

**Checkpoint**: User Story 2 verified; failure recording no longer incurs synchronous storage blocking.

---

## Phase 5: User Story 3 - Comprehensive Structured Gemini Error Hierarchy (Priority: P2)

**Goal**: Standardize error dispatching across the Gemini client so all errors instantiate `GeminiRequestError` with typed `code` and `category`.

**Independent Test**: `npm test -- src/services/gemini/__tests__/geminiClient.test.ts` passes with structured error assertions.

### Tests for User Story 3
- [x] T009 [P] [US3] Add unit tests in `src/services/gemini/__tests__/geminiClient.test.ts` verifying `error instanceof GeminiRequestError` and checking `error.code` across 404, 400, 429 exhaustion, and timeout

### Implementation for User Story 3
- [x] T010 [US3] Refactor `executeLogicalGeminiCall` in `src/services/gemini/geminiClient.ts` to throw `GeminiRequestError` for all error paths and replace `catch (err: any)` with `catch (err: unknown)`

**Checkpoint**: User Story 3 verified; dynamic monkey-patching eliminated across Gemini error handling.

---

## Phase 6: User Story 4 - Strict Unknown Error Handling in Direct Glossary Extraction (Priority: P2)

**Goal**: Eliminate `any` in error catching and checking within `directGlossaryEngine.ts` using safe error message extraction.

**Independent Test**: `npm test -- src/services/__tests__/directGlossaryEngine.test.ts` passes with type-safe error handling.

### Tests for User Story 4
- [x] T011 [P] [US4] Add unit tests in `src/services/__tests__/directGlossaryEngine.test.ts` verifying safe handling of non-standard error throws and `CONTENT_BLOCKED` instances

### Implementation for User Story 4
- [x] T012 [US4] Update `isSafetyOrEmptyErrorDirect` and replace all `catch (error: any)` with `catch (error: unknown)` in `src/services/directGlossaryEngine.ts`

**Checkpoint**: User Story 4 verified; full type-safety achieved in direct glossary error handling.

---

## Phase 7: User Story 5 - Modernization of Build and CI Runtime to Node.js 24 LTS (Priority: P3)

**Goal**: Upgrade CI workflow, Docker container definition, and documentation to target Node.js 24 LTS.

**Independent Test**: Configuration file audit and build execution.

### Implementation for User Story 5
- [x] T013 [P] [US5] Update Node.js version to `'24'` in `.github/workflows/ci.yml`
- [x] T014 [P] [US5] Update base builder image to `node:24-alpine` in `Dockerfile`
- [x] T015 [P] [US5] Update runtime requirements to `Node.js 24 LTS` in `README.md`

**Checkpoint**: User Story 5 verified; repository target environment aligned with Node.js 24 LTS.

---

## Phase 8: Polish & Cross-Cutting Verification

**Purpose**: Verify repository integrity, type safety, test suite pass, and buildability.

- [x] T016 [P] Verify full type-checking pass (`npm run lint`)
- [x] T017 Run complete test suite (`npm test`) ensuring all test files pass without regressions
- [x] T018 [P] Verify production build compilation (`npm run build`)
- [x] T019 Execute `quickstart.md` validation checklist and document in `specs/161-runtime-hardening-completion/walkthrough.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories.
- **User Stories (Phase 3–7)**:
  - User Story 1 (P1): Depends on Phase 2.
  - User Story 2 (P1): Depends on Phase 2 (modifies same file `localQuotaTracker.ts` after US1).
  - User Story 3 (P2): Depends on Phase 2.
  - User Story 4 (P2): Depends on Phase 2.
  - User Story 5 (P3): Independent of application code, can proceed in parallel.
- **Polish (Phase 8)**: Depends on all user stories being complete.

### Parallel Opportunities
- T002, T003, T004 can be prepared in parallel.
- T005, T007, T009, T011 test creation can proceed in parallel once foundational types are ready.
- T013, T014, T015 (CI/Docker/Docs) can be executed in parallel with backend service modifications.
