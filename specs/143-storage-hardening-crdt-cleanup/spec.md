# Feature Specification: CRDT Storage Cleanup, Fail-Closed Chapter Safeguard, and Transaction Durability Hardening

**Feature Branch**: `143-storage-hardening-crdt-cleanup`

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: "Tôi đã rà lại main mới nhất, không dùng snapshot cũ. HEAD hiện tại là: 9b66bd63f49d7b84537c77b0235a9956a03176bf — feat: implement project write boundary serialization with Web Locks and Gemini error isolation. CI của commit này cũng đã chạy thành công đầy đủ: security audit, secret scan, type check, build và toàn bộ test suite đều pass. Kết luận lần này: Các lỗi lớn tôi phát hiện ở vòng trước đã được sửa đúng hướng. Tuy nhiên, sau khi đi sâu hơn vào các đường lưu thực tế, tôi vẫn còn 1 lỗi đáng kể và 3 vấn đề cần xử lý: P1 - Xóa project vẫn chưa xóa toàn bộ CRDT data của y-indexeddb; P2 - Fail-closed với chapter thiếu projectId thay vì fallback ghi thẳng; P2 - Đảm bảo transaction IDB đã complete trước khi release queue / lock; P2 - Đồng bộ spec và code ở withRetry cho Web Lock."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete CRDT Persistence Eradication on Project Deletion (Priority: P1)

When a user deletes a project from the application, all associated real-time collaborative CRDT persistence stores and cached chapter session databases must be completely purged from browser storage alongside the primary database records. This guarantees that if a project with the same identifier is subsequently created or imported, no stale CRDT state or deleted draft content is resurrected, and no dead storage space leaks over time.

**Why this priority**: Critical bug (P1) where project deletion cleans the primary database stores (`projects`, `chapters`, `crdt_states`) but leaves separate chapter-specific CRDT databases (`crdt_${projectId}_${chapterId}`) intact on disk. This results in silent local storage leakage and unexpected data resurrection/corruption upon re-creating or re-importing the project.

**Independent Test**: Create a project with multiple chapters, initialize chapter CRDT sessions, invoke project deletion, and independently verify that all chapter-specific CRDT persistence databases are completely deleted from the browser storage subsystem.

**Acceptance Scenarios**:

1. **Given** an existing project with chapters that have cached or active CRDT persistence databases, **When** the user deletes the project, **Then** all chapter-specific CRDT persistence databases matching the project are removed and no stale state can be hydrated if a project with the same ID is recreated.
2. **Given** an environment supporting storage enumeration, **When** a project deletion is requested, **Then** all lingering CRDT databases matching the project identifier prefix are discovered and purged.

---

### User Story 2 - Fail-Closed Orphan Guard for Chapters Lacking Project Association (Priority: P2)

When an operation attempts to save a chapter that does not have an identifiable parent project, the system must fail-closed by safely aborting the write and logging a diagnostic warning, rather than silently writing an unparented chapter into storage. Furthermore, all cloud synchronization and import workflows must explicitly inject and validate the parent project identifier before saving chapters locally.

**Why this priority**: Prevents orphaned, unparented chapter records from polluting the local database when receiving partial or malformed remote sync payloads, enforcing relational integrity.

**Independent Test**: Attempt to save a new chapter object that lacks a `projectId` (and has no pre-existing record to look up); verify that the write operation aborts cleanly without writing any orphan records to storage, and verify that cloud sync importers always inject valid project identifiers.

**Acceptance Scenarios**:

1. **Given** a new chapter payload with no `projectId` and no existing record in the database, **When** `saveChapterToDB` is called, **Then** the operation aborts cleanly without persisting the record and logs a clear diagnostic warning.
2. **Given** a chapter payload with missing `projectId` but matching an existing chapter in the database, **When** `saveChapterToDB` is called, **Then** the existing record's project identifier is resolved and the chapter is safely updated under its parent project.
3. **Given** remote chapter data downloaded from cloud storage during sync or import, **When** the chapter is processed for local storage, **Then** the parent project identifier is validated and attached to the chapter payload before saving.

---

### User Story 3 - Strict Transaction Durability Before Lock and Queue Release (Priority: P2)

When saving or updating chapters and CRDT states, the asynchronous operation must only resolve its completion promise once the underlying storage transaction has committed completely to disk (`transaction.oncomplete`). This ensures that multi-tab locks and sequential write queues are never released prematurely while a transaction is still in-flight.

**Why this priority**: Resolving a write operation prematurely upon request dispatch (`putRequest.onsuccess`) allows subsequent queue tasks or lock holders to execute before data is durable on disk, causing race conditions where subsequent reads or deletions encounter incomplete or uncommitted snapshots.

**Independent Test**: Monitor transaction lifecycle events during chapter and CRDT state write operations; verify that the promise resolves strictly on or after `transaction.oncomplete` and rejects immediately upon transaction error or abort.

