# Feature Specification: Decouple Quality Review Session & JIT Content Loading

**Feature Branch**: `077-decouple-hako-session`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "Hiện tượng sập tab khi tick chọn chương bắt nguồn từ việc lưu trữ cả megabyte văn bản thô (139 chương) vào đối tượng `session` được `structuredClone` và ghi xuống IndexedDB sau mỗi sự kiện click. Kế hoạch giải quyết tập trung vào việc tách rời metadata khỏi văn bản thô (Data Decoupling), áp dụng cơ chế nạp nội dung Just-In-Time (JIT) cho tối đa 12 chương được chọn, và cô lập tương tác UI checkbox khỏi transaction IndexedDB."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Instant Chapter Selection & Responsive Workspace (Priority: P1)

As a moderator reviewing a translation project with hundreds of chapters (e.g. 100–300+ chapters), I want to select and deselect chapters via checkboxes with instantaneous UI response so that the browser tab never lags, freezes, or crashes.

**Why this priority**: Preventing tab crashes and unresponsiveness during chapter selection is the core reliability issue affecting moderators managing large projects.

**Independent Test**: Open a project with 139+ chapters in the Quality Checker workspace, rapidly click multiple chapter checkboxes within 1 second, and verify that selection state updates immediately (< 10ms) without any UI hitching or tab termination.

**Acceptance Scenarios**:

1. **Given** a translation project with 139 chapters is loaded in the Quality Checker, **When** the user clicks any chapter checkbox, **Then** the checkbox toggles state instantaneously without perceptible lag or frame drops.
2. **Given** multiple chapters are checked, **When** the user rapidly clicks "Select All Translatable" or deselects individual chapters, **Then** the UI updates synchronously and selection counter reflects the change immediately.
3. **Given** a chapter with no translation exists, **When** the user attempts to select it, **Then** the system displays an informative message and leaves the chapter unselected without crashing.

---

### User Story 2 - Lightweight Session Persistence & Storage Sanitization (Priority: P2)

As a system user, I want the quality review session to persist lightweight metadata, selected chapter IDs, configurations, and review decisions without storing large raw text blocks, so that disk usage and persistence serialization overhead remain negligible.

**Why this priority**: Storing full text inside the session object bloats persistent storage, triggering costly deep cloning and transaction overhead on every session update.

**Independent Test**: Inspect stored session records for a project with 200+ chapters; verify that the stored payload contains only metadata and IDs (< 50 KB total) rather than megabytes of raw text, and verify that legacy bloated sessions are automatically sanitized on load.

**Acceptance Scenarios**:

1. **Given** a session with 100+ chapters is saved, **When** the persistent storage entry is inspected, **Then** it contains only chapter metadata (ID, title, number, word count, translation presence) and review issues, excluding full source or translated text bodies.
2. **Given** a pre-existing legacy session in storage containing megabytes of full chapter text, **When** the session is loaded, **Then** the storage manager automatically sanitizes and prunes the full-text fields while preserving all issue annotations, decisions, and selection IDs.

---

### User Story 3 - Just-In-Time (JIT) Chapter Content Loading for Analysis (Priority: P3)

As a moderator initiating a quality review run, I want the system to fetch the full Vietnamese and Chinese text only for the selected chapters (up to 12 chapters) at the exact moment analysis begins, so that memory usage remains lean during browsing and the analysis engine receives complete data.

**Why this priority**: Decoupling full-text loading to runtime analysis time ensures that projects with hundreds of chapters load instantly upon selection, while the quality review engine still receives 100% complete text.

**Independent Test**: Select 12 chapters in a 150-chapter project and click "Bắt đầu kiểm định"; verify that full chapter text is retrieved only for the 12 selected IDs, displayed with progress feedback, and passed directly into the heuristic and AI scanning engine without being saved back into persistent session storage.

**Acceptance Scenarios**:

1. **Given** 12 chapters are selected from a large project, **When** the user clicks "Bắt đầu kiểm định", **Then** the system displays a brief loading indicator, loads full text exclusively for the 12 selected chapters, and proceeds directly to heuristic and AI quality analysis.
2. **Given** quality analysis completes with detected issues, **When** the session updates and saves, **Then** the detected issues and chapter metadata are preserved in session storage without writing full text blocks into the session record.

---

### User Story 4 - Debounced / Non-Blocking Selection Synchronization (Priority: P4)

As a moderator rapidly configuring a batch of chapters, I want UI interactions to remain unblocked by background storage writes so that rapid clicking never queues up blocking database transactions.

