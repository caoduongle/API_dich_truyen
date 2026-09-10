# Research: Batch Action Confirmation Guard & Undo Capability

**Feature**: `097-batch-action-confirmation-undo`  
**Date**: 2026-09-10  
**Status**: Completed

## 1. Confirmation Modal Pattern

### Context & Need
"Duyệt nhanh tất cả" (Confirm All) and "Bỏ qua tất cả" (Dismiss All) modify large numbers of issues simultaneously. When reviewing 12 chapters, this may affect 30–50+ issues. An accidental misclick can overwrite triage decisions across the entire session. An explicit confirmation dialog is required when $> 5$ issues are affected.

### Findings & Analysis
- **Existing `src/components/ui/Modal.tsx`**:
  - The repository already has a standardized, accessible modal primitive (`Modal.tsx`) built according to the "Mực & Chu Sa" design system.
  - Features: z-index `z-50`, backdrop blur, focus trap, Escape key handling, backdrop click dismiss, scroll locking, and standard header/body/footer slots.
  - Used in `HakoReportExportModal.tsx`, `CustomThemeModal.tsx`, etc.
- **Alternatives Considered**:
  - *Browser `window.confirm()`*: Rejected because it blocks the UI thread, has inconsistent platform styling, does not fit "Mực & Chu Sa" aesthetic, and is difficult to test reliably in jsdom.
  - *`useNotifications().showConfirm()`*: While `showConfirm` is present in `NotificationSystem.tsx`, rendering an explicit `<Modal>` component in `HakoIssueReviewPanel.tsx` is completely self-contained within the component tree, facilitates precise unit test assertions on modal open/close in isolated tests, and directly adheres to the user prompt ("xem cách HakoReportExportModal.tsx").
- **Decision**: Use `<Modal>` from `../ui/Modal` with local state `confirmBatch: { action: 'confirmed' | 'dismissed', ids: string[] } | null`. When confirmed, proceed with execution; when canceled/closed, reset state to `null` with zero side effects.

---

## 2. Temporary Toast Notification & Undo Pattern

### Context & Need
After executing a batch decision, users need a brief window (6–8 seconds) to revert the action if it was executed accidentally or on the wrong filtered tab. Reverting must restore all targeted issue IDs to their previous `'pending'` status.

### Findings & Analysis
- **Existing `src/components/NotificationSystem.tsx`**:
  - Provides `useNotifications()` hook with `showToast(options: ToastOptions | string)`.
  - `ToastOptions` directly supports:
    ```typescript
    export interface ToastOptions {
      message: string;
      type?: ToastType; // 'success' | 'warning' | 'info' | 'error'
      duration?: number; // ms
      onUndo?: () => void | Promise<void>;
      undoLabel?: string;
    }
    ```
  - When `onUndo` is provided, `NotificationSystem` renders a floating toast (`z-[60]`) with a progress countdown bar and an "Hoàn tác" button with the `RotateCcw` icon.
  - Clicking "Hoàn tác" calls `onUndo()` and immediately dismisses the toast.
  - If unclicked, the toast automatically dismisses after `duration` (configured to 7000ms, satisfying the 6–8s requirement), expiring the undo opportunity cleanly without unbounded memory leaks.
- **Decision**: Reuse `useNotifications().showToast` with `duration: 7000`, `type: 'success'`, and `onUndo: () => revertBatch(ids)`.

---

## 3. Threshold Constant & Invariants

### Context & Need
The prompt specifies: "nếu số lượng issue bị ảnh hưởng > 5, hiện 1 hộp thoại xác nhận đơn giản".

### Decision & Rationale
- Define `const BATCH_CONFIRM_THRESHOLD = 5;`.
- When `pendingIds.length > BATCH_CONFIRM_THRESHOLD` ($N \ge 6$):
  - Intercept action, open `<Modal>`.
  - On confirm: dispatch batch mutation, open undo toast.
- When `pendingIds.length <= BATCH_CONFIRM_THRESHOLD` ($1 \le N \le 5$):
  - Skip `<Modal>` to avoid notification fatigue for tiny batches.
  - Dispatch batch mutation immediately.
  - Still open undo toast so the user retains safety even on smaller batches.
- When `pendingIds.length === 0`:
  - No-op (buttons are disabled or hidden).

---

## 4. Single-Write Batch Reversal Integration

### Context & Need
Reverting an undo action must not introduce multiple redundant writes or connection churn.

### Decision & Rationale
- Prompt A3 (Feature 095) introduced `updateMultipleIssueDecisions(issueIds, decision)` in `useHakoReviewSession.ts` and wired `onBatchDecisionChange` into `HakoIssueReviewPanel.tsx`.
- The undo action will call `onBatchDecisionChange(targetIds, 'pending')`, restoring all affected IDs to `'pending'` in a single atomic IndexedDB write.
- Fallback: if `onBatchDecisionChange` is undefined, fallback to `targetIds.forEach(id => onDecisionChange(id, 'pending'))`.
