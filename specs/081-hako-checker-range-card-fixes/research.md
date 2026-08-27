# Technical Research & Architecture Decisions

**Feature**: Hako Quality Checker Selection UX, Card Numbering & Error Visibility  
**Feature Directory**: `specs/081-hako-checker-range-card-fixes`  
**Date**: 2026-08-27

---

## 1. Chapter Number Propagation in Quality Issue Pipeline

### Problem
Currently, `QualityIssue` in `src/types/hakoChecker.ts` only retains `chapterId` and `chapterTitle`. In `HakoIssueCard.tsx`, the card header displays only `issue.chapterTitle` (e.g., "第一百三十四章 装逼"). For reviewers managing dozens of chapters or novels with non-descriptive titles, the numeric sequence is lost.

### Decision
1. Augment `QualityIssue` interface in `src/types/hakoChecker.ts` with:
   ```typescript
   export interface QualityIssue {
     id: string;
     chapterId: string;
     chapterTitle: string;
     chapterNumber: number; // Added field
     category: QualityIssueCategory;
     severity: QualityIssueSeverity;
     vietnameseSnippet: string;
     rawSnippet?: string;
     explanation: string;
     suggestedFix?: string;
     decision: QualityIssueDecision;
     moderatorNote?: string;
     detectedBy: 'heuristic' | 'ai';
     createdAt: string;
   }
   ```
2. In `src/services/hakoQualityEngine.ts`:
   - Extend `runHeuristicQualityScan` input signature to include `chapterNumber: number`.
   - Extend `runAiQualityScan` chapter input interface to include `chapterNumber: number`.
   - At all 5 `QualityIssue` creation points in `hakoQualityEngine.ts`, pass `chapterNumber: chapter.chapterNumber`.
3. In `src/components/hako-checker/HakoCheckerWorkspace.tsx`:
   - In `handleStartAnalysis`, pass `chapterNumber: chData.chapterNumber` to `runHeuristicQualityScan`.
   - In `validChaptersForAi`, pass `chapterNumber: ch.chapterNumber` to `runAiQualityScan`.
4. In `src/components/hako-checker/HakoIssueCard.tsx`:
   - Replace bare title span with `#<chapterNumber> · <chapterTitle>` format:
   ```tsx
   <span
     className="text-[11px] text-text-muted font-medium truncate max-w-[220px]"
     title={`#${issue.chapterNumber} · ${issue.chapterTitle}`}
   >
     <span className="font-mono font-bold text-polish">#{issue.chapterNumber}</span>
     {' · '}
     {issue.chapterTitle}
   </span>
   ```
5. In Markdown Report Generation (`generateQualityReport` in `hakoQualityEngine.ts`):
   - Sort grouped chapters by `chapterNumber` ascending.
   - Format section header as `### Chương #{chapterNumber} — {chapterTitle}`.

---

## 2. Range-Based Fast Chapter Selection

### Problem
Selecting chapters for analysis currently requires individual checkbox clicks. When a moderator wants to inspect chapters 120 through 131 of a 140-chapter novel, 12 separate manual clicks are required.

### Decision
Add a range selection control inside `HakoChapterSelector.tsx`:
1. Inputs: "Từ chương" (`fromChapter`) and "Đến chương" (`toChapter`) of `type="number"`.
2. Button: "Chọn khoảng" using `<Button variant="outline" size="sm">`.
3. Range Logic:
   - Parse inputs: `const fromNum = parseInt(fromChapter, 10); const toNum = parseInt(toChapter, 10);`
   - Handle reversed inputs gracefully by auto-swapping `[minNum, maxNum]`.
   - Filter `chapterList`:
     ```typescript
     const matched = chapterList.filter((ch, idx) => {
       const num = ch.chapterNumber ?? (idx + 1);
       return num >= minNum && num <= maxNum && ch.translationType !== 'none';
     });
     const idsToSelect = matched.map((ch, idx) => String(ch.chapterId || (ch as any).id || `chap-${idx}`));
     onSelectRange(idsToSelect);
     ```
   - Limit enforcement: Handled centrally by `useHakoReviewSession.selectChapterRange`, which truncates to `MAX_CHAPTERS_LIMIT` (12) and sets `CHAPTER_LIMIT_EXCEEDED` error message.

---

## 3. Quick Single Chapter Selection by Number

### Problem
Moderators often spot a specific chapter number in translator notes or reader comments (e.g., chapter 134) and want to quickly add it without searching through the list.

### Decision
Add a single-number quick select input inside `HakoChapterSelector.tsx`:
1. Input: `type="number"` with placeholder "Nhập số chương..." and `onKeyDown` checking `e.key === 'Enter'`.
2. Button: "Chọn" button next to the input.
3. Behavior:
   - On submit, lookup `chapterList.find((ch, idx) => (ch.chapterNumber ?? (idx + 1)) === enteredNum)`.
   - If found and `translationType !== 'none'`:
     - Calls `onToggleChapter(chapterIdStr)`.
     - Clears the input field so users can type additional chapter numbers in rapid succession ("134 [Enter], 135 [Enter]").
   - If not found:
     - Sets local state `notFoundMessage` = `"Không tìm thấy chương #${enteredNum}"`.
     - Displays transient warning text (`text-[11px] text-amber-400 font-medium`).
     - Auto-clears warning message after 2.5 seconds via `setTimeout`.
   - If untranslated:
     - Sets local warning `"Chương #${enteredNum} chưa có bản dịch"`.

---

## 4. Session Error & Warning Visibility

### Problem
`useHakoReviewSession` returns `{ error, setError }`, setting errors when selecting >12 chapters or selecting untranslated chapters. However, `HakoCheckerWorkspace.tsx` did not destructure `error`, so errors were completely invisible to users.

### Decision
1. Destructure `error` from `useHakoReviewSession()` in `HakoCheckerWorkspace.tsx`.
2. Render a styled, dismissible warning banner when `error !== null`:
   - Positioned above `HakoChapterSelector`.
   - Amber/warning color tone with `AlertTriangle` icon and close ("x") button.
   - Clicking "x" invokes `setError(null)`.
   - Automatically unmounts when `error === null`.

---

## 5. Architectural & Design System Consistency

- **Design System**: All added elements adhere to `.agents/rules/design-system.md`:
  - Input styling matches `<select>` in `HakoChapterSelector.tsx` (`bg-ink border border-parchment-2 rounded-md px-2.5 py-1 text-xs font-serif text-text-main focus:outline-none focus:border-polish`).
  - Buttons use `<Button variant="outline" size="sm">` and `<Button variant="secondary" size="sm">`.
  - Number labels use `font-mono font-bold text-polish`.
- **Zero New Dependencies**: Reuses existing `lucide-react` icons (`Hash`, `AlertTriangle`, `X`, `Check`), `clsx`, `tailwind-merge`.
- **Quality Gates**: Preserves strict typing across `QualityIssue` and ensures 100% test pass rate with new unit tests for numbering and range selection.
