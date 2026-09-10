# Contract: Batch Action Confirmation & Undo Guard

**Feature**: `097-batch-action-confirmation-undo`  
**Date**: 2026-09-10  
**Status**: Active

## 1. Threshold Invariant

```typescript
const BATCH_CONFIRM_THRESHOLD = 5;
```

- **Invariant 1**: Any batch action where `targetPendingIds.length > BATCH_CONFIRM_THRESHOLD` MUST NOT invoke `onBatchDecisionChange` or `onDecisionChange` synchronously upon clicking the batch trigger.
- **Invariant 2**: The batch action must be staged in component state (`confirmBatch`) until the user explicitly confirms via the modal.
- **Invariant 3**: Any batch action where `targetPendingIds.length <= BATCH_CONFIRM_THRESHOLD` MUST execute immediately without presenting the modal.

---

## 2. Confirmation Modal Contract

- **Component**: `<Modal>` from `../ui/Modal`
- **Props**:
  - `open`: boolean (`confirmBatch !== null`)
  - `onClose`: `() => setConfirmBatch(null)`
  - `title`: `"Xác nhận thao tác hàng loạt"`
  - `size`: `"sm"`
  - `showCloseButton`: `true`
  - `closeOnBackdropClick`: `true`
  - `closeOnEscape`: `true`
- **Body Content**:
  - For confirm: `"Bạn sắp duyệt " + count + " lỗi. Tiếp tục?"`
  - For dismiss: `"Bạn sắp bỏ qua " + count + " lỗi. Tiếp tục?"`
- **Footer Buttons**:
  - Cancel button: `<Button variant="secondary" size="sm" onClick={() => setConfirmBatch(null)}>Hủy</Button>`
  - Confirm button: `<Button variant="primary" size="sm" onClick={handleProceed}>Xác nhận</Button>`

---

## 3. Undo Toast Contract

- **Provider**: `useNotifications().showToast`
- **Toast Payload**:
  - `message`: `"Đã duyệt " + count + " lỗi."` (hoặc `"Đã bỏ qua " + count + " lỗi."`)
  - `type`: `'success'`
  - `duration`: `7000` (7 seconds)
  - `undoLabel`: `"Hoàn tác"`
  - `onUndo`: Reverts the exact array of mutated `ids` back to `'pending'`:
    ```typescript
    onUndo: () => {
      if (onBatchDecisionChange) {
        onBatchDecisionChange(targetIds, 'pending');
      } else {
        targetIds.forEach((id) => onDecisionChange(id, 'pending'));
      }
    }
    ```
- **Post-conditions**:
  - Clicking "Hoàn tác" restores all target issues to `'pending'`.
  - Toast is automatically closed upon clicking "Hoàn tác".
  - If 7 seconds expire without clicking "Hoàn tác", toast closes and the undo opportunity ends.
