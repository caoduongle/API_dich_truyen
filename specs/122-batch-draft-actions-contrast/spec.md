# Feature Specification: Batch Draft Management and Light Theme Contrast Hardening

**Feature Branch**: `122-batch-draft-actions-contrast`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "tôi muốn nút hàng loạt ở chỗ chọn chương nữa; không chỉ mỗi chọn từng chương; điều này rất tốn thời gian; và sửa luôn màu ở chế độ sáng; các chữ màu vàng mà nền màu này thì rất khó nhìn" kèm ảnh minh họa giao diện Lịch Sử Chương Dịch ở chế độ sáng.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Batch Draft Management in Chapter History (Priority: P1)

As a translator managing multiple translated or partially-translated chapters in the Chapter History panel, when I select multiple chapters (or click "Select All" with tens or hundreds of chapters), I want to execute bulk draft actions directly from the chapter selection toolbar:
1. **"Xóa bản biên tập (N)"**: Bulk removes polished drafts for all selected chapters that have one, preserving 100% of their raw translations.
2. **"Xóa bản dịch thô (N)"**: Bulk removes raw translations for all selected chapters that have one.
3. **"Chuyển thành bản thô (N)"**: Bulk promotes polished drafts into raw translations for all selected chapters with polished drafts, resetting their polished draft to empty so they are primed as the baseline draft for fresh polishing cycles.
4. **"Reset về gốc (N)"**: Bulk resets both raw and polished drafts back to Chinese source (retaining existing functionality).

**Why this priority**: Operating on one chapter at a time when dealing with 100+ chapters is prohibitively tedious and time-consuming. Bulk actions allow users to reset, clean, or elevate drafts for an entire volume or selection in seconds.

**Independent Test**: Select 3 chapters in the history panel (e.g. 1 with both raw and polished, 1 with only raw, 1 with only polished). Click "Xóa bản biên tập (3)" and confirm; verify in IndexedDB and the UI that only chapters with polished drafts had their polished draft cleared, raw drafts remain untouched, and the UI metadata reflects the updated state.

**Acceptance Scenarios**:

1. **Given** 10 chapters selected with varying translation states, **When** the user clicks "Xóa bản biên tập (10)" and confirms the dialog, **Then** all selected chapters with polished translations have `polishedTranslation` cleared, `rawTranslation` preserved 100%, chapter status updated to `'in_progress'`, and project metadata synchronized.
2. **Given** 10 chapters selected, **When** the user clicks "Xóa bản dịch thô (10)" and confirms the dialog, **Then** all selected chapters with raw translations have `rawTranslation` cleared, status set to `'completed'` if polished text exists or `'not_started'` otherwise, and project metadata synchronized.
3. **Given** 10 chapters selected, **When** the user clicks "Chuyển thành bản thô (10)" and confirms the dialog, **Then** all selected chapters with polished translations copy `polishedTranslation` into `rawTranslation`, clear `polishedTranslation`, set status to `'in_progress'`, and update project metadata.
4. **Given** multiple chapters selected, **When** reviewing the batch action toolbar, **Then** actions show clear count indicators (e.g. `(N)`) and display descriptive confirmation modals detailing the exact scope before making changes.

---

### User Story 2 - High-Contrast Light & Sepia Theme Typography (Priority: P1)

As a user reading or working in Light mode (`data-theme="light"`) or Sepia mode (`data-theme="sepia"`), all button text, icons, and status badges (especially warning, reset, and secondary actions) MUST maintain a minimum WCAG AA contrast ratio (>= 4.5:1) against the light parchment/cream background. Buttons must NEVER display pale yellow (`amber-300` / `#fcd34d`) on a light background.

**Why this priority**: Pale yellow text on a cream/parchment background is functionally illegible and causes severe eye strain, rendering critical buttons (like Reset and Delete) unreadable in light mode.

**Independent Test**: Render `ChapterHistoryPanel` with `data-theme="light"` on the document root; inspect the contrast ratio of the warning/reset/draft buttons. Verify the text color resolves to dark amber/ochre (`text-amber-800` or `--color-warning-darker` / `--color-warning-default` in light mode, resolving to `>= 4.5:1` contrast) while seamlessly transitioning to bright amber (`text-amber-300`) in dark mode (`data-theme="dark"`).

**Acceptance Scenarios**:

1. **Given** the app is in Light mode (`html[data-theme="light"]`) or Sepia mode (`html[data-theme="sepia"]`), **When** viewing buttons with warning or amber accents (such as "Reset về bản gốc", "Xóa bản biên tập", "Xóa bản dịch thô"), **Then** the text and icon color is a rich dark ochre/amber (`text-amber-800` / `text-warning-darker`) with high contrast against the light surface.
2. **Given** the app is switched to Dark mode (`html[data-theme="dark"]`), **When** viewing the same buttons, **Then** the text and icon color switches to radiant warm amber (`dark:text-amber-300`), maintaining excellent legibility against dark ink.
3. **Given** any theme mode, **When** hovering over these buttons, **Then** the hover background state provides clear visual feedback without washing out the text.

---

### User Story 3 - Responsive Batch Action Toolbar & Safe Selection Feedback (Priority: P2)

As a translator using different screen sizes or viewing the Chapter History panel, the batch actions toolbar in the sidebar MUST wrap cleanly without layout breaking or horizontal scrolling, and show clear progress/toasts when batch operations finish.

**Why this priority**: When 4 bulk buttons are displayed alongside the chapter list title, a cramped layout could overflow or misalign on smaller desktop/tablet viewports.

**Independent Test**: Select chapters and trigger a bulk action on 50+ chapters; verify a loading state or atomic batch update occurs, followed by an informative toast (e.g., "Đã xóa bản biên tập của 50 chương.").

