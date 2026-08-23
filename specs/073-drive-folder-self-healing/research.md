# Research & Technical Decisions: Google Drive Folder Self-Healing and Recovery

**Feature**: Self-Healing and Graceful Recovery for Missing Google Drive Folders and Files  
**Branch**: `073-drive-folder-self-healing`  
**Date**: 2026-08-23  

---

## Technical Unknowns & Research Findings

### 1. Safe Google Drive Resource Existence Checking (`fileExists`)

- **Problem**: When a file or folder ID stored in IndexedDB has been deleted or moved to trash on Google Drive, direct API operations (such as uploading to parent folder ID or fetching metadata) fail with HTTP 404 or HTTP 403. Code that uses raw `fetch` throws unhandled exceptions that break user sync flows.
- **Decision**: Introduce a non-throwing probe method `fileExists(accessToken: string, fileId: string): Promise<boolean>` in `DriveRestClient`.
- **Implementation**:
  ```ts
  public async fileExists(accessToken: string, fileId: string): Promise<boolean> {
    if (!fileId || !fileId.trim()) return false;
    try {
      const res = await fetch(
        `${DRIVE_FILES_ENDPOINT}/${fileId}?fields=id,trashed`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) return false;
      const data = await res.json();
      return !data.trashed;
    } catch {
      return false;
    }
  }
  ```
- **Rationale**:
  - `fields=id,trashed` requests the minimal payload possible, consuming negligible bandwidth.
  - Checks both HTTP response status (`res.ok`) and Google Drive's soft-delete flag (`data.trashed === false`).
  - Swallows network/HTTP errors cleanly and returns `false` without throwing.
- **Alternatives Considered**:
  - *Full metadata search (`q='id in parents...'`)*: Slower, requires complex query formatting, fails if parent permissions change.
  - *Trying operations and catching 404 inline*: Spreads messy try-catch recovery logic across multiple callers instead of a clean pre-flight existence check.

---

### 2. In-Memory Root Folder Cache Invalidation (`ensureAppFolder`)

- **Problem**: `DriveRestClient` maintains `private cachedFolderId: string | null = null`. If the user leaves the app open and deletes `AI_Dich_Truyen_Data` directly on Drive, `ensureAppFolder` continues returning the stale `cachedFolderId`, causing all subsequent uploads to fail with 404 until page refresh.
- **Decision**: In `ensureAppFolder`, if `this.cachedFolderId` exists, verify it with `fileExists`. If it is invalid or trashed, reset `this.cachedFolderId = null` and re-query or recreate the folder.
- **Implementation**:
  ```ts
  public async ensureAppFolder(accessToken: string): Promise<string> {
    if (this.cachedFolderId) {
      const isValid = await this.fileExists(accessToken, this.cachedFolderId);
      if (isValid) {
        return this.cachedFolderId;
      }
      this.cachedFolderId = null;
    }
    // Search query & create logic...
  }
  ```
- **Rationale**: Ensures resilience across long user sessions without requiring user intervention or full page reload.

---

### 3. Self-Healing in Granular Project Synchronization (`syncGranularProject`)

- **Problem**: When `syncGranularProject` runs, if `driveFolderId` is missing/trashed, it currently attempts to search for `manifest.json` under that folder, fails, and throws errors.
- **Decision**: At the very beginning of `syncGranularProject`, check `await client.fileExists(accessToken, driveFolderId)`. If `false`:
  1. Notify user via `onProgress`:
     ```ts
     onProgress?.({
       status: 'syncing',
       message: 'Thư mục Drive cũ không còn tồn tại. Đang tạo lại backup mới...',
       progressPercent: 15,
     });
     ```
  2. Call `this.migrateProjectToGranularSubfolder(client, accessToken, projectId, onProgress)`.
  3. `migrateProjectToGranularSubfolder` already creates a fresh subfolder, uploads `project.json`, `chapter_*.json`, and `manifest.json`, updates `project.driveFolderId` in IndexedDB via `saveProjectToDB`, and returns the new folder ID.
  4. Return a successful sync summary with `uploadedChapters = totalLocalChapters` and `downloadedChapters = 0`.
- **Rationale**: Completely self-heals in one step. The user clicks "Đồng bộ", sees a helpful status message, and the backup is re-established transparently.

---

### 4. Differentiating Missing Folder vs Missing Files in `importProjectFromSharedFolder`

- **Problem**: When a user inputs or selects a deleted shared folder ID to restore a project, the code searched for `project.json` and threw `Không thể tìm thấy tệp project.json trong thư mục (HTTP 404)`, which was ambiguous and confusing.
- **Decision**: Run `await client.fileExists(accessToken, sharedFolderId)` at the start of `importProjectFromSharedFolder`. If `false`, throw a descriptive Vietnamese error:
  ```ts
  const folderExists = await client.fileExists(accessToken, sharedFolderId);
  if (!folderExists) {
    throw new Error(
      'Thư mục chia sẻ này không còn tồn tại trên Google Drive (có thể đã bị xoá). ' +
      'Vui lòng chọn lại một thư mục dự án còn tồn tại, hoặc đồng bộ lại (Push) để tạo backup mới.'
    );
  }
  ```
- **Rationale**: Clear diagnostic error separates container-level failure (deleted folder / revoked permission) from content-level failure (folder exists but is not a valid project export).

---

### 5. Multi-Project Batch Sync Resilience (`pushAllToDrive` & `syncBiDirectional`)

- **Problem**: During "Push All" or "Sync 2 Chiều", if one granular project encounters a deleted Drive folder, does it crash the entire batch?
- **Decision**: In `pushAllToDrive`, granular sync is invoked via `onSyncGranularProject(accessToken, project.id, project.driveFolderId)`. Because `syncGranularProject` self-heals and returns `{ success: true, ... }` after re-provisioning, `pushAllToDrive` succeeds automatically.
- **Rationale**: No architectural changes required in `driveProjectSync.ts`; the fix in `driveGranularSync.ts` automatically propagates to all batch flows.

---

### 6. Resilience in Bundle Format Sync (`driveBundleSync.ts`)

- **Problem**: What happens if a project in `bundle` format has its `driveFileId` deleted on Drive?
- **Decision**:
  - In `pushBundle`: `client.uploadJsonFile` handles root folder recreation and uploads the file afresh.
  - In `pullBundle`: If `client.downloadJsonFile` fails because the bundle file is deleted/404, or if `client.fileExists` is false:
    - For owner projects (`isOwner === true`), pull can gracefully fall back to re-pushing the local bundle.
    - For collaborator projects (`isOwner === false`), display clear error asking to re-link or select the new shared bundle file.
