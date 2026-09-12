# Quickstart & Validation Guide: Batch Draft Actions and Contrast Hardening

## Prerequisites
- Node.js 18+
- Project dependencies installed (`npm install`)

## Automated Quality Gate Verification
```bash
# 1. Type check
npm run lint

# 2. Automated test suite
npm test

# 3. Production build
npm run build
```

## Manual Validation Scenarios

### Scenario 1: Batch Actions in Chapter Selection Sidebar
1. Open the app in browser (`npm run dev`).
2. Navigate to the **Lịch Sử Chương Dịch** (Chapter History) tab.
3. Check the "Chọn tất cả" checkbox (or select 3+ chapters).
4. Verify the batch action toolbar renders cleanly below the header title with 4 buttons:
   - `Reset (N)`
   - `Xóa biên tập (N)`
   - `Xóa bản thô (N)`
   - `Thành bản thô (N)`
5. Click **"Xóa biên tập (N)"**:
   - Verify the confirmation modal appears.
   - Click "Xác nhận xóa":
   - Verify a toast appears confirming deletion of polished drafts.
   - Verify chapters with polished drafts now have only raw translations (`in_progress`).

### Scenario 2: Light Mode & Sepia Mode Contrast Hardening
1. Switch the application theme to **Light** mode (or **Sepia** mode).
2. Inspect all action buttons in the Chapter History panel:
   - "Reset về bản gốc" / "Reset (N)"
   - "Xóa bản biên tập" / "Xóa biên tập (N)"
   - "Xóa bản dịch thô" / "Xóa bản thô (N)"
   - "Chuyển thành bản thô" / "Thành bản thô (N)"
3. Verify that text is crisp, dark amber/ochre (`#92400e`), easily readable with high contrast against the cream/parchment background.
4. Verify zero pale yellow (`#fcd34d`) text on light surfaces.
5. Switch to **Dark** mode:
   - Verify the text gracefully transitions to warm golden amber (`#fcd34d`), maintaining high contrast on dark ink.
