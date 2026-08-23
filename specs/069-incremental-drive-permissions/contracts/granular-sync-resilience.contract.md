# Contract: Granular Sync Resilience & Incremental Pull

**Module**: `src/services/google-drive/driveGranularSync.ts`
**Feature**: `069-incremental-drive-permissions`

---

## 1. Interface Extensions

```typescript
export interface GranularSyncOptions {
  accessToken: string;
  projectId: string;
  driveFolderId: string;
  onProgress?: (progress: SyncProgress) => void;
  /** Optional pre-selected file list to expedite file resolution */
  selectedFiles?: { id: string; name: string }[];
}

export interface GranularProjectSyncSummary {
  success: boolean;
  uploadedChapters: number;
  downloadedChapters: number;
  failedPullCount: number;
  failedChapters: { id: string; title?: string; error?: string }[];
  error?: string;
}
```

---

## 2. Function Contracts

### `importProjectFromSharedFolder(accessToken: string, sharedFolderId: string, onProgress?: (progress: SyncProgress) => void, selectedFiles?: { id: string; name: string }[]): Promise<StoryProject>`

- Resolves `project.json` (from `selectedFiles` or Drive search query).
- Resolves `manifest.json` (from `selectedFiles` or Drive search query).
- Downloads all accessible chapters, catching per-chapter errors without halting import.
- Saves project record in IndexedDB with `driveFolderId = sharedFolderId`, `driveStorageFormat = 'granular'`, `isShared = true`, `isOwner = false`.

### `syncGranularProject(accessToken: string, projectId: string, driveFolderId: string, onProgress?: (progress: SyncProgress) => void, selectedFiles?: { id: string; name: string }[]): Promise<GranularProjectSyncSummary>`

- Reconciles timestamps between local database and remote Drive manifest.
- Pushes locally modified chapters.
- Pulls remotely modified chapters inside per-chapter `try/catch` blocks.
- If a chapter download fails (e.g., HTTP 404/403 due to missing file-level permission):
  - Increments `failedPullCount`.
  - Records chapter ID and reason in `failedChapters`.
  - Continues processing remaining chapters.
- Returns comprehensive summary object.

---

## 3. Invariants

1. **Failure Isolation**: A failure downloading `chapter_X.json` MUST NOT prevent `chapter_Y.json` from downloading.
2. **Local Data Preservation**: An interrupted or partial pull MUST NEVER delete existing local chapters.
3. **Owner Transparency**: Project owners (`isOwner: true`) are never prompted to grant file permissions.
