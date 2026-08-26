# Quickstart Validation Guide: Hako Checker Chapter Virtualization

## Purpose
This document provides end-to-end steps to validate that chapter virtualization and storage optimizations perform reliably without crashing, memory spikes, or render blocking.

---

## Prerequisites
- Node.js & npm installed
- Development server running on `http://localhost:3000`

---

## 1. Automated Verification Suite
Run the standard test and build commands from repo root:

```bash
# 1. Type-checking
npm run lint

# 2. Vitest unit and integration test suite
npm test

# 3. Production bundle build
npm run build
```

**Expected Outcome**: All commands exit with code 0 without type errors or broken tests.

---

## 2. Interactive Browser Verification (Large Project 139+ Chapters)

### Step 1: Launch Dev Environment
```bash
npm run dev
```
Open `http://localhost:3000` in Google Chrome with DevTools Console and Memory tabs open.

### Step 2: Select Long Novel Project
1. Navigate to the **"Kiểm Định Hako"** tab (Alt+6).
2. Select the **"Lãnh Chúa (139 chương)"** project from the dropdown.

### Step 3: Scroll & Selection Test
1. Scroll down quickly to the bottom of the chapter selector (#120 - #139).
2. Rapidly click 5 checkboxes (e.g. #132, #134, #135, #136, #138).

**Expected Outcome**:
- Checkbox feedback is instantaneous (<16ms, 60fps).
- Main thread does not block.
- Total DOM nodes rendered inside chapter list is <50 elements.
- Counter reads `Đã chọn: 5 / 12`.
- Zero console exceptions (`TypeError`, `Maximum update depth exceeded`, `DataCloneError`).

### Step 4: Storage Inspection
1. Open DevTools -> **Application** -> **Storage** -> **IndexedDB** -> **`HakoQualityCheckerDB`**.
2. Select `hako_quality_sessions`.
3. Verify that the recorded session holds `selectedChapterIds` with the chosen 5 IDs and that records are cleanly sanitized (<30KB).
