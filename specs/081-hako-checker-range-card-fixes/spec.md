# Feature Specification: Hako Quality Checker Selection UX, Card Numbering & Error Visibility

**Feature Branch**: `081-hako-checker-range-card-fixes`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "Tôi cần bổ sung 3 tính năng cho module "Kiểm Định Hako" (feature 075-moderator-quality-checker) trong repo API_dich_truyen, đồng thời vá 1 lỗi liên quan. KHÔNG đổi luồng logic phân tích AI/Heuristic hiện có, chỉ mở rộng dữ liệu và UI. 1) Hiển thị số thứ tự chương trong thẻ lỗi kiểm định; 2) Ô chọn nhanh theo khoảng chương (từ chương... đến chương...); 3) Ô nhập số thứ tự chương để chọn nhanh 1 chương; 4) FIX BẮT BUỘC: hiển thị thông báo lỗi (error) hiện đang bị mất tích."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Chapter Number Context on Quality Issue Cards & Reports (Priority: P1)

When a translation moderator or editor reviews detected quality issues (e.g., character name inconsistencies, untranslated raw leaks, or duplicate paragraphs), each issue card clearly displays the chapter sequence number alongside the chapter title (formatted as `#<chapterNumber> · <chapterTitle>`), allowing the reviewer to instantly identify where the issue occurs in the novel timeline. Additionally, exported Markdown reports group and sort chapters by their numeric sequence with formatted headers (`### Chương #{chapterNumber} — {chapterTitle}`).

**Why this priority**: P1 is critical for moderator navigation and report clarity. Without the chapter number, chapters with Chinese-only titles or similar titles are confusing to locate, requiring moderators to search back and forth across hundreds of chapters.

