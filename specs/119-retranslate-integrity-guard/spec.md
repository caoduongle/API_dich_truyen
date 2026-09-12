# Feature Specification: Retranslate Integrity Guard and Safe Draft Preservation

**Feature Branch**: `119-retranslate-integrity-guard`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "vấn đề là bây giờ tôi bị như thế này; vì trước đó cơ chế đệ quy bị lỗi nên nó thành ra như trong ảnh; nếu tôi ấn dịch từ đầu thì nó lại coi như bản biên tập bị cụt do mất cơ chế đệ quy này là bản dịch thô xong xóa bản dịch thô trước đó đi (bản trước đó có cơ chế đệ quy nên rất đầy đủ); hãy tìm hướng giải quyết. Thêm nút: ở đây có nút reset lại từ bản gốc; tôi muốn thêm nút xóa bản biên tập, nút xóa bản dịch thô và nút chuyển bản biên tập thành bản dịch thô để chuốt"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - True Re-Translation From Scratch (Priority: P1)

As a translator who encounters corrupted, truncated, or incomplete chapters from past runs, when I select "Dịch từ đầu" (`from_scratch`), the translation engine MUST perform a fresh Phase 1 raw translation directly from the original Chinese source text (`chapter.sourceText`), followed by Phase 2 polishing. It must NEVER skip Phase 1 or treat an existing cut-off translation as the raw draft.

**Why this priority**: When a chapter has a broken translation, "Dịch từ đầu" is the user's primary recovery mechanism. Skipping Phase 1 and reusing the corrupted text destroys user trust, locks in the error, and makes it impossible to recover the full chapter without manual database manipulation.

**Independent Test**: Call `executeSingleChapterTranslation` on a chapter that already has a 1-paragraph `polishedTranslation` with `autoTranslateMode = 'from_scratch'`; verify that `translateRawDirect` is called with full `sourceText`, producing a fresh full-length `rawTranslation`, and the resulting chapter contains complete content.

**Acceptance Scenarios**:

1. **Given** a chapter with existing (or truncated) `rawTranslation` and `polishedTranslation`, **When** the user executes translation with `autoTranslateMode = 'from_scratch'`, **Then** the service executes Phase 1 (`translateRawDirect`) from the source text and logs the start of Phase 1 translation, ignoring any prior partial text.
2. **Given** a chapter with truncated text, **When** "Dịch từ đầu" completes, **Then** the saved chapter in IndexedDB has both a full `rawTranslation` and a full `polishedTranslation` covering the entire chapter.

---

### User Story 2 - Truncated Draft Integrity Guard (Priority: P1)

As a translation system handling automated chapter workflows, whenever existing translations are evaluated for reuse (e.g. in re-polish or resume workflows), the system MUST compare the length and paragraph count of the candidate draft against `chapter.sourceText`. If the draft is suspiciously truncated (e.g. length < 40% of source text, or 1 paragraph vs multi-paragraph source), the engine flags it as `TRUNCATED_DRAFT`, logs a warning, and automatically initiates a fresh raw translation from `sourceText` instead of propagating the truncated text.

**Why this priority**: Prevents silent truncation cascading. If a previous run only translated 1 paragraph before stopping, any automated workflow must detect this incompleteness and refuse to treat it as a valid, complete translation.

**Independent Test**: Provide a 1000-character Chinese source text and a 100-character Vietnamese candidate draft; verify `isDraftTruncated` evaluates to `true`, and the engine logs `[Cảnh báo toàn vẹn]` and triggers Phase 1 raw translation.

**Acceptance Scenarios**:

1. **Given** a chapter with a candidate draft whose length is less than 40% of the Chinese source text, **When** evaluated for reuse, **Then** the system detects truncation, rejects the candidate, and falls back to fresh raw translation from `sourceText`.
2. **Given** a multi-paragraph source text (>= 3 paragraphs) and a single-paragraph candidate draft, **When** evaluated, **Then** the system flags paragraph mismatch and refuses to treat the single paragraph as a complete chapter.

---

### User Story 3 - Strict Separation & Immutability of Raw vs Polished Drafts (Priority: P2)

As a user who relies on Phase 1 raw translations as the source of truth, when Phase 2 polishing runs, the input draft (`firstDraft`) MUST strictly be sourced from `chapter.rawTranslation` and NEVER from `chapter.polishedTranslation`. Furthermore, if Phase 1 was skipped during a re-polishing run, `chapter.rawTranslation` in IndexedDB MUST remain untouched and immutable, preventing any corrupted Phase 2 output from overwriting the raw translation.

