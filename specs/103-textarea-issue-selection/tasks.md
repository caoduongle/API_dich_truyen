# Tasks: Textarea Issue Selection & Smooth Auto-Scroll

**Feature Branch**: `103-textarea-issue-selection`  
**Input**: Design artifacts from `specs/103-textarea-issue-selection/` (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`)

---

## Phase 1: Setup & Baseline Check

**Purpose**: Verify clean baseline environment and test execution readiness

- [x] T001 Verify baseline environment and clean test suite status via npm test and npm run lint in repository root

---

## Phase 2: Foundational Utility Creation

**Purpose**: Scaffold the core DOM selection and line-height scroll calculation utility

- [x] T002 Implement scrollAndSelectInTextarea utility with indexOf, newline counting, getComputedStyle line-height calculation, and scrollTop buffering in src/utils/textareaHighlight.ts
- [x] T003 [P] Create comprehensive unit test suite in src/utils/__tests__/textareaHighlight.test.ts covering exact matching, unmatched fallback, null safety, and line-height parsing

---

## Phase 3: User Story 1 - Click-to-Locate Quality Issues in Active Editor (Priority: P1) 🎯 MVP

**Goal**: Enable translators to click any issue card with targetText in UnifiedAuditPanel to focus, select, and scroll the active editor textarea to the offending excerpt.

**Independent Test**: Mount BilingualEditor, click an issue card in UnifiedAuditPanel with targetText, and verify the active textarea highlights the selection range and scrolls to the target line.

### Implementation for User Story 1

- [x] T004 [US1] Update BilingualEditor.tsx to create rawTextareaRef and polishedTextareaRef, bind them to corresponding textarea elements, compute activeTextareaRef, and pass it to UnifiedAuditPanel
- [x] T005 [US1] Update UnifiedAuditPanelProps to receive activeTextareaRef and invoke scrollAndSelectInTextarea on issue card click in src/components/translator-workspace/UnifiedAuditPanel.tsx

**Checkpoint**: Clicking an issue card with targetText focuses and highlights the exact snippet in the active translation textarea.

---

## Phase 4: User Story 2 - Graceful Fallback & Non-blocking Feedback (Priority: P2)

**Goal**: Provide non-blocking user feedback when a target excerpt has drifted or been modified, preventing silent confusion without breaking workflow.

**Independent Test**: Click an issue card whose targetText was edited or deleted in the textarea, verify that selection is untouched, and verify an informational toast notification appears.

### Implementation for User Story 2

- [x] T006 [US2] Implement non-blocking informational toast notification via useNotifications when scrollAndSelectInTextarea returns false for non-empty targetText in src/components/translator-workspace/UnifiedAuditPanel.tsx
- [x] T007 [P] [US2] Update test suite in src/components/translator-workspace/__tests__/UnifiedAuditPanel.test.tsx to verify activeTextareaRef prop integration, card click selection, and unmatched toast display

**Checkpoint**: Drifted or unmatched text triggers mild toast notification with zero runtime errors.

---

## Phase 5: Polish & Quality Gates

**Purpose**: Multi-gate verification required by Constitution Principle I before delivery.

- [x] T008 Run TypeScript type-check via npm run lint to ensure zero type diagnostics
- [x] T009 Run full unit test suite via npm test to ensure all tests pass with zero regressions
- [x] T010 Run production build via npm run build to ensure clean bundle

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1; creates `textareaHighlight.ts` and its unit tests.
- **User Story 1 (Phase 3)**: Depends on Phase 2; wires refs in `BilingualEditor` and click-to-select in `UnifiedAuditPanel`.
- **User Story 2 (Phase 4)**: Depends on Phase 3; implements soft toast notification on drift and adds component test coverage.
- **Quality Gates (Phase 5)**: Runs lint, test, and build across the entire project.

### User Story Dependencies

- **User Story 1 (P1)**: Foundational MVP delivering the core click-to-select and scroll interaction.
- **User Story 2 (P2)**: Enhances User Story 1 with graceful fallback notification when text drifts.

---

## Parallel Opportunities

- `T003` (utility unit tests) can be developed alongside `T002`.
- `T007` (panel tests) can run in parallel with `T006` once `T005` completes.

---

## Implementation Strategy

### MVP Scope (User Story 1 Only)
1. Complete T001 baseline verification.
2. Complete T002-T003: Implement and test `scrollAndSelectInTextarea`.
3. Complete T004-T005: Wire textarea refs in `BilingualEditor` and selection handler in `UnifiedAuditPanel`.
4. Validate MVP: Clicking an issue card highlights the excerpt in the active editor.

### Incremental Delivery
1. Add T006-T007: Fallback toast on text drift and test assertions.
2. Add T008-T010: Complete quality gates (`lint`, `test`, `build`) and live visual verification.
