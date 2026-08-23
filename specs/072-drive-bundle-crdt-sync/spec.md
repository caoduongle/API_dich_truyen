# Feature Specification: Single-File Bundle Storage, CRDT Merge on Pull, and Responsive Google Picker

**Feature Branch**: `072-drive-bundle-crdt-sync`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "Hợp nhất dữ liệu Drive dự án chia sẻ thành 1 file bundle duy nhất (thay vì project.json + manifest.json + chapter_*.json rời rạc), bổ sung merge CRDT khi pull thay vì ghi đè, và sửa lỗi kích thước Google Picker."

---

## Background & Problem Statement

Under the minimal and non-negotiable `drive.file` OAuth scope, Google Drive permissions are non-recursive: a collaborator (User B) only receives access to files created by User B or files explicitly picked by User B via Google Picker. In the previous multi-file architecture (`project.json`, `manifest.json`, and `chapter_*.json` separate files), whenever the project owner (User A) created new chapters after User B's initial import:
1. User B's file listing calls could not see User A's newly added chapter files, leading to duplicate file creation when User B synced.
2. Direct media downloads (`files/{fileId}?alt=media`) on unauthorized new files returned 404 errors (Drive masking 403 authorization failures).
3. The previous interim fix (Spec 069) added a "Đồng bộ file mới" multi-select Picker workaround, but this required manual re-selection every time new chapters were added.
4. Additionally, Google Picker popups lacked explicit responsive dimensions (`builder.setSize`), leading to cropped headers and unclickable modals under non-100% browser zoom levels.
5. Furthermore, chapter reconciliation during pull relied on simple timestamp last-write-wins (LWW) and full-chapter overwrite, risking data loss for concurrent local changes across multiple chapters in a bundle.

This specification unifies project data into a **single bundle file** on Google Drive, integrates **CRDT merge on pull**, cleans up manual permission granting flows, and fixes Google Picker display dimensions.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One-Click Shared Project Import via Single-File Bundle (Priority: P1) 🎯 MVP

As an invited collaborator (User B), when I import a shared translation project via Google Picker, I want to select a single project bundle file (`project_bundle.json`) in one step, so that my account obtains permanent `drive.file` access to the entire project and all present/future chapters without needing secondary multi-file selection or subsequent manual re-authorizations.

**Why this priority**: Solves the root cause of 404 errors, duplicate file collisions, and multi-step import friction by reducing the shared project on Google Drive to a single, permanently authorized file identity.

**Independent Test**: Have User A share a project bundle file with User B on Google Drive. User B clicks "Mở dự án được chia sẻ", selects the bundle file in Google Picker once, and confirms that the project metadata and all chapters are imported into User B's workspace immediately.

**Acceptance Scenarios**:

1. **Given** an invited collaborator with access to a shared project bundle file, **When** they click "Mở dự án được chia sẻ" in Google Sync, **Then** Google Picker opens in single-file selection mode filtered for project bundle JSON files.
2. **Given** the collaborator selects the project bundle file, **When** they confirm selection, **Then** the application downloads the bundle, extracts project metadata and all chapter records, and saves them into local IndexedDB with `isOwner: false` and the bundle file ID stored for future sync operations.
3. **Given** the project owner later adds new chapters and pushes an updated bundle to Drive, **When** the collaborator performs a sync, **Then** the new chapters are pulled automatically using the same authorized file ID without showing any picker prompts or errors.

---

### User Story 2 - Conflict-Resistant CRDT Merge on Chapter Pull (Priority: P1) 🎯 MVP

As a translator or editor (User A or User B) pulling remote updates from Google Drive, when the remote bundle contains chapter changes that overlap with my unpushed local changes, I want the system to merge the chapter content and metadata using CRDT (Conflict-free Replicated Data Types via Yjs) rather than overwriting my entire chapter, so that neither author's translation edits, polishings, or title changes are silently erased.

**Why this priority**: In a single-file bundle architecture, a single pull operation reconciles all modified chapters at once. Merging via CRDT prevents bulk data loss when multiple team members edit chapters concurrently.

