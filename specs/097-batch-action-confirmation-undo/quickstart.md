# Quickstart & Verification Guide: Batch Action Confirmation & Undo Guard

**Feature**: `097-batch-action-confirmation-undo`  
**Date**: 2026-09-10

## 1. Automated Verification (Unit Tests)

Run the dedicated test suite:
```bash
npm test -- src/components/hako-checker/__tests__/HakoIssueReviewPanel.test.tsx
```

Expected output:
- Test 1: Batch confirm with 10 pending issues displays confirmation modal "Bạn sắp duyệt 10 lỗi. Tiếp tục?".
- Test 2: Clicking "Hủy" in modal closes modal and leaves all 10 issues as pending (no batch call dispatched).
- Test 3: Clicking "Xác nhận" in modal closes modal, updates all 10 issues to confirmed, and displays the undo toast.
- Test 4: Clicking "Hoàn tác" in the toast calls `onBatchDecisionChange` with decision `'pending'`, reverting all 10 issues.
- Test 5: Batch action with 3 pending issues ($\le 5$) executes immediately without confirmation modal and shows undo toast.

---

## 2. Quality Gates Check

Run project standard quality commands:
```bash
npm run lint    # tsc --noEmit — must pass with 0 errors
npm test        # vitest run — all 56+ test files must pass
npm run build   # tsc && vite build — production bundle build must succeed
```

---

## 3. Manual Browser Verification

1. Start development server:
   ```bash
   npm run dev
   ```
2. Navigate to "Kiểm Định Chất Lượng Hako" tab (`/hako-checker` or `Alt+6`).
3. Select chapters that generate $> 5$ issues (e.g. 10–15 issues).
4. Click "Duyệt nhanh tất cả":
   - Verify modal opens: "Bạn sắp duyệt N lỗi. Tiếp tục?".
   - Click outside or click "Hủy": verify nothing changes.
   - Click "Duyệt nhanh tất cả" again, click "Xác nhận": verify issues turn confirmed, modal closes, toast appears in bottom-right with "Hoàn tác".
   - Click "Hoàn tác": verify issues turn back to pending.
