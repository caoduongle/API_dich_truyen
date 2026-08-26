# Research & Architectural Decisions: Nav Tabs Overflow & Visibility

**Feature**: `076-nav-tabs-overflow-fix`
**Date**: 2026-08-27
**Status**: Completed

---

## 1. Architectural Decisions

### Decision 1: Dedicated Tab Auto-Scroll & Overflow Detection Hook (`useScrollOverflow`)

- **Context**: The tab bar contains 6 tabs with icons, Vietnamese labels, shortcut badges (`Kbd`), and dynamic count badges (`Badge`). On typical laptop screen widths (1024px - 1440px), the total tab strip width exceeds available screen width. The existing `.scrollbar-none` class hides the scrollbar, making the container look static and concealing Tab 6 ("Kiểm Định Hako").
- **Decision**:
  - Implement a lightweight custom hook `useScrollOverflow(containerRef, deps)` or integrate directly with `useEffect` + `ResizeObserver`.
  - Calculate `canScrollLeft = scrollLeft > 1` and `canScrollRight = scrollLeft + clientWidth < scrollWidth - 1`.
  - On `activeTab` transition (mouse click or `Alt+1..6`), target `document.getElementById(`tab-${activeTab}`)` and execute `scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })`.
- **Rationale**:
  - Instant, reliable, native browser API with zero performance overhead.
  - Automatically handles both mouse clicks and keyboard shortcut navigations.
- **Alternatives Considered**:
  - *Showing a permanent horizontal scrollbar*: Rejected. Cluttered UI that violates the "Mực & Chu Sa" design aesthetic.
  - *Pagination / Dropdown for extra tabs*: Rejected. Violates constraint to preserve the 6-tab flat structure with hotkeys.

---

### Decision 2: Non-Intrusive Gradient Fade Indicators

- **Context**: Users need visual feedback that additional tabs are hidden offscreen to the left or right without adding distracting buttons or colored icons.
- **Decision**:
  - Render subtle fade overlays positioned absolutely at the left and right edges of the scrolling tab wrapper:
    - Left: `absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-parchment to-transparent pointer-events-none z-10`
    - Right: `absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-parchment to-transparent pointer-events-none z-10`
  - Only show left fade when `canScrollLeft` is true; only show right fade when `canScrollRight` is true.
- **Rationale**:
  - Uses existing design system token `from-parchment` which harmonizes with theme colors in both dark and light modes.
  - `pointer-events-none` guarantees clicks on tabs near the edges pass through without hindrance.
  - Zero external dependencies.

---

### Decision 3: Layout Isolation for Active Project Title Indicator

- **Context**: Previously, `<nav>` and `{activeProject && (<div>...</div>)}` shared a single `flex justify-between overflow-x-auto` container, causing the project title to compete with tabs and get pushed out of view during scrolling.
- **Decision**:
  - Restructure the header container into two distinct flex columns/sections:
    - **Tab Navigation Area**: `relative flex-1 min-w-0 overflow-hidden` containing the scrollable `<nav>` and fade overlays.
    - **Project Indicator Area**: `shrink-0 flex items-center pl-3 border-l border-parchment-2/60 ml-2 hidden sm:flex` containing `activeProject.title` with `max-w-[180px] md:max-w-[240px] lg:max-w-[320px] truncate` and full `title` tooltip.
- **Rationale**:
  - Guarantees the active project title is always visible and static on the right, while the tab list scrolls independently within its allocated space.
