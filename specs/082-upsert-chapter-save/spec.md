# Feature Specification: Upsert Chapter Save in Translator Workspace

**Feature Branch**: `082-upsert-chapter-save`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "Tôi cần sửa lỗi nghiêm trọng trong luồng lưu chương của Mặt Trận Dịch Thuật (single-chapter translator workspace), repo API_dich_truyen. Sửa handleSaveChapter và các phần liên quan theo đúng logic UPSERT dựa trên currentChapterId..."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Update Existing Chapter In-Place (Priority: P1)

As a translator editing an existing chapter loaded from the translation history, when I make edits to the title, source text, or translations (raw or polished) and save (via button or Ctrl+S shortcut), I want the system to update the existing chapter record in-place rather than generating a duplicate chapter with a new ID.

**Why this priority**: Preventing data duplication and preserving chapter integrity is critical to workspace usability and prevents duplicate/fragmented translation history entries.

**Independent Test**:
- Open an existing chapter from Chapter History via "Mở chỉnh sửa lại".
- Edit the polished translation text and chapter title.
- Press "Lưu chương dịch" (or Ctrl+S).
- Navigate back to Chapter History: verify that the total chapter count remains unchanged, no duplicate chapter is created, and the existing chapter displays updated content and timestamp.

**Acceptance Scenarios**:

1. **Given** an existing chapter in the active project with `id = "chap_123"` loaded into the translator workspace, **When** the user edits the content and triggers `handleSaveChapter`, **Then** the chapter with `id = "chap_123"` in `activeProject.chapters` is updated in-place with the new `title`, `sourceText`, `rawTranslation`, `polishedTranslation`, `paragraphs`, `translatedLines`, `status`, and `updatedAt` timestamp, preserving its original `id` and `createdAt`.
2. **Given** an existing chapter being saved, **When** the update completes successfully, **Then** a toast notification is displayed informing the user that the specific chapter has been updated (e.g., `Đã cập nhật thành công chương: "<title>"`), and no new item is added to `activeProject.chapters`.

---

### User Story 2 - Create New Chapter with Immediate Session Binding (Priority: P1)

As a translator composing a new chapter from scratch, when I click "Lưu chương dịch" (or press Ctrl+S) for the first time, I want the system to save it as a new chapter and immediately bind the workspace session to the newly created chapter ID, so that any subsequent saves during the same editing session update that chapter instead of spawning additional duplicate chapters.

**Why this priority**: Prevents rapid successive saves (e.g., repeated Ctrl+S presses) from cluttering the chapter history with multiple clone entries for the same chapter draft.

**Independent Test**:
- Open the workspace on a clean draft (no chapter loaded).
- Enter source text and perform translation.
- Click "Lưu chương dịch" twice in succession without navigating away.
- Verify that only one new chapter is added to the project's chapter list, and the second save updates the newly created chapter.

**Acceptance Scenarios**:

