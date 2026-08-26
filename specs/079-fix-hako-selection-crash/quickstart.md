# Quickstart: Validating Hako Chapter Selection Runtime Resilience

**Feature Branch**: `079-fix-hako-selection-crash`
**Date**: 2026-08-27
**Spec**: [spec.md](./spec.md)

## Automated Verification Workflow

### 1. Type Safety Check
Verify all components, hooks, and types compile cleanly with zero TypeScript errors:
```bash
npm run lint
```

### 2. Unit & Integration Test Suite
Run the test suite including session store, chapter selection, and hook tests:
```bash
npx vitest run src/hooks/__tests__/useHakoReviewSession.test.ts
npm test
```

### 3. Production Build Validation
Verify Vite production bundle builds successfully:
```bash
npm run build
```

---

## Manual Verification Scenarios

### Scenario 1: Long Chapter List Bottom Scrolling & Selection (#118 - #127)
1. Open the application (`npm run dev`).
2. Go to the **Kiểm Định Hako** tab (`Alt+6`).
3. Select a project with over 100 chapters (e.g. 139 chapters).
4. Scroll down to the bottom of the list.
5. Click checkboxes on chapters #118, #119, #120, through #127.
6. **Expected Outcome**:
   - The UI updates instantly (<50ms).
   - "Đã chọn: X / 12" counter increments accurately.
   - No console errors, no unhandled exceptions, and no white screen crash.

---

### Scenario 2: Quick-Selection & Maximum Limit Enforcement
1. With a long project loaded, click **"Chọn nhanh 12 chương đầu"**.
2. Verify that exactly 12 chapters are selected.
3. Try clicking a 13th chapter (e.g., #13).
4. **Expected Outcome**:
   - The warning banner displays: *"Mỗi lượt rà soát chỉ được chọn tối đa 12 chương để đảm bảo tốc độ và tránh quá tải."*
   - Selection count remains capped at 12/12 without exceptions.

---

### Scenario 3: Deselection & Clear All Operations
1. With 12 chapters selected, click **"Bỏ chọn tất cả"**.
2. **Expected Outcome**:
   - All checkboxes reset to unchecked.
   - Counter resets to `Đã chọn: 0 / 12`.
   - Workspace state resets cleanly.

---

### Scenario 4: Error Boundary Resilience
1. If an unexpected runtime anomaly is encountered, verify the localized error banner displays:
   *"Đã xảy ra lỗi tại phân vùng này"* or *"Lỗi phân vùng: Kiểm Định Hako"*.
2. Click **"Khôi phục phân vùng"**.
3. Verify the main app header and other tabs (Dịch, Từ điển, Lịch sử, Dự án) remain fully operational without full page reload.
