# Tasks: Unified Audit Panel for Translator Workspace

**Feature Branch**: `102-unified-audit-panel`  
**Input**: Design artifacts from `specs/102-unified-audit-panel/` (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`)

---

## Phase 1: Setup & Baseline Check

**Purpose**: Verify clean baseline environment and test execution readiness

- [X] T001 Verify baseline environment and clean test suite status via npm test and npm run lint in repository root

---

## Phase 2: Foundational Component Creation

**Purpose**: Scaffold the base component structure and data transformation pipeline

- [X] T002 Implement base UnifiedAuditPanel component structure, props interface, and useMemo data mapping in src/components/translator-workspace/UnifiedAuditPanel.tsx

---

## Phase 3: User Story 1 - Header Action Bar & On-Demand AI Critique (Priority: P1) 🎯 MVP

**Goal**: Implement the top header with seal, issue count summary, and the "Chạy AI Thẩm định" button replacing the old auto-trigger.

**Independent Test**: Mount `UnifiedAuditPanel`, click "Chạy AI Thẩm định", verify `onRunAiQaCritique` is invoked, and verify button is disabled with spinner during `isCheckingQa`.

### Implementation for User Story 1

- [X] T003 [US1] Implement header action bar with Seal, title, and primary 'Chạy AI Thẩm định' button with isCheckingQa loading state in src/components/translator-workspace/UnifiedAuditPanel.tsx

**Checkpoint**: Header action bar renders and triggers manual AI review.

---

## Phase 4: User Story 2 - Multi-Category Filter Tabs (Priority: P1)

**Goal**: Implement 4 filter tabs ("Tất cả", "Quy chuẩn Hako", "Góp ý AI", "Chưa xử lý") with live count badges.

**Independent Test**: Render issues from both sources, click each filter tab, and verify only matching issues are shown and counts match data.

### Implementation for User Story 2

- [X] T004 [US2] Implement filter tab bar with dynamic count badges for all, hako_rule, ai_critique, and pending states in src/components/translator-workspace/UnifiedAuditPanel.tsx

**Checkpoint**: Filter tabs seamlessly toggle between issue subsets.

---

## Phase 5: User Story 3 - Compact Issue Cards & Severity Tokens (Priority: P1)

**Goal**: Render compact issue cards styled for dense sidebar constraints with standard severity tokens (`danger`, `warning`, `neutral`).

**Independent Test**: Verify cards display severity badges, title, message, optional `targetText` excerpt, and fire `onIssueClick(issue)` on click.

### Implementation for User Story 3

- [X] T005 [US3] Implement compact issue card rendering with severity Badges, source tags, targetText excerpt, and onIssueClick handler in src/components/translator-workspace/UnifiedAuditPanel.tsx

**Checkpoint**: Issue cards render cleanly with proper typography and contrast.

---

## Phase 6: User Story 4 - 3 Mandatory UX States & Error Recovery (Priority: P1)

**Goal**: Implement Loading (Skeleton), Empty (EmptyState with CTA), and Error (alert + retry button) states per design-system.md.

**Independent Test**: Verify Loading displays Skeleton during `isCheckingQa=true`, Empty displays EmptyState when 0 issues, and Error displays retry button when `qaError` is set.

### Implementation for User Story 4

- [X] T006 [US4] Implement Skeleton loading state, EmptyState with CTA, Error alert with retry button, and paragraph mismatch alert in src/components/translator-workspace/UnifiedAuditPanel.tsx

**Checkpoint**: All 3 mandatory UX states and mismatch alert are functional.

---

## Phase 7: Workspace Integration & Legacy Deletion (Priority: P1)

**Goal**: Integrate `UnifiedAuditPanel` into the workspace editor and delete the obsolete `QaCritiquePanel`.

**Independent Test**: Verify `BilingualEditor` and `TranslatorWorkspace` compile and render `UnifiedAuditPanel`, and `grep` finds 0 references to `QaCritiquePanel`.

### Implementation for Workspace Integration

- [X] T007 [US1] Update BilingualEditor.tsx to replace QaCritiquePanel import and render UnifiedAuditPanel in src/components/translator-workspace/BilingualEditor.tsx
- [X] T008 [US1] Update TranslatorWorkspace.tsx to pass hakoIssues and onRunAiQaCritique down to BilingualEditor in src/components/TranslatorWorkspace.tsx
- [X] T009 Delete legacy QaCritiquePanel.tsx and confirm zero remaining references across repository

**Checkpoint**: Workspace compiles cleanly with UnifiedAuditPanel; QaCritiquePanel is fully eliminated.

---

## Phase 8: Unit Testing (Priority: P1)

**Goal**: Provide thorough unit test coverage for `UnifiedAuditPanel` covering all user stories and states.

- [X] T010 [P] Add unit test suite in src/components/translator-workspace/__tests__/UnifiedAuditPanel.test.tsx covering render, action click, tab filtering, card selection, and 3 mandatory states

---

## Phase 9: Polish & Verification Quality Gates

**Purpose**: Multi-gate verification required by Constitution Principle I before delivery.

- [X] T011 Run TypeScript type-check via npm run lint to ensure zero type diagnostics
- [X] T012 Run unit test suite via npm test to ensure all tests pass
- [X] T013 Run production build via npm run build to ensure clean bundle

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1; creates base component and mappings.
- **User Story 1 (Phase 3)**: Implements header and on-demand review CTA.
- **User Story 2 (Phase 4)**: Implements filter tabs and counters.
- **User Story 3 (Phase 5)**: Implements compact cards and severity badges.
- **User Story 4 (Phase 6)**: Implements Loading, Empty, and Error states.
- **Integration (Phase 7)**: Wires into `BilingualEditor` & `TranslatorWorkspace`, deletes `QaCritiquePanel`.
- **Testing (Phase 8)**: Validates complete component behaviors.
- **Quality Gates (Phase 9)**: Executes lint, test, and build.

---

## Implementation Strategy

### MVP Scope (User Story 1 & Integration)
1. Complete T001 baseline verification.
2. Complete T002: Base `UnifiedAuditPanel` structure and mapping.
3. Complete T003: Header and "Chạy AI Thẩm định" button.
4. Complete T004: Filter tabs.
5. Complete T005: Compact issue cards.
6. Complete T006: Loading, Empty, Error states.
7. Complete T007-T009: Integration into `BilingualEditor` and `TranslatorWorkspace`, delete `QaCritiquePanel`.
8. Complete T010: Comprehensive unit tests in `UnifiedAuditPanel.test.tsx`.
9. Complete T011-T013: Run quality gates (`lint`, `test`, `build`).
