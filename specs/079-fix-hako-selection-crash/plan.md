# Implementation Plan: Fix Hako Chapter Selection Runtime Crash

**Branch**: `079-fix-hako-selection-crash` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/079-fix-hako-selection-crash/spec.md`

## Summary

Fix the unhandled JavaScript runtime error (`TypeError: Cannot read properties of undefined`) that causes a blank screen crash (DOM tree unmount) when moderators scroll down and select late-stage chapters (e.g. #118 - #127) in long novel projects:
1. **Universal Chapter ID Normalization**: Enforce string coercion (`String(id)`) across `useHakoReviewSession`, `HakoChapterSelector`, and `HakoCheckerWorkspace` to prevent `===` mismatch between numeric and string IDs.
2. **Defensive Bounds & Safe Rendering**: Add row-level guard clauses (`if (!ch) return null;`), fallback labels (`ch.title || 'Chương không có tiêu đề'`), fallback chapter numbers (`ch.chapterNumber ?? index + 1`), and stable keys in `HakoChapterSelector.tsx`.
3. **Safe Aggregations & Array Filtering**: Ensure `selectedChapters` and `totalSelectedWords` calculations in `HakoCheckerWorkspace.tsx` use `.filter(Boolean)` and safe optional chaining to guard against missing/stale metadata.
4. **Asynchronous Non-blocking Persistence**: Decouple immediate UI state updates from background IndexedDB persistence in `useHakoReviewSession.ts` to prevent UI thread blocking or render-cycle deadlocks.
5. **Localized Error Boundary Containment**: Wrap workspace components in an localized `ErrorBoundary` to catch any unhandled rendering exceptions and provide in-place recovery controls.
6. **Comprehensive Unit Tests**: Add tests for ID normalization (numeric vs string), sparse array handling, boundary selection, and aggregate word count calculation in `src/hooks/__tests__/useHakoReviewSession.test.ts`.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19
**Primary Dependencies**: Tailwind CSS v4, Lucide React icons, existing project primitives (`Button`, `Badge`, `Seal`, `EmptyState`)
**Storage**: IndexedDB (`HakoQualityCheckerDB`) via `hakoSessionStore.ts`
**Testing**: Vitest (`npx vitest run`) + TypeScript compiler (`tsc --noEmit`)
**Target Platform**: Modern Web Browsers (Chrome, Edge, Firefox, Safari)
**Performance Goals**:
- Selection click feedback latency $< 50\text{ms}$
- 0 unhandled runtime exceptions during rapid scrolling or selection
- Seamless handling of projects with up to 500+ chapters
**Constraints**: Adhere strictly to the "Mực & Chu Sa" design system and Constitution principles (no backend Gemini changes, no core schema mutations).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check Item | Status | Notes |
| :--- | :--- | :---: | :--- |
| **I. Quality Gates** | `tsc --noEmit`, `vitest run`, `vite build` | **PASS** | Strict verification required across all tests and build steps. |
| **II. Dependency Minimization** | No new NPM packages added | **PASS** | Reuses existing React, Lucide, and component primitives. |
| **III. Concern Separation** | UI & Hook only, no backend/translation changes | **PASS** | Restricted to `useHakoReviewSession.ts`, `HakoChapterSelector.tsx`, `HakoCheckerWorkspace.tsx`, and tests. |
| **IV. Immutable Schemas** | No changes to `src/types.ts` or database schemas | **PASS** | Internal runtime normalization only. |
| **V. Atomic Commits & Docs** | Synced specifications and modular changes | **PASS** | Complete contracts, research, data model, and quickstart documentation. |

## Project Structure

### Documentation (this feature)

```text
specs/079-fix-hako-selection-crash/
├── spec.md              # Feature specification
├── plan.md              # This implementation plan
├── research.md          # Root cause analysis & design decisions
├── data-model.md        # Entity definitions & normalization rules
├── quickstart.md        # Verification scenarios & validation guide
├── contracts/
│   └── hako-selection-runtime.contract.md # Component & hook contracts
└── checklists/
    └── requirements.md  # Spec quality validation checklist
