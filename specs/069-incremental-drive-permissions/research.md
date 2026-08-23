# Research & Technical Decisions: Incremental Drive Permissions for Shared Projects

**Feature**: `069-incremental-drive-permissions`
**Date**: 2026-08-23

---

## 1. Google Picker Multi-File Selection & Folder Anchoring

### Context & Problem
Google Drive's `https://www.googleapis.com/auth/drive.file` scope only grants access to files created by the application or explicitly selected by the user in Google Picker. When a collaborator is invited to a folder, selecting only the folder via `google.picker.ViewId.FOLDERS` does *not* grant permissions to the files residing inside that folder. As a result, subsequent `files.list` or `files.get` calls for `project.json` or `chapter_*.json` return 404 or empty file lists.

### Decision
Implement `openFilePicker` in `src/services/googlePickerService.ts` utilizing `google.picker.DocsView(google.picker.ViewId.DOCS)` anchored to `folderId` via `.setParent(folderId)` with multi-select enabled.

### Implementation Details
```typescript
const view = new google.picker.DocsView(google.picker.ViewId.DOCS)
  .setParent(folderId)
  .setIncludeFolders(false)
  .setSelectFolderEnabled(false);

const builder = new google.picker.PickerBuilder()
  .addView(view)
  .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
  .setOAuthToken(accessToken)
  .setDeveloperKey(apiKey)
  .setTitle('Chọn tất cả tệp để cấp quyền truy cập (AI Dịch Truyện)')
  .setCallback((data: any) => {
    if (data.action === google.picker.Action.PICKED) {
      const docs = data[google.picker.Response.DOCS] || data.docs || [];
      const selectedFiles = docs.map((doc: any) => ({
        id: doc.id,
        name: doc.name || '',
        mimeType: doc.mimeType || '',
      }));
      onFilesSelected(selectedFiles);
    } else if (data.action === google.picker.Action.CANCEL) {
      onCancel?.();
    }
  });
```

### Rationale
- Setting `.setParent(folderId)` locks the Picker view to the specific shared folder, preventing confusing navigation outside the project directory.
- `google.picker.Feature.MULTISELECT_ENABLED` allows the collaborator to select multiple or all files in a single interaction.
- Re-selecting already authorized files is idempotent and safe in Google Drive.
- No new NPM dependencies are introduced; it uses the existing dynamically loaded `gapi.load('picker')` script.

### Alternatives Considered
- **Broader OAuth Scope (`drive.readonly` or `drive`)**: Rejected because it requires CASA security tier 2/3 verification, prompts intimidating "unverified app" warnings, and violates the project's minimal privilege privacy commitment.
- **Backend Service Account Proxy**: Rejected because the application is designed to be 100% client-side serverless sync with zero intermediate data storage.

---

## 2. Integration into Initial Import Flow ("Mở dự án được chia sẻ")

### Context & Problem
Collaborators opening a shared project for the first time currently execute `handleOpenSharedProjectPicker` in `GoogleSyncModal.tsx`. It opens `openFolderPicker`, gets `folderId`, and immediately calls `importProjectFromSharedFolder`, which fails immediately when searching for `project.json`.

### Decision
Chain the folder selection with the new file selection picker:
1. `openFolderPicker` returns `folderId`.
2. UI transitions to opening `openFilePicker` pre-anchored to `folderId`.
3. Collaborator selects files and clicks "Select".
4. `importProjectFromSharedFolder` executes, receiving `selectedFiles` list.
5. Project and chapters import cleanly into IndexedDB.

### Rationale
- Provides a seamless, guided two-step interaction without leaving the modal.
- Passing `selectedFiles` to `importProjectFromSharedFolder` allows resolving `project.json` and chapter IDs directly from the returned metadata, avoiding unnecessary extra `files.list` requests.

---

## 3. UI Placement for "Đồng bộ file mới" (Sync New Files)

### Context & Problem
When the project owner adds new chapters, the new chapter IDs and files lack permissions for collaborators. Collaborators need an intuitive and accessible way to trigger permission granting for newly added files.

### Decision
Place the "Đồng bộ file mới" action in two key locations:
1. **In `ShareProjectModal.tsx`**: Add a dedicated action card "Đồng bộ file mới từ Google Drive" when `project.driveStorageFormat === 'granular'` and `project.driveFolderId` is present.
2. **In `GoogleSyncModal.tsx`**: When a granular project is active, provide a direct action button or status hint.
3. **In Sync Notifications**: When two-way sync detects skipped/failed new chapters, display a specific toast message prompting the user: *"Đã đồng bộ X/Y chương — còn Z chương mới cần bấm 'Đồng bộ file mới'"*.

### Rationale
- `ShareProjectModal` is the primary hub for project collaboration and permissions.
- In-modal sync toast guidance provides direct feedback when new unauthorized files are encountered.

---

## 4. Per-Chapter Error Isolation in `syncGranularProject`

### Context & Problem
In `driveGranularSync.ts` (lines 258-281), the pull branch for chapters calls `client.downloadJsonFile` without `try/catch`. An unauthorized file throws an exception that crashes the entire sync loop, preventing even authorized chapters from updating.

### Decision
1. Wrap each chapter download in `try/catch` (mirroring the pattern in `importProjectFromSharedFolder`).
2. Track `failedPullCount` and `downloadedChapters`.
3. In `BiDirectionalSyncResult`, include `failedPullCount` and `failedChapters`.
4. Return clean, informative status messages.

### Rationale
- Guarantees fault isolation: 1 failing chapter will not destroy or block 99 successful chapter syncs.
- Clear accounting of which chapters succeeded vs. which chapters need permissions.
