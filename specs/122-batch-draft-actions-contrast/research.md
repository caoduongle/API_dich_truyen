# Research Findings: Batch Draft Actions and Light Theme Contrast Hardening

## Decision 1: Batch Draft Execution Pattern in ChapterHistoryPanel

- **Context**: The user selects multiple chapters (up to hundreds) in the Chapter History sidebar and executes bulk operations (Reset, Delete Polished, Delete Raw, Promote Polished to Raw).
- **Decision**: Reuse existing pure transformation helpers (`transformChapterDeletePolished`, `transformChapterDeleteRaw`, `transformChapterPromotePolishedToRaw`), fetch and update chapters in parallel batches via `Promise.all` using `getChapterFromDB` and `saveChapterToDB`, and synchronize the in-memory project metadata via a single atomic `onUpdateProject(...)` call.
- **Rationale**:
  - Pure functions are already unit-tested and proven bug-free.
  - Keeps IndexedDB interactions transparent and resilient against transaction timeouts.
  - A single `onUpdateProject` call prevents React render thrashing while keeping the sidebar list state in sync.
- **Alternatives Considered**:
  - Direct low-level IDB transaction bypass: Adds complexity and bypasses the established service contract in `src/services/db.ts`.

## Decision 2: Theme-Adaptive Typography & WCAG AA Contrast Remediation

- **Context**: In light mode (`data-theme="light"`) and sepia mode (`data-theme="sepia"`), hardcoded `text-amber-300` results in pale yellow text on an off-white/cream parchment background (`#F7F2E9` / `#EBE0C9`), yielding a contrast ratio of ~1.8:1 (failing WCAG AA minimum 4.5:1).
- **Decision**: Standardize all warning, destructive, and draft action buttons in `ChapterHistoryPanel.tsx` to use responsive theme tokens:
  - Text: `text-amber-800 dark:text-amber-300` (Light/Sepia: `#92400e` on `#F7F2E9` yields ~7.8:1 contrast; Dark: `#fcd34d` on `#1F1914` yields ~8.5:1 contrast).
  - Border: `border-amber-300/80 dark:border-amber-800/40`.
  - Hover background: `hover:bg-amber-100/60 dark:hover:bg-amber-950/20`.
- **Rationale**: Completely eliminates unreadable text in light mode while maintaining the desired aesthetic in dark mode without adding new CSS variables or breaking test suites.
- **Alternatives Considered**:
  - Standard red (`text-red-500`): Violates project constitution rule prohibiting default Tailwind rose/red tokens.
  - Black/Neutral text: Loses the semantic warning indication.

## Decision 3: Batch Action Toolbar Layout in Sidebar

- **Context**: Rendering 4 bulk buttons in the single header row alongside the checkbox and title causes overflow and layout breakage on standard desktop resolutions.
- **Decision**: When `selectedChapterIds.length > 0`, render a dedicated, compact batch actions toolbar directly below the header title.
  - Layout: `flex flex-wrap gap-1.5 pt-2 border-t border-parchment-2/60`.
  - Buttons: Size `sm` (or compact padding), with icons (`RotateCcw`, `FileX`, `Trash2`, `Sparkles`) and counter tags `(N)`.
  - Tooltips: Explicit descriptive tooltips detailing the action behavior.
- **Rationale**: Provides clear visibility and accessible touch targets without disrupting the virtual scroll list height or causing header horizontal overflow.