```

### Source Code Impact

```text
src/
├── hooks/
│   ├── useHakoReviewSession.ts                       # Add ID coercion, defensive guards, and async persistence
│   └── __tests__/
│       └── useHakoReviewSession.test.ts              # Unit tests for numeric/string IDs, sparse arrays, and aggregations
└── components/
    └── hako-checker/
        ├── HakoChapterSelector.tsx                   # Add row guard clauses, safe keys, and fallback labels
        └── HakoCheckerWorkspace.tsx                  # Safe selectedChapters derivation, word counts, and ErrorBoundary
```

## Planned Changes by File

### 1. `src/hooks/useHakoReviewSession.ts`
- Coerce incoming IDs in `toggleChapterSelection(chapterId: string | number)` to string: `const targetId = String(chapterId);`.
- Use `const currentSelected = (current.selectedChapterIds || []).map(String);` to ensure comparison uniformity.
- Coerce `selectChapterRange(chapterIds: (string | number)[])` to strings: `chapterIds.map(String)`.
- Ensure safe lookups in `updateChapterRawText(chapterId: string | number, rawText: string)`.

### 2. `src/components/hako-checker/HakoChapterSelector.tsx`
- Add defensive guard `if (!ch) return null;` at the beginning of `chapterList.map()`.
- Add safe key generation: `key={ch.chapterId || \`chap-row-\${index}\`}`.
- Normalize ID comparison: `const chapterIdStr = String(ch.chapterId || (ch as any).id); const isSelected = selectedChapterIds.some(id => String(id) === chapterIdStr);`.
- Add safe fallbacks for `ch.chapterNumber ?? (index + 1)` and `ch.title || 'Chương không có tiêu đề'`.

### 3. `src/components/hako-checker/HakoCheckerWorkspace.tsx`
- Wrap workspace render in `<ErrorBoundary fallbackTitle="Đã xảy ra lỗi tại phân vùng Kiểm Định Chất Lượng">`.
- Compute `selectedChapters` with `.filter(Boolean)`:
  ```ts
  const selectedChapters = useMemo(() => {
    if (!session?.chapters || !session?.selectedChapterIds) return [];
    const selectedSet = new Set(session.selectedChapterIds.map(String));
    return Object.values(session.chapters).filter(
      (c): c is ProjectReviewChapter => Boolean(c && selectedSet.has(String(c.chapterId)))
    );
  }, [session?.chapters, session?.selectedChapterIds]);
  ```
- Compute `totalSelectedWords` safely with optional chaining:
  ```ts
  const totalSelectedWords = useMemo(() => {
    return selectedChapters.reduce((sum, c) => sum + (c?.wordCount || 0), 0);
  }, [selectedChapters]);
  ```
- Guard `session.selectedChapterIds.map(String)` and `session.chapters[id] || {}` in `handleStartAnalysis`.

### 4. `src/hooks/__tests__/useHakoReviewSession.test.ts`
- Add unit tests verifying:
  - String vs numeric chapter ID matching.
  - Safe handling of projects with missing or sparse chapter records.
  - Safe summation of total word counts with undefined/zero word counts.
  - Selection limit enforcement on high-indexed chapters.

## Verification Plan

### Automated Tests
```bash
npm run lint
npx vitest run src/hooks/__tests__/useHakoReviewSession.test.ts
npm test
npm run build
```

### Manual Verification
1. Open the app and switch to **Kiểm Định Hako** (`Alt+6`).
2. Select a project with 139+ chapters.
3. Scroll to the very bottom and toggle checkboxes for chapters #118 - #127.
4. Verify instant UI updates, accurate "Đã chọn: X / 12" counter, and 0 console errors.
5. Test "Chọn nhanh 12 chương đầu" and "Bỏ chọn tất cả".
