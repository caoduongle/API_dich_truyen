# Feature Specification: Self-Healing and Graceful Recovery for Missing Google Drive Folders and Files

**Feature Branch**: `073-drive-folder-self-healing`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "Fix: tự phục hồi khi Google Drive folder bị xoá thủ công. driveFolderId được lưu cứng trong IndexedDB và các hàm sync dùng thẳng ID mà không kiểm tra folder còn tồn tại hay không. Bổ sung fileExists vào DriveRestClient, tự phục hồi trong syncGranularProject, thông báo lỗi rõ ràng trong importProjectFromSharedFolder, và hỗ trợ luồng push toàn bộ."

---

## Background & Problem Statement

In the Google Drive synchronization architecture, project folder IDs (`project.driveFolderId`) and file IDs (`project.driveFileId`) are persisted in local IndexedDB. During subsequent synchronization cycles (`syncGranularProject`, `uploadJsonFile`, `pushAllToDrive`, and `importProjectFromSharedFolder`), the application attempts direct REST requests against these stored IDs without prior verification.

When an end-user or collaborator manually deletes or trashes a project folder or file directly in Google Drive:
1. All subsequent Drive API requests targeting the deleted ID fail with HTTP 404 (or `trashed: true`), causing synchronization to abort with cryptic error toasts.
2. The user is left in an unrecoverable broken state where clicking "Đồng bộ" continuously throws errors, requiring manual database inspection or developer-tool intervention to clear the stale ID.
3. In shared folder import and restore workflows (`importProjectFromSharedFolder`), when a user selects or provides a non-existent/deleted folder ID, the application outputs generic errors such as "không chứa project.json hợp lệ" instead of clearly explaining that the target folder itself does not exist on Drive.
4. If the top-level application root folder (`AI_Dich_Truyen_Data`) is deleted on Drive during an active browser session, the in-memory cached ID (`cachedFolderId`) becomes stale, causing all subsequent upload operations in that session to fail.

This specification defines a **self-healing recovery mechanism** and **clear diagnostic error reporting** to ensure the application automatically detects missing remote containers, re-provisions backups seamlessly, and provides actionable guidance for restore workflows.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic Self-Healing Sync for Deleted Project Folders (Priority: P1) 🎯 MVP

As a novel translator or project owner, when I sync a project whose Google Drive subfolder was manually deleted or trashed on Drive, I want the application to automatically detect the missing folder, recreate the remote project backup folder, re-upload my local chapters and metadata, and update the local folder ID seamlessly, so that my backup synchronization succeeds without showing cryptic 404 errors or requiring manual troubleshooting.

**Why this priority**: Solves the core user pain point of synchronization breakdown caused by manual folder deletion on Drive, ensuring continuous, zero-friction backup resilience.

**Independent Test**: Delete the project's subfolder on Google Drive. Click "Đồng bộ" in the project sync interface. Verify that the sync progress displays the recovery notification ("Thư mục Drive cũ không còn tồn tại. Đang tạo lại backup mới..."), creates a new folder on Google Drive, re-uploads all local chapters, updates IndexedDB with the new folder ID, and completes with a success status.

**Acceptance Scenarios**:

1. **Given** a local project with a previously synced `driveFolderId` that has been deleted or trashed on Google Drive, **When** the user triggers granular synchronization (`syncGranularProject`), **Then** the system checks remote folder existence before performing file operations, detects that the folder is missing, and transitions into self-healing mode.
2. **Given** self-healing mode is activated, **When** the migration and re-upload process runs, **Then** the system emits progress updates informing the user ("Thư mục Drive cũ không còn tồn tại. Đang tạo lại backup mới..."), provisions a new project subfolder under the application root, uploads all local chapters along with `project.json` and `manifest.json`, and saves the new `driveFolderId` to local storage.
3. **Given** the self-healing sync completes, **When** subsequent syncs are executed, **Then** they use the updated `driveFolderId` without further recreation or errors.

---

### User Story 2 - Clear Diagnostic Error on Restoring Missing Shared Folders (Priority: P1) 🎯 MVP

As a collaborator or translator attempting to restore or import a project from a shared Google Drive folder, when the target folder ID is deleted, trashed, or inaccessible, I want to receive a clear, actionable Vietnamese error message explaining that the folder no longer exists on Drive, so that I understand why the import failed and know how to resolve it (selecting a valid folder or having the owner re-push).