**Acceptance Scenarios**:

1. **Given** chapters are selected, **When** the batch actions toolbar renders, **Then** it presents clean, compact action buttons (`Reset`, `Xóa biên tập`, `Xóa bản thô`, `Thành bản thô`) with responsive wrapping and descriptive tooltips.
2. **Given** a batch action is executed on multiple chapters, **When** the operation completes, **Then** the selection is cleared or preserved cleanly, the currently inspected chapter detail panel updates immediately if it was among the affected chapters, and a toast summarizes the completed bulk action.

---

## Edge Cases

- **What if none of the selected chapters have a polished draft when "Xóa bản biên tập" is clicked?**
  The operation executes safely, updates 0 chapters, informs the user via toast ("Không có chương nào trong danh sách đã chọn có bản dịch biên tập"), and leaves all data untouched.
- **What if none of the selected chapters have a raw draft when "Xóa bản dịch thô" is clicked?**
  The operation executes safely, updates 0 chapters, and notifies the user gracefully.
- **What if the user clicks "Chuyển thành bản thô" when chapters have no polished draft?**
  Only chapters that actually possess a non-empty `polishedTranslation` are modified. Chapters with empty polished drafts are skipped.
- **What if the user has 500+ chapters selected?**
  The bulk database operation uses `saveChapterToDB` sequentially or in indexed transaction batches, ensuring IndexedDB does not block or timeout, and updates project metadata in a single atomic pass.
- **What if the currently viewed chapter is in the selection?**
  The active chapter detail view (`selectedChapterDetails`) refreshes immediately with the new chapter state, and the active view tab switches to the logical tab (e.g. `'raw'` when polished is cleared or promoted).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: In `ChapterHistoryPanel.tsx`, when `selectedChapterIds.length > 0`, the sidebar MUST render a batch action toolbar with 4 distinct bulk operations:
  - Bulk Reset to Source ("Reset về gốc")
  - Bulk Delete Polished ("Xóa biên tập")
  - Bulk Delete Raw ("Xóa bản thô")
  - Bulk Promote Polished to Raw ("Thành bản thô")
- **FR-002**: Each bulk action MUST prompt an explicit confirmation dialog before modifying data, indicating the number of selected chapters affected.
- **FR-003**: Bulk "Xóa biên tập" MUST iterate over all selected chapters, apply `transformChapterDeletePolished` to eligible chapters (chapters with non-empty `polishedTranslation`), persist updates to IndexedDB, update `activeProject.chapters` metadata, and refresh the active chapter detail view if affected.
- **FR-004**: Bulk "Xóa bản thô" MUST iterate over all selected chapters, apply `transformChapterDeleteRaw` to eligible chapters (chapters with non-empty `rawTranslation`), persist updates to IndexedDB, update `activeProject.chapters` metadata, and refresh the active chapter detail view if affected.
- **FR-005**: Bulk "Chuyển thành bản thô" MUST iterate over all selected chapters, apply `transformChapterPromotePolishedToRaw` to eligible chapters (chapters with non-empty `polishedTranslation`), persist updates to IndexedDB, update `activeProject.chapters` metadata, and refresh the active chapter detail view if affected.
- **FR-006**: Bulk "Reset về gốc" MUST retain existing behavior via `onResetChapters`, resetting both drafts to Chinese text and refreshing state.
- **FR-007**: All warning/reset/draft action buttons across `ChapterHistoryPanel.tsx` (both single-chapter action buttons and batch action buttons) MUST replace hardcoded `text-amber-300 border-amber-800/40 hover:bg-amber-950/20` with theme-adaptive styling:
  - Light / Sepia: `text-amber-800 border-amber-300 hover:bg-amber-100/60` (or semantic `text-warning-darker dark:text-warning-lighter border-warning/40 hover:bg-warning/10`)
  - Dark: `dark:text-amber-300 dark:border-amber-800/40 dark:hover:bg-amber-950/20`
  - Ensure minimum 4.5:1 contrast ratio against the background across all themes.
- **FR-008**: The batch action toolbar in `ChapterHistoryPanel.tsx` MUST be organized cleanly (e.g. compact flex container with wrapping) to maintain visual hierarchy without pushing the virtual chapter list off-screen.
- **FR-009**: Pure state transformation functions in `ChapterHistoryPanel.tsx` (`transformChapterDeletePolished`, `transformChapterDeleteRaw`, `transformChapterPromotePolishedToRaw`) MUST remain pure and exported for unit testing.
- **FR-010**: All UI components MUST adhere to `.agents/rules/design-system.md` (no default rose/red/pink, rounded-[2px] / rounded-md corners, Lucide icons, `Button` primitive).

### Success Criteria *(mandatory)*

- **SC-001**: Users can execute batch delete-polished, batch delete-raw, batch promote-to-raw, and batch reset on any number of selected chapters with a single confirmation.
- **SC-002**: 100% of text on warning and draft management buttons achieves WCAG AA compliant contrast (>= 4.5:1) in Light, Sepia, and Dark themes.
- **SC-003**: 0 instances of unreadable yellow text on light/cream backgrounds.
- **SC-004**: Database consistency: all bulk operations atomically update IndexedDB and propagate new statuses to `activeProject.chapters`.
- **SC-005**: Quality gates clean: `npm run lint`, `npm test`, and `npm run build` pass with 0 errors.

---

## Assumptions

- Users who select all chapters intend to apply the batch operation to all matching chapters in that selection (e.g., chapters that actually have a polished draft).
- A confirmation dialog is sufficient protection against accidental bulk clicks.
- The project metadata array `activeProject.chapters` contains lightweight status and timestamps, while full chapter drafts are stored in IndexedDB.