**Independent Test**: Perform a quality scan on a selected range of chapters (e.g., chapters #120 to #131) and verify that all generated issue cards render `#120 · 第一百二十章 ...`, `#121 · 第一百二十一章 ...`, etc., with high visual clarity, and that copying or exporting the markdown report outputs sequentially ordered chapters prefixed with `Chương #{chapterNumber}`.

**Acceptance Scenarios**:

1. **Given** a detected quality issue in chapter #134 titled "第一百三十四章 装逼", **When** rendered in the issue review card, **Then** the header shows `#134 · 第一百三十四章 装逼` where `#134` is visually highlighted with monospace emphasis and title tooltip shows the full string.
2. **Given** issues detected across non-consecutive chapters (e.g., #134, #120, #125), **When** the moderator generates the quality report (Markdown), **Then** the report groups and sorts chapters in ascending numerical order (`#120` -> `#125` -> `#134`) with headers formatted as `### Chương #{chapterNumber} — {chapterTitle}`.
3. **Given** both heuristic and AI scan engines run across multiple chapters, **When** issues are created, **Then** each issue preserves its accurate originating `chapterNumber` in memory and persistent storage.

---

### User Story 2 - Range-Based Chapter Batch Selection (Priority: P1)

When preparing a quality check session on a long novel with dozens or hundreds of chapters, the moderator can specify a numeric range ("Từ chương" and "Đến chương") and click "Chọn khoảng" to instantly select all translated chapters within that interval without manually ticking individual checkboxes.

**Why this priority**: P1 drastically improves usability for long novels (100–500+ chapters). Selecting a 12-chapter slice (e.g., chapters 120 to 131) currently requires scrolling through a long list and clicking 12 individual checkboxes.

**Independent Test**: In a project with 139 chapters, enter `120` in "Từ chương" and `131` in "Đến chương", click "Chọn khoảng", and verify that all 12 chapters in that numeric range are immediately marked as selected.

**Acceptance Scenarios**:

1. **Given** a novel project with chapters numbered 1 to 139, **When** the user inputs `120` in "Từ chương" and `131` in "Đến chương" and clicks "Chọn khoảng", **Then** all translated chapters with `chapterNumber >= 120 && chapterNumber <= 131` are selected in one step.
2. **Given** the user inputs a reversed range (e.g., `From: 131`, `To: 120`), **When** the user clicks "Chọn khoảng", **Then** the system automatically swaps the values to `[120, 131]` and selects the chapters without error.
3. **Given** the specified range contains untranslated chapters (`translationType === 'none'`), **When** the range selection is executed, **Then** untranslated chapters are automatically skipped.
4. **Given** the specified range contains more than 12 translatable chapters (e.g., 100 to 130 = 31 chapters), **When** "Chọn khoảng" is clicked, **Then** the system selects the first 12 eligible chapters and surfaces the standard limit warning banner.
5. **Given** either range input is blank or non-numeric, **When** viewing the controls, **Then** the "Chọn khoảng" button is disabled.

---

### User Story 3 - Single Chapter Quick-Select by Chapter Number (Priority: P2)

When a moderator needs to add a specific chapter to the review batch (e.g., upon finding an anomaly in chapter #134), they can type the chapter number into a dedicated quick-select field and press Enter (or click "Chọn") to instantly toggle or add that chapter to the current selection.

**Why this priority**: P2 allows rapid, keyboard-friendly selection of isolated chapters without searching or scrolling the virtualized list.

**Independent Test**: Type `134` into "Nhập số chương" and press Enter. Verify that chapter #134 is immediately toggled into the selected chapters list, and the text input is cleared for consecutive input. Type `9999` and press Enter to verify an inline transient warning ("Không tìm thấy chương #9999") appears and auto-dismisses after 2-3 seconds.

**Acceptance Scenarios**:

1. **Given** a valid chapter number existing in the project (e.g., `134`) that has a translation, **When** the user enters `134` and hits Enter or clicks "Chọn", **Then** chapter #134 is toggled into the selection, and the input field is automatically reset to empty for consecutive entry.
2. **Given** the user enters a chapter number that does not exist in the active project (e.g., `9999`), **When** submitted, **Then** an inline warning message (e.g., `text-[11px] text-amber-400`) displays "Không tìm thấy chương #9999" and automatically fades out after 2–3 seconds without throwing exceptions.
3. **Given** the user enters a chapter that has no translation (`translationType === 'none'`), **When** submitted, **Then** the system leaves selection unchanged and indicates the chapter is untranslated.

---

### User Story 4 - Session Error & Warning Visibility Banner (Priority: P1)

When session-level warnings or operational errors occur in the quality checker (such as selecting more than 12 chapters, attempting to analyze untranslated chapters, or experiencing an analysis failure), a prominent, dismissible error banner is rendered in the workspace UI to clearly explain why an action was constrained.

**Why this priority**: P1 fixes a critical UX bug where `error` state produced by `useHakoReviewSession` was never destructured or rendered in `HakoCheckerWorkspace.tsx`, causing silent rejections and leaving users confused when chapters weren't selected.

**Independent Test**: Attempt to select 15 chapters at once via range select or script. Verify that a prominent amber/red banner immediately appears above the chapter selector explaining `Đã tự động giới hạn ở 12 chương đầu tiên...`, and clicking the "x" button dismisses the banner immediately.

**Acceptance Scenarios**:

1. **Given** any error or warning state returned by `useHakoReviewSession` (`error !== null`), **When** the workspace renders, **Then** a styled warning/error banner appears displaying `error.message`.
2. **Given** an active error banner, **When** the user clicks the close ("x") button on the banner, **Then** `setError(null)` is called and the banner disappears.
3. **Given** no active error (`error === null`), **When** the workspace renders, **Then** the banner container is cleanly unmounted or hidden without taking up layout space.

---

### Edge Cases

- **Non-existent or Out-of-bounds Chapter Numbers**: Entering chapter numbers lower than the first chapter or higher than the last chapter in range or single-select gracefully selects valid intersections or shows the transient not-found hint.
- **Floating Point or Negative Inputs**: Typing negative numbers or decimal values in number inputs is sanitized or handled by integer conversion (`Math.floor` / `parseInt`).
- **Rapid Keyboard Entry**: Pressing Enter rapidly with different numbers (e.g., `100 [Enter]`, `105 [Enter]`, `110 [Enter]`) sequentially toggles the respective chapters without race conditions.
- **Range Selection Overlapping Pre-selected Chapters**: Selecting a range when some chapters within that range are already selected handles deduplication cleanly up to the 12-chapter cap.
- **Empty Projects or Zero Translatable Chapters**: Range and single-select inputs are disabled or hidden when no project is loaded or when a project contains zero chapters.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `QualityIssue` data interface MUST include `chapterNumber: number` to represent the chapter sequence index.
- **FR-002**: Heuristic quality scan engine (`runHeuristicQualityScan`) and AI scan engine (`runAiQualityScan`) MUST propagate `chapterNumber` from chapter input to all produced `QualityIssue` items.
- **FR-003**: `HakoCheckerWorkspace` analysis orchestrator MUST pass `chapterNumber` when constructing heuristic and AI scan payloads.
- **FR-004**: `HakoIssueCard` MUST render `#<chapterNumber> · <chapterTitle>` in its header with tooltip support for truncated text.
- **FR-005**: Markdown quality report generator (`generateQualityReport` / `formatQualityReportAsMarkdown`) MUST sort chapter groups by `chapterNumber` ascending and render chapter section headers as `### Chương #{chapterNumber} — {chapterTitle}`.
- **FR-006**: `HakoChapterSelector` MUST provide range selection inputs ("Từ chương" and "Đến chương") that select chapters by `chapterNumber` with automatic min/max ordering, skipping untranslated chapters and adhering to the 12-chapter limit.
- **FR-007**: `HakoChapterSelector` MUST provide a single chapter number input with submit button and `Enter` key support that toggles the specified chapter into selection and clears the input field upon success.
- **FR-008**: Single chapter selector MUST display a temporary inline notification message (auto-dismissing after 2-3 seconds) when an entered chapter number is not found in the project.
- **FR-009**: `HakoCheckerWorkspace` MUST destructure `error` from `useHakoReviewSession()` and render a dismissible error/warning alert banner with a close ("x") button calling `setError(null)`.
- **FR-010**: All UI controls and banners MUST adhere to the project's design system tokens, typography (`font-serif`, `font-mono`, `font-display`), and component primitives (`Button`, `Badge`, `Seal`, `cn`).

### Key Entities

- **QualityIssue**: The quality finding entity, augmented with `chapterNumber: number`, identifying the specific chapter sequence where an issue occurred.
- **Chapter Range Selector**: UI control state holding `fromChapter` and `toChapter` numeric values and providing batch range selection.
- **Quick Chapter Finder**: UI control state holding `targetChapterNumber`, input validation, and transient `notFoundMessage`.
- **Session Error State**: Session-level notification object `{ code: string; message: string } | null` controlling the workspace warning banner.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of detected quality issue cards display the chapter number prefix (`#<chapterNumber> ·`) across both heuristic and AI scan results.
- **SC-002**: Range selection executes in a single click, successfully selecting up to 12 chapters in <50ms without freezing or page reload.
- **SC-003**: Entering a single chapter number and pressing Enter toggles the chapter and clears the input in <50ms for seamless consecutive entry.
- **SC-004**: 100% of session errors and limit exceeded warnings triggered via `setError` are visible to the user in a styled, dismissible alert banner.
- **SC-005**: Generated Markdown quality reports have chapters ordered strictly by numerical chapter sequence with formatted chapter headers.
- **SC-006**: All quality gates pass cleanly: `npm run lint` (0 type errors), `npm test` (100% test pass), and `npm run build` (successful production build).

## Assumptions

- Novel projects use sequential integer `chapterNumber` values assigned during project import/creation.
- Maximum review batch limit remains fixed at 12 chapters to safeguard AI token quotas and browser memory.
- Design tokens from `design-system.md` (ink, parchment, parchment-2, polish, warning tones) are used for all new form inputs and banner states.
- No changes to backend translation services or core Gemini API schemas are required.
