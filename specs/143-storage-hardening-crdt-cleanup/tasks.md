# Tasks: CRDT Storage Cleanup, Fail-Closed Chapter Safeguard, and Transaction Durability Hardening

**Feature**: `143-storage-hardening-crdt-cleanup`
**Date**: 2026-09-17
**Spec**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)

## Phase 1: Setup & Environment

**Purpose**: Verify repository health, compiler status, and baseline environment

- [X] T001 [P] Verify baseline type check and lint status via npm run lint

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core test utilities and simulation harnesses required for validating storage deletion and transaction durability

- [X] T002 [P] Establish test harness utilities for simulating y-indexeddb databases and IndexedDB transaction completion in src/services/__tests__/projectDeleteQueue.test.ts

**Checkpoint**: Foundation ready - User story implementation can now begin

---

## Phase 3: User Story 1 - Complete CRDT Persistence Eradication on Project Deletion (Priority: P1) 🌟 MVP

**Goal**: Completely purge all chapter-specific CRDT databases (`crdt_${projectId}_${chapterId}`) and prefixed lingering databases when `deleteProjectFromDB` is called, eliminating stale data resurrection and storage leaks.

**Independent Test**: Create project with chapters, populate simulated or real `crdt_${projectId}_${chapterId}` databases, invoke `deleteProjectFromDB(projectId)`, and verify that all chapter CRDT databases are deleted via `indexedDB.deleteDatabase`.

### Tests for User Story 1

- [X] T003 [P] [US1] Add unit tests for deleteProjectCrdtDatabases and complete eradication of crdt_${projectId}_* databases on project deletion in src/services/__tests__/projectDeleteQueue.test.ts

### Implementation for User Story 1

- [X] T004 [US1] Implement deleteProjectCrdtDatabases helper with indexedDB.deleteDatabase and database enumeration fallback in src/services/db.ts
- [X] T005 [US1] Integrate deleteProjectCrdtDatabases into executeDeleteProjectFromDB before records purge in src/services/db.ts

**Checkpoint**: User Story 1 complete - all CRDT databases are wiped on project delete; project re-creation or import starts with completely clean state.

---

## Phase 4: User Story 2 - Fail-Closed Orphan Guard for Chapters Lacking Project Association (Priority: P2)

**Goal**: Prevent unparented chapters from being written to storage when `projectId` cannot be determined, and ensure Google Drive sync workflows always inject valid `projectId`.

**Independent Test**: Call `saveChapterToDB` with an unparented chapter object (no `projectId` and no existing record); verify that the function aborts cleanly, logs a diagnostic warning, and writes 0 records to storage.

### Tests for User Story 2

- [X] T006 [P] [US2] Add unit tests verifying fail-closed behavior for unparented chapters without projectId in src/services/__tests__/projectDeleteQueue.test.ts

### Implementation for User Story 2

- [X] T007 [US2] Enforce fail-closed check in saveChapterToDB and abort save cleanly with diagnostic warning if effectiveProjectId is missing in src/services/db.ts
- [X] T008 [P] [US2] Inject parent projectId into downloaded chapter objects before saveChapterToDB in src/services/google-drive/driveGranularSync.ts
- [X] T009 [P] [US2] Ensure chaptersData has valid projectId before invoking saveChapterToDB in src/services/google-drive/driveProjectSync.ts

**Checkpoint**: User Story 2 complete - relational integrity is enforced at the database boundary and in cloud sync.

---

## Phase 5: User Story 3 - Strict Transaction Durability Before Lock and Queue Release (Priority: P2)

**Goal**: Ensure promises for database write operations only resolve upon `transaction.oncomplete` and reject upon `transaction.onerror` / `onabort`, ensuring disk durability before releasing write locks and queues.

**Independent Test**: Instrument IndexedDB transactions during chapter and CRDT state saves; verify that resolution happens strictly on or after `transaction.oncomplete` and transaction aborts reject the promise.

### Tests for User Story 3

- [X] T010 [P] [US3] Add unit tests verifying transaction.oncomplete resolution timing and error propagation for write operations in src/services/__tests__/projectDeleteQueue.test.ts

### Implementation for User Story 3

- [X] T011 [US3] Update executeSaveChapterToDB to resolve strictly on transaction.oncomplete and handle missing parent early exit in src/services/db.ts
- [X] T012 [US3] Update executeSaveChaptersToDB to resolve strictly on transaction.oncomplete instead of putRequest.onsuccess in src/services/db.ts
- [X] T013 [US3] Update executeSaveCrdtState, executeSaveCrdtStates, and executeDeleteCrdtStatesByProject to resolve strictly on transaction.oncomplete in src/services/db.ts

**Checkpoint**: User Story 3 complete - ACID disk durability is guaranteed before releasing write queues and locks.

---

## Phase 6: User Story 4 - Resilient Web Lock Acquisition with Retry (Priority: P2)

**Goal**: Wrap `withProjectLock` lock acquisition in `withRetry` with exponential backoff to handle transient lock acquisition rejections and align specification with implementation.

**Independent Test**: Mock `navigator.locks.request` to reject on initial attempts; verify that `withProjectLock` retries with backoff and succeeds once the lock is acquired.

### Tests for User Story 4

- [X] T014 [P] [US4] Add unit tests verifying Web Lock acquisition retries on transient rejection in src/services/__tests__/projectWriteLock.test.ts

### Implementation for User Story 4

- [X] T015 [US4] Wrap navigator.locks.request in withRetry within withProjectLock in src/services/db.ts

**Checkpoint**: User Story 4 complete - Web Lock acquisition is resilient against momentary contention.

---

## Phase 7: Polish & Cross-Cutting Verification

**Purpose**: End-to-end regression testing, verification, and code cleanliness

- [X] T016 Run full test suite vitest run to verify zero regressions across all 90+ test files
- [X] T017 Run npm run lint to verify type safety and zero compiler errors
- [X] T018 Run npm run build to verify production bundle generation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - executes first.
- **Foundational (Phase 2)**: Depends on Setup - provides test utilities for subsequent stories.
- **User Stories (Phase 3+)**:
  - **User Story 1 (P1)**: Independent MVP. Modifies `deleteProjectFromDB` and CRDT DB deletion.
  - **User Story 2 (P2)**: Independent. Hardens `saveChapterToDB` fail-closed guard and Drive sync.
  - **User Story 3 (P2)**: Independent. Standardizes `transaction.oncomplete` timing across write operations.
  - **User Story 4 (P2)**: Independent. Wraps `withProjectLock` in `withRetry`.
- **Polish (Phase 7)**: Depends on completion of all stories.

### Parallel Opportunities

- T003, T006, T010, T014 can be developed in parallel in their respective test suites.
- T008 and T009 can be executed in parallel with `db.ts` changes.
- Within each story, test tasks precede implementation tasks.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002)
3. Complete Phase 3: User Story 1 (T003 - T005)
4. Validate User Story 1: Verify all `crdt_*` databases are wiped on project delete.

### Incremental Delivery
1. Add User Story 2 (T006 - T009): Fail-closed chapter guard & Drive sync hardening.
2. Add User Story 3 (T010 - T013): Strict `transaction.oncomplete` durability.
3. Add User Story 4 (T014 - T015): Resilient Web Lock retry.
4. Execute Polish (T016 - T018): Full regression verification (`npm test`, `npm run lint`, `npm run build`).
