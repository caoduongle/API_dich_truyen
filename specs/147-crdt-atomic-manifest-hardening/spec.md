# Feature Specification: CRDT Atomic Deletion Manifest & Storage Integrity Hardening

**Feature Branch**: `147-crdt-atomic-manifest-hardening`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "Atomic deletion manifest, single chapter manifest, write path foreign key validation, fail-closed CRDT persistence destroy and manifest error recovery"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Atomic Manifest and Catalog Deletion to Prevent Premature CRDT Database Loss (Priority: P1)

When a user deletes a project or a batch of chapters, the deletion manifest record and the catalog deletions (project, chapters, CRDT states) must be committed atomically within the same transactional operation. If the application terminates or crashes during or before catalog deletion, the database transaction aborts both the manifest and catalog changes together. This ensures the startup recovery service never encounters an orphaned manifest for active data and never deletes physical CRDT databases of surviving projects or chapters.

**Why this priority**: P1 (Highest severity). Committing a deletion manifest in a separate transaction prior to catalog deletion introduces a critical data-loss vulnerability: an unexpected crash between manifest commit and catalog deletion causes the recovery worker to delete active physical CRDT databases on restart while catalog records still exist.

**Independent Test**: Simulate an abort or interruption during the catalog deletion phase of project deletion; verify that neither the catalog deletion nor the deletion manifest is persisted. On restart, verify that the recovery service finds no pending manifests and the existing project and chapter CRDT databases remain completely intact.

**Acceptance Scenarios**:

1. **Given** an existing project with chapters and physical CRDT databases, **When** the user deletes the project, **Then** the deletion manifest record (status "pending") and the deletion of project, chapter, and CRDT state records are committed within the same IndexedDB transaction before physical database deletion begins.
2. **Given** a project deletion where the transaction aborts or fails prior to commit, **When** the application restarts, **Then** no deletion manifest exists in storage and all catalog and physical CRDT databases remain intact.
3. **Given** a project deletion where the atomic transaction commits successfully but the process terminates before physical databases are deleted, **When** the application restarts, **Then** the recovery service discovers the pending manifest, deletes the orphaned physical databases, and removes the manifest upon completion.

---

### User Story 2 - Durable Deletion Manifest for Single Chapter Deletions (Priority: P1)

When a user deletes an individual chapter, the system must record a durable deletion manifest atomically with the deletion of the chapter catalog records before removing the physical CRDT database. If the process terminates between catalog deletion and physical cleanup, the recovery service discovers the manifest upon next startup and finishes the cleanup, ensuring zero dangling databases.

**Why this priority**: P1. Single chapter deletion currently lacks a deletion manifest entirely. An interruption between catalog deletion and physical cleanup permanently orphans the physical CRDT database with no durable record for recovery.

**Independent Test**: Perform a single chapter deletion and simulate process exit immediately after the catalog transaction commits; verify upon application restart that the recovery service detects the single chapter deletion manifest, cleans up the specific physical CRDT database, and clears the manifest.

**Acceptance Scenarios**:

1. **Given** an existing chapter in a project, **When** the user deletes the chapter via `deleteChapterFromDB`, **Then** a deletion manifest containing the project ID, chapter ID, and target physical database name is committed in the same transaction as the chapter and CRDT state catalog deletions.
2. **Given** a single chapter deletion where the atomic transaction commits and physical database deletion succeeds immediately, **When** physical cleanup completes, **Then** the deletion manifest is removed from storage.
3. **Given** an uncompleted single chapter deletion where the atomic transaction committed but physical cleanup did not execute, **When** the recovery service runs on application restart, **Then** the targeted physical CRDT database is deleted and the manifest is removed.

---

### User Story 3 - Cross-Boundary Foreign Key Validation on All Write Paths (Priority: P1/P2)