**Acceptance Scenarios**:

1. **Given** a chapter or CRDT state save operation, **When** the underlying storage put requests succeed, **Then** the returned promise remains pending until the transaction commits (`transaction.oncomplete`).
2. **Given** a storage transaction that encounters an error or abort event during a write operation, **When** the failure occurs, **Then** the returned promise rejects with the transaction error and cleans up the serialization queue.
3. **Given** a write operation where the parent project does not exist, **When** the parent existence check detects a missing project, **Then** the operation resolves cleanly without writing to disk.

---

### User Story 4 - Resilient Web Lock Acquisition with Retry (Priority: P2)

When acquiring a multi-tab project write lock, transient lock acquisition rejections (such as lock timeouts or transient context interruptions) must be automatically retried with exponential backoff, ensuring resilience under high concurrency and aligning the lock specification with the retry architecture.

**Why this priority**: Prevents transient lock acquisition rejections under high-load multi-tab scenarios from bypassing retry mechanisms and surfacing unhandled errors to the caller.

**Independent Test**: Simulate transient lock acquisition rejections; verify that lock acquisition is retried with backoff and successfully proceeds once the lock is acquired.

**Acceptance Scenarios**:

1. **Given** a project write operation competing for a multi-tab lock, **When** the initial lock request encounters a transient failure, **Then** the lock acquisition is retried with exponential backoff before failing.
2. **Given** a browser or test environment where the Web Locks API is unavailable, **When** a project write operation is executed, **Then** the system gracefully falls back to local in-memory queue serialization without error.

---

### Edge Cases

- What happens if a chapter's CRDT database is currently held open by an active tab when project deletion is invoked? The deletion helper closes and clears the database provider connection and invokes database deletion.
- What happens if a project has zero chapters or its CRDT databases were never opened? The deletion routine proceeds gracefully without errors.
- What happens if a batch chapter save (`saveChaptersToDB`) contains an empty array? The operation completes immediately without creating an unnecessary transaction.
- What happens if the browser environment does not support `indexedDB.databases()`? The system falls back to querying known chapter IDs from the primary database before removing the project.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST discover and delete all chapter-specific CRDT persistence databases (`crdt_${projectId}_${chapterId}`) whenever a project is deleted from local storage.
- **FR-002**: The system MUST query and purge all lingering CRDT persistence databases matching the project identifier prefix if browser database enumeration (`indexedDB.databases`) is supported.
- **FR-003**: The system MUST fail-closed by aborting chapter writes when neither the incoming payload nor existing database records specify a valid parent project identifier.
- **FR-004**: Cloud synchronization and import services MUST ensure that all chapter payloads contain a valid `projectId` before calling local chapter storage functions.
- **FR-005**: Storage modification operations (`saveChapterToDB`, `saveChaptersToDB`, `saveCrdtState`, `saveCrdtStates`, `deleteCrdtStatesByProject`) MUST resolve their completion promise only after the database transaction successfully commits (`transaction.oncomplete`), except when an early clean exit is required due to a missing parent project.
- **FR-006**: Storage modification operations MUST reject their completion promise if the database transaction emits an `onerror` or `onabort` event.
- **FR-007**: Web Lock acquisition for project write serialization MUST be protected by retry mechanics with exponential backoff to handle transient lock acquisition failures.

### Key Entities

- **StoryProject**: Root entity representing a translation project, holding metadata, chapters list, and cloud synchronization references.
- **Chapter**: Individual story chapter containing source text, translation lines, status, and associated parent `projectId`.
- **Chapter CRDT Persistence Database**: Dedicated client-side IndexedDB database instance per chapter session (`crdt_${projectId}_${chapterId}`) managing real-time collaborative state and offline Yjs document updates.
- **Project Write Queue**: In-memory and cross-tab serialization mechanism ensuring mutually exclusive writes and deletes for a given project identifier.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of chapter-level CRDT persistence databases associated with a deleted project are completely deleted upon project deletion.
- **SC-002**: 0 orphaned chapter records lacking a parent project identifier are persisted into the local database during invalid writes or sync operations.
- **SC-003**: In 100% of monitored write operations, the caller's completion promise resolves strictly on or after disk transaction completion (`transaction.oncomplete`).
- **SC-004**: Transient Web Lock acquisition failures are retried up to 3 times before rejecting, ensuring 0 premature aborts from momentary contention.
- **SC-005**: 100% pass rate across the full test suite (`npm run lint`, `npm test`, `npm run build`) with zero regressions.

## Assumptions

- Environments without `navigator.locks` (such as Node.js or Vitest headless test environments) gracefully fall back to local queue serialization.
- Environments without `indexedDB.databases()` (such as certain mobile browsers or synthetic test polyfills) correctly purge all CRDT databases using the chapter IDs retrieved from the project index prior to project removal.
- Existing valid chapters in the database retain their `projectId` and allow recovery if an incoming partial update omits the `projectId`.
