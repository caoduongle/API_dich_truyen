# Quickstart & Verification Guide: Reading & Editor Theme System

**Feature Directory**: `specs/053-reading-theme-system`
**Date**: 2026-08-22

---

## 1. Automated Verification Commands

```bash
# 1. Typecheck (Must be 100% clean)
npm run lint

# 2. Unit & Integration Tests (vitest)
npm test

# 3. Production Build
npm run build
```

---

## 2. Manual & Visual Testing Scenarios

### Scenario A: Switching Built-in Presets
1. Open the app in browser.
2. In the top navigation header, locate the Theme Switcher button (adjacent to Language Selector).
3. Click to open dropdown:
   - Select **"Sáng (Giấy Ngà)"** -> Entire app shifts to warm ivory paper background (`#F7F2E9`) with dark brown readable text (`#3A2E22`) and cinnabar red accents (`#B8402C`).
   - Select **"Sepia (Giấy Cũ)"** -> Entire app shifts to vintage parchment background (`#F4ECD8`) with deep sepia text (`#5B4636`).
   - Select **"Tối (Mực & Chu Sa)"** -> Returns to original dark aesthetic.
4. Navigate to `BilingualEditor` on an active chapter:
   - Check Chinese source textarea, Raw translation textarea, and Polished translation textarea.
   - All 3 textareas adapt effortlessly.

### Scenario B: Custom Theme Studio with Contrast Warnings
1. In Theme Switcher, select **"Tùy chỉnh..."**.
2. Custom Theme Studio modal opens.
3. Test adjusting colors with native color pickers:
   - Set page background to `#FFFFFF` and text to `#DDDDDD` (low contrast).
   - Observe immediate warning badge: `Độ tương phản thấp: 1.4:1 (Khuyến nghị >= 4.5:1)`.
   - Set text to `#1A1A1A` -> Warning badge disappears (`Đạt chuẩn WCAG AAA: 16.1:1`).
4. Click **"Lưu bảng màu"** -> Custom theme is applied and saved in `localStorage`.

### Scenario C: Persistence & Reload
1. Set theme to **"Sepia"**.
2. Reload browser window (`F5`).
3. Verify that the app immediately renders in Sepia with 0 dark/light flash.