When saving projects, batches of chapters, or importing project bundles from external sources (such as Google Drive synchronization), the storage subsystem must strictly validate chapter ownership against existing stored chapters across all write paths (`saveChapterToDB`, `saveChaptersToDB`, `saveProjectToDB`, and `atomicSaveProjectBundle`). Re-parenting an existing chapter from one project to another must be rejected with a relational integrity error before any record is modified or overwritten.

**Why this priority**: P1/P2. Foreign key protection was previously enforced on direct chapter writes but bypassed by `saveProjectToDB` and `atomicSaveProjectBundle`. External bundle synchronization could silently reassign an existing chapter from one project to another.

**Independent Test**: Attempt to call `saveProjectToDB` or `atomicSaveProjectBundle` with a chapter ID that already exists in storage under a different project ID; verify that the write operation throws a relational integrity error, aborts the transaction, and leaves the original chapter intact under its original project.

**Acceptance Scenarios**:

1. **Given** Chapter C associated with Project A in storage, **When** `saveProjectToDB` is called for Project B containing Chapter C, **Then** the operation aborts with a relational integrity violation error and does not modify Chapter C.
2. **Given** Chapter C associated with Project A in storage, **When** `atomicSaveProjectBundle` is called for Project B with Chapter C, **Then** pre-validation detects the ownership conflict, aborts before enqueuing any record mutations, and throws a relational integrity violation error.
3. **Given** a bundle with multiple valid chapters belonging to Project B, **When** `atomicSaveProjectBundle` is called, **Then** all chapters pass ownership validation and are saved atomically.

---

### User Story 4 - Fail-Closed CRDT Persistence Release and Manifest Discovery (Priority: P2)

When deleting CRDT databases or executing background recovery, the system must adhere to fail-closed semantics. If releasing active in-memory persistence instances fails during deletion, the operation must reject immediately rather than proceeding with database deletion; if reading pending manifests encounters a database error, the recovery worker must report failure rather than treating the result as an empty list.

**Why this priority**: P2. Swallowing errors in persistence destroy or manifest lookup creates silent failure modes, potentially corrupting active connections or skipping pending cleanups unnoticed.

**Independent Test**: Mock a failure in `destroyCrdtPersistence` during chapter or project deletion and verify that the deletion rejects with the error and preserves the pending manifest; mock a read error in `getPendingDeletionManifests` and verify that `recoverPendingDeletions` reports a failed count or rejects rather than reporting clean success.

**Acceptance Scenarios**:

1. **Given** an active CRDT persistence instance that fails during destroy, **When** `deleteProjectCrdtDatabases` or `deleteChapterCrdtDatabase` runs, **Then** the error is propagated to the caller, database deletion is not attempted, and the deletion manifest remains pending.
2. **Given** a storage read error when querying deletion manifests, **When** `recoverPendingDeletions` executes, **Then** the failure is reported (failed count incremented or promise rejected) rather than returning `{ recoveredCount: 0, failedCount: 0 }`.

---

### User Story 5 - Discovery Consistency Across Concurrency Windows (Priority: P2)

When deleting a project, any chapter IDs discovered or added during the exclusive lock window prior to catalog transaction commit must be included in the committed deletion manifest, ensuring zero orphaned databases even if concurrent activity occurred between initial inspection and commit.

**Why this priority**: P2. Prevents edge-case dangling physical databases if chapters are added or discovered across storage stores during the deletion sequence.

**Independent Test**: Simulate concurrent chapter insertion or multi-store discovery during the deletion sequence; verify that the committed deletion manifest and subsequent physical database cleanup include all discovered chapter IDs.

**Acceptance Scenarios**:

1. **Given** a project deletion process that discovers additional chapter IDs during catalog traversal, **When** the deletion transaction commits, **Then** the committed manifest reflects all discovered chapter IDs and corresponding physical database names.

---

### Edge Cases

