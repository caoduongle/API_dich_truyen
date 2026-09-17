# Feature Specification: CRDT Deletion Error Propagation and Undo Integrity Hardening

**Feature Branch**: `145-crdt-deletion-undo-hardening`

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: "Tôi đã kiểm tra lại HEAD mới nhất của main (8e6fdc6bd59ca244a9a22741d3a2f98e810bcb5e). Commit này đúng là đã xử lý phần lớn các lỗi tôi nêu ở vòng trước. Tuy nhiên, sau khi rà sâu hơn, tôi vẫn thấy 3 vấn đề đáng kể, trong đó có 1 lỗi P1 thực sự: 1. P1 - deleteProjectFromDB() và deleteChapterFromDB() vẫn có thể báo xóa thành công dù CRDT DB chưa bị xóa (swallow error); 2. P2 - Undo đã khôi phục crdt_states, nhưng chưa khôi phục CRDT state mà editor thực sự sử dụng (chưa hydrate Y.Doc / y-indexeddb); 3. P2 - Backup Undo được đọc trước queue, nên có race với autosave; 4. P2 - Bạn vẫn chưa thu thập project.chapters khi xác định CRDT DB cần xóa; 5. P2 - deleteChaptersByProjectFromDB() chưa hoàn chỉnh về CRDT lifecycle; 6. P2 - Chưa có invariant kiểm tra quan hệ chapter.projectId <-> existing chapter <-> project; 7. P2 - destroyAllCrdtPersistencesForProject() vẫn có một API nguy hiểm khi knownChapterIds không truyền (prefix fallback); 8. P2 - Registry có thể bỏ sót nhiều provider cùng một DB name."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fail-Closed Rejection on Incomplete Storage Cleanup (Priority: P1)

When a user triggers a destructive deletion for a project or chapter, the system must guarantee that all corresponding local data—including primary records, collaborative state snapshots, and dedicated physical browser storage—are completely and permanently removed. If any deletion phase fails (for example, if browser storage is locked/blocked beyond timeout or encounters an I/O failure), the operation must fail-closed and reject. The system must never falsely report successful deletion to the user when physical storage remains alive on disk.

**Why this priority**: Falsely reporting success when physical storage cleanup fails causes data retention violations and allows stale ghost documents or drafts to resurrect when a project or chapter with the same identity is created later.

**Independent Test**: Simulate a failure or timeout in dedicated collaborative storage deletion; invoke project deletion and chapter deletion; verify that the deletion operation rejects with an explicit error and does not confirm successful deletion.

**Acceptance Scenarios**:

1. **Given** a project deletion request where physical collaborative storage deletion rejects or times out, **When** the deletion workflow runs, **Then** the operation promise rejects with an error and does not report successful deletion.
2. **Given** a chapter deletion request via `deleteChapterFromDB` where dedicated collaborative storage deletion fails, **When** the deletion executes, **Then** the error is propagated and the operation rejects.

---

### User Story 2 - Complete Collaborative History Restoration on Deletion Undo (Priority: P2)

When a user undoes a project or chapter deletion, the system must restore the full collaborative document state so that reopening the chapter in the collaborative editor immediately loads the exact content and document history from the restored state, without creating an empty or un-hydrated editing document.

**Why this priority**: Restoring only primary metadata without applying restored collaborative state into the active collaborative document model breaks document lineage and leaves the editor out of sync with the restored data.

**Independent Test**: Create a project and chapter with collaborative edits, delete the project, trigger "Undo", and open the chapter in the editor. Verify that the editor document immediately reflects the restored collaborative state and persists it to local storage.

**Acceptance Scenarios**:

1. **Given** a project deleted and restored via the Undo action, **When** a user opens one of its chapters in the collaborative editor, **Then** the editor session hydrates its collaborative document directly from the restored collaborative state.
2. **Given** a chapter deleted and restored via Undo in chapter history, **When** the user opens the restored chapter, **Then** all translated text and collaborative state match the pre-deletion state.

---

### User Story 3 - Fresh Snapshot Consistency for Deletion Undo (Priority: P2)