**Why this priority**: Prevents user confusion by distinguishing between "the folder does not exist or was deleted" and "the folder exists but is missing specific project files (`project.json`)".

**Independent Test**: Attempt to import from a non-existent or deleted Drive folder ID via `importProjectFromSharedFolder`. Verify that the operation halts early with the explicit Vietnamese error message: `"Thư mục chia sẻ này không còn tồn tại trên Google Drive (có thể đã bị xoá). Vui lòng chọn lại một thư mục dự án còn tồn tại, hoặc đồng bộ lại (Push) để tạo backup mới."`

**Acceptance Scenarios**:

1. **Given** an invalid, trashed, or non-existent shared folder ID, **When** the user initiates an import via `importProjectFromSharedFolder`, **Then** the system checks folder existence upfront before attempting to search for `project.json`.
2. **Given** the folder does not exist or is trashed, **When** the existence check returns negative, **Then** the system throws an explicit, user-friendly error specifying folder non-existence rather than a generic file-not-found or 404 HTTP error.
3. **Given** the folder exists on Drive but lacks `project.json`, **When** the search for `project.json` returns empty, **Then** the system reports that the project metadata file is missing from that specific folder.

---

### User Story 3 - In-Memory App Root Folder Cache Invalidation and Recovery (Priority: P2)

As a user working across long browser sessions, when the top-level application storage folder (`AI_Dich_Truyen_Data`) is removed or trashed on Google Drive, I want the client to invalidate its cached root folder ID, verify existence, and automatically recreate the root folder during the next sync or upload, so that sync operations continue to work without requiring a full browser page refresh.

**Why this priority**: Prevents stale in-memory state in singleton or long-lived `DriveRestClient` instances from causing cascading upload failures across all projects in the workspace.

**Independent Test**: Cache a valid root folder ID in `DriveRestClient`, delete the root folder on Drive, and invoke `ensureAppFolder`. Verify that the client detects that the cached ID is invalid, recreates the `AI_Dich_Truyen_Data` folder on Drive, and caches the new valid ID.

**Acceptance Scenarios**:

1. **Given** a `DriveRestClient` instance with a non-null `cachedFolderId`, **When** `ensureAppFolder` is called, **Then** the client verifies whether the cached ID still exists and is not trashed before returning it.
2. **Given** the cached ID is determined to be non-existent or trashed, **When** validation fails, **Then** the client resets `cachedFolderId = null`, searches for or creates a new root folder, and stores the new valid folder ID.

---

### User Story 4 - Resilient Multi-Project Push and Bi-Directional Synchronization (Priority: P2)

As a user performing a full backup ("Push All" or "Sync Bi-Directional") across multiple local projects, when one or more projects have missing remote folders or bundle files on Drive, I want each affected project to self-heal independently, so that the overall batch backup completes successfully for all projects.

**Why this priority**: Ensures that a single corrupted or deleted remote reference does not abort the entire multi-project synchronization pipeline.

**Independent Test**: Have multiple local projects where one project has a deleted remote folder. Trigger "Push All to Drive". Verify that the valid projects sync normally, the affected project self-heals by recreating its remote folder and uploading chapters, and the final sync summary reports all projects synced successfully.

**Acceptance Scenarios**:

1. **Given** multiple projects queued for batch push or bi-directional sync, **When** a granular project with a missing remote folder is processed, **Then** the granular sync handler automatically executes self-healing recovery and returns a success summary.
2. **Given** the batch sync concludes, **When** the progress summary is displayed, **Then** the synced project count includes the self-healed project without failing the overall batch.

---

### Edge Cases

