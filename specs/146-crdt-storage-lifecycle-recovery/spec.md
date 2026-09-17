# Feature Specification: CRDT Storage Lifecycle Recovery and Invariant Hardening

**Feature Branch**: `146-crdt-storage-lifecycle-recovery`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "Tôi đã kiểm tra lại HEAD mới nhất hiện tại của repo (d586151b7e12da07c7e3db94140b9671e4cad3cc). CI xanh hoàn toàn, các lỗi cũ đã sửa đúng. Tuy nhiên vẫn còn các vấn đề quan trọng: 1. 🔴 P1 - Fail-closed hiện tại chưa giải quyết được orphan CRDT DB sau khi lỗi (cần durable deletion manifest/tombstone); 2. 🔴 P1/P2 - Foreign-key validation đang 'skip', không thực sự reject (chuyển toàn bộ ownership violation từ console.warn(); return thành reject/abort); 3. 🔴 P2 - saveCrdtState() vẫn có thể lưu CRDT state cho chapter không tồn tại (chặn !chapter); 4. 🟠 P2 - waitForQueueIdle() chưa biến snapshot + delete thành một critical section (đưa snapshot + delete vào cùng critical section); 5. 🟠 P2 - deleteChapterFromDB(id, projectId) tin projectId do caller truyền vào (xác minh canonical projectId từ DB); 6. 🟠 P2 - deleteProjectCrdtDatabases() vẫn có những đường fail-open (lỗi discovery và persistence destroy bị nuốt); 7. 🟠 P2 - getCrdtState(chapterId) khi hydrate không xác minh projectId; 8. Test/verification & quickstart consistency."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Resilient Physical Storage Cleanup via Durable Deletion Manifest (Priority: P1)

When a project or chapter deletion is initiated, the system must guarantee that physical storage cleanup can always be completed, even if the initial physical deletion encounters errors or interruptions. Because primary catalog records are deleted to reflect user intent, the system must durably record a deletion manifest (or tombstone) containing the exact identities of targeted physical databases *before* committing the destructive catalog removal. If physical database deletion fails or is interrupted (e.g. browser crash, tab closure, locked storage), subsequent application sessions can detect unresolved manifests and resume physical cleanup, preventing orphaned storage from lingering on the user's device without a recovery path.

**Why this priority**: Without a persistent deletion manifest, if physical deletion fails after catalog records are committed, all reference metadata is lost and physical collaborative databases become permanently orphaned with zero possibility of targeted cleanup.

**Independent Test**: Simulate an interrupted or failed physical database deletion during project deletion. Verify that a durable pending deletion manifest is preserved in persistent storage, and that invoking the startup recovery process detects the manifest and cleanly deletes the remaining physical databases.

**Acceptance Scenarios**:

1. **Given** a project deletion request, **When** the deletion workflow begins, **Then** a durable deletion manifest listing all targeted physical database identities is recorded prior to committing catalog deletions.
2. **Given** a committed project deletion where physical database removal fails or is interrupted, **When** the application restarts or recovery is triggered, **Then** the pending deletion manifest is processed to purge all outstanding physical databases.
3. **Given** a project or chapter deletion where physical cleanup succeeds completely, **When** the workflow finishes, **Then** the corresponding deletion manifest is finalized and cleanly retired.

---

### User Story 2 - Strict Reject/Abort Semantics for Relational Ownership Violations (Priority: P1)

When saving a chapter or a collaborative state record, the system must strictly enforce relational boundaries: attempting to re-parent an existing chapter across different projects, attempting to associate collaborative state with a non-existent chapter, or saving collaborative state under a conflicting project identifier must actively abort and reject the operation with a descriptive error. The system must never silently drop writes while falsely reporting successful execution to the caller.

**Why this priority**: Silent write drops disguise data integrity violations and cause silent data loss where calling processes (and users) believe data was saved, while in reality the storage layer discarded the payload without notice.

