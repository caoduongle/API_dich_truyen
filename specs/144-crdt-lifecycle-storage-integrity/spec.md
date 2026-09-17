# Feature Specification: CRDT Lifecycle, Storage Integrity, and Lock Isolation Hardening

**Feature Branch**: `144-crdt-lifecycle-storage-integrity`

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: "Tôi đã kiểm tra lại HEAD mới nhất của main (1ea02dc6ee948d433e0c8c8646788bbadcf0e54a). Các lỗi lớn ở vòng trước đã được sửa khá đầy đủ. Tuy nhiên, sau khi rà sâu hơn vào lifecycle thực tế, tôi vẫn tìm thấy 2 lỗi P1/P1-ish cần sửa trước khi coi storage layer là kín hoàn toàn, và 5 vấn đề P2: 1. P1 - deleteProjectCrdtDatabases() đang coi blocked/error là xóa thành công; 2. P1 - Prefix sweep CRDT có khả năng xóa nhầm CRDT DB của project khác; 3. P2 - Xóa một chapter chưa dọn CRDT của chính chapter đó; 4. P2 - saveCrdtState() vẫn có đường fail-open khi thiếu projectId; 5. P2 - atomicSaveProjectBundle() có thể nhận CRDT state thuộc project khác; 6. P2 - withProjectLock() đang retry cả callback, không chỉ retry việc lấy lock; 7. P2 - Undo sau khi xóa project không khôi phục CRDT; 8. P2 - Một số delete path vẫn không dùng transaction.oncomplete."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reliable CRDT Database Deletion Without Blocked/Error False Positives (Priority: P1)

When a user deletes a project or chapter, the system must wait for true physical deletion confirmation (`onsuccess`) from the browser storage layer before completing. If an active connection holds a lock on the database resulting in `onblocked` or if an error occurs (`onerror`), the system must not falsely report success. Furthermore, the application lifecycle must ensure all active database connections (such as open editor persistence providers) are closed prior to deletion, ensuring that deleted projects are genuinely purged and cannot resurrect stale drafts.

**Why this priority**: Falsely resolving on `onblocked` or `onerror` allows the deletion workflow to report completion while an open connection still keeps the database alive on disk. Recreating or reopening the project immediately restores stale data.

**Independent Test**: Simulate an open database connection that triggers `onblocked` during `indexedDB.deleteDatabase`; verify that the deletion routine does not resolve prematurely and handles the blocked state appropriately, and verify that closing active persistence instances allows the deletion to succeed cleanly with `onsuccess`.

**Acceptance Scenarios**:

1. **Given** a database deletion request, **When** `indexedDB.deleteDatabase` is executed, **Then** the completion promise resolves strictly when `onsuccess` fires and rejects or times out if `onerror` or persistent `onblocked` occurs.
2. **Given** an open chapter editor session with active `IndexeddbPersistence`, **When** project deletion or chapter deletion is triggered, **Then** all active persistence connections for that project are closed before database deletion is invoked.

---

### User Story 2 - Exact CRDT Database Targeting Without Cross-Project Prefix Collisions (Priority: P1)

When purging chapter CRDT databases, the system must delete only the exact databases corresponding to known project and chapter identifiers (`crdt_${projectId}_${chapterId}`). The system must never use naive prefix matching (`startsWith("crdt_" + projectId + "_")`) that could mistakenly match and delete databases belonging to another project whose identifier starts with the same substring (e.g., `proj_123` matching `proj_123_456`).

**Why this priority**: Prevents catastrophic cross-project data loss where deleting one project silently wipes out chapters and collaborative drafts from another project due to prefix collisions.

**Independent Test**: Create two projects where Project A's ID is a prefix of Project B's ID (e.g., `proj_alpha` and `proj_alpha_beta`) with active CRDT databases; delete Project A and verify that only Project A's databases are purged while Project B's databases remain intact.

**Acceptance Scenarios**:

1. **Given** Project A (`proj_100`) and Project B (`proj_100_200`) each having CRDT databases, **When** Project A is deleted, **Then** only Project A's CRDT databases are deleted, and Project B's CRDT databases remain untouched.
2. **Given** a project with multiple chapters, **When** CRDT cleanup is executed, **Then** database deletions target exact derived identifiers (`crdt_${projectId}_${chapterId}`) from known project chapters.

---

### User Story 3 - Complete CRDT Cleanup on Single Chapter Deletion (Priority: P2)

When an individual chapter is deleted from a project (`deleteChapterFromDB`), the system must atomically clean up its record in `chapters`, remove its stored collaborative state in `crdt_states`, and physically delete its dedicated persistence database (`crdt_${projectId}_${chapterId}`) within the project's write boundary.