- **Trashed vs Permanently Deleted**: When a Google Drive folder or file is moved to the Trash (`trashed: true`), the Drive API may still return metadata indicating it exists with `trashed: true`. The existence check MUST treat `trashed: true` as non-existent (`return false`).
- **Authorization and Scope Restrictions**: Under the `drive.file` scope, a file/folder not created by or picked by the user will return HTTP 404 or 403. The existence verification MUST safely catch any HTTP error status codes (400, 401, 403, 404, 500) and network exceptions without throwing unhandled errors, returning `false`.
- **Transient Offline / Network Drop**: If a network error occurs during the existence check, the system safely interprets it as inaccessible and follows standard sync error handling with clear connectivity feedback.
- **Empty Local Project with Missing Remote Folder**: If a local project has 0 chapters and its Drive folder was deleted, self-healing still creates the subfolder, uploads `project.json` and empty manifest, and updates `driveFolderId`.
- **Concurrent Sync Requests**: If multiple sync triggers fire in close succession for a project with a deleted folder, atomic state updates in IndexedDB ensure the newly generated `driveFolderId` is persisted cleanly.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `DriveRestClient` class MUST provide a `fileExists(accessToken: string, fileId: string): Promise<boolean>` method that queries the Google Drive API (`files/{fileId}?fields=id,trashed`) and returns `false` if the entity is not found, trashed, unauthorized, or upon any network/HTTP failure, without throwing unhandled exceptions.
- **FR-002**: The `ensureAppFolder` method in `DriveRestClient` MUST validate any existing `cachedFolderId` using `fileExists` (or re-verification query) before returning it, resetting the cached reference and creating a new root folder if the cached folder is deleted or trashed.
- **FR-003**: The `syncGranularProject` method MUST invoke `fileExists` on the provided `driveFolderId` at the beginning of the synchronization lifecycle before initiating manifest searches or chapter uploads.
- **FR-004**: If `driveFolderId` is found to be non-existent or trashed in `syncGranularProject`, the system MUST:
  - Notify the user via `onProgress` callback with status `syncing` and message `"Thư mục Drive cũ không còn tồn tại. Đang tạo lại backup mới..."`.
  - Automatically call `migrateProjectToGranularSubfolder` to create a fresh subfolder, upload all local chapters, upload `project.json` and `manifest.json`, and update `project.driveFolderId` in IndexedDB.
  - Return a successful `GranularProjectSyncSummary` reflecting the newly uploaded chapters.
- **FR-005**: The `importProjectFromSharedFolder` method MUST invoke `fileExists` on the `sharedFolderId` prior to querying for `project.json`, and if the folder does not exist or is trashed, it MUST throw an explicit, actionable Vietnamese error message directing the user to select an existing folder or perform a re-push.
- **FR-006**: In single-file bundle synchronization workflows (`driveBundleSync`), if a project's `driveFileId` is verified as missing or trashed on Drive during a push or pull operation, the system MUST handle the missing remote file gracefully by regenerating and uploading a new bundle file and updating the local project reference.
- **FR-007**: Multi-project backup operations (`pushAllToDrive`, `syncBiDirectional`) MUST delegate project synchronization through the self-healing granular and bundle handlers, ensuring batch resilience when remote folders are missing.
- **FR-008**: All database updates performed during self-healing (e.g. `saveProjectToDB`, `saveChapterToDB`) MUST strictly adhere to the existing IndexedDB schema without mutating immutable core types.

---

### Key Entities

- **Google Drive Entity Verification (`fileExists`)**: A non-throwing safety probe that checks remote resource vitality (`id`, `trashed: false`) across folders and files under the active OAuth token.
- **Project Folder Identity (`driveFolderId`)**: The remote directory ID associated with a project in IndexedDB; when invalidated, it is dynamically replaced by the self-healing migration workflow.
- **Root Application Folder (`APP_FOLDER_NAME = 'AI_Dich_Truyen_Data'`)**: The top-level Drive container whose cached reference is automatically refreshed upon remote deletion.
- **Sync Progress Feedback (`SyncProgress`)**: User-facing progress messages and percent indicators reflecting self-healing recovery stages.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of synchronization attempts on projects with deleted or trashed Google Drive folders successfully recover by automatically provisioning a new remote folder and uploading all local chapters without user intervention.
- **SC-002**: Zero unhandled 404 HTTP errors or cryptic stack traces presented to users when syncing projects with missing remote folders or files.
- **SC-003**: 100% of restore attempts targeting deleted shared folders produce explicit, actionable Vietnamese diagnostic messages clearly differentiating missing folders from missing files.
- **SC-004**: Stale in-memory cache for deleted root application folders is invalidated and recovered with 0 page reloads or manual cache clears required.
- **SC-005**: All quality gates (`npm run lint`, `npm test`, `npm run build`) pass cleanly with 100% test pass rate and zero regressions.

---

## Assumptions

- Users operate with valid Google Drive OAuth credentials granted under the `https://www.googleapis.com/auth/drive.file` scope.
- Local project and chapter data in IndexedDB remain the authoritative source of truth when recreating deleted remote backups.
- Existing Vietnamese UI copy conventions and design system patterns are preserved throughout all status notifications and error messages.
- The standard Web `fetch` API is available in the browser runtime environment.
