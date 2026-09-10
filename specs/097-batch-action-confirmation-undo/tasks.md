# Tasks: Batch Action Confirmation & Undo Guard

**Feature**: `097-batch-action-confirmation-undo`  
**Input**: Design documents from `specs/097-batch-action-confirmation-undo/`  
**Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/097-batch-action-confirmation-undo/spec.md) | **Plan**: [plan.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/097-batch-action-confirmation-undo/plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify active feature directory configuration

- [x] T001 Verify active feature configuration in .specify/feature.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core constants, imports, and state infrastructure required by User Stories

- [x] T002 Import Modal from ../ui/Modal, useNotifications from ../NotificationSystem, define BATCH_CONFIRM_THRESHOLD = 5, and declare confirmBatch state in src/components/hako-checker/HakoIssueReviewPanel.tsx

**Checkpoint**: Core dependencies, constants, and state variables are available in `HakoIssueReviewPanel.tsx`.

---

## Phase 3: User Story 1 (P1) - Confirmation Guard for Large-Scale Batch Actions 🎯 MVP

**Goal**: Require explicit user confirmation before executing "Duyệt nhanh tất cả" or "Bỏ qua tất cả" whenever $> 5$ issues are affected, preventing accidental mass triage mutations.

**Independent Test**: Render `HakoIssueReviewPanel` with 10 pending issues. Click "Duyệt nhanh tất cả". Verify confirmation modal appears displaying "Bạn sắp duyệt 10 lỗi. Tiếp tục?". Click "Hủy", verify no issues are changed. Click "Xác nhận", verify all 10 issues are updated to `confirmed`.

### Implementation for User Story 1

- [x] T003 [US1] Refactor handleBatchConfirm and handleBatchDismiss to stage confirmBatch when pending issues count > BATCH_CONFIRM_THRESHOLD or execute directly when <= BATCH_CONFIRM_THRESHOLD in src/components/hako-checker/HakoIssueReviewPanel.tsx
- [x] T004 [US1] Render Modal dialog with "Bạn sắp duyệt/bỏ qua N lỗi. Tiếp tục?" and "Hủy" / "Xác nhận" buttons in src/components/hako-checker/HakoIssueReviewPanel.tsx

**Checkpoint**: Batch actions affecting $> 5$ issues display the confirmation modal; canceling preserves state, confirming dispatches changes.

---

## Phase 4: User Story 2 (P1) - Temporary Undo Window for Bulk Decision Mutations

**Goal**: Display a temporary notification toast (7000ms) with an "Hoàn tác" button following any batch execution, allowing single-click restoration of all mutated issues back to `pending`.

**Independent Test**: Execute batch confirm on 10 pending issues. Observe toast with message "Đã duyệt 10 lỗi." and "Hoàn tác" button. Click "Hoàn tác", verify all 10 issues revert back to `pending`.

### Implementation for User Story 2

- [x] T005 [US2] Implement executeBatchMutation helper integrating useNotifications showToast with onUndo callback calling onBatchDecisionChange(ids, 'pending') in src/components/hako-checker/HakoIssueReviewPanel.tsx

**Checkpoint**: Batch operations trigger an undoable toast that reverts affected issues to `pending` upon click.

---

## Phase 5: Automated Testing & Quality Verification

**Purpose**: Add unit test coverage and enforce all constitutional quality gates

- [x] T006 [P] Create comprehensive unit tests covering confirmation modal gating, cancellation, execution, and undo flow in src/components/hako-checker/__tests__/HakoIssueReviewPanel.test.tsx
- [x] T007 Run TypeScript type check via npm run lint to ensure zero type errors
- [x] T008 Run full unit test suite via npm test to ensure 100% test pass rate
- [x] T009 Run production build via npm run build to verify bundle compilation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2).
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) and US1 execution flow.
- **Testing & Quality (Phase 5)**: Depends on Phase 3 and Phase 4 completion.

### User Story Dependencies

- **User Story 1 (P1)**: Independent core confirmation gate.
- **User Story 2 (P1)**: Integrates with batch execution flow triggered either after modal confirmation or directly when $\le 5$ issues.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1: Setup (`T001`).
2. Complete Phase 2: Foundational imports and state (`T002`).
3. Complete Phase 3: Modal guard and threshold check (`T003`, `T004`).
4. Validate modal opens for 10 issues and cancels/confirms properly.

### Incremental Delivery
1. Add Phase 4: Undo toast with `showToast` & `onUndo` (`T005`).
2. Add Phase 5: Automated tests and quality verification (`T006`, `T007`, `T008`, `T009`).
