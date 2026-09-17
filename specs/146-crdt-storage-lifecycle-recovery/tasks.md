# Tasks: CRDT Storage Lifecycle Recovery and Invariant Hardening

**Feature Branch**: `146-crdt-storage-lifecycle-recovery`  
**Specification**: [spec.md](./spec.md) | **Implementation Plan**: [plan.md](./plan.md)

---

## Phase 1: Setup (Baseline & Contract Verification)

**Purpose**: Verify baseline code health and contract consistency before making storage changes

- [x] T001 Run baseline verification via `npm test` to ensure clean starting state
- [x] T002 [P] Verify TypeScript interface contract definitions in `specs/146-crdt-storage-lifecycle-recovery/contracts/crdtStorageLifecycleContracts.ts`

---

## Phase 2: Foundational (Schema Upgrade & Project Queue Exclusive Section)

**Purpose**: Core infrastructure prerequisites that block all user stories

- [x] T003 Bump `STORAGE_CONFIG.DB_VERSION` from 4 to 5 in `src/config/constants.ts`
- [x] T004 [P] Export `DELETION_MANIFESTS_STORE` and implement v5 schema upgrade in `src/services/dbMigration.ts`
- [x] T005 [P] Implement `runInProjectExclusiveSection` in `src/services/projectStorageQueue.ts`

**Checkpoint**: Storage schema upgrade v5 and project exclusive runner ready.

---

## Phase 3: User Story 1 - Resilient Physical Storage Cleanup via Durable Deletion Manifest (Priority: P1) 🎯 MVP

**Goal**: Prevent permanently orphaned physical databases when physical deletion fails or is interrupted by persisting a deletion manifest prior to catalog deletion and executing recovery on startup.

**Independent Test**: Simulate an interrupted/failed physical database deletion during project deletion. Verify manifest persists in `deletion_manifests`. Call `recoverPendingDeletions()` and verify all physical databases are purged and manifest is removed.

### Tests for User Story 1
- [x] T006 [P] [US1] Add unit tests in `src/services/__tests__/projectDeleteQueue.test.ts` verifying that `recoverPendingDeletions` detects pending manifests, purges physical databases, and removes completed manifests
- [x] T007 [P] [US1] Add unit tests in `src/services/__tests__/projectDeleteQueue.test.ts` verifying that deletion manifests are recorded before catalog commits and removed on successful physical deletion

### Implementation for User Story 1
- [x] T008 [US1] Implement `recordDeletionManifest`, `removeDeletionManifest`, and `recoverPendingDeletions` in `src/services/db.ts`
- [x] T009 [US1] Update `executeDeleteProjectFromDB` and `executeDeleteChaptersByProjectFromDB` in `src/services/db.ts` to record a pending manifest before catalog transaction commit and remove it upon physical deletion completion
- [x] T010 [US1] Integrate `recoverPendingDeletions()` call into `initDB()` in `src/services/db.ts` to automatically resume physical cleanup upon application bootstrap

**Checkpoint**: User Story 1 complete. Physical storage cleanup is crash-resilient and recoverable across app restarts.

---

## Phase 4: User Story 2 - Strict Fail-Closed Invariant Enforcement on Entity Ownership (Priority: P1)

**Goal**: Convert silent write drops (`console.warn; return`) into active transaction aborts and Promise rejections (`reject(new Error(...))`). Reject `saveCrdtState` if referenced chapter does not exist (`!chapter`).

**Independent Test**: Attempt to save an existing chapter with a conflicting `projectId`, attempt to save CRDT state for a missing chapter, or attempt to save CRDT state under a conflicting project; verify in all cases that the promise rejects and the transaction aborts.

### Tests for User Story 2
- [x] T011 [P] [US2] Add unit tests in `src/services/__tests__/projectDeleteQueue.test.ts` asserting that `saveChapterToDB` and `saveChaptersToDB` reject with an Error on `existing.projectId !== incomingProjectId`
- [x] T012 [P] [US2] Add unit tests in `src/services/__tests__/projectDeleteQueue.test.ts` asserting that `saveCrdtState` and `saveCrdtStates` reject with an Error when target chapter does not exist in store (`!chapter`)
- [x] T013 [P] [US2] Add unit tests in `src/services/__tests__/projectDeleteQueue.test.ts` asserting that `saveCrdtState` and `saveCrdtStates` reject with an Error on `chapter.projectId !== record.projectId`

### Implementation for User Story 2
- [x] T014 [US2] Enforce active rejection (`transaction.abort()` and `reject(new Error(...))`) for chapter re-parenting in `executeSaveChapterToDB` and `executeSaveChaptersToDB` in `src/services/db.ts`
- [x] T015 [US2] Enforce active rejection (`transaction.abort()` and `reject(new Error(...))`) for missing chapters (`!chapter`) and project mismatches in `executeSaveCrdtState` and `executeSaveCrdtStates` in `src/services/db.ts`

**Checkpoint**: User Story 2 complete. Zero silent write drops; relational ownership boundaries strictly fail closed.

---

## Phase 5: User Story 3 - Unified Critical Section for Deletion Snapshot and Removal (Priority: P2)

