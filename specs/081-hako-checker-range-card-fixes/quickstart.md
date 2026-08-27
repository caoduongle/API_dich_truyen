# Quickstart Guide: Hako Quality Checker Selection UX, Card Numbering & Error Visibility

**Feature**: Hako Quality Checker Selection UX, Card Numbering & Error Visibility  
**Feature Directory**: `specs/081-hako-checker-range-card-fixes`  
**Date**: 2026-08-27

---

## 1. Prerequisites & Automated Quality Gates

Before and after applying changes, verify that the environment is fully clean:

```bash
# 1. Type check
npm run lint

# 2. Run test suite
npm test

# 3. Build verification
npm run build
```

---

## 2. Manual Verification Workflow

### Test Scenario 1: Range-Based Chapter Selection & Limit Enforcement

1. Start development server:
   ```bash
   npm run dev
   ```
2. Navigate to `http://localhost:5173` (or active Vite port) and switch to the **"Kiểm Định Hako"** tab.
3. Select a project containing >20 translated chapters (e.g., a project with 139 chapters).
4. Locate the range controls ("Từ chương" and "Đến chương"):
   - Enter `120` in "Từ chương" and `131` in "Đến chương".
   - Click **"Chọn khoảng"**.
   - **Verification**: Exactly 12 chapters (#120 to #131) are highlighted and selected.
5. Inverted Range Test:
   - Clear selection ("Bỏ chọn tất cả").
   - Enter `131` in "Từ chương" and `120` in "Đến chương".
   - Click **"Chọn khoảng"**.
   - **Verification**: Chapters #120 to #131 are selected without error.
6. Limit Exceeded Test:
   - Enter `100` in "Từ chương" and `130` in "Đến chương" (31 chapters).
   - Click **"Chọn khoảng"**.
   - **Verification**: Selection is capped at the first 12 eligible chapters (#100 to #111), and a prominent warning banner appears stating: `"Đã tự động giới hạn 12 chương đầu tiên theo quy định tối đa mỗi lượt rà soát."`

---

### Test Scenario 2: Single Chapter Quick-Select & Missing Chapter Feedback

1. In the "Nhập số chương" input:
   - Type `134` and press **Enter** (or click "Chọn").
   - **Verification**: Chapter #134 is immediately toggled into selection. The input field resets to empty.
2. Type `135` and press **Enter**.
   - **Verification**: Chapter #135 is added to selection immediately.
3. Non-existent Chapter Test:
   - Type `9999` and press **Enter**.
   - **Verification**: An inline warning appears in amber text (`"Không tìm thấy chương #9999"`), and automatically fades away after 2–3 seconds without console errors.

---

### Test Scenario 3: Chapter Number Display on Issue Cards & Report Export

1. With chapters selected (e.g., #134), click **"Bắt đầu kiểm định"**.
2. Once heuristic/AI analysis completes and issue cards render:
   - **Verification**: Every issue card displays `#<chapterNumber> · <chapterTitle>` in its header (e.g., `#134 · 第一百三十四章 装逼`).
   - Hover over the title to verify full tooltip text.
3. Click **"Xuất báo cáo chất lượng"** and inspect the Markdown preview:
   - **Verification**: Chapter sections are ordered numerically and formatted as `### Chương #134 — 第一百三十四章 装逼`.

---

### Test Scenario 4: Error Banner Dismissal

1. When a limit warning or session error banner is displayed:
   - Click the **"x"** button on the top-right of the error banner.
   - **Verification**: `setError(null)` is triggered and the banner immediately disappears.
