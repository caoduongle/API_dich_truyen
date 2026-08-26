# Feature Specification: Fix Hako Chapter Selection Runtime Crash

**Feature Branch**: `079-fix-hako-selection-crash`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "Dựa trên log server và triệu chứng sập trắng trang khi cuộn xuống chọn các chương ở cuối (như chương #118 - #127), nguyên nhân không còn nằm ở dung lượng ghi IndexedDB mà là lỗi JavaScript Runtime (TypeError: Cannot read properties of undefined) xảy ra trong quá trình render của React. Khi một lỗi không được bắt (unhandled exception) xảy ra trong luồng render, React sẽ unmount toàn bộ DOM tree dẫn đến màn hình trắng xóa."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Safe Selection and Scrolling on Large Chapter Lists (Priority: P1)

As a moderator auditing translations for long novels (100+ chapters), when scrolling to the bottom of the chapter selector and selecting late-stage chapters (e.g., #118 through #127), the selection state, counters, and chapter cards update smoothly without freezing, throwing runtime exceptions, or crashing the workspace to a blank page.

**Why this priority**: P1 is critical because unhandled render exceptions crash the entire React DOM tree, completely preventing moderators from inspecting chapters in long-running novels.

**Independent Test**: Load a translation project containing over 100 chapters, scroll to the bottom of the list, select and deselect chapters (#118 - #127), and verify the UI updates immediately with correct selection indicators and word counts without any console error or unmount.

**Acceptance Scenarios**:

1. **Given** a project with 139 chapters loaded in the Quality Checker, **When** the moderator scrolls to chapter #118 and clicks its selection checkbox, **Then** the checkbox activates, the counter updates to "Đã chọn: 1 / 12", and the entire interface remains responsive.
2. **Given** up to 12 chapters are selected across varying indices (e.g., #1, #45, #118, #139), **When** the workspace renders the selected summary and word counts, **Then** the total word count and chapter summaries reflect the aggregate values accurately without lookup failures.

---

### User Story 2 - Robust Data Type Harmonization & Boundary Defense (Priority: P2)

When chapter data contains heterogeneous identifier types (numeric vs string) or sparse/out-of-bounds array indices during list scrolling and rapid re-renders, the system seamlessly normalizes lookups and skips non-existent items without throwing `TypeError`.

**Why this priority**: P2 ensures system resilience across diverse project database schemas and state transitions, guaranteeing that identity checks never return unexpected `undefined` lookups.

**Independent Test**: Select chapters in projects with numeric IDs and string IDs, rapid-scroll through virtualized/scrollable lists, and ensure lookups consistently match without returning undefined property accesses.

**Acceptance Scenarios**:

1. **Given** a chapter record with numeric ID `118` and a selection set containing string `"118"`, **When** the selector checks if the chapter is selected, **Then** the comparison evaluates to `true` through normalized identity comparison.
2. **Given** an empty, null, or out-of-bounds chapter entry during array mapping or filtering, **When** the component renders rows or calculates aggregates, **Then** the invalid entry is safely ignored and valid chapters render without error.

---

### User Story 3 - Localized Fault Isolation via Error Boundary (Priority: P3)

If an unexpected runtime error occurs within the Quality Checker workspace during rendering or state updates, the error is trapped within a localized boundary displaying an informative diagnostic fallback card with a recovery button, preserving the main application navigation and other tabs.

**Why this priority**: P3 provides defense-in-depth so that even an unforeseen data irregularity never causes a full-screen application blank crash (white screen of death).

**Independent Test**: Inject or simulate an unhandled rendering error inside the Quality Checker workspace; confirm the localized error card displays with "Khôi phục phân vùng" while the outer application header and tab navigation stay functional.

**Acceptance Scenarios**:

1. **Given** an unexpected exception thrown during workspace rendering, **When** the error triggers, **Then** a localized error card is shown inside the tab area with recovery controls, while the global navigation remains interactive and functional.

---

### Edge Cases

- **Rapid Toggling at Max Limit**: Rapidly clicking checkboxes on high-indexed chapters when reaching the 12-chapter limit properly preserves the boundary limit and ignores excess selections without stale-state races.
- **Missing or Zero Word Counts**: Chapters with 0 words, undefined `wordCount`, or missing titles display fallback values ("0 từ", "Chương không có tiêu đề") and sum into aggregate word counts safely.
- **Scrolled to Absolute Boundary**: Scrolling kịch xuống đáy danh sách (e.g. index 138/139) and toggling the last chapter does not trigger index out-of-bounds access.
- **Project Switching with Active Selections**: Switching between projects cleanly resets or re-aligns selection IDs without referencing orphaned IDs from the previous project.
- **Async Storage Persistence**: Persisting session state asynchronously does not block immediate UI state changes or cause render cycle deadlocks.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST normalize all chapter identifiers (`chapterId`, `id`, `selectedChapterIds`) to consistent string representations during storage, selection checks, and array filtering.
- **FR-002**: Chapter selector list MUST include defensive guard clauses (`if (!chapter) return null;`) for every list item to guard against sparse arrays, null items, or out-of-bounds index calculations.
- **FR-003**: All summary, preview, and aggregation calculations (such as total word count and selected chapters count) MUST use safe filtering (`.filter(Boolean)`) and optional chaining (`?.`) to prevent reading properties on `undefined`.
- **FR-004**: Chapter selection actions MUST decouple immediate React state updates from persistent database writes (using non-blocking asynchronous dispatch or debouncing) to prevent render-cycle stalling.
- **FR-005**: The Quality Checker workspace MUST wrap its component tree in a localized `ErrorBoundary` to catch any unhandled render exceptions, display diagnostic information, and allow state recovery without crashing the whole application.
- **FR-006**: Chapter range selection and select-all controls MUST strictly enforce the maximum limit of 12 chapters regardless of list length or starting index.

### Key Entities

- **Quality Review Session**: The active audit session holding project identity, title, a list of normalized selected chapter ID strings (maximum 12), a dictionary of chapter metadata, issue records, and audit status.
- **Project Review Chapter Metadata**: Lightweight chapter record containing normalized `chapterId`, `chapterNumber`, `title`, `translationType`, `wordCount`, `status`, and optional raw Chinese snippet.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of chapter selection and de-selection operations across long novels (100+ chapters, including chapters #100 - #500) execute without runtime exceptions or white-screen crashes.
- **SC-002**: UI selection responsiveness remains under 50ms with instant checkbox visual feedback upon clicking.
- **SC-003**: 100% of aggregate calculations (selected count, word count, issue statistics) safely handle empty, missing, or zero-valued fields without throwing errors.
- **SC-004**: If an isolated error occurs inside the quality workspace, 100% of parent application navigation and adjacent tabs remain fully functional with in-place workspace recovery.

## Assumptions

- Novel projects can contain up to 500+ chapters.
- Maximum concurrent chapter selection limit for a quality review batch remains fixed at 12 chapters.
- Chapter IDs may be initialized as strings or numbers from different input sources and must be coerced consistently to strings.
- IndexedDB session storage is isolated to the dedicated quality checker database and must not affect core translation data.