**Goal**: Eliminate the race condition between autosave writes and undo backup snapshots by wrapping snapshot capture and deletion inside an exclusive critical section.

**Independent Test**: Initiate deletion while active background writes are enqueued; verify that snapshot capture and deletion execute within `runInProjectExclusiveSection` without allowing intervening writes.

### Tests for User Story 3
- [x] T016 [P] [US3] Add unit tests in `src/hooks/__tests__/useProjects.test.ts` verifying that `handleDeleteProject` and `handleDeleteChapterHistory` execute snapshot capture and deletion atomically inside `runInProjectExclusiveSection`

### Implementation for User Story 3
- [x] T017 [US3] Wrap undo backup capture and deletion execution inside `runInProjectExclusiveSection` in `handleDeleteProject` in `src/hooks/useProjects.ts`
- [x] T018 [US3] Wrap chapter snapshot read and deletion inside `runInProjectExclusiveSection` in `handleDeleteChapterHistory` in `src/hooks/useProjects.ts`

**Checkpoint**: User Story 3 complete. Undo backup snapshot and deletion are atomically synchronized.

---

## Phase 6: User Story 4 - Canonical Project Identity Verification in Chapter Operations (Priority: P2)

**Goal**: Enforce canonical parent project identity from storage in `deleteChapterFromDB` and assert `crdtRecord.projectId === projectId` during editor hydration.

**Independent Test**: Call `deleteChapterFromDB` with a conflicting `projectId` parameter and verify rejection; verify `useChapterCRDT` aborts hydration if stored `crdtRecord.projectId` conflicts with active session.

### Tests for User Story 4
- [x] T019 [P] [US4] Add unit tests in `src/services/__tests__/projectDeleteQueue.test.ts` verifying that `deleteChapterFromDB` rejects on conflicting `projectId` and resolves canonical ID when omitted
- [x] T020 [P] [US4] Add unit tests in `src/hooks/__tests__/useChapterCRDTHydration.test.ts` verifying that editor hydration aborts if `crdtRecord.projectId !== projectId`

### Implementation for User Story 4
- [x] T021 [US4] Update `deleteChapterFromDB` in `src/services/db.ts` to inspect stored chapter, reject on supplied `projectId !== stored.projectId`, and resolve canonical ID for queuing and cleanup
- [x] T022 [US4] Add project identity assertion in `useChapterCRDT.ts` during `getCrdtState` hydration to abort update application if `crdtRecord.projectId !== projectId`

**Checkpoint**: User Story 4 complete. Canonical project identities are strictly verified.

---

## Phase 7: User Story 5 - Fail-Closed Discovery & Safe Persistence Release (Priority: P2)

**Goal**: Ensure physical storage target discovery fails closed on error, and persistence providers are retained in registry if closure fails.

**Independent Test**: Simulate discovery error during `deleteProjectCrdtDatabases` (verify rejection); simulate provider `.destroy()` failure (verify provider retained in registry and error propagated).

### Tests for User Story 5
- [x] T023 [P] [US5] Add unit tests in `src/services/__tests__/projectDeleteQueue.test.ts` verifying that `deleteProjectCrdtDatabases` rejects if chapter ID discovery encounters an error
- [x] T024 [P] [US5] Add unit tests in `src/services/__tests__/projectDeleteQueue.test.ts` verifying that `destroyCrdtPersistence` retains provider references in the registry if `.destroy()` throws

### Implementation for User Story 5
- [x] T025 [US5] Remove error swallowing around chapter ID discovery in `deleteProjectCrdtDatabases` in `src/services/db.ts` to propagate errors fail-closed
- [x] T026 [US5] Update `destroyCrdtPersistence` in `src/services/crdtPersistenceRegistry.ts` to await provider closure before removing registry entries and propagate errors safely

**Checkpoint**: User Story 5 complete. No partial cleanup on discovery error; failed provider closures are retained for retry.

---

## Phase 8: Polish & Verification

**Purpose**: Full quality validation across the entire test suite and build

- [x] T027 Run full lint check via `npm run lint` (`tsc --noEmit`)
- [x] T028 Run full unit test suite via `npm test` (`vitest run`)
- [x] T029 Run production build via `npm run build` (`tsc && vite build`)
- [x] T030 Validate scenarios against `specs/146-crdt-storage-lifecycle-recovery/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: No dependencies - starts immediately.
- **Foundational (Phase 2)**: Depends on Phase 1; blocks all User Stories.
- **User Stories (Phases 3 to 7)**: Depend on Phase 2. Can proceed sequentially in priority order (US1 → US2 → US3 → US4 → US5).
- **Polish (Phase 8)**: Depends on completion of all User Stories.

### Parallel Opportunities
- In Phase 3: Tests T006 and T007 can run in parallel.
- In Phase 4: Tests T011, T012, and T013 can run in parallel.
- In Phase 5: Test T016 can be authored alongside Phase 4.
- In Phase 6: Tests T019 and T020 can run in parallel.
- In Phase 7: Tests T023 and T024 can run in parallel.
