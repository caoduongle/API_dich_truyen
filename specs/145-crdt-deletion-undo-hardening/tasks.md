# Tasks: CRDT Deletion Error Propagation and Undo Integrity Hardening

**Branch**: `145-crdt-deletion-undo-hardening` | **Date**: 2026-09-17 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Phase 1: Setup & Interface Alignment

**Purpose**: Align interface definitions and test scaffolds before implementation

- [X] T001 Verify project readiness and clean test baseline via `npm test`
- [X] T002 [P] Inspect interface definitions in `specs/145-crdt-deletion-undo-hardening/contracts/crdtHardeningContracts.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core multi-instance registry data structures that underpin all lifecycle operations

**⚠️ CRITICAL**: Foundational registry support must be established before multi-instance cleanup and deletion hooks are updated.

- [X] T003 Upgrade `activePersistences` structure to `Map<string, Set<{ provider: CrdtPersistenceProvider; projectId?: string }>>` in `src/services/crdtPersistenceRegistry.ts`
- [X] T004 Implement multi-provider registration and unregistration logic in `src/services/crdtPersistenceRegistry.ts`
- [X] T005 Implement collision-proof project persistence destruction in `src/services/crdtPersistenceRegistry.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Fail-Closed Rejection on Incomplete Storage Cleanup (Priority: P1) 🎯 MVP

**Goal**: Ensure `deleteProjectFromDB` and `deleteChapterFromDB` reject if physical CRDT database deletion fails, eliminating false-positive success reporting.

**Independent Test**: Simulate `deleteDatabase` rejection or timeout; verify that `deleteProjectFromDB` and `deleteChapterFromDB` propagate the rejection.

### Tests for User Story 1
- [X] T006 [P] [US1] Add unit test in `src/services/__tests__/projectDeleteQueue.test.ts` verifying that `deleteProjectFromDB` rejects when `deleteDatabase` fails or times out
- [X] T007 [P] [US1] Add unit test in `src/services/__tests__/projectDeleteQueue.test.ts` verifying that `deleteChapterFromDB` rejects when `deleteDatabase` fails or times out

### Implementation for User Story 1
- [X] T008 [US1] Modify `executeDeleteProjectFromDB` in `src/services/db.ts` to await `deleteProjectCrdtDatabases` in `transaction.oncomplete` and reject on error
- [X] T009 [US1] Modify `deleteChapterFromDB` in `src/services/db.ts` to await `deleteChapterCrdtDatabase` and propagate errors directly without swallowing

**Checkpoint**: User Story 1 complete and independently testable. Deletion never reports false success on physical storage failure.

---

## Phase 4: User Story 2 - Complete Collaborative History Restoration on Deletion Undo (Priority: P2)

**Goal**: Hydrate the active editor `Y.Doc` from `crdt_states` snapshot upon opening a chapter, ensuring restored collaborative history is actively loaded and persisted to the dedicated local database.

**Independent Test**: Delete a project, trigger Undo, open a chapter in the editor, and verify that the Yjs document state reflects the snapshot and persists to IndexedDB.

### Tests for User Story 2
- [X] T010 [P] [US2] Add unit test in `src/hooks/__tests__/useChapterCRDT.test.ts` verifying `Y.Doc` hydration from stored `crdt_states` update upon open

### Implementation for User Story 2
- [X] T011 [US2] Implement asynchronous `getCrdtState` check and `Y.applyUpdate(doc, crdtRecord.update, 'restore-hydration')` during session initialization in `src/hooks/useChapterCRDT.ts`

**Checkpoint**: User Story 2 complete. Undo restores full collaborative editing lineage in the editor.

---

## Phase 5: User Story 3 - Fresh Snapshot Consistency for Deletion Undo (Priority: P2)

**Goal**: Ensure undo backup snapshots are taken after all in-flight and queued write operations have settled, preventing stale restores.

**Independent Test**: Queue rapid saves followed immediately by project deletion; verify that the backup snapshot captures the latest saved content.

### Tests for User Story 3
- [X] T012 [P] [US3] Add unit test in `src/hooks/__tests__/useProjects.test.ts` verifying `waitForQueueIdle` is awaited before taking undo snapshots

### Implementation for User Story 3
- [X] T013 [US3] Add `await waitForQueueIdle(id)` before reading chapter and CRDT backups in `handleDeleteProject` in `src/hooks/useProjects.ts`
- [X] T014 [US3] Add `await waitForQueueIdle(activeProjectId)` before reading chapter and CRDT backups in `handleDeleteChapterHistory` in `src/hooks/useProjects.ts`

**Checkpoint**: User Story 3 complete. Undo backup captures fresh state without race conditions.

---

## Phase 6: User Story 4 - Exhaustive Chapter Storage Discovery & Bulk Cleanup (Priority: P2)

**Goal**: Discover all chapter IDs across `project.chapters`, `chapters` store, and `crdt_states` store during project deletion, and complete the cleanup lifecycle for `deleteChaptersByProjectFromDB`.

**Independent Test**: Delete a project with a chapter present only in `project.chapters`; verify its dedicated CRDT database is purged. Call `deleteChaptersByProjectFromDB`; verify CRDT states and databases are purged.