**Why this priority**: `rawTranslation` is the literal translation foundation. Blending `polishedTranslation` into `firstDraft` creates a cyclic feedback loop where partial or hallucinated text overwrites the literal translation forever.

**Independent Test**: Execute a polish pass on a chapter with existing `rawTranslation`; verify `chapter.rawTranslation` remains strictly identical to its pre-run content, and only `chapter.polishedTranslation` is updated.

**Acceptance Scenarios**:

1. **Given** an existing `chapter.rawTranslation` and `chapter.polishedTranslation`, **When** selecting a candidate draft for polishing, **Then** the system strictly takes `chapter.rawTranslation`.
2. **Given** an execution that only runs Phase 2, **When** saving to IndexedDB, **Then** the existing `rawTranslation` is preserved byte-for-byte.

---

### User Story 4 - Re-polish Only Mode ("Chỉ chuốt lại từ bản dịch thô") (Priority: P2)

As a user with a library of completed raw translations who wants to apply the new recursive polishing engine without spending API tokens re-doing Phase 1, I can select a dedicated "Chỉ chuốt lại" (Re-polish from Raw Draft) mode. The system safely reads existing complete `rawTranslation`, passes the integrity guard, and runs Phase 2 polishing while keeping `rawTranslation` safe.

**Why this priority**: Saves substantial API quota and time for users who already have complete raw translations and only want to upgrade the literary polish.

**Independent Test**: Execute queue with mode `repolish`; verify Phase 1 is bypassed only if `rawTranslation` passes integrity check, and Phase 2 runs directly.

**Acceptance Scenarios**:

1. **Given** a chapter with a valid, non-truncated `rawTranslation`, **When** translated under `repolish` mode, **Then** Phase 1 is skipped, Phase 2 executes with the raw translation as input, and the chapter completes.
2. **Given** a chapter under `repolish` mode whose `rawTranslation` is missing or truncated, **When** processed, **Then** the engine automatically falls back to running Phase 1 to generate a valid raw draft first.

---

### User Story 5 - Granular Draft Controls in Chapter History Viewer (Priority: P2)

As a translator reviewing stored chapters in the Chapter History Panel (`ChapterHistoryPanel`), I want granular control buttons for managing draft states:
1. **"Xóa bản biên tập"**: Clears only `chapter.polishedTranslation`, leaving `chapter.rawTranslation` intact so I can re-polish from the clean raw draft.
2. **"Xóa bản dịch thô"**: Clears only `chapter.rawTranslation`, resetting the chapter status appropriately.
3. **"Chuyển thành bản thô"**: Promotes the current `polishedTranslation` to become the `rawTranslation` (clearing `polishedTranslation`), preparing this polished text to be the new baseline draft for subsequent polishing rounds.

**Why this priority**: Empowers users to manually fix, reset, or elevate translation states per-chapter without wiping everything back to Chinese text.

**Independent Test**: Mount `ChapterHistoryPanel` with a chapter containing both raw and polished translations; click each button, verify confirmation modal appears, database is updated, state is synced, and the viewer switches to the expected tab.

**Acceptance Scenarios**:

1. **Given** a chapter with `polishedTranslation`, **When** user clicks "Xóa bản biên tập" and confirms, **Then** `polishedTranslation` is set to empty string, `rawTranslation` is preserved, tab switches to "Dịch thô", and a confirmation toast is shown.
2. **Given** a chapter with `rawTranslation`, **When** user clicks "Xóa bản dịch thô" and confirms, **Then** `rawTranslation` is set to empty string, tab switches to "Bản gốc", and chapter status updates.
3. **Given** a chapter with `polishedTranslation`, **When** user clicks "Chuyển thành bản thô" and confirms, **Then** `rawTranslation` takes the value of `polishedTranslation`, `polishedTranslation` is cleared, status is set to `'in_progress'`, and tab switches to "Dịch thô".

---

## Edge Cases

- **What happens if a chapter has no `sourceText`?**
  The engine throws a clear descriptive error and marks the chapter failed without corrupting any fields.
- **What happens if a user clicks "Dịch từ đầu" on a chapter that was never translated before?**
  It runs Phase 1 and Phase 2 normally from `sourceText`.
- **What happens if a short chapter naturally has only 1 paragraph in Chinese?**
  The integrity guard checks relative ratio (e.g. character count >= 35% of source) rather than purely paragraph count, so legitimately short chapters are not falsely flagged as truncated.
- **What happens if the user wants to recover a chapter where `rawTranslation` was already overwritten with a 1-paragraph fragment?**
  Selecting "Dịch từ đầu" will now properly re-translate from `chapter.sourceText`, generating a brand new complete `rawTranslation` and `polishedTranslation`.