**Independent Test**: Attempt to save an existing chapter with a conflicting project identifier; attempt to save collaborative state for a chapter that does not exist in storage; attempt to save collaborative state for a chapter belonging to another project. Verify that in all cases the returned operation promise rejects with a validation error and aborts transaction execution.

**Acceptance Scenarios**:

1. **Given** an existing chapter assigned to Project A, **When** a save request arrives with Project B as its parent ID, **Then** the operation actively rejects with an error and does not overwrite existing data.
2. **Given** a collaborative state record referencing a chapter ID that does not exist in the primary catalog, **When** save is requested, **Then** the operation rejects with a missing entity error.
3. **Given** an existing chapter assigned to Project A, **When** a collaborative state save request arrives specifying Project B, **Then** the operation rejects with an ownership mismatch error.

---

### User Story 3 - Unified Critical Section for Deletion Snapshot and Removal (Priority: P2)

When a user initiates deletion of a project or chapter history, the snapshot taken for the Undo action and the destructive deletion execution must occur within a single, continuous exclusive critical section. In-flight background saves must settle, and no new autosave writes may be admitted between snapshot capture and deletion execution, ensuring that the undo backup always reflects the exact latest user modifications.

**Why this priority**: Eliminates the race window where a background autosave write arrives after the undo snapshot is captured but before deletion executes, which causes Undo to restore stale, outdated data.

**Independent Test**: Dispatch a burst of edits while simultaneously initiating project deletion; verify that snapshot capture and deletion execute sequentially within an unbroken lock, and that restoring via Undo restores the complete set of final edits.

**Acceptance Scenarios**:

1. **Given** an active editor generating background saves, **When** project deletion is initiated, **Then** the project lock ensures all pending saves commit, captures the undo backup snapshot, and executes deletion without allowing intervening writes.
2. **Given** a chapter history deletion request, **When** initiated, **Then** chapter snapshot and history removal occur within an exclusive critical section for the chapter's parent project.

---

### User Story 4 - Canonical Project Identity Verification in Chapter Operations (Priority: P2)

When deleting a chapter or hydrating collaborative editor sessions, the system must resolve and verify the canonical parent project identity directly from the persistent storage entity rather than trusting unverified arguments supplied by callers.

**Why this priority**: Prevents cross-project deletion pollution or mismatched document hydration caused by buggy callers, corrupted cache, or identity collisions.

**Independent Test**: Invoke chapter deletion with a mismatched project parameter; verify that the operation rejects. Attempt to hydrate an editor session with collaborative state belonging to a different project; verify that hydration aborts and logs an ownership violation.

**Acceptance Scenarios**:

1. **Given** a chapter deletion request specifying a project ID that conflicts with the chapter's stored parent ID, **When** deletion executes, **Then** the operation rejects with an ownership mismatch error.
2. **Given** a chapter deletion request without a project ID, **When** deletion executes, **Then** the canonical project ID is retrieved from storage and used to coordinate serialization and cleanup.
3. **Given** an editor session opening for Project A, **When** collaborative state is queried, **Then** the system asserts that the retrieved state record matches Project A before applying document updates.

---

### User Story 5 - Fail-Closed Discovery & Persistence Connection Release (Priority: P2)

When preparing for database deletion, the system must treat discovery failures and connection release failures as hard errors that fail closed. Discovery of physical databases must not swallow partial errors, and persistence provider tracking must retain provider references until connection closure successfully completes, allowing reliable retries.

**Why this priority**: Swallowing discovery errors or prematurely dropping provider references leaves locked connections and un-tracked databases on disk, violating the zero-dangling-database guarantee.

**Independent Test**: Simulate an error during chapter storage discovery; verify that deletion rejects. Simulate a failure during persistence provider destruction; verify that provider references remain in the registry so subsequent cleanup attempts can re-close them.

**Acceptance Scenarios**:

1. **Given** a project deletion where storage target discovery fails midway, **When** executed, **Then** the operation rejects and does not proceed with incomplete cleanup.
2. **Given** an active persistence provider whose closure fails during cleanup, **When** destruction is attempted, **Then** the error is propagated and provider tracking is preserved for subsequent cleanup retries.