1. **Given** a new chapter draft where `currentChapterId` is null (or not found in the project's chapters), **When** the user clicks "Lưu chương dịch", **Then** a new chapter with a unique ID (`chap_<timestamp>`) is prepended to `activeProject.chapters`, and `currentChapterId` is immediately updated to this new ID.
2. **Given** a newly saved chapter that just received its ID, **When** the user edits the text and clicks "Lưu chương dịch" a second time, **Then** the second save executes an in-place update on that same chapter ID without increasing the total chapter count.

---

### User Story 3 - Clean Workspace Chapter ID Reset (Priority: P2)

As a translator switching projects or loading fresh example data, I want the workspace's active chapter tracking state (`currentChapterId`) to be reset to `null` appropriately so that new draft sessions do not accidentally overwrite previously edited chapters from another project or context.

**Why this priority**: Guarantees safety against accidental cross-project or cross-session chapter overwrites.

**Independent Test**:
- Edit an existing chapter in Project A (`currentChapterId` set).
- Switch to Project B in the project management interface.
- Verify that `currentChapterId` resets to `null`, ensuring any new draft in Project B is saved as a new chapter rather than targeting the ID from Project A.

**Acceptance Scenarios**:

1. **Given** a workspace with an active `currentChapterId`, **When** `activeProject.id` changes, **Then** `currentChapterId` is reset to `null`.
2. **Given** a workspace with an active `currentChapterId`, **When** example sample text is loaded via `handleLoadExample`, **Then** the draft session is treated as fresh/unbound and resets `currentChapterId` to `null`.

---

### Edge Cases

- **Deleted Chapter ID in State**: If `currentChapterId` holds an ID that no longer exists in `activeProject.chapters` (e.g., deleted in another tab/panel), `handleSaveChapter` MUST fall back safely to the creation branch (creating a new chapter and updating `currentChapterId`) rather than failing or corrupting the list.
- **Empty Content Guard**: If `sourceText` is blank or whitespace-only, `handleSaveChapter` MUST reject saving with a warning toast and make no modifications to `activeProject.chapters`.
- **Status Calculation Accuracy**: When updating or creating a chapter, `status` must correctly reflect the current state (`'completed'` if `polishedTranslation` is present, `'in_progress'` if only `rawTranslation` is present, `'not_started'` otherwise).
- **Paragraph & Line Synchronization**: The `paragraphs` array (split from `sourceText`) and `translatedLines` array (split from `polishedTranslation` or `rawTranslation`) must be recomputed accurately on every save/update.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST perform an existence check on `currentChapterId` against `activeProject.chapters` during `handleSaveChapter` using `activeProject.chapters.find(c => c.id === currentChapterId)`.
- **FR-002**: When an existing chapter is matched by `currentChapterId`, system MUST update that chapter in-place within `activeProject.chapters` using array mapping, preserving original `id` and `createdAt`, while updating `title`, `sourceText`, `rawTranslation`, `polishedTranslation`, `paragraphs`, `translatedLines`, `status`, and setting `updatedAt` to the current ISO timestamp.
- **FR-003**: When updating an existing chapter, system MUST NOT append or prepend a new chapter object to `activeProject.chapters`.
- **FR-004**: When updating an existing chapter, system MUST display a distinct success toast indicating chapter update (e.g., `Đã cập nhật thành công chương: "<title>"`).
- **FR-005**: When `currentChapterId` is `null` or does not exist in `activeProject.chapters`, system MUST create a new `Chapter` object with a new ID (`chap_${Date.now()}`), prepend it to `activeProject.chapters`, and immediately set `currentChapterId` to the newly created chapter's ID.
- **FR-006**: When creating a new chapter, system MUST display a success toast indicating successful new chapter storage.
- **FR-007**: System MUST reset `currentChapterId` to `null` whenever `activeProject.id` changes (in the project switch effect).
- **FR-008**: System MUST maintain the existing `handleSaveChapter: () => void` interface exported from `useWorkspaceState` and consumed by `TranslatorWorkspace` and `BilingualEditor`.

### Key Entities

- **Chapter**: Represents a translated or draft chapter entity within a `StoryProject`.
  - `id`: String identifier (e.g., `'chap_' + timestamp`). Immutable once created.
  - `title`: Chapter title string.
  - `sourceText`: Raw Chinese source text.
  - `rawTranslation`: Stage 1 raw Vietnamese translation.
  - `polishedTranslation`: Stage 2 polished Vietnamese translation.
  - `paragraphs`: Array of non-empty source text paragraphs.
  - `translatedLines`: Array of non-empty translated lines.
  - `status`: `'not_started' | 'in_progress' | 'completed'`.
  - `createdAt`: ISO timestamp of original chapter creation.
  - `updatedAt`: ISO timestamp of most recent chapter modification.
- **StoryProject**: Contains project-level metadata and an array of `Chapter` records (`chapters: Chapter[]`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Re-saving an edited chapter results in 0 duplicate entries added to `activeProject.chapters` (chapter count unchanged).
- **SC-002**: 100% of updated chapter fields (`title`, `sourceText`, `rawTranslation`, `polishedTranslation`, `status`, `updatedAt`) reflect user modifications upon navigating back to Chapter History.
- **SC-003**: Successive rapid saves (Ctrl+S multiple times) on a new chapter draft produce exactly 1 new chapter entry in Chapter History instead of multiple clones.
- **SC-004**: 100% automated test pass rate with 0 TypeScript/linting regressions across the entire workspace test suite.

## Assumptions

- The workspace single-chapter editor operates on one active chapter draft at a time identified by `currentChapterId`.
- The storage layer (`IndexedDB` / `onUpdateProject`) handles persisting the full updated `StoryProject` object emitted by `useWorkspaceState`.
- Toast notification visual styling remains standard using existing `showToast` utility.