- **What happens if user clicks "Chuyển thành bản thô" when no polished text exists?**
  The button is hidden or disabled when `polishedTranslation` is absent.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: In `chapterTranslationService.ts`, when `autoTranslateMode === 'from_scratch'`, the service MUST always execute Phase 1 (`translateRawDirect`) using `chapter.sourceText` and MUST NOT bypass Phase 1 under any circumstances.
- **FR-002**: The candidate draft for Phase 2 polishing MUST strictly read from `chapter.rawTranslation`. The expression `(chapter.polishedTranslation || chapter.rawTranslation)` MUST NOT be used to source Phase 2 input drafts.
- **FR-003**: The engine MUST implement an integrity guard function `isDraftTruncated(draft: string, sourceText: string): boolean`:
  - A draft is truncated if its character length is less than 35% of the source text length (for source text > 150 characters).
  - A draft is truncated if the source text has >= 3 paragraphs but the draft has only 1 paragraph and length < 50% of source.
- **FR-004**: If an existing candidate draft is determined to be truncated during any reuse attempt, the system MUST emit a warning log `[Cảnh báo toàn vẹn]` and automatically invoke `translateRawDirect` from `chapter.sourceText`.
- **FR-005**: In `chapterTranslationService.ts`, saving `updatedFullChapter` to IndexedDB MUST preserve the original `chapter.rawTranslation` if Phase 1 was skipped, ensuring Phase 2 cannot corrupt or overwrite the raw draft.
- **FR-006**: Support `repolish` mode alongside `resume` and `from_scratch` across `TranslationConfigPanel`, `AutoTranslator`, `useTranslationProcess`, and `chapterTranslationService`.
- **FR-007**: In `ChapterHistoryPanel.tsx`, provide a "Xóa bản biên tập" button (visible when `chap.polishedTranslation` is present) that prompts confirmation, clears `polishedTranslation`, saves to DB, updates state, and switches tab to `'raw'`.
- **FR-008**: In `ChapterHistoryPanel.tsx`, provide a "Xóa bản dịch thô" button (visible when `chap.rawTranslation` is present) that prompts confirmation, clears `rawTranslation`, saves to DB, updates state, and switches tab to `'source'`.
- **FR-009**: In `ChapterHistoryPanel.tsx`, provide a "Chuyển thành bản thô" button (visible when `chap.polishedTranslation` is present) that prompts confirmation, copies `polishedTranslation` into `rawTranslation`, resets `polishedTranslation = ''`, sets status to `'in_progress'`, saves to DB, updates state, and switches tab to `'raw'`.
- **FR-010**: All UI additions in `ChapterHistoryPanel.tsx` MUST conform to `.agents/rules/design-system.md` (using `Button` primitives with proper variants, clean responsive flex wrapping, and confirm dialogs via `useNotifications`).

### Key Entities

- **AutoTranslateMode**: Extended union type `'resume' | 'from_scratch' | 'repolish'`.
  - `'resume'`: Dịch tiếp tục các chương chưa dịch (`status !== 'completed'`).
  - `'from_scratch'`: Dịch lại từ đầu toàn bộ Giai đoạn 1 (thô) và Giai đoạn 2 (chuốt) từ tiếng Trung gốc.
  - `'repolish'`: Chỉ chuốt lại từ bản dịch thô đã có (chỉ chạy GĐ2, bảo vệ nguyên vẹn bản thô).
- **DraftIntegrityCheckResult**: Contains `isTruncated: boolean`, `reason?: string`, `sourceLength: number`, `draftLength: number`, `sourceParagraphs: number`, `draftParagraphs: number`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of chapters processed under `from_scratch` mode execute Phase 1 raw translation directly from `sourceText`.
- **SC-002**: 100% of truncated drafts (such as 1-paragraph fragments on full chapters) are blocked by the integrity guard and replaced with full translations.
- **SC-003**: 0 instances of `chapter.rawTranslation` being overwritten or contaminated by `chapter.polishedTranslation`.
- **SC-004**: Users can independently delete polished text, delete raw text, or promote polished text to raw text directly from the Chapter History viewer.
- **SC-005**: All automated quality gates pass cleanly (`npm run lint`, `npm test`, `npm run build`).

## Assumptions

- Chinese chapters have substantial text content (typically > 500 characters); legitimate chapters with < 100 characters are rare edge cases handled gracefully.
- Re-polishing requires a valid raw draft; if the raw draft is missing or truncated, falling back to Phase 1 translation is the expected and desired behavior.
- Promoting polished text to raw text is intended for multi-stage progressive refinement workflows.