**Why this priority**: Isolating UI state updates from immediate synchronous persistence writes guarantees smooth 60fps interaction on devices with slower storage I/O.

**Independent Test**: Rapidly click 10 checkboxes in sequence; verify that UI state updates on each click while storage synchronization debounces to execute once the user finishes clicking.

**Acceptance Scenarios**:

1. **Given** a user rapidly toggles multiple checkboxes, **When** clicks occur in quick succession, **Then** the UI reflects every toggle immediately while storage updates are debounced cleanly in the background.

---

### Edge Cases

- **Large Project Volume**: Projects with 500+ chapters must load metadata in under 50ms and browse without memory pressure.
- **Untranslated Chapter Selection**: Attempting to select a chapter with status 'none' (no raw or polished translation) is disallowed with a clear explanatory notice.
- **Maximum Batch Cap (12 Chapters)**: Attempting to select a 13th chapter triggers a friendly warning notifying the user of the 12-chapter per-batch limit.
- **Missing or Corrupted Chapter Data**: If a selected chapter's text cannot be found in database storage when JIT loading begins, the system records an error for that specific chapter and allows the remaining valid chapters to proceed.
- **Legacy Stored Session Migration**: Sessions created prior to decoupling that hold complete text arrays are transparently sanitized upon reading from storage without losing user notes or issue decisions.
- **Analysis Cancellation**: If the user cancels an in-progress analysis, loaded in-memory text is safely released and the workspace returns to idle state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST separate chapter data into lightweight persistent metadata (ID, title, chapter number, translation availability, word count, review status) and ephemeral full-text content.
- **FR-002**: When a user selects a story project, the system MUST construct the quality review session catalog using project chapter metadata without reading full chapter text bodies from database storage.
- **FR-003**: The system MUST decouple checkbox selection UI state from synchronous persistence transactions, guaranteeing instantaneous (< 10ms) UI updates.
- **FR-004**: The system MUST debounce or optimize session persistence writes to prevent repeated I/O transactions during rapid user selection interactions.
- **FR-005**: When quality analysis is triggered ("Bắt đầu kiểm định"), the system MUST load full text (Vietnamese translation and raw Chinese source) just-in-time (JIT) exclusively for the currently selected chapter IDs (up to a maximum of 12 chapters).
- **FR-006**: The system MUST pass loaded chapter text directly to the heuristic and AI quality analysis pipeline at runtime without writing full text back into the persistent session store.
- **FR-007**: The system MUST enforce a maximum limit of 12 chapters per review batch and provide user feedback if the limit is exceeded.
- **FR-008**: The storage manager MUST sanitize persistent review session payloads prior to saving and upon loading to remove any redundant full-text properties while preserving issue records, decisions, notes, and metadata.

### Key Entities *(include if feature involves data)*

- **QualityReviewSession**: Persistent session container containing session ID, project ID, project title, selected chapter IDs array, lightweight chapter metadata map, quality issue records list, status, and timestamps.
- **ChapterMetadataItem**: Lightweight metadata descriptor representing a chapter in the review catalog (ID, title, chapter number, translation availability type, approximate word count, status).
- **ChapterAnalysisPayload**: Ephemeral runtime data object holding full text (Vietnamese translation and optional Chinese source text) for an individual selected chapter, used strictly during analysis execution.
- **QualityIssue**: Record of an identified issue (ID, chapter ID, chapter title, category, severity, evidence snippets, explanation, suggestion, moderator decision, moderator note, source).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Chapter checkbox toggle response time is under 10ms with zero perceptible UI freezing on projects with 200+ chapters.
- **SC-002**: Initial project loading time in the Quality Checker workspace is under 50ms for projects containing over 100 chapters.
- **SC-003**: Persistent session storage payload size for a 150-chapter project is reduced by at least 95% (under 50 KB vs. 3–5 MB previously).
- **SC-004**: Browser tab memory consumption during chapter browsing in large projects drops by over 80%.
- **SC-005**: 100% of selected chapters (up to 12) have their full text accurately retrieved on-demand and analyzed by both heuristic and AI engines without data loss.
- **SC-006**: Zero tab crashes or browser "Out of Memory" errors occur when interacting with projects containing up to 500 chapters.

## Assumptions

- Project chapters already exist in client-side storage with valid chapter titles and IDs.
- A maximum limit of 12 chapters per review batch provides optimal analysis depth and token management for AI scanning.
- Full text content is only required at the point of executing quality analysis and is not needed for chapter list browsing.
