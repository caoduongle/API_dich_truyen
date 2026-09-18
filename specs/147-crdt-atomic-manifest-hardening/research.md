# Research & Architectural Decisions: CRDT Atomic Deletion Manifest & Storage Integrity Hardening

**Feature**: `147-crdt-atomic-manifest-hardening`
**Date**: 2026-09-18

## Overview

This research document analyzes the storage lifecycle vulnerabilities identified in commit `25ea4bd804d5aaa8a4b3c55f48317e2e435bb2c6` and establishes the architectural decisions for atomic manifest transactions, single-chapter deletion recovery, cross-boundary foreign key guards, fail-closed persistence disposal, and fail-closed recovery discovery.

---

## Technical Decisions & Findings

### Decision 1: Atomic Deletion Manifest and Catalog Deletion within a Single IDBTransaction

- **Context**: The existing implementation writes a deletion manifest in a standalone transaction *before* executing a second transaction that deletes catalog records (`projects`, `chapters`, `crdt_states`). If the browser tab crashes or closes after the manifest commits but before the catalog transaction commits, the startup recovery service discovers the pending manifest and deletes physical CRDT databases for projects and chapters that are still active and present in the catalog.
- **Decision**: In `executeDeleteProjectFromDB` and `executeDeleteChaptersByProjectFromDB`, encompass `DELETION_MANIFESTS_STORE` alongside `PROJECTS_STORE`, `CHAPTERS_STORE`, and `CRDT_STATES_STORE` in a single `readwrite` IndexedDB transaction:
  ```
  IDBTransaction([PROJECTS, CHAPTERS, CRDT_STATES, DELETION_MANIFESTS], 'readwrite')
  ├─ Discover final chapters across stores
  ├─ store.put(deletionManifest) [status: 'pending']
  ├─ store.delete(project / chapters / crdt_states)
  COMMIT
  ```
  Only after the transaction successfully commits (`transaction.oncomplete`) does the application invoke physical CRDT database deletion (`deleteProjectCrdtDatabases`). Once physical databases are confirmed deleted, `removeDeletionManifest(manifestId)` clears the manifest.
- **Rationale**:
  - If a crash occurs before commit, IndexedDB rolls back both the manifest and catalog mutations. No orphaned manifest exists on restart, and active data is never destroyed.
  - If a crash occurs after commit, catalog records are already deleted and the manifest is durably persisted. Startup recovery safely cleans up the physical databases.
- **Alternatives Considered**: Two-phase status transitions (`prepared` -> `committed` in separate transactions). Rejected because it doubles transaction roundtrips and still creates edge cases if the browser crashes between phases, whereas IndexedDB native multi-store atomic transactions provide zero-cost rollback.

---

### Decision 2: Durable Deletion Manifest for Single Chapter Deletions (`deleteChapterFromDB`)

- **Context**: `deleteChapterFromDB` currently opens a transaction on `[CHAPTERS_STORE, CRDT_STATES_STORE]`, deletes the catalog records, commits, and calls `deleteChapterCrdtDatabase`. If the browser crashes between catalog commit and physical database deletion, the physical database remains orphaned permanently with no manifest for recovery.
- **Decision**: Extend `deleteChapterFromDB` to include `DELETION_MANIFESTS_STORE` in its transaction. In that single transaction:
  1. Record a durable deletion manifest:
     - `id`: `manifest_chap_${Date.now()}_${id}_...`
     - `projectId`: `resolvedProjectId`
     - `chapterIds`: `[id]`
     - `physicalDbNames`: `['crdt_${resolvedProjectId}_${id}']`
     - `status`: `'pending'`
     - `createdAt`: ISO timestamp
  2. Delete chapter record from `CHAPTERS_STORE`.
  3. Delete CRDT state from `CRDT_STATES_STORE` (if present).
  4. On transaction commit: invoke `deleteChapterCrdtDatabase(resolvedProjectId, id)`.
  5. On physical deletion success: invoke `removeDeletionManifest(manifest.id)`.
  6. If physical deletion fails: propagate error; manifest remains pending for next recovery pass.
- **Rationale**: Closes the single-chapter orphaned database loophole and unifies the lifecycle semantics across project deletion, bulk chapter deletion, and single chapter deletion.
- **Alternatives Considered**: Background sweeps scanning `indexedDB.databases()`. Rejected because `databases()` is non-standard or unsupported in some environments, and wildcard/prefix matching risks deleting databases belonging to other projects sharing ID prefixes.