**Independent Test**: Simulate concurrent edits on Chapter 1: User A edits paragraph 1 remotely while User B edits paragraph 2 locally. When User B pulls the bundle, verify that both paragraph 1 and paragraph 2 changes are merged and preserved in User B's local database.

**Acceptance Scenarios**:

1. **Given** a local chapter and a remote chapter from the pulled bundle, **When** the pull reconciliation executes, **Then** the system decodes the remote CRDT state snapshot, merges it with the local CRDT chapter document, and updates the local database with the merged result.
2. **Given** concurrent edits to text fields (`rawText`, `polishedText`), **When** merged, **Then** character-level and paragraph-level diffs are resolved deterministically without full text overwrites.
3. **Given** concurrent edits to chapter metadata (e.g. `title`, `status`, `translatedLines`), **When** merged, **Then** the fields are merged per-key using deterministic last-write semantics rather than discarding entire chapter objects.

---

### User Story 3 - Responsive and Unobscured Google Picker (Priority: P2)

As a user opening Google Picker on various screen sizes or browser zoom levels (e.g., 90%, 110%, 125%), I want the Google Picker dialog to fit comfortably within my viewport with visible header, search bar, and action buttons, so that I can easily navigate and select files without parts of the interface being cut off or unclickable.

**Why this priority**: Eliminates a verified UI bug where Google Picker opened without explicit dimensions, clipping modal headers and controls under browser zoom.

**Independent Test**: Zoom browser to 125% and 80%, open Google Picker, and verify that the modal dimensions dynamically constrain to at most 90% of viewport width (max 1051px) and 90% of viewport height (max 650px), with all buttons, header, and search box fully visible and clickable.

**Acceptance Scenarios**:

1. **Given** any browser window size or zoom level, **When** Google Picker is launched, **Then** the builder applies bounded dimensions (`width <= Math.min(1051, innerWidth * 0.9)`, `height <= Math.min(650, innerHeight * 0.9)`).
2. **Given** a resized browser window, **When** Picker opens, **Then** no modal controls or header elements are positioned off-screen.

---

### User Story 4 - Seamless Deprecation of Incremental Workarounds and Clean Owner Migration (Priority: P3)

As a project owner (User A) with existing projects, when I use the application after this update, I want my project to automatically bundle into the unified format on Drive upon sync, and I want obsolete manual workaround UI (such as "Đồng bộ file mới" and multi-select folder prompts) to be cleanly removed, so that the sync interface is simple, intuitive, and clutter-free.

**Why this priority**: Removes legacy complexity, eliminates user confusion around "Đồng bộ file mới", and cleans up the UI/UX while providing a smooth migration path for existing projects.

**Independent Test**: Verify that the "Đồng bộ file mới" card and button are removed from `ShareProjectModal`, and that project owners uploading to Drive produce the single bundle file seamlessly.

**Acceptance Scenarios**:

1. **Given** an existing project owned by User A, **When** User A performs a backup or push to Google Drive, **Then** the system bundles the project metadata and all chapters with their CRDT snapshots into a single bundle file on Drive.
2. **Given** the sharing and sync UI modals, **When** inspected, **Then** the "Đồng bộ file mới" card, buttons, and references to incremental permission warnings are cleanly removed.
3. **Given** an existing granular project on Drive, **When** the owner transitions to the bundle format, **Then** collaborators are prompted via a clear, one-time flow to select the new shared bundle file via Picker.

---

### Edge Cases

