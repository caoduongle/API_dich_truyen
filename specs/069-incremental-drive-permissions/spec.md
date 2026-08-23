# Feature Specification: Incremental Drive Permissions for Shared Project Files (Sync New Files Button)

**Feature Branch**: `069-incremental-drive-permissions`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "Bổ sung một cơ chế Google Picker chọn-nhiều-file (multi-select), neo sẵn vào driveFolderId đã biết, để cộng tác viên chủ động cấp quyền drive.file cho các file mới xuất hiện trong thư mục dự án chia sẻ — vừa gắn vào luồng 'Mở dự án được chia sẻ' lần đầu (sửa đúng lỗi gốc), vừa lộ ra thành một nút 'Đồng bộ file mới' độc lập cho các lần chia sẻ tiếp theo."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open Shared Project for the First Time with File Permission Granting (Priority: P1)

As an invited collaborator (User B), when I open a shared project for the first time via Google Picker, I want the system to prompt me to select the project files within the shared folder so that my Google account acquires `drive.file` access to `project.json`, `manifest.json`, and all initial chapter files, allowing the project to import successfully into my local workspace without encountering "project.json not found" errors.

**Why this priority**: Without explicit file selection, Google Drive's `drive.file` security scope prevents collaborators from reading files created by the project owner, causing 100% of first-time project imports to fail.

**Independent Test**: Have User A share a project folder with User B. Log in as User B, click "Mở dự án được chia sẻ (Google Picker)", pick the project folder, select all project files in the subsequent multi-file selector, and verify that the project and all chapters are fully downloaded into local storage and ready for translation.

**Acceptance Scenarios**:

1. **Given** an invited collaborator authenticated with Google, **When** they select a shared project folder via the folder picker, **Then** the application automatically opens a multi-item file picker pre-anchored to that folder ID.
2. **Given** the multi-item file picker is displayed, **When** the collaborator selects the files and confirms, **Then** the application immediately continues importing `project.json`, `manifest.json`, and all associated chapter files into local storage without requiring a second click.
3. **Given** a collaborator completes the initial import, **When** they inspect the workspace, **Then** the project title, metadata, and all chapters are available locally with storage format marked as granular and ownership marked as collaborator (`isOwner: false`).

---

### User Story 2 - Incremental Permission Sync for Newly Added Chapters (Priority: P1)

As an active collaborator (User B) working on a shared book where the project owner (User A) has uploaded new raw chapters, I want a dedicated "Đồng bộ file mới" (Sync New Files) action that re-anchors the multi-file selector directly to the project's existing Drive folder without asking me to find the folder again, so that I can quickly grant permissions to the newly added chapter files and download them into my local workspace.

**Why this priority**: During long-running novel translation, raw chapters are frequently imported or replaced in batches, generating new file IDs that collaborators cannot access until explicitly selected through the file picker.

**Independent Test**: As User A, add 5 new chapters to a shared project and push to Drive. As User B, click "Đồng bộ file mới", confirm selection in the pre-anchored file picker, and verify that the 5 new chapters are downloaded and added to User B's local workspace.

**Acceptance Scenarios**:

1. **Given** a shared project already imported in the collaborator's workspace, **When** the collaborator clicks "Đồng bộ file mới", **Then** the multi-item file picker opens immediately anchored to the project's `driveFolderId` without displaying a folder selection prompt.
2. **Given** the collaborator selects all files (including newly added chapter files and previously authorized files), **When** they confirm selection, **Then** the sync engine automatically triggers a granular pull and imports the new chapters into local storage.
3. **Given** the sync completes, **When** the collaborator checks their chapter list, **Then** all newly authorized chapters are present with their remote translation status and timestamps.

---

### User Story 3 - Resilient Granular Sync with Individual Chapter Error Isolation (Priority: P2)

As a collaborator synchronizing a shared project containing a mix of accessible and newly added (unauthorized) chapters, I want the two-way sync process to continue and successfully sync all accessible chapters even if some files fail or lack authorization, while clearly reporting the number of unsynced new chapters and suggesting the "Đồng bộ file mới" action.

**Why this priority**: Prevents a single unauthorized or inaccessible chapter file from crashing the entire synchronization process and discarding valid progress on other chapters.

**Independent Test**: Simulate a scenario where 8 chapters are authorized and 2 newly added chapters lack permissions. Trigger "Đồng bộ 2 chiều". Verify that the 8 chapters sync cleanly, the sync does not crash, and a clear notification reports: "Đã đồng bộ 8/10 chương — còn 2 chương mới cần bấm 'Đồng bộ file mới'".

**Acceptance Scenarios**:

1. **Given** a shared project sync in progress with multiple chapters to pull, **When** a specific chapter download encounters an authorization or network error, **Then** the error is captured and isolated to that chapter, allowing the remaining chapters to complete.
2. **Given** one or more chapters failed to download due to missing permissions, **When** the sync operation finishes, **Then** the user is notified with an informative status summary indicating how many chapters succeeded and prompting them to use "Đồng bộ file mới".
3. **Given** local chapter changes exist while syncing, **When** non-failing chapters are processed, **Then** local changes for those chapters are correctly pushed and timestamps are updated in the local database.