When a user deletes a project or chapter shortly after making edits, the backup taken for the Undo action must capture the latest committed state. The system must ensure that any in-flight saves or queued write operations finish before the backup snapshot is generated, preventing Undo from reverting to a stale or outdated version.

**Why this priority**: Capturing the undo backup before in-flight background saves complete causes data loss if the user subsequently clicks Undo, restoring an outdated snapshot.

**Independent Test**: Trigger a save operation followed immediately by project deletion; verify that the undo snapshot creation awaits the write queue and captures the updated content, and that invoking Undo restores the latest modifications.

**Acceptance Scenarios**:

1. **Given** active in-flight saves for a project, **When** the user deletes the project, **Then** pending writes are completely flushed before the backup snapshot is created.
2. **Given** a project deletion with serialized snapshot backup, **When** Undo is triggered, **Then** the restored project reflects the most recent edits committed prior to deletion.

---

### User Story 4 - Exhaustive Chapter Storage Discovery from All Sources (Priority: P2)

When deriving the set of dedicated storage instances to clean up during project deletion, the system must collect chapter identifiers exhaustively across all available sources: the primary project definition (`project.chapters`), stored chapter entities, and recorded collaborative states. This ensures that even partially detached or dangling chapters are completely purged. Furthermore, bulk chapter deletion for a project must cleanly clean up collaborative states and dedicated storage.

**Why this priority**: Relying only on a subset of storage sources leaves orphaned physical databases on disk if a chapter is recorded in `project.chapters` but already detached from the chapters table.

**Independent Test**: Create a project where `project.chapters` lists a chapter ID that does not exist in the chapters table but has dedicated collaborative storage; delete the project and verify that the dedicated storage for that chapter ID is purged.

**Acceptance Scenarios**:

1. **Given** a project with chapter IDs present in `project.chapters`, `chapters` store, and `crdt_states` store, **When** the project is deleted, **Then** all unique chapter IDs across all three sources are targeted and purged.
2. **Given** a bulk chapter deletion request for a project via `deleteChaptersByProjectFromDB`, **When** executed, **Then** all chapter records, associated collaborative states, and dedicated storage are purged.

---

### User Story 5 - Relational Foreign-Key Ownership Integrity (Priority: P2)

The system must protect project boundaries by enforcing strict relational ownership: saving a chapter or a collaborative state must verify that the entity's parent project matches its existing parent, rejecting attempts to re-parent chapters across different projects or associate collaborative states with conflicting project identifiers.

**Why this priority**: Prevents silent cross-project data corruption, accidental project re-parenting, or orphaned state injection during cloud sync, imports, or programmatic operations.

**Independent Test**: Attempt to save an existing chapter with a different parent project ID; verify that the save operation aborts with a validation warning and preserves the original ownership.

**Acceptance Scenarios**:

1. **Given** an existing chapter assigned to Project A, **When** a save request arrives with Project B as its parent ID, **Then** the system rejects the operation and preserves Project A's ownership.
2. **Given** a collaborative state record, **When** saving to storage, **Then** the system verifies that the target chapter belongs to the specified parent project.

---

### User Story 6 - Collision-Safe Persistence Management & Multi-Instance Cleanup (Priority: P2)

The in-memory registry for active collaborative persistence providers must handle multiple concurrent provider instances associated with the same document without overwriting references. Additionally, project-wide disconnection must isolate providers using exact project and chapter coordinates, eliminating naive prefix matching that could match projects with substring-overlapping identifiers.

**Why this priority**: Multiple editor mount lifecycles in single-page applications can spawn duplicate providers for the same document. If one overwrites the other in the registry, dangling providers hold open database connections, blocking physical deletion.

**Independent Test**: Register multiple persistence providers for the same database name; invoke provider destruction; verify that all registered provider instances for that database are destroyed. Register providers for Project `proj_100` and `proj_100_200`; purge Project `proj_100`; verify that `proj_100_200` providers remain untouched.

**Acceptance Scenarios**:

