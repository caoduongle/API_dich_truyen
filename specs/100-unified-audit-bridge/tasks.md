# Tasks: Unified Audit Issue Types & Bridge Service

**Feature Branch**: `100-unified-audit-bridge`  
**Input**: Design artifacts from `specs/100-unified-audit-bridge/` (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`)

---

## Phase 1: Setup & Environment Validation

**Purpose**: Verify clean baseline environment and test execution readiness

- [X] T001 Verify baseline environment and clean test suite status via npm test in repository root

---

## Phase 2: User Story 1 - Unified Data Contract for Quality Defects (Priority: P1) 🎯 MVP

**Goal**: Establish the central type definitions (`IssueSource`, `UnifiedSeverity`, `UnifiedAuditIssue`) and severity mapping lookup tables.

**Independent Test**: Run `npm run lint` (`tsc --noEmit`) to verify `src/types/audit.ts` compiles cleanly with no type diagnostics.

### Implementation for User Story 1

- [X] T002 [US1] Create unified audit types and severity mapping tables in src/types/audit.ts

**Checkpoint**: Core type contract and severity mappings are established and exportable.

---

## Phase 3: User Story 2 - Deterministic Normalization via Pure Bridge Functions (Priority: P1)

**Goal**: Implement pure bridge functions `mapHakoIssueToUnified` and `mapQaIssueToUnified` with thorough unit test coverage.

**Independent Test**: Run `npx vitest run src/services/__tests__/auditBridgeService.test.ts` to verify 100% test pass on severity mapping, targetText preservation, and autoFixable category branching.

### Tests for User Story 2

- [X] T003 [P] [US2] Create unit test suite for audit bridge mappers in src/services/__tests__/auditBridgeService.test.ts

### Implementation for User Story 2

- [X] T004 [US2] Implement pure bridge transformation functions in src/services/auditBridgeService.ts

**Checkpoint**: Bridge service functions normalize both Hako and QA issues cleanly; all bridge unit tests pass.

---

## Phase 4: Polish & Verification Quality Gates

**Purpose**: Multi-gate verification required by Constitution Principle I before delivery.

- [X] T005 Run TypeScript type-check via npm run lint to ensure zero type diagnostics
- [X] T006 Run unit test suite via npm test to ensure all tests pass
- [X] T007 Run production build via npm run build to ensure clean bundle

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Can start immediately.
- **User Story 1 (Phase 2)**: Depends on T001; defines types needed by all subsequent tasks.
- **User Story 2 (Phase 3)**: Depends on Phase 2 (`src/types/audit.ts` exports).
  - T003 (unit test) can be drafted first (TDD approach).
  - T004 (service implementation) satisfies T003.
- **Polish (Phase 4)**: Depends on completion of User Story 1 and 2.

### Parallel Opportunities

- `T003` (unit test suite) and `T004` (service skeleton) can be prepared in coordination.
- `T005`, `T006`, `T007` run sequentially as progressive quality gates.

---

## Implementation Strategy

### MVP Scope (User Story 1 & 2 Core)
1. Complete T001 baseline verification.
2. Complete T002 (`src/types/audit.ts`).
3. Complete T003 and T004 (`src/services/auditBridgeService.ts` and tests).
4. Run `npx vitest run src/services/__tests__/auditBridgeService.test.ts` to confirm isolated unit test success.
5. Run full verification gates (T005-T007).