---

### Decision 3: Universal Chapter Ownership Guard (`assertChapterOwnership`) Across All Write Boundaries

- **Context**: `saveChapterToDB` and `saveChaptersToDB` validate foreign key ownership against existing records. However, `saveProjectToDB` and `atomicSaveProjectBundle` (used by Google Drive sync and project bundle imports) extract chapters and directly enqueue `chaptersStore.put({ ...chap, projectId: project.id })`. If an imported bundle contains a chapter ID that already belongs to a different existing project, it silently re-parents the chapter.
- **Decision**: Implement a canonical validation utility:
  ```typescript
  export function assertChapterOwnership(
    existing: Chapter | undefined,
    incomingProjectId: string,
    chapterId: string
  ): void {
    if (existing && existing.projectId && existing.projectId !== incomingProjectId) {
      throw new Error(
        `Relational integrity violation: Cannot re-parent chapter "${chapterId}" from project "${existing.projectId}" to "${incomingProjectId}".`
      );
    }
  }
  ```
  Enforce this check in:
  - `saveChapterToDB`
  - `saveChaptersToDB`
  - `saveProjectToDB`: check existing chapters in `chaptersStore` before saving.
  - `atomicSaveProjectBundle`: pre-validate ALL incoming chapters against `chaptersStore` inside the transaction before any `put()` operations are enqueued. If any chapter belongs to another project, abort the transaction immediately and throw.
- **Rationale**: Guarantees relational integrity across all ingestion pathways, including cloud synchronization and file bundle imports.
- **Alternatives Considered**: Validating only at the UI hook level. Rejected because UI hooks do not intercept background sync or direct service invocations (Constitution Principle III).

---

### Decision 4: Strict Fail-Closed Semantics for Persistence Disposal

- **Context**: In `deleteProjectCrdtDatabases` and `deleteChapterCrdtDatabase`, errors from `destroyCrdtPersistence` and `destroyAllCrdtPersistencesForProject` are caught and logged with `console.warn`, allowing `executeDeleteDatabase` to proceed anyway. If `provider.destroy()` fails, the persistence instance remains registered in the registry, but the database deletion proceeds while connections might still be active.
- **Decision**: Remove the `try / catch` error suppression around `destroyCrdtPersistence` and `destroyAllCrdtPersistencesForProject`. If closing in-memory persistence instances fails:
  - Reject/throw the error immediately.
  - Do NOT proceed to `executeDeleteDatabase`.
  - Retain the deletion manifest in `pending` status.
- **Rationale**: Prevents deleting databases underneath unclosed providers and maintains registry fail-closed semantics across the entire stack.
- **Alternatives Considered**: Forcibly unregistering the provider even after destroy failure. Rejected because unclosed providers could attempt subsequent writes to an unlinked database.

---

### Decision 5: Fail-Closed Manifest Recovery Discovery

- **Context**: `getPendingDeletionManifests()` catches any database read error and returns `[]`. `recoverPendingDeletions()` then considers recovery complete with `{ recoveredCount: 0, failedCount: 0 }`.
- **Decision**:
  - `getPendingDeletionManifests()` MUST propagate errors if the transaction or object store read fails.
  - `recoverPendingDeletions()` MUST catch the read error, propagate it or increment `failedCount`, and reject the operation so that callers are aware that recovery could not verify manifests.
- **Rationale**: Distinguishes "no pending manifests" from "failed to query manifests" to avoid silent failure of recovery obligations.
- **Alternatives Considered**: Retrying indefinitely in a loop. Rejected to prevent locking the main thread; standard error propagation allows callers and lifecycle hooks to log and reschedule.

---

### Decision 6: Concurrency and Discovery Consistency in Project Deletion

- **Context**: Project deletion discovers chapters prior to transaction opening. In cross-tab scenarios where Web Locks are degraded, another tab could insert a chapter before the catalog transaction locks.
- **Decision**: Inside the atomic deletion transaction:
  - Discover all chapters from `projectsStore.get(id)`, `chaptersStore.index('projectId')` (or cursor), and `crdtStore.index('projectId')`.
  - Construct the final `chapterIds` and `physicalDbNames`.
  - Put the manifest record with the complete discovered list in the same transaction.
  - After commit, pass this authoritative list to `deleteProjectCrdtDatabases`.
- **Rationale**: Guarantees zero dangling databases even under concurrency windows between initial inspection and transaction commit.