---

### Edge Cases

- What happens if the browser is terminated while deleting physical databases? The durable deletion manifest remains in storage; on next application startup, the cleanup recovery worker detects the unresolved manifest and completes removal.
- What happens if a chapter is deleted while it is currently open in an active editor tab? The canonical deletion acquires the project write lock, closes active persistence providers, deletes the databases, and reports failure to the caller if storage remains blocked.
- What happens if an undo action is invoked after a successful deletion? The in-memory undo snapshot re-inserts catalog records and collaborative state, cleanly reinstating the project.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The storage layer MUST persist a durable deletion manifest recording targeted physical database names and project identity prior to committing destructive catalog deletions.
- **FR-002**: The application MUST provide an initialization recovery worker that scans for unresolved deletion manifests and executes physical database cleanup.
- **FR-003**: A deletion manifest MUST only be removed or marked complete after all associated physical databases have been successfully confirmed deleted.
- **FR-004**: Entity save operations (`saveChapterToDB`, `saveChaptersToDB`) MUST reject the operation promise and abort the transaction if an existing entity with the same identity belongs to a different project.
- **FR-005**: Collaborative state save operations (`saveCrdtState`, `saveCrdtStates`) MUST verify that the referenced chapter exists in storage and belongs to the specified parent project; if either condition fails, the operation MUST reject with an explicit error.
- **FR-006**: Deletion workflows capturing undo backup snapshots MUST lock the target project in an unbroken critical section encompassing both snapshot generation and deletion execution.
- **FR-007**: Chapter deletion (`deleteChapterFromDB`) MUST verify caller-provided project identity against the canonical stored chapter record, rejecting mismatches and resolving canonical project identity when omitted.
- **FR-008**: Physical storage target discovery (`deleteProjectCrdtDatabases`) MUST NOT swallow errors during chapter ID aggregation and MUST reject if discovery fails.
- **FR-009**: Collaborative persistence provider destruction MUST NOT discard provider references prior to successful closure and MUST propagate connection release errors.
- **FR-010**: Editor collaborative state hydration MUST verify that any retrieved state record belongs to the active session's parent project before applying document updates.

### Key Entities

- **Deletion Manifest**: Durable record stored in persistent storage containing `id`, `projectId`, `chapterIds`, `physicalDbNames`, `createdAt`, and `status` ('pending' | 'completed').
- **StoryProject**: Root project document containing novel metadata, chapter catalog, and glossary entries.
- **Chapter**: Chapter entity holding source text, translations, paragraphs, and canonical parent `projectId`.
- **CrdtStateRecord**: Serialized collaborative state snapshot holding `chapterId`, `projectId`, and binary `state`.
- **Dedicated Collaborative Storage**: Browser-level IndexedDB database (`crdt_${projectId}_${chapterId}`).
- **Persistence Provider Registry**: In-memory manager tracking active browser storage connections for open documents.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of interrupted or failed physical storage deletions are discoverable and recoverable via durable deletion manifests upon subsequent application launch.
- **SC-002**: Zero silent write drops: 100% of relational foreign-key and ownership invariant violations reject the operation promise with an explicit error.
- **SC-003**: 100% of collaborative state records committed to storage are verified to belong to a currently existing chapter in the primary catalog.
- **SC-004**: Zero race conditions between autosave writes and undo backup snapshots during project or chapter deletion.
- **SC-005**: Zero physical databases or persistence provider references orphaned due to swallowed errors during discovery or destruction.
- **SC-006**: 100% pass rate across the full verification suite (`npm run lint`, `npm test`, `npm run build`) with zero regressions.

## Assumptions

- Durable deletion manifests are stored in a dedicated object store within the primary database (`novel_translator_db`).
- Re-running physical database deletion for an already-deleted database in IndexedDB is safe and succeeds idempotently.
- A chapter entity must exist in the primary catalog before collaborative state can be persisted for it.
- Deletion manifest cleanup worker runs during application initialization or database bootstrap.
