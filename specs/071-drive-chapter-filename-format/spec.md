# Feature Specification: Human-Readable Chapter Filenames on Google Drive for Picker Usability

**Feature Branch**: `071-drive-chapter-filename-format`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User prompt: "Phần 3 — Sửa tên file Drive để có thể phân biệt trong Picker (bổ sung, tối giản). Bug: Chapter.id sinh với tiền tố 'chap_file_' hoặc 'chap_' dẫn đến tên file 'chapter_chap_file_1234567890_0.json' không thể phân biệt trong Google Picker. Yêu cầu: KHÔNG đổi Chapter.id (giữ nguyên schema), CHỈ đổi công thức đặt tên file Drive (số thứ tự + tiêu đề rút gọn: chapter_003_ten-chuong.json) trên mọi nơi trong driveGranularSync.ts và manifest."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visually Identifiable Chapter Files in Google Picker (Priority: P1) 🎯 MVP

As a collaborator or owner opening Google Picker (multi-select dialog) to view or authorize files in a shared project folder, I want chapter files on Google Drive to be named with sequential indices and sanitized chapter titles (e.g. `chapter_001_hoi-1-khoi-dau.json`) instead of internal hash/timestamp IDs (`chapter_chap_file_1724412345_0.json`), so that I can immediately identify, verify, and select chapters by eye in the Picker interface.

**Why this priority**: In the multi-select Google Picker, users must select files manually. When all files share identical timestamp prefixes like `chapter_chap_file_...`, users cannot tell which file corresponds to which chapter, leading to selection mistakes or confusion.

**Independent Test**: Create a story project with 3 chapters ("Hồi 1: Khởi Đầu", "Hồi 2: Gặp Gỡ", "Hồi 3: Quyết Đấu"). Migrate to granular subfolder on Google Drive. Open Google Picker on that folder and verify that the file names in Drive are formatted as `chapter_001_hoi-1-khoi-dau.json`, `chapter_002_gap-go.json`, and `chapter_003_quyet-dau.json`.

**Acceptance Scenarios**:

1. **Given** a story project with named chapters, **When** `migrateProjectToGranularSubfolder` or `syncGranularProject` uploads chapter files to Google Drive, **Then** the file names follow the format `chapter_{3-digit-index}_{sanitized-slug}.json`.
2. **Given** a chapter with no title or empty title, **When** uploaded, **Then** the file name cleanly falls back to `chapter_{3-digit-index}.json`.
3. **Given** `manifest.json` uploaded to the shared folder, **When** inspected, **Then** each item in `manifest.chapters` preserves the internal `id: string` while recording `fileName?: string` matching the Drive file name.

---

### User Story 2 - Resilient Backward Compatibility for Existing Chapter Files (Priority: P1)

As a collaborator synchronizing an existing shared project that was created with legacy file names (`chapter_chap_...`), I want `syncGranularProject` and `importProjectFromSharedFolder` to correctly resolve chapter files by checking `manifest.fileName`, `manifest.fileId`, legacy filename patterns, and picker selected files, so that existing shared projects continue to work without data loss.

**Why this priority**: Existing shared folders on Google Drive already contain legacy-named chapter files. The synchronization engine must seamlessly recognize both legacy and new naming conventions.

**Independent Test**: Run `importProjectFromSharedFolder` against a mock Drive folder containing both legacy-named files (`chapter_chap_123.json`) and new-formatted files (`chapter_001_hoi-1.json`). Verify both formats import cleanly into IndexedDB with correct `Chapter.id` mappings.

**Acceptance Scenarios**:

1. **Given** a manifest with legacy chapter file names, **When** `importProjectFromSharedFolder` validates and downloads chapters, **Then** it successfully matches `selectedFiles` by `fileId`, `fileName`, or legacy naming patterns.
2. **Given** a new chapter added locally, **When** `syncGranularProject` pushes the chapter to Drive, **Then** it generates the new formatted file name while preserving the existing `Chapter.id` in IndexedDB.
3. **Given** local `Chapter.id` in IndexedDB (`chap_xxx`), **When** saved or updated, **Then** the `id` value remains unchanged.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST implement a deterministic utility `formatChapterFileName(index: number, title?: string, chapId?: string): string` producing human-readable file names in the format `chapter_{padIndex}_{slug}.json` (e.g. `chapter_001_hoi-1-khoi-dau.json`), with clean fallback to `chapter_{padIndex}.json`.
- **FR-002**: `migrateProjectToGranularSubfolder` in `driveGranularSync.ts` MUST use `formatChapterFileName` when creating new chapter files and record `fileName` in `manifest.json`.
- **FR-003**: `syncGranularProject` in `driveGranularSync.ts` MUST use `formatChapterFileName` when uploading new chapters to Google Drive.
- **FR-004**: `importProjectFromSharedFolder` in `driveGranularSync.ts` MUST match chapter files in `selectedFiles` against `chapMeta.fileName`, `formatChapterFileName(index, chapMeta.title, chapMeta.id)`, `chapMeta.fileId`, or legacy pattern `chapter_${chapMeta.id}.json`.
- **FR-005**: `Chapter.id` in `src/types.ts` and IndexedDB MUST NOT be altered or migrated, maintaining strict compliance with the Immutable Core Schemas principle.

---

### Key Entities

- **Human-Readable Drive Filename**: String representing the Google Drive file `name` attribute in the format `chapter_{001-999}_{sanitized-title}.json`.
- **Chapter Manifest Item (`SharedChapterMetadata`)**: Item inside `manifest.json` containing `{ id, title, fileId, fileName?, updatedAt, status }`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of newly migrated or uploaded chapter files on Google Drive have clear 3-digit index prefixes and sanitized Vietnamese/English titles visible in Google Picker.
- **SC-002**: Zero modifications to `Chapter.id` format in IndexedDB or application runtime memory.
- **SC-003**: 100% backward compatibility with existing legacy chapter files (`chapter_chap_*.json`).
- **SC-004**: All automated quality gates (`tsc --noEmit`, `vitest run`, `vite build`) pass with 0 type errors and 0 test failures.

---

## Assumptions

- Google Drive file names support standard UTF-8 characters; sanitized ASCII slugs (e.g. `chapter_001_hoi-1.json`) ensure maximum compatibility across all operating systems, Google Picker views, and URL handlers.
- Chapters within a story project have a deterministic order based on their array index.