- **Corrupted or Malformed Bundle File**: If the downloaded bundle JSON is truncated or has invalid structure, the sync operation halts safely, reports a clear error message, and leaves local IndexedDB data intact.
- **Empty or Missing Chapters in Bundle**: If a bundle contains an empty chapter list or missing chapters, the system reconciles existing local chapters safely without deleting them unless explicitly deleted by a tombstone mechanism.
- **Offline / Network Interruption during Bundle Sync**: If a network failure occurs midway through downloading or uploading the bundle, the transaction fails atomically without partial state corruption in IndexedDB.
- **Large Novel Bundles**: If a project contains hundreds of chapters (e.g. 500+ chapters), the JSON bundle serialization/deserialization and CRDT decode remain memory-efficient and do not block the browser UI thread noticeably.
- **Picker Cancelled by User**: If the user dismisses the single-file Google Picker without selecting a file, the system exits the import flow gracefully without showing error toasts or leaving orphan state.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST store and synchronize shared Google Drive projects as a **single unified JSON bundle file** containing project metadata and an array of all chapters with embedded CRDT snapshot data.
- **FR-002**: The Google Picker service MUST provide a **single-file selection workflow** configured to select the project bundle JSON file, returning the selected file ID and name.
- **FR-003**: The Google Picker builder MUST dynamically compute and set explicit modal dimensions (`width: Math.min(1051, Math.round(window.innerWidth * 0.9))`, `height: Math.min(650, Math.round(window.innerHeight * 0.9))`) before rendering, preventing header clipping across varying zoom levels and viewports.
- **FR-004**: When importing a shared project via Google Picker, the system MUST download the bundle by its single file ID, extract project and chapter data, and save them into local IndexedDB with appropriate drive file references (`isOwner: false`).
- **FR-005**: When pulling remote chapter updates during synchronization, the system MUST merge remote chapter data into local chapters using **CRDT merge utilities** (`applyDocUpdate` / `readChapterFromYDoc`) for text fields (`rawText`, `polishedText`) and per-key last-write-wins for chapter metadata, rather than performing destructive full-object overwrites.
- **FR-006**: The system MUST retain and persist CRDT document lineage for chapters in local storage so that incremental text differences are accurately tracked and merged over successive sync cycles.
- **FR-007**: The system MUST REMOVE and DEPRECATE the "Đồng bộ file mới" button, card, and associated multi-file permission granting logic from `ShareProjectModal.tsx`, `GoogleSyncModal.tsx`, and sync services (superseding Spec 069).
- **FR-008**: The system MUST support automatic migration for project owners (`isOwner: true`), bundling local project and chapter data into the single bundle format on their next Drive push/sync.
- **FR-009**: The system MUST maintain the existing minimal OAuth scope (`https://www.googleapis.com/auth/drive.file`) without requesting elevated or full Drive permissions.
- **FR-010**: All local database schema changes MUST be strictly additive (e.g. optional fields in IndexedDB) without altering existing core types or breaking offline functionality.

---

### Key Entities

- **Project Bundle File (`project_bundle.json`)**: A single JSON document on Google Drive containing `{ project: ProjectMetadata, chapters: Array<ChapterWithCrdtSnapshot>, version: number, exportedAt: string }`.
- **Chapter CRDT Snapshot**: Base64-encoded binary representation of a chapter's Yjs document state (`crdtSnapshot`), encapsulating editing history and text fragments for conflict-free reconciliation.
- **Drive Bundle Reference**: Identifier stored in local project state (`driveFileId` / `driveFolderId`) representing the authorized bundle file on Google Drive under the user's `drive.file` scope.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of collaborator project imports succeed in a **single Picker interaction** (1 file selected, 0 sub-folder or multi-file picker steps).
- **SC-002**: Zero 404 or permission errors when the owner adds new chapters and collaborator syncs, eliminating 100% of recurring manual permission prompts.
- **SC-003**: 100% of concurrent text edits across local and remote chapters merge cleanly without losing unpushed local edits during pull operations.
- **SC-004**: Google Picker popup renders with 0% header or control clipping across viewport widths from 360px to 4K and zoom levels from 75% to 150%.
- **SC-005**: All strict quality gates (`npm run lint` / `tsc --noEmit`, `npm test` / `vitest run`, `npm run build`) pass cleanly with zero errors and zero skipped tests.

---

## Assumptions

- The project continues to operate under the `drive.file` OAuth scope (`https://www.googleapis.com/auth/drive.file`) without requiring Google app verification or elevated permissions.
- Collaborators have been granted access to the shared bundle file or containing folder on Google Drive by the project owner.
- Yjs CRDT library (`yjs`) already installed and present in the codebase is utilized for document merging and diff calculation.
- Client-side browser environments running the app support IndexedDB and modern Web APIs.
- Existing legacy granular files on Google Drive (`project.json`, `chapter_*.json`) can be superseded by the new bundle file without breaking existing local project state.