1. **Given** multiple active persistence provider instances for a single document, **When** cleanup is requested, **Then** all instances are closed and destroyed.
2. **Given** projects with IDs `proj_alpha` and `proj_alpha_beta`, **When** providers for `proj_alpha` are destroyed without explicit chapter IDs, **Then** providers belonging to `proj_alpha_beta` are never touched.

---

### Edge Cases

- What happens if a database deletion times out after 5 seconds due to a persistent lock in another window? The deletion operation rejects with an informative error, and the user-facing action indicates deletion could not be finalized.
- What happens if a project has no chapters or collaborative states? Deletion executes cleanly and removes the project record without attempting invalid database deletions.
- What happens if the undo action is invoked after the user has navigated away or closed the application? The undo toast action is ephemeral per user session, while permanent deletions remain durable.
- What happens if an undo snapshot is taken while an editor is actively typing? The serialization queue flushes the latest debounced change before the snapshot is sealed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Deletion functions (`deleteProjectFromDB`, `deleteChapterFromDB`) MUST propagate collaborative storage deletion errors and MUST NOT catch-and-swallow failures to report false-positive success.
- **FR-002**: The collaborative editor lifecycle MUST hydrate its active collaborative document from stored collaborative state records whenever a chapter session is opened.
- **FR-003**: The deletion workflow in the project management interface MUST wait for all in-flight write operations on the target project to settle before capturing the undo backup snapshot.
- **FR-004**: Project deletion MUST aggregate chapter identifiers from `project.chapters`, the primary chapters store, and the collaborative states store to guarantee comprehensive cleanup of dedicated storage.
- **FR-005**: Bulk chapter deletion (`deleteChaptersByProjectFromDB`) MUST purge chapter records, collaborative state records, and dedicated collaborative storage databases within the project write boundary.
- **FR-006**: Chapter save operations MUST enforce parent project consistency: if a chapter already exists in storage under a given `projectId`, incoming saves with a mismatched `projectId` MUST be rejected.
- **FR-007**: Collaborative state save operations MUST verify that the target chapter belongs to the specified parent project before committing to storage.
- **FR-008**: The persistence registry MUST track multiple active provider instances per document identity (e.g. using collection sets) so that all open instances are closed before database deletion.
- **FR-009**: Project-level persistence destruction MUST identify target providers using exact project boundary matching, avoiding naive substring prefix matching that could match projects sharing prefix substrings.

### Key Entities

- **StoryProject**: Root project document containing novel metadata, chapter catalog (`chapters`), and glossary entries.
- **Chapter**: Chapter entity holding source text, translations, paragraphs, and parent `projectId`.
- **CrdtStateRecord**: Serialized collaborative state snapshot stored in the primary application database.
- **Dedicated Collaborative Storage**: Browser-level IndexedDB database (`crdt_${projectId}_${chapterId}`) holding operational transformation and state history.
- **Persistence Registry**: In-memory manager tracking active browser storage connections for open collaborative documents.
- **Undo Backup Snapshot**: In-memory snapshot of project, chapter, and collaborative records captured prior to deletion for possible reversal.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of failed or blocked physical storage deletions reject the parent deletion promise, producing zero false-positive success confirmations when data remains.
- **SC-002**: 100% of chapters restored via Undo successfully hydrate their collaborative editor session with full document content and history upon opening.
- **SC-003**: Zero instances of stale data restoration when deleting and undoing a project or chapter immediately following edits.
- **SC-004**: 100% of chapter-specific collaborative databases referenced across project definitions, chapter stores, and state registers are identified and purged upon project deletion.
- **SC-005**: Zero unintended session disconnects or database removals between projects whose identifiers share substring prefixes.
- **SC-006**: 100% pass rate across the full verification suite (`npm run lint`, `npm test`, `npm run build`) with zero regressions.

## Assumptions

- Collaborative documents are identifiable by the tuple of `(projectId, chapterId)`.
- Physical database deletion timeouts (5000ms) provide sufficient tolerance for normal tab cleanup before treating blocked state as a hard failure.
- In-memory undo snapshots are retained for the duration of the notification toast (e.g. 5-10 seconds) and discardable thereafter.
- Re-parenting chapters across distinct projects is invalid within the application domain and indicates malformed input.
