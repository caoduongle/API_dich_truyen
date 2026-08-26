# Quickstart & Verification Guide: Nav Tabs Overflow & Visibility

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

### Scenario 1: Tab 6 Visibility via Keyboard Shortcut (Alt+6)
1. Resize browser window to ~1280px or 1024px (standard laptop width).
2. Observe that Tab 6 ("Kiểm Định Hako") might be partially offscreen.
3. Press `Alt+6` on the keyboard.
4. **Expected Result**: The tab strip automatically and smoothly scrolls to the right, bringing Tab 6 into full view with active highlight (`border-polish text-text-main bg-parchment-2/40`).
5. Press `Alt+1`.
6. **Expected Result**: The tab strip automatically scrolls back to the left, showing Tab 1.

---

### Scenario 2: Visual Overflow Fade Indicators
1. At 1280px width, observe the right edge of the tab strip.
2. **Expected Result**: A subtle, elegant fade gradient (`from-parchment to-transparent`) indicates more tabs are available to the right.
3. Scroll or navigate to Tab 6.
4. **Expected Result**: The left edge now displays the fade gradient, while the right edge fade disappears because the end of the list is reached.
5. Maximize window on a wide monitor (>1600px).
6. **Expected Result**: Both left and right fade overlays disappear completely since all 6 tabs fit naturally.

---

### Scenario 3: Isolated Active Project Indicator
1. Open a story project with a long title (e.g., "Đấu Phá Thương Khung Chi Vô Thượng Cảnh Giới").
2. Check the right side of the tab bar.
3. **Expected Result**: The project title is displayed cleanly, truncated with an ellipsis if needed, and separated by a subtle border, never overlapping or being scrolled away with the tab list.

---

### Scenario 4: Automated Quality Gates
```bash
npm run lint    # Type check MUST pass with 0 errors
npm test        # Vitest suite MUST pass 100%
npm run build   # Production build MUST succeed
```
