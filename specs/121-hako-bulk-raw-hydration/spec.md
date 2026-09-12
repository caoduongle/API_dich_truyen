# Feature Specification: Hako Bulk Raw Hydration

**Feature Branch**: `121-hako-bulk-raw-hydration`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "hiện tại mỗi chương đều phải tự tay ấn nút thêm raw; rất mất thời gian; tôi muốn thêm nút thêm raw cho tất cả các chương; hoặc là nó sẽ tự động thêm raw"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic Project-Wide Raw Chinese Hydration on Load (Priority: P1)

As a translator or moderator opening the Hako Quality Checker for a novel project, whenever I select a project or open the chapter list, the system MUST automatically load and associate the original Chinese source text from local database storage for all chapters of the project in the background, so that every chapter with available raw text immediately displays "Đã có Raw (X ký tự)" without requiring me to manually click "+ Thêm Raw" on each individual chapter.

**Why this priority**: Novels typically contain tens to hundreds of chapters (e.g. 139 chapters). Having to click "+ Thêm Raw" individually for every single chapter is extremely tedious and breaks the workflow. Automating this on project load saves massive manual effort.

**Independent Test**:
Open the Hako Quality Checker for a project containing 139 chapters with stored source text; verify that all 139 chapter cards automatically display "Đã có Raw (X ký tự)" without the user having to click any button.

**Acceptance Scenarios**:

1. **Given** a project with chapters stored in the database containing `sourceText`, **When** the user selects the project in Hako Checker, **Then** all chapters with source text are automatically hydrated with `rawChineseContent` in the background.
2. **Given** chapters with auto-hydrated raw text, **When** rendered in the chapter list, **Then** their badges display "Đã có Raw (X ký tự)" in green/success styling instead of "+ Thêm Raw".
3. **Given** an existing review session reopened from storage, **When** initialized, **Then** any chapter missing raw content in the cached session is automatically synced and populated from local storage.

---

### User Story 2 - One-Click "Nạp Raw Tất Cả Chương" Toolbar Action (Priority: P1)

As a user managing chapter inspection in `HakoChapterSelector`, I want an explicit "⚡ Nạp Raw tất cả chương" (or "Nạp Raw toàn bộ") button in the selection toolbar, so that I can trigger an instant bulk reload of raw Chinese text for all chapters in the active project on demand with immediate visual feedback.

**Why this priority**: Explicitly requested by the user ("tôi muốn thêm nút thêm raw cho tất cả các chương"). Gives user agency, handles edge cases where new raw texts were imported during the session, and provides reassurance that raw data is fully up to date.

**Independent Test**:
In the chapter selection toolbar, click "⚡ Nạp Raw tất cả chương"; verify that a brief loading indicator appears, all chapters update to "Đã có Raw", and a feedback badge/message indicates the total number of hydrated chapters (e.g. "Đã nạp Raw cho 139/139 chương").

**Acceptance Scenarios**:

1. **Given** the chapter selector toolbar, **When** viewing the controls, **Then** an accessible button "⚡ Nạp Raw toàn bộ" is visible alongside selection controls.
2. **Given** chapters currently displaying "+ Thêm Raw", **When** the user clicks "⚡ Nạp Raw toàn bộ", **Then** the system fetches source text for all chapters of the project in a single batch operation and updates all chapter badges to "Đã có Raw".
3. **Given** the bulk action is in progress, **When** fetching, **Then** a loading spinner or disabled state prevents duplicate clicks.
4. **Given** the bulk action finishes, **When** complete, **Then** a notification or status indicator confirms the count of updated chapters.

---

### User Story 3 - Visual Metrics and Mixed-Project Graceful Handling (Priority: P2)

As a user working with mixed projects (where some chapters have raw text and some were imported as pure Vietnamese translation), I want clear summary indicators of raw text coverage across the project, and chapters lacking raw text must cleanly retain "+ Thêm Raw" for manual input.

**Why this priority**: Prevents confusion when some chapters genuinely do not have raw text in the database, allowing users to see overall raw coverage and manually paste text only where needed.

