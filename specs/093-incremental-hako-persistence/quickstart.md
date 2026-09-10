# Quickstart: Incremental Quality Review Session Persistence Validation

**Feature**: `093-incremental-hako-persistence`  
**Date**: 2026-09-10  
**Status**: Ready  

## 1. Overview & Validation Objective

This guide outlines step-by-step verification procedures to ensure that:
1. Review issues and chapter states are saved incrementally after each chapter completes.
2. In-flight cancellation or errors preserve all issues collected up to that moment in IndexedDB with session status set to `'partial'`.
3. The UI presents the review panel and a descriptive notification banner when a session is in `'partial'` status.
4. Normal uninterrupted runs complete with status `'completed'` without regressions.

---

## 2. Automated Test Execution

### 2.1 Run Hook & Session Tests
```powershell
npx vitest run src/hooks/__tests__/useHakoReviewSession.test.ts
```
**Expected Outcome**: All existing tests pass, plus the new test case asserting that an analysis aborted midway (e.g. at Chapter 2 of 3) saves a session with status `'partial'`, non-empty issues containing Chapter 1 findings, and Chapter 1 marked `'done'`.

### 2.2 Quality Gates Audit
```powershell
npm run lint
npm test
npm run build
```
**Expected Outcome**: 0 TypeScript type errors, all unit tests pass (100%), and Vite production build succeeds.

---

## 3. Manual Workspace End-to-End Walkthrough

### Scenario A: Abort Mid-Run (Partial Session Retention)
1. Open the app (`npm run dev`) and navigate to **Kiểm Định Chất Lượng** tab.
2. Select a project that has at least 3 translated chapters.
3. Select 3 chapters (e.g., Chapter 1, Chapter 2, Chapter 3).
4. Click **"Bắt đầu kiểm định"**.
5. Observe progress: Chapter 1 completes heuristic + AI scan.
6. As soon as Chapter 2 starts AI analysis, click **"Hủy phân tích"**.
7. **Verify**:
   - The analysis halts immediately (< 200ms).
   - A warning banner appears: *"Kết quả kiểm định chưa đầy đủ (Đã dừng giữa chừng: 1 / 3 chương đã hoàn tất)..."*.
   - The **HakoIssueReviewPanel** renders beneath the banner, showing all issues detected in Chapter 1.
   - Reload the browser tab: the session reloads from IndexedDB in `'partial'` status with all Chapter 1 issues and Chapter 1 marked `'done'`.

### Scenario B: Full Run Completion (Happy Path)
1. In the same workspace, click **"Đặt lại phiên"** (or select chapters again).
2. Select 2 chapters and click **"Bắt đầu kiểm định"**.
3. Allow both chapters to complete without interruption.
4. **Verify**:
   - Session status transitions to `'completed'`.
   - No partial warning banner is shown.
   - All issues from both chapters appear in the review panel and can be exported as a report.
