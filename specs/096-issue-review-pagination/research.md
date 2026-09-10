# Research: Issue Review Panel Pagination

## Technical Decisions

### 1. Pagination vs. Virtualization
- **Context**: The issue cards in `HakoIssueReviewPanel.tsx` are large and feature-rich (~16KB per `HakoIssueCard` component), with expandable snippet text, optional raw Chinese snippets, notes textareas, and interactive action buttons.
- **Problem with `useVirtualList`**: `useVirtualList.ts` in the codebase assumes fixed item heights (`itemHeight: number`) and calculates node offsets via `translateY(index * itemHeight)`. Because `HakoIssueCard` elements have dynamic, variable heights depending on content length and expansion state, using `useVirtualList` causes card collisions, overlapping, or incorrect scroll positions.
- **Decision**: Implement discrete, deterministic client-side pagination with `PAGE_SIZE = 20`.
- **Rationale**:
  - Eliminates DOM node bloating by capping simultaneous mounted card instances to at most 20.
  - Zero assumptions about card dimensions or height stability; cards can expand, collapse, or show textareas with 100% layout fidelity.
  - Fast, simple implementation with zero new dependencies or layout jitter.
- **Alternatives Considered**:
  - *Dynamic height virtualizer (e.g. `react-virtualized` or `@tanstack/react-virtual`)*: Requires external dependencies (prohibited by Constitution Principle II) and introduces high complexity with DOM measurement resize observers.
  - *Infinite scroll / "Load more"*: Accumulates DOM nodes over time, eventually reproducing the low-memory device lag problem on large batches.

### 2. Page Clamping and Filter Synchronization
- **Context**: When a user is on Page 3 and changes the filter (e.g. from "Tất cả" to "Nghiêm trọng"), the number of matching issues may drop from 50 to 5.
- **Decision**:
  - Reset `currentPage` to 1 whenever any filter (`filterSeverity`, `filterCategory`, `filterDecision`, `filterChapterId`) changes.
  - Additionally, compute `effectivePage = Math.min(currentPage, totalPages)` when slicing `displayedIssues` to prevent empty renders during the same render pass.
  - Add an effect to clamp `currentPage` to `Math.max(1, totalPages)` if items are removed/updated.
- **Rationale**: Guarantees users are never stranded on a blank page.

### 3. Batch Actions Scope Invariant
- **Context**: "Duyệt nhanh tất cả" and "Bỏ qua tất cả" allow bulk resolution of all issues matching the active filter.
- **Decision**: Keep `handleBatchConfirm` and `handleBatchDismiss` operating on the entirety of `filteredIssues`, NOT merely the 20 items in `displayedIssues`.
- **Rationale**: Preserves existing user workflow where a user filters for "Cảnh báo" or a specific chapter and expects all matching issues across the batch to be confirmed or dismissed with one click.

### 4. UI Design & Component Reuse
- **Context**: Design system specifies `rounded-[2px]`/`rounded-md`, `font-mono` for metrics, and reusing existing UI primitives.
- **Decision**: Use `src/components/ui/Button.tsx` with `variant="secondary"` and `size="sm"` for navigation controls.
- **Rationale**: Fully adheres to `.agents/rules/design-system.md` without bespoke button styles or redundant CSS.