---

### User Story 4 - Zero-Overhead Workflow for Project Owners (Priority: P3)

As the project owner (User A), I want all existing backup, restore, and synchronization operations to proceed directly without showing redundant file-selection pickers, because my account already holds native ownership and `drive.file` permissions over all files I created.

**Why this priority**: Ensures the project owner's workflow remains streamlined and completely backward-compatible with zero unnecessary prompts.

**Independent Test**: As the project owner (`isOwner: true`), perform Push, Pull, and Two-way Sync. Verify that no file picker popups appear and the operation finishes seamlessly.

**Acceptance Scenarios**:

1. **Given** a user is the project owner (`isOwner === true`), **When** they trigger any sync, push, or pull action, **Then** no file authorization picker is shown.
2. **Given** the project owner views project sharing settings, **When** managing collaborators, **Then** the owner can invite or revoke collaborators without being prompted to re-authorize project files.

---

### Edge Cases

- **User Cancels File Picker**: If the user closes or cancels the multi-file Picker at any stage, the operation halts gracefully with a friendly notification and leaves the local project in its prior state without corruption.
- **Empty Shared Folder or Missing `project.json`**: If a selected folder contains no valid files or does not contain `project.json` after selection, the system provides a clear diagnostic error message explaining that the folder is not a recognized translation project.
- **Partial Selection**: If a collaborator selects only some files in the picker (leaving some chapters unselected), the system processes the selected chapters, logs skipped chapters gracefully, and allows subsequent re-selection at any time.
- **Re-Selecting Previously Authorized Files**: Selecting already-authorized files in the multi-select Picker is a safe, idempotent operation with no negative side effects.
- **Revoked Folder Access**: If the owner revokes folder permissions on Google Drive, subsequent sync attempts notify the user that folder access has been revoked without deleting local IndexedDB data.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a reusable multi-file Google Picker method that opens a file view anchored to a specified `folderId` (disallowing navigation outside that folder) and enables multi-item selection.
- **FR-002**: The multi-file Picker MUST return the list of selected item IDs and names upon user confirmation.
- **FR-003**: The initial "Mở dự án được chia sẻ" workflow MUST invoke the multi-file Picker immediately after the folder is chosen, ensuring `drive.file` permissions are granted for `project.json`, `manifest.json`, and all initial chapter files before attempting file downloads.
- **FR-004**: The system MUST automatically proceed with importing the project and chapters into local storage upon file selection confirmation in the initial import flow.
- **FR-005**: The system MUST provide a dedicated "Đồng bộ file mới" action for granular shared projects that opens the multi-file Picker pre-anchored to `project.driveFolderId` without requiring the user to re-select the folder.
- **FR-006**: The system MUST automatically trigger a granular synchronization pull immediately after the collaborator confirms file selection via "Đồng bộ file mới".
- **FR-007**: The granular synchronization engine (`syncGranularProject`) MUST wrap individual chapter downloads in error-handling boundaries so that an unauthorized or failing chapter file does not abort the synchronization of other chapters.
- **FR-008**: The granular synchronization engine MUST count successful and failed chapter downloads and provide informative feedback (e.g., "Đã đồng bộ X/Y chương — còn Z chương mới cần bấm 'Đồng bộ file mới'").
- **FR-009**: The system MUST NOT show incremental file permission pickers to the project owner (`isOwner === true`).

---

### Key Entities

- **Shared Project Folder**: A Google Drive directory representing a granular project (`AI_Dich_Truyen_Data/{projectId}/`), containing `project.json`, `manifest.json`, and individual chapter files.
- **Drive File Authorization Token**: The client-side session state granting temporary `drive.file` OAuth scope access to individual files selected through Google Picker.
- **Project Sync State**: Local IndexedDB record tracking `driveFolderId`, `driveStorageFormat: 'granular'`, `isOwner: boolean`, and chapter timestamps for granular conflict-free synchronization.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of invited collaborators can successfully import a valid shared project on the first attempt without "project.json not found" or permission errors.
- **SC-002**: Collaborators can authorize and download newly added chapters within a single user action (opening the pre-anchored picker and confirming) taking under 15 seconds.
- **SC-003**: In any synchronization batch where at least one chapter is accessible, 100% of accessible chapters complete synchronization regardless of unauthorized files in the folder.
- **SC-004**: Project owners experience zero additional prompts or clicks during standard sync workflows compared to the previous baseline.
- **SC-005**: All quality gates (`tsc --noEmit`, `vitest run`, `vite build`) pass with zero errors, zero skipped tests, and zero new runtime dependencies.

---

## Assumptions

- The OAuth 2.0 PKCE implementation and `drive.file` scope (`https://www.googleapis.com/auth/drive.file`) remain strictly unchanged to avoid Google Casa verification and unverified app warnings.
- The Google Picker JavaScript API is dynamically loaded and initialized at runtime with the user's valid access token and Google Developer API Key.
- Local storage schema in IndexedDB (`src/services/db.ts`) and core TypeScript interfaces (`src/types.ts`) remain unchanged.
- Collaborator accounts have been granted "writer" or "reader" permissions on the shared Drive folder by the owner prior to or during sharing.