**Why this priority**: Deleting a chapter without purging its CRDT records leaves ghost data in `crdt_states` and lingering databases on disk, which can resurface if a chapter with the same ID is created later.

**Independent Test**: Create a chapter, populate its `crdt_states` and its dedicated `crdt_${projectId}_${chapterId}` database, call `deleteChapterFromDB(chapterId)`, and verify that all three representations of the chapter are deleted.

**Acceptance Scenarios**:

1. **Given** a chapter with associated `crdt_states` and a dedicated `crdt_${projectId}_${chapterId}` database, **When** the chapter is deleted, **Then** the chapter record, its `crdt_states` entry, and its dedicated database are all completely removed.

---

### User Story 4 - Strict Fail-Closed Semantics for CRDT State Persistence (Priority: P2)

When saving CRDT state records via `saveCrdtState` or `saveCrdtStates`, any record that lacks a valid parent `projectId` must be rejected or omitted, logging a diagnostic warning rather than falling back to unassigned or unparented persistence.

**Why this priority**: Guarantees consistent relational integrity across all storage stores, preventing orphaned CRDT records that cannot be managed by project lifecycle operations.

**Independent Test**: Call `saveCrdtState` with a record missing `projectId`; verify that the write operation aborts cleanly without writing to `CRDT_STATES_STORE` and logs a diagnostic warning.

**Acceptance Scenarios**:

1. **Given** a CRDT state record lacking a `projectId`, **When** `saveCrdtState` is called, **Then** the save operation aborts cleanly and writes nothing to storage.
2. **Given** a batch of CRDT records where some lack `projectId`, **When** `saveCrdtStates` is called, **Then** only records with valid `projectId` are enqueued and persisted.

---

### User Story 5 - Project Boundary Validation in Atomic Bundle Saves (Priority: P2)

When saving a full project bundle via `atomicSaveProjectBundle`, all CRDT state items included in the bundle must be validated against the parent `project.id`. If any item specifies a differing `projectId`, the system must reject the bundle with a validation error rather than silently writing foreign project data or corrupting cross-project state.

**Why this priority**: Prevents bundle corruption and cross-project contamination where foreign CRDT states are mistakenly injected into another project's transaction.

**Independent Test**: Call `atomicSaveProjectBundle` with a project and a CRDT item whose `projectId` differs from `project.id`; verify that the operation rejects with a descriptive validation error and commits nothing to disk.

**Acceptance Scenarios**:

1. **Given** a project bundle payload containing a CRDT item with a mismatched `projectId`, **When** `atomicSaveProjectBundle` is invoked, **Then** the operation rejects with a validation error and writes 0 records to disk.
2. **Given** a project bundle payload where CRDT items match `project.id` or omit `projectId`, **When** `atomicSaveProjectBundle` is invoked, **Then** all items are normalized to `project.id` and committed atomically.

---

### User Story 6 - Isolated Lock Acquisition Retry in Web Locks (Priority: P2)

When synchronizing operations across tabs via `withProjectLock`, retry mechanics with exponential backoff must be isolated strictly to the lock acquisition phase (`navigator.locks.request`). If the user-provided callback (`fn()`) executes and throws an application error, that error must immediately propagate to the caller without re-acquiring the lock or re-running the callback.

**Why this priority**: Retrying the callback inside `withProjectLock` causes repeated execution of business logic, database transactions, and external side-effects whenever an operation fails within an already-acquired lock.

**Independent Test**: Instrument `withProjectLock` with a callback that throws an error; verify that the callback is executed exactly once, the error is thrown directly, and no retry attempts occur. Verify that lock acquisition failures are still retried up to the configured limit.

**Acceptance Scenarios**:

1. **Given** an operation protected by `withProjectLock`, **When** the callback throws an error, **Then** the callback is executed exactly once and the error is propagated without retry.
2. **Given** an operation protected by `withProjectLock`, **When** `navigator.locks.request` rejects before lock grant, **Then** lock acquisition is retried with backoff.

---

### User Story 7 - Complete Durability for Delete Transactions & Undo Integrity (Priority: P2)

All deletion transactions (`deleteChapterFromDB`, `deleteChaptersByProjectFromDB`) must resolve their returned promises strictly upon `transaction.oncomplete` and reject upon error or abort. Furthermore, the project deletion undo workflow must cleanly handle CRDT lineage and chapter restoration without stale state anomalies.

**Why this priority**: Guarantees ACID durability for all delete paths before releasing queues, and ensures undo leaves project and chapter state in a coherent, functional state.

