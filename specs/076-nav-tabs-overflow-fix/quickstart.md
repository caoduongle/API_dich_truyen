# Quickstart & Verification Guide: Kế Hoạch Toàn Diện — Thanh Điều Hướng Tab Chính

**Feature**: `076-nav-tabs-overflow-fix`
**Date**: 2026-08-27

---

## 1. Local Development Setup

```bash
# Start development server
npm run dev
```
Open browser at `http://localhost:3000`.

---

## 2. Validation Scenarios

### Scenario 1: Chevron Navigation & Smooth Offset Scrolling
1. Resize browser window to ~1280px.
2. Verify that the right Chevron button `>` appears on the right edge along with the gradient fade.
3. Click the right Chevron button `>`:
   - **Expected Result**: Dải tab cuộn mượt mà sang phải 200px. Nút Chevron trái `<` xuất hiện ở mép trái.
4. Click the left Chevron button `<`:
   - **Expected Result**: Dải tab cuộn mượt mà trở lại sang trái.

---

### Scenario 2: Active Tab Auto-Scroll via Hotkeys
1. At 1280px width, press `Alt+6`.
2. **Expected Result**: Tab 6 ("Kiểm Định Hako") tự động cuộn vào giữa khung nhìn, sáng viền active đỏ chu sa.
3. Press `Alt+1`.
4. **Expected Result**: Tab 1 ("Dịch Thuật") tự động cuộn về mép trái.

---

### Scenario 3: Responsive Density (Padding & Kbd Shortcuts)
1. Trên màn hình < 1440px:
   - **Expected Result**: Huy hiệu `Kbd` ẩn đi, nút tab co gọn với padding `px-2.5 sm:px-3 py-1.5 sm:py-2`.
   - Rê chuột vào từng nút tab: Tooltip hiển thị đầy đủ tên và phím tắt (e.g., `Kiểm Định Hako (Alt+6)`).
2. Phóng to màn hình >= 1440px (`2xl:`):
   - **Expected Result**: Huy hiệu `Kbd` hiển thị nổi bật bên cạnh tên tab.

---

### Scenario 4: "More Tabs" Dropdown Menu
1. Click nút "Thêm ▾" / `MoreHorizontal` ở góc phải dải tab.
2. **Expected Result**: Dropdown mở ra hiển thị đầy đủ 6 tab kèm biểu tượng, nhãn tiếng Việt, phím tắt và số lượng badge.
3. Click chọn "Quản Lý Từ Điển":
   - **Expected Result**: Ứng dụng chuyển sang tab Từ Điển, dải tab tự động cuộn đến Tab 3 và dropdown tự đóng.

---

### Scenario 5: Automated Quality Gates
```bash
npm run lint    # Type check MUST pass with 0 errors
npm test        # Vitest suite MUST pass 100%
npm run build   # Production build MUST succeed
```
