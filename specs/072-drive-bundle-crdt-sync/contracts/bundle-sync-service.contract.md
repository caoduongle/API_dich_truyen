# Bundle Sync Service Contract

## Overview

Defines the interface contract for the new bundle-based Drive sync service that replaces the granular per-file sync for shared/collaborative projects.

## Service: `DriveBundleSync`

### `buildProjectBundle(projectId: string): Promise<ProjectBundle>`

Serializes a local project and all its chapters (with CRDT snapshots) into a `ProjectBundle` object.

**Input**: `projectId` — must exist in IndexedDB.  
**Output**: `ProjectBundle` as defined in `data-model.md`.  
**Behavior**:
- Reads project from `projects` store.
- Reads all chapters from `chapters` store via `projectId` index.
- For each chapter: reads CRDT state from `crdt_states` store if available, otherwise creates fresh Y.Doc from chapter text.
- Encodes CRDT state as base64 `crdtSnapshot`.
- Returns assembled `ProjectBundle` with `bundleVersion: 1`.

**Error conditions**:
- Project not found → throws `Error('Không tìm thấy dự án')`.
- Empty chapter list → returns bundle with `chapters: []` (valid).

---

### `pushBundle(accessToken: string, projectId: string): Promise<{ fileId: string }>`

Builds a bundle and uploads it to Google Drive.

**Input**: Valid OAuth access token, project ID.  
**Output**: `{ fileId: string }` — the Drive file ID of the uploaded bundle.  
**Behavior**:
- Calls `buildProjectBundle(projectId)`.
- JSON-stringifies the bundle.
- If project has existing `driveFileId`: PATCHes the existing file (update).
- If no `driveFileId`: creates new file named `project_bundle_{projectId}.json` in app root folder.
- Updates local project record with `driveFileId`, `driveStorageFormat: 'bundle'`.
- Saves CRDT states for all chapters to `crdt_states`.

---

### `pullBundle(accessToken: string, projectId: string, driveFileId: string): Promise<PullResult>`

Downloads the bundle from Drive and merges chapters using CRDT.

**Input**: Valid OAuth access token, project ID, Drive file ID.  
**Output**: `PullResult { mergedChapterCount: number; newChapterCount: number; conflictsResolved: number }`.  
**Behavior**:
- Downloads bundle JSON via `downloadJsonFile<ProjectBundle>(fileId)`.
- Validates `bundleVersion`.
- Updates project metadata in IndexedDB (merge non-destructive fields).
- For each remote chapter:
  - If exists locally: performs CRDT merge (see merge algorithm in `research.md` R3).
  - If new: saves directly to IndexedDB and creates initial CRDT state.
- For local-only chapters (not in remote bundle): keeps them (no deletion).
- Saves all updated CRDT states to `crdt_states`.

---

### `importBundle(accessToken: string, driveFileId: string): Promise<StoryProject>`

Imports a shared project bundle for the first time (collaborator flow).

**Input**: Valid OAuth access token, Drive file ID from Picker.  
**Output**: `StoryProject` — the imported project.  
**Behavior**:
- Downloads bundle JSON.
- Checks if project already exists locally (by `project.id`): if yes, performs pull-merge instead.
- Saves project with `isOwner: false`, `isShared: true`, `driveFileId`, `driveStorageFormat: 'bundle'`.
- Saves all chapters to IndexedDB.
- Creates initial CRDT states for all chapters.

---

## Service: `GooglePickerService` (Additions)

### `openBundlePicker(options: OpenBundlePickerOptions): Promise<void>`

Opens a single-file Google Picker filtered for JSON bundle files.

**Input**:
```typescript
interface OpenBundlePickerOptions {
  accessToken: string;
  pickerApiKey?: string;
  onFileSelected: (file: SelectedDriveFile) => void;
  onCancel?: () => void;
}
```

**Output**: Calls `onFileSelected` with the selected file or `onCancel` if dismissed.  
**Behavior**:
- Creates `DocsView` with `ViewId.DOCS`.
- Filters by `mimeType: 'application/json'`.
- Does NOT enable `MULTISELECT_ENABLED`.
- Sets responsive dimensions: `setSize(Math.min(1051, innerWidth * 0.9), Math.min(650, innerHeight * 0.9))`.
- Sets `setOrigin`, `setAppId`, `setDeveloperKey`, `setOAuthToken`.
- Title: `'Chọn file dự án được chia sẻ (AI Dịch Truyện)'`.

---

## Service: `db.ts` (Additions)

### `getCrdtState(chapterId: string): Promise<CrdtStateRecord | null>`

Reads CRDT state binary for a chapter from the `crdt_states` store.

### `saveCrdtState(record: CrdtStateRecord): Promise<void>`

Upserts a CRDT state record into the `crdt_states` store.

### `saveCrdtStates(records: CrdtStateRecord[]): Promise<void>`

Batch upserts CRDT state records in a single transaction.

### `deleteCrdtStatesByProject(projectId: string): Promise<void>`

Deletes all CRDT states for a project (cleanup on project delete).
