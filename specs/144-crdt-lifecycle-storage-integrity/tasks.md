# Tasks: CRDT Lifecycle, Storage Integrity, and Lock Isolation Hardening

**Feature**: `144-crdt-lifecycle-storage-integrity`  
**Input**: Design documents from `specs/144-crdt-lifecycle-storage-integrity/` (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`)

---

## Phase 1: Setup & Foundations

**Purpose**: Establish active persistence registry and foundational contracts before user story implementations.

- [x] T001 Create active in-memory CRDT persistence registry in `src/services/crdtPersistenceRegistry.ts`
- [x] T002 Wire `useChapterCRDT.ts` to register on provider creation and unregister on cleanup in `src/hooks/useChapterCRDT.ts`
- [x] T003 Export CRDT query helper `getCrdtStatesByProject` in `src/services/db.ts`

---

## Phase 2: User Story 1 - Reliable CRDT Database Deletion Without Blocked/Error False Positives (Priority: P1) 🎯 MVP

**Goal**: Ensure `deleteProjectCrdtDatabases` resolves strictly upon `onsuccess`, rejects on `onerror` or timeout, handles `onblocked` with a 5000ms safety timeout, and destroys active connections beforehand.

**Independent Test**: Simulate an open DB connection / `onblocked` event during `deleteProjectCrdtDatabases`; verify that it does not resolve prematurely and completes cleanly when connections close.

### Tests for User Story 1
- [x] T004 [P] [US1] Unit test for reliable `onsuccess` / `onblocked` / `onerror` handling in `src/services/__tests__/projectDeleteQueue.test.ts`

### Implementation for User Story 1
- [x] T005 [US1] Update `deleteProjectCrdtDatabases` in `src/services/db.ts` to destroy active persistences via `destroyAllCrdtPersistencesForProject` before deleting
- [x] T006 [US1] Rewrite IndexedDB deletion request wrapper in `src/services/db.ts` to only resolve on `onsuccess`, reject on `onerror`, and wait for `onsuccess` on `onblocked` with bounded 5000ms timeout

**Checkpoint**: User Story 1 complete — DB deletion cannot report false positives while connections are blocked.

---

## Phase 3: User Story 2 - Exact CRDT Database Targeting Without Prefix Collisions (Priority: P1)

**Goal**: Eliminate naive `startsWith("crdt_" + projectId + "_")` sweep; target only exact derived database names (`crdt_${projectId}_${chapterId}`) from known chapters in stores.

**Independent Test**: Setup Project A (`proj_100`) and Project B (`proj_100_200`) each with CRDT databases; delete Project A and assert Project B's CRDT database remains intact.

### Tests for User Story 2
- [x] T007 [P] [US2] Unit test verifying prefix safety (`proj_100` vs `proj_100_200`) during CRDT database cleanup in `src/services/__tests__/projectDeleteQueue.test.ts`

### Implementation for User Story 2
- [x] T008 [US2] Remove `startsWith` prefix sweep from `deleteProjectCrdtDatabases` in `src/services/db.ts`
- [x] T009 [US2] Ensure known chapter IDs are collected comprehensively from `chapters`, `project.chapters`, and `crdt_states` to compute exact DB names in `src/services/db.ts`

**Checkpoint**: User Story 2 complete — cross-project prefix collisions are completely prevented.

---

## Phase 4: User Story 3 - Complete CRDT Cleanup on Single Chapter Deletion (Priority: P2)

**Goal**: Atomically clean up `CHAPTERS_STORE`, `CRDT_STATES_STORE`, and delete the dedicated `crdt_${projectId}_${chapterId}` database when deleting a single chapter.

**Independent Test**: Create a chapter with records in `chapters`, `crdt_states`, and a dedicated database; call `deleteChapterFromDB` and assert all three are deleted.

### Tests for User Story 3
- [x] T010 [P] [US3] Unit test for single chapter deletion cleaning both stores and dedicated CRDT DB in `src/services/__tests__/projectDeleteQueue.test.ts`

### Implementation for User Story 3
- [x] T011 [US3] Add `deleteChapterCrdtDatabase(projectId, chapterId)` helper in `src/services/db.ts` to destroy active persistence and delete the chapter's DB
- [x] T012 [US3] Refactor `deleteChapterFromDB` in `src/services/db.ts` to delete from both `CHAPTERS_STORE` and `CRDT_STATES_STORE` in an atomic transaction resolving on `transaction.oncomplete`, serialized with `enqueueProjectWrite`, and purge the CRDT database

**Checkpoint**: User Story 3 complete — single chapter deletion leaves 0 orphaned records or databases.

---

## Phase 5: User Story 4 - Strict Fail-Closed Semantics for CRDT State Persistence (Priority: P2)

**Goal**: Ensure `saveCrdtState` and `saveCrdtStates` reject/omit records lacking `projectId` and never persist unassigned CRDT data.

**Independent Test**: Call `saveCrdtState` with an unparented record; assert nothing is written to `CRDT_STATES_STORE` and a diagnostic warning is logged.

### Tests for User Story 4
- [x] T013 [P] [US4] Unit test verifying fail-closed rejection for unparented CRDT states in `src/services/__tests__/projectDeleteQueue.test.ts`

### Implementation for User Story 4
- [x] T014 [US4] Update `saveCrdtState` in `src/services/db.ts` to log a warning and abort if `!record.projectId`
- [x] T015 [US4] Update `saveCrdtStates` in `src/services/db.ts` to omit unassigned records and avoid persisting orphaned items

**Checkpoint**: User Story 4 complete — orphan CRDT state persistence is impossible.

---

## Phase 6: User Story 5 - Project Boundary Validation in Atomic Bundle Saves (Priority: P2)

**Goal**: Reject any `atomicSaveProjectBundle` payload where any CRDT item specifies a differing `projectId` from `project.id`.

**Independent Test**: Call `atomicSaveProjectBundle` with a mismatched CRDT item `projectId`; assert immediate rejection with descriptive error and 0 writes committed.

### Tests for User Story 5
- [x] T016 [P] [US5] Unit test verifying cross-project boundary validation in `atomicSaveProjectBundle` in `src/services/__tests__/projectDeleteQueue.test.ts`

### Implementation for User Story 5
- [x] T017 [US5] Add strict `projectId` mismatch check in `atomicSaveProjectBundle` in `src/services/db.ts` before transaction creation

**Checkpoint**: User Story 5 complete — atomic bundle saves strictly reject mismatched foreign project items.

---

## Phase 7: User Story 6 - Isolated Lock Acquisition Retry in Web Locks (Priority: P2)

**Goal**: Wrap callback in `withProjectLock` using `LockOutcome<T>` so application exceptions are never retried by `withRetry`.

**Independent Test**: Pass a failing callback to `withProjectLock`; assert callback runs exactly once, error is thrown, and no retry attempts occur.

### Tests for User Story 6
- [x] T018 [P] [US6] Unit test verifying single execution of failing callbacks in `src/services/__tests__/projectWriteLock.test.ts`

### Implementation for User Story 6
- [x] T019 [US6] Refactor `withProjectLock` in `src/services/db.ts` to use outcome pattern `{ ok: true, value } | { ok: false, error }`

**Checkpoint**: User Story 6 complete — Web Lock retry is strictly isolated to lock acquisition.

---

## Phase 8: User Story 7 - Complete Durability for Delete Transactions & Undo Integrity (Priority: P2)

**Goal**: Ensure `deleteChaptersByProjectFromDB` resolves on `transaction.oncomplete` and `useProjects.ts` backs up and restores CRDT states on project and chapter deletion Undo.

**Independent Test**: Delete a project, trigger Undo, and assert `crdt_states` are restored into `novel_translator_db`.

### Tests for User Story 7
- [x] T020 [P] [US7] Integration test for project & chapter delete undo with CRDT state restoration in `src/hooks/__tests__/useProjects.test.ts`

### Implementation for User Story 7
- [x] T021 [US7] Update `deleteChaptersByProjectFromDB` in `src/services/db.ts` to resolve strictly on `transaction.oncomplete`
- [x] T022 [US7] Update `handleDeleteProject` in `src/hooks/useProjects.ts` to back up `crdt_states` and restore them on Undo
- [x] T023 [US7] Update `handleDeleteChapter` in `src/hooks/useProjects.ts` to back up `crdt_state` and restore it on Undo

**Checkpoint**: User Story 7 complete — ACID durability for all delete transactions and complete undo fidelity.

---

## Phase 9: Polish, Quality Gates & Verification

**Purpose**: Verify all quality gates across the repository.

- [x] T024 Run `npm run lint` (`tsc --noEmit`) to verify 0 type errors
- [x] T025 Run `npm test` (`vitest run`) to verify 100% passing tests across all test suites (778 tests across 90 files)
- [x] T026 Run `npm run build` (`tsc && vite build`) to verify clean production build