### Tests for User Story 4
- [X] T015 [P] [US4] Add unit test in `src/services/__tests__/projectDeleteQueue.test.ts` verifying chapter IDs from `project.chapters` are purged
- [X] T016 [P] [US4] Add unit test in `src/services/__tests__/projectDeleteQueue.test.ts` verifying `deleteChaptersByProjectFromDB` purges CRDT states and databases

### Implementation for User Story 4
- [X] T017 [US4] Inspect `projectsStore.get(id)` to collect chapter IDs from `project.chapters` in `executeDeleteProjectFromDB` in `src/services/db.ts`
- [X] T018 [US4] Inspect `PROJECTS_STORE` to collect chapter IDs from `project.chapters` in `deleteProjectCrdtDatabases` in `src/services/db.ts`
- [X] T019 [US4] Update `executeDeleteChaptersByProjectFromDB` in `src/services/db.ts` to purge `CRDT_STATES_STORE` and delete dedicated databases upon commit

**Checkpoint**: User Story 4 complete. No dangling databases remain across partial hierarchies or bulk chapter deletes.

---

## Phase 7: User Story 5 - Relational Foreign-Key Ownership Integrity (Priority: P2)

**Goal**: Prevent cross-project data corruption by rejecting attempts to re-parent existing chapters or save CRDT states under mismatched projects.

**Independent Test**: Attempt to save an existing chapter with a conflicting `projectId`; attempt to save a CRDT state for a chapter belonging to another project; verify both abort cleanly.

### Tests for User Story 5
- [X] T020 [P] [US5] Add unit test in `src/services/__tests__/projectDeleteQueue.test.ts` verifying that re-parenting an existing chapter to another `projectId` is rejected
- [X] T021 [P] [US5] Add unit test in `src/services/__tests__/projectDeleteQueue.test.ts` verifying that saving CRDT state for a mismatched chapter-project pair is rejected

### Implementation for User Story 5
- [X] T022 [US5] Enforce foreign-key check in `executeSaveChapterToDB` in `src/services/db.ts` (abort if `existing.projectId !== incoming.projectId`)
- [X] T023 [US5] Enforce foreign-key check in `executeSaveCrdtState` in `src/services/db.ts` (abort if chapter does not belong to `record.projectId`)

**Checkpoint**: User Story 5 complete. Relational ownership boundaries are strictly protected.

---

## Phase 8: User Story 6 - Collision-Safe Persistence Management & Multi-Instance Cleanup (Priority: P2)

**Goal**: Ensure active persistence registry handles multiple provider instances per document cleanly and isolates project-scoped provider destruction without substring prefix collisions.

**Independent Test**: Register multiple providers for a database and destroy; verify all are closed. Register providers for `proj_100` and `proj_100_200`; destroy `proj_100`; verify `proj_100_200` remains active.

### Tests for User Story 6
- [X] T024 [P] [US6] Add unit test in `src/services/__tests__/projectDeleteQueue.test.ts` verifying that all registered provider instances for a database are destroyed
- [X] T025 [P] [US6] Add unit test in `src/services/__tests__/projectDeleteQueue.test.ts` verifying that destroying providers for `proj_100` does not affect `proj_100_200`

### Implementation for User Story 6
- [X] T026 [US6] Pass `projectId` when registering persistence provider in `src/hooks/useChapterCRDT.ts`
- [X] T027 [US6] Implement exact-token or metadata-based provider scoping in `destroyAllCrdtPersistencesForProject` in `src/services/crdtPersistenceRegistry.ts`

**Checkpoint**: User Story 6 complete. Multiple provider lifecycles and project identifiers with overlapping prefixes are safely isolated.

---

## Phase 9: Polish & Verification

**Purpose**: End-to-end quality validation across the entire codebase

- [X] T028 Run full lint check via `npm run lint` (`tsc --noEmit`)
- [X] T029 Run full unit test suite via `npm test` (`vitest run`)
- [X] T030 Run production build via `npm run build` (`tsc && vite build`)
- [X] T031 Validate scenarios against `specs/145-crdt-deletion-undo-hardening/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1; blocks User Story implementation.
- **User Stories (Phases 3 to 8)**: Depend on Phase 2 completion. Can proceed sequentially in priority order (P1 → P2) or in parallel where independent files allow.
- **Polish (Phase 9)**: Depends on completion of all User Stories.

### Parallel Opportunities
- In Phase 3: Tests T006 and T007 can be authored concurrently.
- In Phase 4: Test T010 can be authored concurrently with other tests.
- In Phase 5: Test T012 can be authored concurrently with other tests.
- In Phase 6: Tests T015 and T016 can run in parallel.
- In Phase 7: Tests T020 and T021 can run in parallel.
- In Phase 8: Tests T024 and T025 can run in parallel.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1 & Phase 2.
2. Complete Phase 3 (User Story 1: Propagate deletion errors fail-closed).
3. Validate User Story 1 tests pass cleanly.

### Incremental Delivery
1. Add User Story 2 (Editor CRDT hydration upon Undo).
2. Add User Story 3 (Serialized undo backup snapshot).
3. Add User Story 4 (Exhaustive chapter discovery & bulk delete CRDT lifecycle).
4. Add User Story 5 (Relational foreign-key ownership integrity).
5. Add User Story 6 (Multi-instance persistence registry & prefix isolation).
6. Run Phase 9 quality verification (`npm run lint`, `npm test`, `npm run build`).