**Independent Test**:
In a project where 5 chapters lack original Chinese text, run bulk hydration; verify that all other chapters show "Đã có Raw", the 5 chapters show "+ Thêm Raw", and the toolbar indicates raw coverage (e.g. "Đã có Raw: 134/139 chương").

**Acceptance Scenarios**:

1. **Given** a project where certain chapters lack `sourceText` in storage, **When** bulk hydration runs, **Then** those chapters gracefully retain the "+ Thêm Raw" button without errors.
2. **Given** mixed raw availability, **When** looking at the chapter selection header, **Then** a status indicator displays the proportion of chapters with raw text available (e.g. "134/139 đã có raw").

---

## Edge Cases

- **Large projects with hundreds of chapters (300 - 1000 chapters)**:
  Bulk hydration MUST NOT trigger hundreds of individual sequential database requests. It must retrieve all project chapters in a single indexed batch query (`getChaptersByProjectFromDB`) to prevent browser thread freeze.
- **Switching projects**:
  When switching from Project A to Project B, the hydration system must cancel any pending hydration for Project A and immediately hydrate Project B's chapters.
- **Manual override preservation**:
  If a user has manually modified or pasted a specific raw text in the modal for a chapter, automatic bulk hydration should not overwrite their custom edits unless explicitly requested.
- **No chapters in project**:
  If a project has zero chapters, the bulk button is disabled and no query errors are thrown.
- **Network / storage latency**:
  Hydration runs asynchronously in the background and does not block chapter selection or immediate interaction with the UI.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST automatically hydrate `rawChineseContent` from `sourceText` in local storage for all chapters of the active project when opening or selecting a project in Hako Quality Checker.
- **FR-002**: System MUST use a single indexed batch query (`getChaptersByProjectFromDB`) to fetch all project chapter records in one operation rather than querying chapters one by one.
- **FR-003**: System MUST provide a dedicated "⚡ Nạp Raw toàn bộ" action button in the `HakoChapterSelector` toolbar.
- **FR-004**: Clicking "⚡ Nạp Raw toàn bộ" MUST refresh and hydrate raw Chinese text across all chapters of the project, displaying a loading indicator during the process.
- **FR-005**: System MUST reactively update chapter card badges to "Đã có Raw ({count} ký tự)" immediately as raw text is populated.
- **FR-006**: System MUST display a clear coverage status or count (e.g. "Đã có Raw: X/Y chương") in the chapter selector header so users know how many chapters have raw text available.
- **FR-007**: Chapters without source text in local storage MUST retain the manual "+ Thêm Raw" button and open the raw edit modal normally.
- **FR-008**: Hydrated raw texts MUST be seamlessly preserved in the session state (`updatedChaptersRecord`) so subsequent quality scans (Heuristic & AI) immediately utilize the raw text.

### Key Entities

- **ProjectReviewChapter**:
  - `rawChineseContent`: The full Chinese original text of the chapter, auto-hydrated from database `sourceText`.
  - `chapterId`: The identifier linking the review chapter to its storage record.
- **HakoReviewSession**:
  - `chapters`: Record mapping `chapterId` to `ProjectReviewChapter` with populated `rawChineseContent`.
  - `projectId`: The active project ID used for batch querying.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of chapters with source text in local storage have raw text populated without requiring users to click individual chapter cards.
- **SC-002**: Bulk hydration for a 150-chapter project completes in under 200 milliseconds.
- **SC-003**: Manual clicks required to populate raw for a 139-chapter project drops from 139 clicks to 0 clicks (automatic) or 1 click (bulk button).
- **SC-004**: Zero UI freezing or dropped frames during batch chapter retrieval.

---

## Assumptions

- Novel projects stored in IndexedDB store the original Chinese text in `Chapter.sourceText`.
- `getChaptersByProjectFromDB(projectId)` efficiently queries the `projectId` index in IndexedDB.
- Users want automatic population by default, with a manual button available for on-demand sync.
- The UI maintains compliance with the existing design system (`.agents/rules/design-system.md`).
