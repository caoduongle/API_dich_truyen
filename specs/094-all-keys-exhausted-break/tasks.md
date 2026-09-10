# Tasks: All API Keys Exhausted Fast-Break & Error Taxonomy

**Feature**: `094-all-keys-exhausted-break`  
**Input**: Design documents from `specs/094-all-keys-exhausted-break/`  
**Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/094-all-keys-exhausted-break/spec.md) | **Plan**: [plan.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/094-all-keys-exhausted-break/plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify active feature directory configuration

- [x] T001 Verify active feature configuration in .specify/feature.json

---

## Phase 2: User Story 2 (P1) - Differentiated Quota Exhaustion Error Property in `callGeminiDirect`

**Goal**: When all API keys fail with 429/RESOURCE_EXHAUSTED, attach `.code = 'ALL_KEYS_EXHAUSTED'` to the thrown Error without changing the Vietnamese message.

**Independent Test**: Invoke `callGeminiDirect` with exhausted keys; assert that the caught error has `err.code === 'ALL_KEYS_EXHAUSTED'`.

### Implementation for User Story 2

- [x] T002 [US2] Attach code 'ALL_KEYS_EXHAUSTED' to error and re-throw in catch block in src/services/directGeminiClient.ts

**Checkpoint**: `callGeminiDirect` throws distinguishable `ALL_KEYS_EXHAUSTED` error.

---

## Phase 3: User Story 1 (P1) - Fast-Break on Global Quota Exhaustion in `runAiQualityScan` 🎯 MVP

**Goal**: In `runAiQualityScan()`, intercept `ALL_KEYS_EXHAUSTED`, push exactly 1 summary warning issue, break the loop immediately, and avoid calling `callGeminiDirect` for subsequent chapters.

**Independent Test**: Mock `callGeminiDirect` to throw `ALL_KEYS_EXHAUSTED` on Chapter 1 of 3; verify only 1 warning issue is emitted, Chapters 2 and 3 are not called, and prior results are preserved.

### Tests for User Story 1

- [x] T003 [US1] Add unit test in src/services/__tests__/hakoQualityEngine.test.ts asserting runAiQualityScan breaks on ALL_KEYS_EXHAUSTED and callGeminiDirect is not called for remaining chapters

### Implementation for User Story 1

- [x] T004 [US1] Implement ALL_KEYS_EXHAUSTED check, single warning issue emission, and immediate break in src/services/hakoQualityEngine.ts

**Checkpoint**: `runAiQualityScan` immediately breaks on quota exhaustion without duplicate warnings or unnecessary calls.

---

## Phase 4: User Story 3 (P2) - Non-Quota Error Isolation Verification

**Goal**: Verify that non-quota errors (content safety, network error) continue processing subsequent chapters.

**Independent Test**: Mock `callGeminiDirect` to throw a generic error on Chapter 1 of 3; assert Chapter 1 gets a localized warning and Chapters 2 and 3 are still scanned.

### Tests & Verification for User Story 3

- [x] T005 [P] [US3] Add unit test asserting localized non-quota errors allow subsequent chapters to continue in src/services/__tests__/hakoQualityEngine.test.ts

**Checkpoint**: Localized errors are safely isolated.

---

## Phase 5: Polish & Quality Verification

**Purpose**: Verify all quality gates and constitutional constraints pass cleanly

- [x] T006 Run TypeScript type check via npm run lint to ensure zero type errors
- [x] T007 Run full unit test suite via npm test to ensure 100% test pass rate
- [x] T008 Run production build via npm run build to verify bundle compilation

---

## Dependencies & Execution Order

- **Phase 1 (Setup)**: No dependencies.
- **Phase 2 (US2)**: Prerequisite for Phase 3 (`callGeminiDirect` error code needed by `runAiQualityScan`).
- **Phase 3 (US1)**: Test first (`T003`), then implementation (`T004`).
- **Phase 4 (US3)**: Can run after Phase 3.
- **Phase 5 (Polish)**: Runs after all implementation tasks.
