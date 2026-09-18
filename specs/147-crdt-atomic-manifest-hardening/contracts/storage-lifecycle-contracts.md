# Storage Lifecycle & Integrity Contracts

**Feature**: `147-crdt-atomic-manifest-hardening`
**Date**: 2026-09-18

## Public Storage API Contracts

### 1. `deleteProjectFromDB(id: string, options?: { skipQueue?: boolean }): Promise<void>`

- **Description**: Atomically deletes the project catalog, chapters, and CRDT states while recording a durable deletion manifest in the same IDB transaction, followed by physical CRDT database cleanup.
- **Preconditions**:
  - `id` must be a non-empty string.
- **Transactional Guarantees**:
  - `DELETION_MANIFESTS_STORE`, `PROJECTS_STORE`, `CHAPTERS_STORE`, and `CRDT_STATES_STORE` locked in a single `readwrite` transaction.
  - Manifest is placed with `status: 'pending'`.
  - Catalog entities deleted.
  - If transaction fails/aborts: neither catalog nor manifest is mutated.
  - After commit: `deleteProjectCrdtDatabases` cleans physical databases, then removes manifest.
- **Error Semantics**:
  - Rejects if catalog transaction fails, if persistence destroy fails, or if physical database deletion fails.
  - Preserves manifest on post-commit failure for startup recovery.

---

### 2. `deleteChapterFromDB(id: string, projectId?: string, options?: { skipQueue?: boolean }): Promise<void>`

- **Description**: Atomically records a deletion manifest and deletes the specified chapter and CRDT state from catalog stores, then removes the physical CRDT database `crdt_${projectId}_${id}`.
- **Preconditions**:
  - `id` must be a valid chapter ID.
  - If `projectId` provided, must match existing chapter's `projectId`.
- **Transactional Guarantees**:
  - Single atomic transaction over `[CHAPTERS_STORE, DELETION_MANIFESTS_STORE, CRDT_STATES_STORE]`.
  - Manifest contains `chapterIds: [id]` and `physicalDbNames: ['crdt_${resolvedProjectId}_${id}']`.
  - Manifest is removed only after physical database deletion succeeds.
- **Error Semantics**:
  - Throws if `projectId` mismatches existing stored chapter.
  - Propagates persistence destroy errors (fail-closed).
  - Propagates physical DB deletion errors (fail-closed, manifest preserved).

---

### 3. `deleteChaptersByProjectFromDB(projectId: string): Promise<void>`

- **Description**: Atomically deletes all chapters and CRDT states for a project while committing a deletion manifest in the same transaction, followed by physical database cleanup.
- **Preconditions**:
  - `projectId` must be a non-empty string.
- **Transactional Guarantees**:
  - Atomic manifest write and chapter/CRDT state catalog deletions.
  - Physical database cleanup runs after commit.

---

### 4. `assertChapterOwnership(existing: Chapter | undefined, incomingProjectId: string, chapterId: string): void`

- **Description**: Enforces foreign key immutability for chapters across all storage write paths.
- **Behavior**:
  - If `existing` is defined, has a non-empty `projectId`, and `existing.projectId !== incomingProjectId`:
    - Throws `new Error('Relational integrity violation: Cannot re-parent chapter "${chapterId}" from project "${existing.projectId}" to "${incomingProjectId}".')`.
  - Otherwise: returns cleanly.

---

### 5. `saveProjectToDB(project: StoryProject): Promise<void>`

- **Description**: Saves project metadata and chapter items.
- **Integrity Requirement**:
  - For each chapter in `project.chapters`:
    - Validates against existing chapter in `chaptersStore`.
    - If existing chapter belongs to a different project, aborts transaction and throws relational integrity violation error.

---

### 6. `atomicSaveProjectBundle(project: StoryProject, chapters: Chapter[], crdtStates?: ...): Promise<void>`

- **Description**: Saves project, chapters, and CRDT states in a single atomic transaction (used by Google Drive sync and bundle imports).
- **Integrity Requirement**:
  - Pre-validates ALL incoming `chapters` against existing records in `chaptersStore` before any `put` operation is enqueued.
  - If any chapter belongs to a different project, aborts transaction immediately and throws relational integrity violation error.

---

### 7. `getPendingDeletionManifests(): Promise<DeletionManifestRecord[]>`

- **Description**: Retrieves all deletion manifests with `status === 'pending'`.
- **Error Semantics**:
  - Throws/propagates errors on database read failures (NO silent catch-and-return-empty-array).

---

### 8. `recoverPendingDeletions(): Promise<{ recoveredCount: number; failedCount: number }>`

- **Description**: Scans pending deletion manifests on startup and completes physical CRDT database cleanups.
- **Error Semantics**:
  - If reading manifests fails: propagates error or records failure.
  - If physical DB deletion fails: increments `failedCount`, leaves manifest pending.
  - If physical DB deletion succeeds: removes manifest and increments `recoveredCount`.
