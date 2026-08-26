# Quickstart Validation Guide: Decouple Quality Review Session & JIT Content Loading

**Feature**: `077-decouple-hako-session`
**Date**: 2026-08-27
**Status**: Ready

## 1. Automated Verification Scenarios

### 1.1 Type Safety & Static Analysis
Run the TypeScript compiler to ensure strict typing across all touched files without errors:
```bash
npm run lint
```
*Expected Outcome*: Clean exit code 0, no type discrepancies with `HakoChapterMeta` or `ProjectReviewChapter`.

### 1.2 Unit Tests Execution
Run Vitest to verify the session hook, store sanitization, and quality engine behavior:
```bash
npx vitest run src/hooks/__tests__/useHakoReviewSession.test.ts src/services/__tests__/hakoQualityEngine.test.ts
```
*Expected Outcome*: All test suites pass cleanly.

### 1.3 Production Build Verification
Verify that the production bundle compiles successfully:
```bash
npm run build
```
*Expected Outcome*: Vite and esbuild build without warnings or bundle errors.

---

## 2. Manual & End-to-End Scenarios

### 2.1 Large Project Chapter Selection & Responsiveness
1. Start local dev server: `npm run dev`.
2. Navigate to the **Hako Checker** tab.
3. Select a project with 100+ chapters from the dropdown.
   - **Verification**: The project header and chapter list render instantly in $< 50\text{ms}$.
4. Rapidly click 10 checkboxes within 1 second.
   - **Verification**: Every checkbox toggles instantaneously without frame drop, freezing, or tab lag.
5. Click **"Bỏ chọn tất cả"** and **"Chọn nhanh 12 chương đầu"**.
   - **Verification**: Batch selection toggles immediately to 12 items.

### 2.2 Just-In-Time (JIT) Quality Analysis
1. Select 5 translated chapters in the list.
2. Click **"Bắt đầu kiểm định"**.
   - **Verification**: A brief progress indicator displays ("Đang quét quy tắc nhanh..."), then executes the scan.
3. Inspect DevTools -> Application -> IndexedDB -> `HakoQualityCheckerDB` -> `hako_quality_sessions`.
   - **Verification**: The stored session record size is under 30 KB and does NOT contain `vietnameseContent` strings in any chapter item.
