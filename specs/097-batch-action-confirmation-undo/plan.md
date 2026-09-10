# Implementation Plan: Batch Action Confirmation & Undo Guard

**Branch**: `097-batch-action-confirmation-undo` | **Date**: 2026-09-10 | **Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/097-batch-action-confirmation-undo/spec.md)

**Input**: Feature specification from `specs/097-batch-action-confirmation-undo/spec.md`

## Summary

In `src/components/hako-checker/HakoIssueReviewPanel.tsx`, the two bulk moderation buttons ("Duyệt nhanh tất cả" and "Bỏ qua tất cả") currently mutate all filtered pending issues immediately without prior confirmation or an undo safety net. When reviewing multi-chapter audits with dozens of issues, an accidental misclick overwrites extensive triage progress.

This plan adds:
1. An explicit confirmation modal (reusing the existing `<Modal>` component from `src/components/ui/Modal.tsx`) when the number of affected pending issues exceeds `BATCH_CONFIRM_THRESHOLD = 5`.
2. A temporary floating toast notification (7000ms duration, reusing `useNotifications` from `src/components/NotificationSystem.tsx`) with an "Hoàn tác" action button that reverts all affected issues back to `pending` via `onBatchDecisionChange`.
3. Automated unit tests covering both the confirmation prompt gating and undo execution.

## Technical Context

**Language/Version**: TypeScript 5.8+, React 19  
**Primary Dependencies**: React 19, Lucide React, existing UI primitives (`Button`, `Modal`), `NotificationSystem` (`useNotifications`)  
**Storage**: In-memory component state (`confirmBatch`) & single-write batch dispatch to IndexedDB session store via `onBatchDecisionChange`  
**Testing**: Vitest (`npm test`), React Testing Library  
**Target Platform**: Browser / Client-side React Web App  
**Project Type**: React UI component  
**Performance Goals**: Instant modal render (< 16ms), single-write atomic undo revert without connection thrashing  
**Constraints**:
- Strictly limited to `src/components/hako-checker/HakoIssueReviewPanel.tsx` and its unit test.
- Do NOT rewrite or alter `NotificationSystem.tsx` or `HakoIssueCard.tsx`.
- Threshold is strictly $> 5$ issues.
- No new external NPM dependencies.
- Strict compliance with `.agents/rules/design-system.md` (`rounded-[2px]`, `rounded-md`, design tokens, no new colors).
- All quality gates (`npm run lint`, `npm test`, `npm run build`) must pass cleanly.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status | Verification |
| :--- | :--- | :---: | :--- |
| **I. Strict Quality Gates & Verification** | `npm run lint`, `npm test`, `npm run build` must pass cleanly without skipped tests. | **PASS** | Automated tests added; lint and build checked before completion. |
| **II. Dependency Minimization** | No new NPM packages added; reuse existing primitives. | **PASS** | Reuses `Modal`, `Button`, and `useNotifications`. |
| **III. Strict Concern Separation** | UI changes isolated to `HakoIssueReviewPanel.tsx`. | **PASS** | Bounded strictly to panel component. |
| **IV. Immutable Core Schemas** | No modifications to `src/types.ts` or database schema. | **PASS** | 100% compliant. |
| **V. Atomic Commits & Sync** | Modular, reviewable diff. | **PASS** | Single-component targeted changes. |

## Project Structure

### Documentation (this feature)

```text
specs/097-batch-action-confirmation-undo/
├── spec.md              # Feature specification
├── plan.md              # Implementation plan (this file)
├── research.md          # Technical decisions (Modal vs NotificationSystem)
├── data-model.md        # State architecture & lifecycle transitions
├── contracts/           # Component invariants & interfaces
│   └── batch-action-guard.contract.md
├── quickstart.md        # Verification walkthrough & test commands
└── checklists/
    └── requirements.md  # Quality checklist
```

### Source Code (repository root)

```text
src/
└── components/
    └── hako-checker/
        ├── HakoIssueReviewPanel.tsx                     # [MODIFY] Add BATCH_CONFIRM_THRESHOLD, confirmation Modal, and useNotifications showToast undo wiring
        └── __tests__/
            └── HakoIssueReviewPanel.test.tsx            # [NEW] Vitest suite covering confirmation modal, cancellation, execution, and undo flow
```

## Implementation Phases

### Phase 1: Confirmation Modal & Threshold Guard in `HakoIssueReviewPanel.tsx`
- Define `const BATCH_CONFIRM_THRESHOLD = 5;`.
- Add local state: `const [confirmBatch, setConfirmBatch] = useState<{ action: 'confirmed' | 'dismissed'; ids: string[]; count: number } | null>(null);`.
- Import `Modal` from `../ui/Modal`.
- Update `handleBatchConfirm` and `handleBatchDismiss`:
  - If `pendingIds.length > BATCH_CONFIRM_THRESHOLD`: set `confirmBatch`.
  - If `pendingIds.length <= BATCH_CONFIRM_THRESHOLD`: execute mutation immediately and show undo toast.
- Render `<Modal open={!!confirmBatch} onClose={() => setConfirmBatch(null)} title="Xác nhận thao tác hàng loạt" size="sm">`:
  - Message: `Bạn sắp {confirmBatch.action === 'confirmed' ? 'duyệt' : 'bỏ qua'} {confirmBatch.count} lỗi. Tiếp tục?`
  - Footer: "Hủy" button and "Xác nhận" button.

### Phase 2: Temporary Undo Toast Notification
- Import `useNotifications` from `../NotificationSystem`.
- Define helper `executeBatchMutation(action: 'confirmed' | 'dismissed', ids: string[])`:
  - Dispatch `onBatchDecisionChange(ids, action)` (or `onDecisionChange` fallback).
  - Call `showToast({ message: action === 'confirmed' ? `Đã duyệt ${ids.length} lỗi.` : `Đã bỏ qua ${ids.length} lỗi.`, type: 'success', duration: 7000, onUndo: () => revertBatch(ids), undoLabel: 'Hoàn tác' })`.
- `revertBatch(ids: string[])`: calls `onBatchDecisionChange(ids, 'pending')`.

### Phase 3: Automated Unit Testing
- Create `src/components/hako-checker/__tests__/HakoIssueReviewPanel.test.tsx`.
- Wrap component in `<NotificationProvider>`.
- Test cases:
  1. Click "Duyệt nhanh tất cả" with 10 pending issues -> modal opens with "Bạn sắp duyệt 10 lỗi. Tiếp tục?".
  2. Click "Hủy" -> modal closes, no decision changed.
  3. Click "Xác nhận" -> modal closes, all 10 issues updated to `confirmed`, toast displayed with "Hoàn tác".
  4. Click "Hoàn tác" -> issues revert back to `pending`.
  5. Click with $\le 5$ issues -> executes immediately without modal, shows undo toast.

### Phase 4: Quality Verification
- Run `npm run lint`.
- Run `npm test`.
- Run `npm run build`.

## Complexity Tracking

*No violations. All principles pass cleanly.*
