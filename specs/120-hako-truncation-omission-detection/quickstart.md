# Quickstart & Verification Guide: Hako Truncation and Omission Detection

**Feature**: `120-hako-truncation-omission-detection`  
**Date**: 2026-09-12  

## 1. Prerequisites
- Node.js 18+ & npm installed.
- Valid Google Gemini API Key configured in AI Settings (for end-to-end AI test, mockable in unit tests).

---

## 2. Automated Test Suite Execution

Run the targeted Vitest test suites:

```bash
# Run Hako Quality Engine unit tests (including new omission guard tests)
npm test src/services/__tests__/hakoQualityEngine.test.ts

# Run Hako UI & Selector tests
npm test src/components/hako-checker/__tests__/HakoChapterSelector.test.tsx
npm test src/components/hako-checker/__tests__/HakoIssueReviewPanel.test.tsx

# Run full project verification
npm run lint
npm test
npm run build
```

---

## 3. Manual Verification Scenarios

### Scenario 1: Modal Auto-Hydrates Raw from Database
1. Open application in browser: `npm run dev`.
2. Go to **Kiểm định Hako** tab.
3. Select a project with translated chapters (e.g. *Đại Phát Thanh Kinh Dị*).
4. Click `+ Thêm Raw` on any chapter that has Chinese source text.
5. **Expected Outcome**:
   - Modal opens with title `Văn bản raw tiếng Trung: #[X] [Title]`.
   - Textarea is **automatically populated** with the Chinese raw text from IndexedDB.
   - Footer displays the actual character count (e.g. `2,450 ký tự`) instead of `"Chưa có dữ liệu"`.
   - Close modal: The button in the list immediately reflects `Đã có Raw`.

### Scenario 2: Truncated Chapter (80 Words) Flags Critical Omission
1. In the chapter list, select Chapter 138 (the truncated chapter with only 80 words).
2. Click **Bắt đầu kiểm định (1 chương)**.
3. **Expected Outcome**:
   - Inspection finishes.
   - Quality report shows at least **1 Critical Error** under category **Bỏ sót nội dung so với raw** (`omission`).
   - The card states that the translation is severely truncated (< 35% of raw or only 80 words).
   - Card includes button **"Mở trong Bàn Dịch để sửa"**.
   - Clicking that button immediately switches to the Translator Workspace with Chapter 138 loaded.

### Scenario 3: Chapter Without Raw But Abnormally Short
1. Select a chapter that has no Chinese raw text (or simulate empty raw), but has only 80 words in Vietnamese.
2. Run inspection.
3. **Expected Outcome**:
   - Heuristic scan flags a **Major** issue warning that the chapter is suspiciously short (< 150 words) for a finished chapter.