- **Crash during atomic transaction**: Browser tab closes while writing the manifest and deleting catalog records. IndexedDB transactions ensure that either all operations commit or none do. On restart, the project remains fully intact with its CRDT databases, and no manifest exists.
- **Crash immediately following atomic commit**: Browser crashes after the atomic transaction commits but before physical deletion occurs. On restart, the recovery service detects the committed pending manifest, performs physical cleanup, and clears the manifest.
- **Single chapter deletion with non-existent physical database**: A chapter is deleted that was never opened or modified (no physical CRDT DB exists). Physical deletion treats missing databases gracefully and completes manifest removal.
- **Bundle import with partial conflicting chapters**: An imported bundle contains 5 chapters, where 4 are new and 1 belongs to another existing project. Pre-validation identifies the conflict before any writes occur, rejecting the entire bundle atomically.
- **Recovery worker runs while database is locked or corrupted**: The recovery worker encounters an error reading manifests; instead of assuming zero pending items, it reports the failure so the issue can be inspected or retried.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The storage engine MUST commit deletion manifest creation and catalog deletion (project, chapters, and CRDT states) within the same transactional boundary for project and bulk chapter deletion.
- **FR-002**: The storage engine MUST NOT execute physical CRDT database removal until after the atomic deletion and manifest transaction has successfully committed.
- **FR-003**: The storage engine MUST record a durable deletion manifest within the same transaction that deletes a single chapter and its CRDT state in `deleteChapterFromDB`.
- **FR-004**: The storage engine MUST remove the deletion manifest record once all associated physical CRDT databases are successfully deleted.
- **FR-005**: The storage engine MUST enforce a unified chapter ownership assertion (`assertChapterOwnership`) across all chapter write entry points, including `saveChapterToDB`, `saveChaptersToDB`, `saveProjectToDB`, and `atomicSaveProjectBundle`.
- **FR-006**: When saving a project or bundle, the system MUST pre-validate that none of the incoming chapters are already registered under a different project ID before modifying any record in storage.
- **FR-007**: When releasing CRDT persistence instances during deletion, any error thrown by the destroy operation MUST NOT be caught or ignored; the deletion process MUST reject immediately and retain the deletion manifest in pending status.
- **FR-008**: When retrieving pending deletion manifests for recovery, errors reading from storage MUST NOT be caught and transformed into an empty result; errors MUST be propagated or counted as failed recovery operations.
- **FR-009**: The project deletion routine MUST update or record the manifest using the complete set of chapter IDs discovered across all stores up to the moment of transaction commit.

### Key Entities

- **Deletion Manifest Record**:
  - Represents durable intent to clean up physical storage after catalog records have been removed.
  - Key attributes: unique ID, project identifier, list of chapter identifiers, list of physical database names, status (pending/completed), creation timestamp.
- **Chapter Record**:
  - Represents an individual chapter within a project.
  - Key attributes: chapter ID, project ID (foreign key reference), title, content fields (source text, raw translation, paragraphs), status, timestamps.
- **Story Project**:
  - Represents the top-level translation project.
  - Key attributes: project ID, title, metadata, list of chapter metadata references.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of project, bulk chapter, and single chapter deletions record a persistent deletion manifest atomically with catalog removal, resulting in 0 instances where a physical CRDT database is deleted while catalog records remain.
- **SC-002**: 100% of interrupted deletions after catalog commit are detectable and cleanable by the recovery service on next application launch.
- **SC-003**: 0% rate of chapter re-parenting or ownership hijacking across all storage write operations (`saveChapterToDB`, `saveChaptersToDB`, `saveProjectToDB`, `atomicSaveProjectBundle`).
- **SC-004**: 100% of failed persistence releases or failed manifest reads propagate failure status rather than silently succeeding.
- **SC-005**: All existing test suites pass cleanly with 0 regressions, maintaining full compatibility with the application's client-side architecture.

## Assumptions

- All operations run within the client-side browser environment using IndexedDB as the local store.
- Physical CRDT databases created by the collaboration engine follow the naming convention `crdt_${projectId}_${chapterId}`.
- Storage transactions adhere to standard IndexedDB atomic commit and rollback behavior supported by modern browsers.
- No schema migration or breaking changes to `src/types.ts` are required; all changes enhance internal integrity within existing schemas.
