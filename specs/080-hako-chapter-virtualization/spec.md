# Feature Specification: Hako Checker Chapter Virtualization & Performance Resilience

**Feature Branch**: `080-hako-chapter-virtualization`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "Tôi đang gặp lỗi trắng màn hình (blank white page) trong app React tại localhost:3000, xảy ra trong tab 'Kiểm Định Hako' của repo API_dich_truyen khi thao tác trên các bộ truyện dài (như bộ Lãnh Chúa 139 chương). Khảo sát và tối ưu: thêm virtualization cho danh sách chương (>50 chương), tách việc lưu selectedChapterIds khỏi full session.chapters trên IndexedDB, và đảm bảo tương thích React 19 StrictMode."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Smooth Scrolling & Instant Toggling for Long Chapter Lists (Priority: P1)

As a translation moderator reviewing large novel projects (100 to 500+ chapters), when scrolling through the chapter list and rapidly selecting or deselecting chapters (e.g., chapters #120 through #139), the interface responds instantaneously (<16ms, 60fps) without freezing the main thread, spiking memory abnormally, or crashing the browser tab into a blank white screen.

**Why this priority**: P1 is essential because long novels are the primary use case for professional translators and moderators. Rendering hundreds of unvirtualized DOM nodes with SVG icons and form controls causes render blocking (~270ms per tick) and severe GC memory pressure, leading to UI unresponsiveness and tab crashes.

**Independent Test**: Load a novel project with 139+ chapters in the "Kiểm Định Hako" tab, scroll down to chapter #120-139, and click 5 checkboxes rapidly. Verify that all checkboxes toggle immediately with zero input lag, smooth scroll momentum, and no frame drops or console errors.

**Acceptance Scenarios**:

1. **Given** a novel project with 139+ chapters selected in the Quality Checker, **When** the moderator views the chapter list, **Then** only the visible window of chapter rows (e.g., 8-15 items) is rendered in the DOM, keeping the total DOM node count minimal.
2. **Given** the moderator rapidly toggles 5 checkboxes at the bottom of the list, **When** the clicks occur in quick succession, **Then** visual state updates immediately with instantaneous checkbox feedback, and the selected counter updates accurately ("Đã chọn: 5 / 12").
3. **Given** any chapter item in the virtualized list, **When** the moderator expands the "+ Thêm Raw" drawer or pastes raw text, **Then** the row height dynamically adjusts or handles expansion cleanly without breaking list scroll position or unmounting adjacent items.

---

### User Story 2 - Lightweight & Granular Storage Persistence (Priority: P2)

When a moderator toggles chapter selections or updates session preferences, the system persists state changes without performing heavy full-table cloning (`session.chapters` with all chapter metadata and raw strings) on every selection event.

**Why this priority**: P2 prevents IndexedDB `structuredClone` bottlenecks and storage write locks. Persisting only selection changes or debouncing lightweight delta records ensures the storage layer never blocks React UI state transitions.

**Independent Test**: Toggle multiple chapter checkboxes and inspect the IndexedDB operations in the browser Application tab. Verify that checkbox toggles do not clone full megabyte-scale dictionaries or trigger redundant structuredClone cycles on the main thread.

**Acceptance Scenarios**:

1. **Given** a session containing 139+ chapter records in memory, **When** a single chapter is selected or deselected, **Then** the UI updates synchronously in React state while IndexedDB persistence runs in the background with minimal payload overhead.
2. **Given** rapid selection changes within 300ms, **When** multiple toggles occur, **Then** the debounced persistence collapses them into a single storage write, writing only necessary session state without race conditions.

---

### User Story 3 - React 19 StrictMode & Concurrency Stability (Priority: P3)

When running under React 19 (including double-invocation of effects/callbacks in development StrictMode), session initialization, chapter mapping, and state subscriptions remain idempotent, preventing double writes, stale closures, or infinite re-render loops.

**Why this priority**: P3 ensures absolute runtime stability and error resilience across modern React 19 lifecycle semantics and concurrent rendering features.

**Independent Test**: Mount the Quality Checker workspace in React 19 StrictMode, select projects, switch between tabs, and verify zero duplicate IndexedDB transaction collisions, zero infinite update warnings, and zero memory leaks.

**Acceptance Scenarios**:

1. **Given** the component mounts under React 19 StrictMode, **When** `getLatestSession` executes twice during dev mount, **Then** state settles cleanly into the latest valid session without race conditions or error logs.
2. **Given** any render cycle of the chapter list, **When** selection lookups occur, **Then** selection checks use $O(1)$ `Set` lookups instead of repetitive $O(N)$ array searches, ensuring optimal render efficiency.

---

### Edge Cases

- **Fast Scrolling to Boundaries**: Rapidly flinging the scrollbar from chapter #1 to chapter #139 maintains fluid rendering without blank placeholder flickers or index misalignment.
- **Dynamic Raw Drawer Expansion**: Opening raw Chinese input drawers inside a virtualized list calculates container heights properly without clipping textareas or overlapping neighboring rows.
- **Empty or Single-Chapter Projects**: Projects with 0, 1, or few chapters render seamlessly without virtualization initialization glitches.
- **Maximum 12-Chapter Selection Boundary**: Attempting to select a 13th chapter cleanly shows the warning message and prevents state corruption regardless of how fast the user clicks.
- **Tab Switching & Unmounting**: Switching away to another tab while a debounced storage save is pending cleanly flushes or cancels the pending write without dangling timer references.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST virtualize the chapter list rendering when displaying projects with more than 20 chapters, rendering only elements visible in the active viewport plus a safety overscan buffer.
- **FR-002**: Chapter selection lookups MUST utilize an $O(1)$ `Set` data structure derived via memoization (`new Set(selectedChapterIds)`) to eliminate repeated $O(N)$ searches during list rendering.
- **FR-003**: System MUST isolate and optimize IndexedDB session persistence so that rapid checkbox toggles do not serialize and clone the full `chapters` dictionary on every keystroke/click.
- **FR-004**: System MUST maintain smooth scrolling (targeting 60fps / <16ms frame budget) throughout the entire chapter range (from chapter #1 to chapter #500+).
- **FR-005**: All chapter row interactions (checkbox toggle, raw drawer expansion, raw text update) MUST remain fully functional within the virtualized container.
- **FR-006**: System MUST ensure React 19 StrictMode compatibility, guaranteeing that double-invoked effects or concurrent transitions do not cause transaction locks or infinite update loops.
- **FR-007**: Quality Checker workspace MUST remain shielded by `ErrorBoundary` to gracefully catch and isolate any unforeseen component failure, preserving application-wide navigation.

### Key Entities

- **Virtualized Chapter Viewport**: The visible scroll window containing dynamic virtual row indices, scroll offset tracking, and rendered item slice.
- **Quality Review Session**: The state object holding project metadata, selected chapter ID strings (capped at 12), chapter definitions, detected quality issues, and analysis state.
- **Chapter Row Item**: The individual interactive component representing a chapter, including number, title, translation badge, checkbox, and expandable raw input drawer.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Chapter selection toggle JS execution time drops from >250ms to <16ms per click for projects with 100+ chapters.
- **SC-002**: Active DOM elements in the chapter list remain capped at fewer than 50 elements regardless of whether the project contains 100, 300, or 1000 chapters.
- **SC-003**: Zero white-screen crashes, zero renderer process crashes, and zero `Maximum update depth exceeded` exceptions during rapid scrolling and selecting of late-stage chapters (#100+).
- **SC-004**: Memory allocation churn during list interaction is reduced by at least 80%, eliminating memory spikes when clicking checkboxes.
- **SC-005**: 100% of automated tests pass (`npm run lint`, `npm test`, `npm run build`).

## Assumptions

- Standard novel projects in the application typically contain between 50 and 500 chapters.
- Virtualization can be achieved with lightweight windowing techniques or existing dependencies without adding heavy external packages if not needed.
- The maximum selection limit of 12 chapters per review batch remains unchanged for AI quota and performance safety.
- IndexedDB remains the primary client-side persistence medium for quality review sessions.