**Independent Test**: Call `deleteChapterFromDB` and `deleteChaptersByProjectFromDB` while tracking transaction lifecycle events; verify that resolution happens strictly on `transaction.oncomplete`. Verify that undoing a project deletion restores chapters cleanly.

**Acceptance Scenarios**:

1. **Given** a chapter deletion via `deleteChapterFromDB`, **When** the transaction executes, **Then** the promise resolves strictly on `transaction.oncomplete`.
2. **Given** a project deletion via `deleteChaptersByProjectFromDB`, **When** the transaction executes, **Then** the promise resolves strictly on `transaction.oncomplete`.
3. **Given** a project deletion followed by undo, **When** the user triggers undo, **Then** the project and its chapters are restored and can be edited without stale CRDT conflicts.

---

### Edge Cases

- What happens if a database deletion request is blocked because another browser tab has the database open? The deletion waits with a bounded timeout (e.g. 3-5 seconds); if still blocked, it rejects with a clear diagnostic message rather than falsely resolving.
- What happens if a chapter ID contains special characters or underscores? Using exact derived database names (`crdt_${projectId}_${chapterId}`) avoids delimiter ambiguity and ensures only the target database is deleted.
- What happens if `deleteChapterFromDB` is called for a chapter whose CRDT database was never created? The deletion helper treats `deleteDatabase` for non-existent databases as success (as per standard IndexedDB behavior) and completes cleanly.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST resolve `indexedDB.deleteDatabase` promises only upon `onsuccess` and MUST NOT resolve on `onblocked` or `onerror`.
- **FR-002**: The system MUST disconnect and destroy any active `IndexeddbPersistence` instances prior to executing destructive database deletions.
- **FR-003**: The system MUST identify CRDT databases for deletion by their exact derived names (`crdt_${projectId}_${chapterId}`) using known chapter identifiers, and MUST NOT use prefix matching with `startsWith` that could match projects sharing a prefix.
- **FR-004**: When deleting an individual chapter via `deleteChapterFromDB`, the system MUST delete the chapter record from `chapters`, delete its corresponding entry from `crdt_states`, and delete its dedicated `crdt_${projectId}_${chapterId}` database within the project write boundary.
- **FR-005**: The system MUST fail-closed by rejecting or omitting CRDT state persistence requests that lack a valid parent `projectId`.
- **FR-006**: The system MUST validate all CRDT state records in `atomicSaveProjectBundle` against the bundle's `project.id` and reject the transaction if any mismatch is detected.
- **FR-007**: `withProjectLock` MUST isolate lock acquisition retry from callback execution, ensuring that application errors thrown inside the callback are never retried and the callback is invoked at most once per lock grant.
- **FR-008**: All storage deletion operations (`deleteChapterFromDB`, `deleteChaptersByProjectFromDB`) MUST resolve their completion promise strictly upon `transaction.oncomplete`.
- **FR-009**: The project deletion and undo workflow MUST preserve or cleanly reinitialize chapter states without resurrecting corrupt or mismatched CRDT lineage.

### Key Entities

- **StoryProject**: Project document holding metadata and chapters list.
- **Chapter**: Story chapter containing source text, translations, and parent `projectId`.
- **CrdtStateRecord**: Primary database representation of Yjs document updates in `novel_translator_db`.
- **Chapter CRDT Persistence Database**: Dedicated browser-level IndexedDB database (`crdt_${projectId}_${chapterId}`) managed by `y-indexeddb`.
- **Lock Outcome**: Discriminated union capturing callback execution result `{ ok: true, value } | { ok: false, error }` to decouple lock acquisition retry from callback error propagation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of CRDT database deletions verify confirmation via `onsuccess` before resolving.
- **SC-002**: 0 cross-project CRDT databases deleted when project IDs share prefix substrings.
- **SC-003**: 100% of single-chapter deletions purge both `crdt_states` and the dedicated `y-indexeddb` database.
- **SC-004**: 100% of callback exceptions inside `withProjectLock` execute the callback exactly once without lock re-acquisition retries.
- **SC-005**: 100% of storage deletion transactions resolve strictly on or after `transaction.oncomplete`.
- **SC-006**: 100% pass rate across the full test suite (`npm run lint`, `npm test`, `npm run build`) with zero regressions.

## Assumptions

- When deleting a project, known chapter IDs are retrieved from `chapters` and `project.chapters` in `novel_translator_db`.
- Browser implementations of `indexedDB.deleteDatabase` trigger `onsuccess` even when the target database does not exist.
- Transient lock acquisition failures (such as `AbortError` or timeout) can be safely retried up to 3 times with exponential backoff.
