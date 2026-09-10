# Quickstart & Verification Guide: Unified Audit Panel

**Feature Branch**: `102-unified-audit-panel`  
**Date**: 2026-09-10  
**Status**: Ready

---

## 1. Prerequisites

- Node.js 20+ installed
- Dependencies installed (`npm install`)

---

## 2. Validation Steps

### Step 1: Verify Zero References to QaCritiquePanel
Ensure `QaCritiquePanel` has been removed completely and no references remain in the repository:
```bash
git status --short
# Verify QaCritiquePanel.tsx is deleted
git grep "QaCritiquePanel" src/
# MUST return 0 results
```

### Step 2: Run Type Checking
Ensure TypeScript compiles cleanly with zero diagnostic errors:
```bash
npm run lint
```
**Expected Outcome**: Code exits with 0.

### Step 3: Run Targeted Unit Tests
Run unit tests verifying the rendering, filtering, action triggers, and states of `UnifiedAuditPanel`:
```bash
npx vitest run src/components/translator-workspace/__tests__/UnifiedAuditPanel.test.tsx
```
**Expected Outcome**: All unit tests pass cleanly.

### Step 4: Run Full Test Suite
Ensure no regressions across the entire project test suite:
```bash
npm test
```
**Expected Outcome**: 59+ test files pass, 375+ tests pass.

### Step 5: Run Production Build
Ensure Vite bundles the frontend and esbuild compiles the server without errors:
```bash
npm run build
```
**Expected Outcome**: Build exits with 0.

---

## 3. Visual Verification Scenarios

### Scenario A: Empty State
1. Open Translator Workspace on a clean chapter.
2. Observe `UnifiedAuditPanel`:
   - Counter shows 0 issues.
   - `<EmptyState>` is displayed: "Không có vấn đề cần xử lý".
   - CTA button "Chạy AI Thẩm định" is present.

### Scenario B: Loading State
1. Click "Chạy AI Thẩm định".
2. Observe `UnifiedAuditPanel`:
   - Button is disabled with spinner.
   - 2-3 `<Skeleton>` cards pulse in the issue list.

### Scenario C: Populated & Filtered State
1. Both Hako heuristic errors (e.g. Chinese characters leak) and AI QA Critique issues appear in the panel.
2. Click "Quy chuẩn Hako": Only Hako issues are displayed.
3. Click "Góp ý AI": Only AI issues are displayed.
4. Click "Chưa xử lý": Only pending issues are displayed.
5. Click an issue card: Fires `onIssueClick(issue)`.

### Scenario D: Error State
1. Trigger AI critique when network fails or API quota is exhausted.
2. Error banner renders with specific message and "Thử lại" button.
3. Clicking "Thử lại" re-invokes `onRunAiQaCritique`.
