# Research & Technical Decisions: Hako Truncation and Omission Detection

**Feature**: `120-hako-truncation-omission-detection`  
**Date**: 2026-09-12  

## 1. Problem Investigation Summary

### 1.1 Why Did Chapter 138 (80 words) Pass with "Tổng 0 Lỗi"?
1. **Heuristic Scan Blindness**:
   - `runHeuristicQualityScan` only tested 3 regex rules: `raw_leak` (CJK in Vietnamese), `repetition` (identical duplicate paragraphs), and `other` (placeholders like `[chưa dịch]`).
   - It did not receive `rawChineseContent` or check length ratios.
   - It did not check minimum word counts for completed chapters.
2. **Modal & Selector Auto-Load Disconnect**:
   - `useHakoReviewSession.selectProject` only pulled lightweight `ChapterMetadata` (which omits `sourceText`).
   - `HakoChapterSelector`'s modal promised *"Văn bản raw được tự động nạp từ sourceText của dự án"* but never imported `getChapterFromDB` or dispatched an async load. As a result, `rawChineseContent` was always `undefined` ("Chưa có dữ liệu") and the UI showed `+ Thêm Raw`.
3. **AI Scan Schema and Prompt Silently Discarding Omission**:
   - The JSON schema sent to Gemini required `vietnameseSnippet` for all issues (`required: ['category', 'severity', 'vietnameseSnippet', 'explanation']`).
   - If an entire section or chapter is missing, there is no Vietnamese snippet to quote.
   - Line 408 in `hakoQualityEngine.ts` explicitly dropped any item without `vietnameseSnippet` (`if (!item.vietnameseSnippet || !item.explanation) continue;`).
   - Without raw text attached, Gemini was never prompted to check `omission` or compare lengths.

---

## 2. Technical Decisions & Rationale

### Decision 1: Heuristic Length & Paragraph Ratio Guard
- **Decision**: Extend `runHeuristicQualityScan` to accept `rawChineseContent?: string`.
  - When `rawChineseContent` is available (and length > 150 chars):
    - If `vietnameseContent.length < rawChineseContent.length * 0.35`: Emit `category: 'omission'`, `severity: 'critical'`.
    - If `sourceParagraphs >= 3` and `draftParagraphs <= 1` and `vietnameseContent.length < rawChineseContent.length * 0.5`: Emit `category: 'omission'`, `severity: 'critical'`.
  - When `rawChineseContent` is absent/empty:
    - If `vietnameseWords < 150` for a chapter marked `completed`/`polished`: Emit `category: 'omission'`, `severity: 'major'`.
- **Rationale**: Reuses the validated mathematical boundaries from `isDraftTruncated` (Feature 119). Catches 100% of severe omissions in < 1ms deterministically without requiring Gemini calls.
- **Alternatives Considered**:
  - Relying exclusively on Gemini: Rejected because Gemini costs tokens, takes 2-5 seconds per chapter, and can hallucinate or miss structural length cuts.

### Decision 2: Auto-Hydrate `rawChineseContent` from IndexedDB in Raw Edit Modal & Inspection Flow
- **Decision**:
  1. In `HakoChapterSelector.tsx`, import `getChapterFromDB`. When `editingRawChapterId` is set, if `editingChapter.rawChineseContent` is undefined or empty, asynchronously query `getChapterFromDB(editingRawChapterId)`. If `sourceText` is found, update state via `onUpdateRawText` immediately so the textarea populates with the actual raw text and character count.
  2. In `HakoCheckerWorkspace.tsx`, during `handleStartAnalysis`, after resolving `chData.rawChineseContent`, save `rawChineseContent` into `updatedChaptersRecord` so subsequent renders show "Đã có Raw" and the review session retains it.
- **Rationale**: Fulfills the UI statement *"Văn bản raw được tự động nạp từ sourceText của dự án"*, ensures users see the actual Chinese text when clicking the raw button, and ensures bilingual audits have access to raw text.
- **Alternatives Considered**:
  - Loading all 100+ chapters' `sourceText` upfront during `selectProject`: Rejected because loading 100 chapters into memory at once degrades responsiveness for large novels (reverts the gains from Feature 080 virtualization).

### Decision 3: Resilient AI Schema & Omission Fallback
- **Decision**:
  1. Update `runAiQualityScan` system prompt and user prompt to explicitly instruct Gemini to detect chapter completeness and abrupt endings.
  2. In `schema`, do not strictly require `vietnameseSnippet` for `category === 'omission'`.
  3. In `hakoQualityEngine.ts` response parsing:
     ```ts
     for (const item of rawIssues) {
       if (!item.explanation) continue;
       if (!item.vietnameseSnippet && item.category !== 'omission') continue;
       const viSnippet = item.vietnameseSnippet?.trim()
         || (chapter.vietnameseContent.trim().slice(-120) || 'Đoạn kết thúc bản dịch');
     ```
- **Rationale**: Allows omission issues to be processed even when no Vietnamese snippet exists, using the end of the translated draft as the anchor.
- **Alternatives Considered**:
  - Requiring Gemini to always produce a dummy string for `vietnameseSnippet`: Unreliable because Gemini models often omit fields or return null for missing text.

### Decision 4: Leverage Existing Navigation Bridge
- **Decision**: `HakoIssueCard` already has `onOpenInTranslator`. Ensure that when an `omission` issue is selected or displayed, the user can click "Mở trong Bàn Dịch để sửa" to jump straight into the chapter editor.
- **Rationale**: Zero friction for the translator to fix the missing content.
