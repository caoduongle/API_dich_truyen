# Research: Hako Chapter Selection Runtime Resilience & Boundary Protection

**Feature Branch**: `079-fix-hako-selection-crash`
**Date**: 2026-08-27
**Spec**: [spec.md](./spec.md)

## Summary of Findings & Root Cause Analysis

Investigation into the blank screen crash on late-stage chapters (e.g. #118 - #127) identified a series of unhandled JavaScript runtime exceptions (`TypeError: Cannot read properties of undefined`) during React render cycles. In React 19, an unhandled exception during rendering unmounts the entire DOM tree, causing an instantaneous white screen.

---

## Decisions & Architectural Trade-offs

### Decision 1: Universal String Coercion for Chapter IDs

- **Context**: Project chapter IDs can originate as numbers (`118`) or strings (`"118"`, `"c-118"`, `"chap-118"`). In JavaScript, `118 === "118"` evaluates to `false`. When checking selection via `selectedChapterIds.includes(chapter.id)` or `selectedSet.has(chapter.id)`, type mismatch causes lookups to fail, resulting in undefined chapter accesses.
- **Decision**: Coerce all chapter IDs to strings (`String(id)`) at every boundary:
  - Inside `useHakoReviewSession`: `toggleChapterSelection(chapterId: string | number)`, `selectChapterRange(chapterIds: (string | number)[])`.
  - Inside `HakoChapterSelector`: `const chapterIdStr = String(ch.chapterId);`.
  - Inside `HakoCheckerWorkspace`: Set lookups `selectedSet.has(String(c.chapterId))`.
- **Rationale**: String coercion guarantees consistent $O(1)$ `Set` lookups, eliminates type inequality bugs, and requires zero schema changes in IndexedDB.
- **Alternatives Considered**:
  - *Strict Numeric Parsing*: Rejected because chapter IDs in StoryProjects or Google Drive imports can contain alphanumeric UUIDs or prefix hashes (e.g., `"c-1a2b"`).
  - *Loose Equality (`==`)*: Rejected because `==` creates lint issues and does not work with `Set.has()`.

---

### Decision 2: Defensive Guard Clauses in Chapter List Rendering

- **Context**: When rendering large chapter lists (100 to 500+ items), sparse arrays or out-of-bounds index calculations during fast scrolling can pass an `undefined` or `null` item to mapping callbacks.
- **Decision**:
  1. Add an immediate guard: `if (!ch) return null;` in `chapterList.map((ch, index) => ...)`.
  2. Guard all property accesses with fallback defaults:
     - `ch.chapterNumber ?? (index + 1)`
     - `ch.title || 'Chương không có tiêu đề'`
     - `ch.wordCount ?? 0`
  3. Generate fail-safe React keys: `key={ch.chapterId || \`chap-row-\${index}\`}`.
- **Rationale**: Guarantees that even if an array element is missing or partially malformed, the component continues rendering valid rows seamlessly.
- **Alternatives Considered**:
  - *Filtering before render*: Also applied (`Object.values(chapters).filter(Boolean)`), but in-loop guard provides defense-in-depth against virtualizers or re-indexing side effects.

---

### Decision 3: Safe Computation & Array Aggregations in Workspace

- **Context**: Computing `selectedChapters`, `totalSelectedWords`, or preparing JIT chapters in `HakoCheckerWorkspace` previously assumed every ID in `selectedChapterIds` mapped to a valid `session.chapters[id]`. If an ID was stale, missing, or mismatched, `.wordCount` or `.title` threw `TypeError`.
- **Decision**:
  1. Compute `selectedChapters` using `filter(Boolean)`:
     ```ts
     const selectedChapters = useMemo(() => {
       if (!session?.chapters || !session?.selectedChapterIds) return [];
       const selectedSet = new Set(session.selectedChapterIds.map(String));
       return Object.values(session.chapters).filter(
         (c): c is ProjectReviewChapter => Boolean(c && selectedSet.has(String(c.chapterId)))
       );
     }, [session?.chapters, session?.selectedChapterIds]);
     ```
  2. Compute total word counts using optional chaining:
     ```ts
     const totalSelectedWords = useMemo(() => {
       return selectedChapters.reduce((sum, c) => sum + (c?.wordCount || 0), 0);
     }, [selectedChapters]);
     ```
  3. In `handleStartAnalysis`, safely resolve `const meta = session.chapters[id] || {};` before reading properties.
- **Rationale**: Prevents crashes when switching projects, resetting sessions, or selecting newly added chapters.

---

### Decision 4: Non-blocking Asynchronous Persistence

- **Context**: State mutations when clicking checkboxes must trigger immediate visual feedback (<50ms). Synchronous database transactions inside event handlers or state setters can stall the event loop or trigger race conditions.
- **Decision**:
  - Perform synchronous React state update via `setSession`.
  - Maintain the existing debounced `saveSession` pipeline (300ms debounce for selections, immediate for analysis completion).
  - Wrap any asynchronous operations in `catch(console.error)` to prevent unhandled promise rejections.
- **Rationale**: Keeps the UI 60fps smooth even when rapidly checking 12 chapters in a row.

---

### Decision 5: Localized Error Boundary Wrapper

- **Context**: In React 19, any uncaught error in a child component bubbles up to the root if not intercepted, causing a blank screen.
- **Decision**: Ensure `HakoCheckerWorkspace` is wrapped in an `ErrorBoundary` with clear recovery actions ("Khôi phục phân vùng", "Tải lại trang").
- **Rationale**: Localizes fault isolation so that an anomaly in the Quality Checker never impairs the user's active translation tab or unsaved project data.
