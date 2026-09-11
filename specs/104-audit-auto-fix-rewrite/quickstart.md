# Quickstart Guide: Auto-Fix and Targeted AI Sentence Rewriting

**Feature**: `104-audit-auto-fix-rewrite`

## Overview

This guide demonstrates how to test and verify the two core capabilities introduced in Feature 104:
1. **One-Click Heuristic Auto-Fix**: Automatically replace offending snippets detected by Hako rules with pre-computed suggestions.
2. **Targeted AI Sentence Rewriting with Preview**: Use Gemini to rewrite awkward or erroneous sentences, inspect the suggested rewording in a side-by-side preview, and confirm or dismiss the change.

---

## Scenario 1: One-Click Heuristic Auto-Fix

### Setup
1. In `UnifiedAuditPanel`, open the audit panel for a chapter with known rule issues (e.g. `raw_leak` like `纵横` with suggestion `tung hoành`).
2. An issue card displays with the label "Có thể sửa nhanh" and a "Sửa ngay" button.

### Execution
1. Click the **"Sửa ngay"** button on the issue card.
2. Observe that:
   - The word `纵横` in the translation editor is instantly replaced with `tung hoành`.
   - The editor's CRDT document synchronizes the change in real time.
   - The issue card displays a green **"Đã sửa"** badge and dims slightly.
   - A success toast notification confirms: `"Đã áp dụng sửa lỗi thành công."`
   - The pending issue counter decrements.

### Negative / Drift Test
1. Edit or delete the target snippet in the textarea manually.
2. Click **"Sửa ngay"** on an issue referencing the now-deleted text.
3. Observe that:
   - No changes are made to the translation text.
   - A warning notification alerts: `"Nội dung đã thay đổi, không thể áp dụng sửa nhanh, vui lòng chạy lại kiểm định."`

---

## Scenario 2: Targeted AI Sentence Rewriting

### Setup
1. Run AI QA Critique or inspect an existing AI critique issue card that contains `targetText`.
2. Notice the **"Nhờ AI viết lại câu này"** action button.

### Execution
1. Click **"Nhờ AI viết lại câu này"**.
2. Observe the inline spinner with `"Đang viết lại..."`.
3. Only the target sentence, local context, and issue instruction are transmitted to the Gemini API (not the whole chapter).
4. Once the response arrives:
   - A distinct emerald preview box appears below the issue description showing the AI's rephrased suggestion.
   - Two action buttons are presented: **"Áp dụng"** and **"Hủy"**.
5. Click **"Áp dụng"**:
   - The target sentence is replaced with the new wording in the active translation textarea.
   - The preview box closes.
   - The issue card marks as **"Đã sửa"**.
6. Alternatively, click **"Hủy"**:
   - The preview box closes without altering any editor content.

---

## Automated Verification

Run all test suites to confirm full regression coverage:

```bash
# Type check
npm run lint

# Unit and integration test suites
npm test

# Production build validation
npm run build
```
