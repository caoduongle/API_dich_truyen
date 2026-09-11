# Tasks: Keyboard Navigation and Quick Execution for Audit Issues

**Feature Branch**: `105-audit-keyboard-navigation`  
**Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/105-audit-keyboard-navigation/spec.md)  
**Generated**: 2026-09-11  

---

## Phase 1: Foundational — Pure Helpers & State Setup

**Purpose**: Define pure bounded index navigation and form guard helpers that serve all user stories and can be tested independently.

- [x] T001 [P] [US1] Export pure helper functions `getNextIssueIndex` and `getPrevIssueIndex` with strict bounding `[0, total - 1]` in `src/components/translator-workspace/UnifiedAuditPanel.tsx`
- [x] T002 [P] [US2] Export pure helper function `canTriggerAuditEnterAction(targetElement: Element | null): boolean` to guard against form/textarea input in `src/components/translator-workspace/UnifiedAuditPanel.tsx`
- [x] T003 [US1] Add `focusedIssueIndex` state (initialized to `0` when list has items, `-1` when empty) and `cardRefs` ref array in `src/components/translator-workspace/UnifiedAuditPanel.tsx`

---

## Phase 2: User Story 1 — Sequential Keyboard Navigation via Alt+J / Alt+K (Priority: P1) 🎯 MVP

**Goal**: Enable translators to step up and down through the list of audit issues using `Alt+J` and `Alt+K` without index overflow.

**Independent Test**: Mount the panel with multiple issues, trigger Alt+J/Alt+K, and verify bounded index changes and smooth card scrolling.

- [x] T004 [US1] Register `useHotkeys('alt+j', ...)` to increment `focusedIssueIndex` using `getNextIssueIndex` in `src/components/translator-workspace/UnifiedAuditPanel.tsx`
- [x] T005 [US1] Register `useHotkeys('alt+k', ...)` to decrement `focusedIssueIndex` using `getPrevIssueIndex` in `src/components/translator-workspace/UnifiedAuditPanel.tsx`
- [x] T006 [US1] Add card ref attachment to each rendered issue card and auto-scroll focused card into view (`scrollIntoView({ block: 'nearest', behavior: 'smooth' })`) in `src/components/translator-workspace/UnifiedAuditPanel.tsx`
- [x] T007 [US1] Apply design system focused styling (`ring-1 ring-polish/60 bg-parchment-2/40 border-polish/50`) to the card matching `focusedIssueIndex` in `src/components/translator-workspace/UnifiedAuditPanel.tsx`

**Checkpoint**: User Story 1 delivers working keyboard navigation across all displayed issues with visual feedback.

---

## Phase 3: User Story 2 — Context-Aware Primary Action Execution via Enter (Priority: P2)

**Goal**: Pressing Enter on a focused issue triggers its primary resolution action without colliding with textarea editing.

**Independent Test**: Select an auto-fix issue, press Enter, verify fix applied; select non-fixable issue, press Enter, verify selection in textarea; type in textarea, press Enter, verify newline is inserted.

- [x] T008 [US2] Register `useHotkeys('enter', ...)` with `enableOnFormTags: false` in `src/components/translator-workspace/UnifiedAuditPanel.tsx`
- [x] T009 [US2] In the Enter hotkey handler, verify `canTriggerAuditEnterAction(document.activeElement)` and valid `focusedIssueIndex` before proceeding in `src/components/translator-workspace/UnifiedAuditPanel.tsx`
- [x] T010 [US2] If the focused issue is `autoFixable` (and has `suggestion` and is not resolved), invoke `handleQuickFix` in `src/components/translator-workspace/UnifiedAuditPanel.tsx`
- [x] T011 [US2] If the focused issue is NOT auto-fixable, invoke `handleAuditIssueSelection` to scroll and select `targetText` in the editor textarea in `src/components/translator-workspace/UnifiedAuditPanel.tsx`

**Checkpoint**: Complete keyboard review workflow: navigate with Alt+J/K and resolve or locate with Enter.

---

## Phase 4: User Story 3 — Tab State Synchronization & Boundary Protection (Priority: P3)

**Goal**: Ensure `focusedIssueIndex` clamps safely when filter tabs switch or issues resolve, and synchronize card mouse click with index.

**Independent Test**: Switch between tabs with different issue counts; verify `focusedIssueIndex` never becomes out-of-bounds. Click a card and verify it becomes the focused card.

- [x] T012 [US3] Add `useEffect` to clamp or reset `focusedIssueIndex` whenever `activeTab` or `filteredIssues.length` changes in `src/components/translator-workspace/UnifiedAuditPanel.tsx`
- [x] T013 [US3] Update `handleIssueCardClick` to set `focusedIssueIndex` to the clicked card's index in `src/components/translator-workspace/UnifiedAuditPanel.tsx`

---

## Phase 5: Tests

**Purpose**: Unit and integration tests for navigation helpers, hotkey execution, and visual styling.

- [x] T014 [P] [US1] Add unit tests for `getNextIssueIndex` and `getPrevIssueIndex` (bounds clamping, empty array, overflow prevention) in `src/components/translator-workspace/__tests__/UnifiedAuditPanel.test.tsx`
- [x] T015 [P] [US2] Add unit tests for `canTriggerAuditEnterAction` (input, textarea, select, contenteditable, null/div elements) in `src/components/translator-workspace/__tests__/UnifiedAuditPanel.test.tsx`
- [x] T016 [P] [US1] Add SSR/component tests verifying focused card styling (`ring-polish/60`) renders for focused index in `src/components/translator-workspace/__tests__/UnifiedAuditPanel.test.tsx`

---

## Phase 6: Polish & Quality Gates

- [x] T017 Run `npm run lint` — must pass with 0 errors
- [x] T018 Run `npm test` — all tests must pass
- [x] T019 Run `npm run build` — must build successfully

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: Foundational pure helpers (T001-T003) — no dependencies, blocks Phase 2-4
- **Phase 2** (US1: T004-T007): Depends on Phase 1 — implements Alt+J/Alt+K navigation
- **Phase 3** (US2: T008-T011): Depends on Phase 1 & 2 — implements Enter action
- **Phase 4** (US3: T012-T013): Depends on Phase 2 & 3 — handles tab synchronization
- **Phase 5** (Tests: T014-T016): Can run in parallel with/after implementation
- **Phase 6** (Quality Gates: T017-T019): Final validation of entire codebase

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Implement Phase 1 helpers and state.
2. Implement Phase 2 Alt+J/K navigation and visual focus styling.
3. Validate keyboard traversal before layering Enter execution.

### Incremental Delivery
1. Phase 1 + 2: Working Alt+J / Alt+K navigation (MVP).
2. Phase 3: Add Enter primary action execution with form safety.
3. Phase 4: Sync tab changes and mouse clicks.
4. Phase 5: Add comprehensive tests.
5. Phase 6: Pass all quality gates.
