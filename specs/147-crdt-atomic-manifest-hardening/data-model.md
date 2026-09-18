# Data Model: CRDT Atomic Deletion Manifest & Storage Integrity Hardening

**Feature**: `147-crdt-atomic-manifest-hardening`
**Date**: 2026-09-18

## Entity Definitions & Schemas

### 1. Deletion Manifest (`DeletionManifestRecord`)

Represents durable intent to clean up physical IndexedDB CRDT databases following the atomic deletion of catalog entities.

```typescript
export interface DeletionManifestRecord {
  /**
   * Unique manifest identifier.
   * Format: `manifest_${timestamp}_${targetId}_${random}`
   */
  id: string;

  /**
   * Associated project identifier.
   */
  projectId: string;

  /**
   * List of chapter IDs associated with this deletion.
   */
  chapterIds: string[];

  /**
   * Exact physical database names scheduled for deletion.
   * Format: `crdt_${projectId}_${chapterId}`
   */
  physicalDbNames: string[];

  /**
   * Creation timestamp in ISO-8601 format.
   */
  createdAt: string;

  /**
   * Lifecycle status of the cleanup operation.
   */
  status: 'pending' | 'completed';
}
```

#### Lifecycle State Transitions
```
                Atomic IDBTransaction
                 (Catalog + Manifest)
                          │
                          ▼
                  ┌──────────────┐
                  │   pending    │
                  └───────┬──────┘
                          │
          ┌───────────────┴───────────────┐
          │ Physical cleanup succeeds     │ Physical cleanup fails / crash
          ▼                               ▼
    ┌───────────┐                 ┌──────────────┐
    │  DELETED  │                 │   pending    │ ◄── Picked up on restart by
    │(Manifest  │                 │ (Manifest    │     recoverPendingDeletions()
    │ removed)  │                 │  preserved)  │
    └───────────┘                 └──────────────┘
```

---

### 2. Chapter Entity (`Chapter`)

Represents an individual novel chapter with relational constraints.

```typescript
export interface Chapter {
  id: string;
  projectId?: string; // Foreign key reference to StoryProject.id
  title: string;
  sourceText?: string;
  rawTranslation?: string;
  paragraphs?: Array<{
    id: string;
    source: string;
    translation: string;
    raw?: string;
  }>;
  status?: ChapterStatus;
  createdAt?: string;
  updatedAt?: string;
}
```

#### Relational Integrity Rules
- **Foreign Key Invariant**: A chapter record in `chaptersStore` possesses an immutable association with its `projectId`.
- **Re-parenting Prohibited**: If `existingChapter` in `chaptersStore` has `existingChapter.projectId` and an incoming save operation specifies a differing `incomingProjectId`, the storage engine MUST abort the transaction and reject with:
  `Relational integrity violation: Cannot re-parent chapter "${chapterId}" from project "${existing.projectId}" to "${incomingProjectId}".`
- **Enforcement Scope**: Active across `saveChapterToDB`, `saveChaptersToDB`, `saveProjectToDB`, and `atomicSaveProjectBundle`.

---

### 3. Story Project Entity (`StoryProject`)

Represents the parent novel translation workspace.

```typescript
export interface StoryProject {
  id: string;
  title: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  chapters?: ChapterMetadata[];
  createdAt?: string;
  updatedAt?: string;
  driveFolderId?: string;
  driveFileId?: string;
}
```

#### Transactional Deletion Boundary
When deleting a `StoryProject` with ID `P`:
- Target Stores: `[PROJECTS_STORE, CHAPTERS_STORE, CRDT_STATES_STORE, DELETION_MANIFESTS_STORE]`.
- Atomic Operations in Transaction:
  1. Record `DeletionManifestRecord` with all discovered chapter IDs for `P` (`status: 'pending'`).
  2. Delete `P` from `PROJECTS_STORE`.
  3. Delete all chapters matching `projectId === P` from `CHAPTERS_STORE`.
  4. Delete all CRDT state records matching `projectId === P` from `CRDT_STATES_STORE`.
- Post-Commit Execution:
  1. Invoke `deleteProjectCrdtDatabases(P, discoveredChapterIds)`.
  2. On success, invoke `removeDeletionManifest(manifestId)`.
