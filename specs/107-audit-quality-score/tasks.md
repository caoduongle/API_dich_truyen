# Tasks: Translation Quality Audit Score (0-100)

**Feature**: `107-audit-quality-score`  
**Input**: Design artifacts from `specs/107-audit-quality-score/` (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/audit-score.contract.md`, `quickstart.md`)

---

## Phase 1: Setup & Foundational Prerequisites

**Purpose**: Verify existing environment and test harnesses prior to modifications.

- [X] T001 Verify existing test suites and baseline health via `npm test`

---

## Phase 2: User Story 1 - Instant Quality Score Computation (Priority: P1) 🎯 MVP

**Goal**: Implement pure calculation functions `calculateAuditScore` and `getAuditScoreTier` in `auditBridgeService.ts` with complete unit test coverage.

**Independent Test**: Run `npx vitest run src/services/__tests__/auditBridgeService.test.ts` to verify score deduction weights (-8 error, -3 warning, -1 info), clamping to [0, 100], status filtering (only pending issues deduct), and qualitative tier mapping.

### Tests for User Story 1
- [X] T002 [P] [US1] Add unit test cases for `calculateAuditScore` and `getAuditScoreTier` in `src/services/__tests__/auditBridgeService.test.ts`

### Implementation for User Story 1
- [X] T003 [US1] Export `AuditScoreTier` interface and implement `calculateAuditScore` and `getAuditScoreTier` in `src/services/auditBridgeService.ts`
- [X] T004 [US1] Verify tests pass for `auditBridgeService.test.ts` via `npx vitest run src/services/__tests__/auditBridgeService.test.ts`

**Checkpoint**: At this point, scoring math and qualitative tiering logic are fully functional and independently verified.

---

## Phase 3: User Story 2 - Minimalist Score and Qualitative Tier Indicator in Audit Panel (Priority: P2)

**Goal**: Display numeric score (`{score}/100`) and qualitative tier badge in the header bar of `UnifiedAuditPanel.tsx`, updating reactively when issues resolve.

**Independent Test**: Render `UnifiedAuditPanel` and verify score and tier badge are displayed in header; resolve an issue and verify score increments.

### Implementation for User Story 2
- [X] T005 [US2] Import `calculateAuditScore` and `getAuditScoreTier` and compute memoized `auditScore` and `scoreTier` in `src/components/translator-workspace/UnifiedAuditPanel.tsx`
- [X] T006 [US2] Render score text and qualitative `Badge` inside the Header Action Bar in `src/components/translator-workspace/UnifiedAuditPanel.tsx`

**Checkpoint**: Quality score and qualitative badge are visible and react to issue resolutions in `UnifiedAuditPanel`.

---

## Phase 4: User Story 3 - Advisory Reference Transparency (Priority: P3)

**Goal**: Add explanatory advisory tooltip to the score element in `UnifiedAuditPanel.tsx` informing users that the score is a reference heuristic, not an absolute evaluation.

**Independent Test**: Inspect the score element in `UnifiedAuditPanel.tsx` and verify `title` attribute and styling provide clear advisory guidance.

### Implementation for User Story 3
- [X] T007 [US3] Add advisory tooltip text and cursor-help styling to the score container in `src/components/translator-workspace/UnifiedAuditPanel.tsx`
- [X] T008 [US3] Add component tests in `src/components/translator-workspace/__tests__/UnifiedAuditPanel.test.tsx` verifying score, tier badge, and advisory tooltip rendering

**Checkpoint**: Advisory tooltip is in place and verified.

---

## Phase 5: Polish & Quality Gates

**Purpose**: Execute full verification across linting, unit tests, and production build.

- [X] T009 Run type check via `npm run lint` (`tsc --noEmit`)
- [X] T010 Run full test suite via `npm test` (`vitest run`)
- [X] T011 Run production build via `npm run build` (`vite build + esbuild server`)

---

## Dependencies & Execution Order

### Phase Dependencies
- **Phase 1 (Setup)**: Can start immediately.
- **Phase 2 (User Story 1 - P1 MVP)**: Depends on Phase 1.
- **Phase 3 (User Story 2 - P2)**: Depends on Phase 2 (`calculateAuditScore` available).
- **Phase 4 (User Story 3 - P3)**: Can be integrated into Phase 3 or right after.
- **Phase 5 (Polish & Gates)**: Depends on all user stories completed.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete T001 (baseline check).
2. Complete T002–T004 (scoring math in `auditBridgeService.ts`).
3. Validate independent tests for `auditBridgeService`.

### Incremental UI Delivery
1. Connect UI in `UnifiedAuditPanel.tsx` (T005–T007).
2. Add component test coverage (T008).
3. Validate full quality gates (T009–T011).
