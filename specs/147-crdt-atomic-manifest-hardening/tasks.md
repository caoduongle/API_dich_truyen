# Tasks: CRDT Atomic Deletion Manifest & Storage Integrity Hardening

**Feature**: `147-crdt-atomic-manifest-hardening`
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Research**: [research.md](research.md)
**Date**: 2026-09-18

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Extract reusable validation utility and prepare the foundational guard used by all user stories.

- [x] T001 [P] Create `assertChapterOwnership()` utility function in `src/services/db.ts` — a canonical chapter ownership validator that throws `Relational integrity violation` when an existing chapter's `projectId` differs from the incoming `incomingProjectId`. Signature: `export function assertChapterOwnership(existing: Chapter | undefined, incomingProjectId: string, chapterId: string): void`. Place immediately after the `DeletionManifestRecord` interface block (~line 34).
- [x] T002 [P] Refactor existing inline FK check in `executeSaveChapterToDB()` in `src/services/db.ts` (~line 1146) to delegate to the new `assertChapterOwnership()`, preserving identical error message and `transaction.abort()` + `reject()` behavior. Verify no functional change via existing test `refuses to re-parent an existing chapter to another projectId in saveChapterToDB (T020)`.
- [x] T003 [P] Refactor existing inline FK check in `executeSaveChaptersToDB()` in `src/services/db.ts` (~line 1239) to delegate to the new `assertChapterOwnership()`, preserving identical behavior. Verify via existing test `refuses to re-parent an existing chapter to another projectId in batch saveChaptersToDB (T020, T011)`.

**Checkpoint**: `assertChapterOwnership` extracted and proven backward-compatible with all existing FK tests.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Remove the standalone `recordDeletionManifest()` call from deletion flows, preparing them for in-transaction manifest writes.

> [!IMPORTANT]
> No user story work can begin until this phase is complete. The removal of the standalone `await recordDeletionManifest(manifest)` call BEFORE the catalog transaction is the foundation for atomic manifest placement inside the transaction.

- [x] T004 Identify and document all call sites of `recordDeletionManifest()` outside of an atomic catalog transaction in `src/services/db.ts`: `executeDeleteProjectFromDB` (~line 915) and `executeDeleteChaptersByProjectFromDB` (~line 1428). These will be inlined into the atomic transactions in US1.

**Checkpoint**: Foundation ready — standalone manifest writes identified, user story implementation can now begin.

---

## Phase 3: User Story 1 — Atomic Manifest and Catalog Deletion (Priority: P1) 🎯 MVP

**Goal**: Merge deletion manifest `put()` and catalog `delete()` operations into the same IDB transaction for project deletion and bulk chapter deletion, ensuring zero risk of manifest-exists-but-catalog-alive on crash.

**Independent Test**: Verify that when the catalog transaction aborts/fails, no manifest exists in `deletion_manifests`; when the transaction commits successfully and then crashes before physical cleanup, `recoverPendingDeletions()` correctly finishes the work.

### Implementation for User Story 1

- [x] T005 [US1] Refactor `executeDeleteProjectFromDB()` in `src/services/db.ts` (~lines 898–1036): add `DELETION_MANIFESTS_STORE` to the `storesToLock` array, move the manifest `put()` inside the single IDB transaction (alongside project/chapter/crdt_states deletions), remove the standalone `await recordDeletionManifest(manifest)` call before the transaction. Build the final `chapterIds` and `physicalDbNames` list from all discovery sources inside the transaction and write the manifest with the complete list before transaction commits.
- [x] T006 [US1] Refactor `executeDeleteChaptersByProjectFromDB()` in `src/services/db.ts` (~lines 1411–1530): add `DELETION_MANIFESTS_STORE` to the `storesToLock` array, move the manifest `put()` inside the single IDB transaction, remove the standalone `await recordDeletionManifest(manifest)` call. Collect final `deletedChapterIds` from cursors inside the transaction and record manifest with the complete discovery list.
- [x] T007 [US1] Add test in `src/services/__tests__/projectDeleteQueue.test.ts`: verify that when the catalog transaction for `deleteProjectFromDB` aborts (simulate via mock), zero manifests exist in `deletion_manifests` store and all project/chapter/crdt data remains intact.
- [x] T008 [US1] Add test in `src/services/__tests__/projectDeleteQueue.test.ts`: verify that a successful `deleteProjectFromDB` creates a manifest atomically with catalog deletion, and after physical cleanup completes, the manifest is removed.
- [x] T009 [US1] Add test in `src/services/__tests__/projectDeleteQueue.test.ts`: verify that `deleteChaptersByProjectFromDB` also writes the manifest inside the transaction atomically.
- [x] T010 [US1] Run `npm run lint && npm test && npm run build` — all must pass cleanly.

**Checkpoint**: Project and bulk chapter deletion now use atomic manifest + catalog transactions. If transaction aborts, neither manifest nor catalog changes persist.

---

## Phase 4: User Story 2 — Durable Deletion Manifest for Single Chapter Deletion (Priority: P1)

**Goal**: Add a durable deletion manifest to `deleteChapterFromDB`, recorded atomically with chapter/CRDT-state catalog deletion, followed by physical cleanup and manifest removal.

**Independent Test**: Perform a single chapter deletion; verify that a pending manifest exists after catalog commit; simulate crash before physical cleanup and verify `recoverPendingDeletions()` finishes the cleanup.

### Implementation for User Story 2

- [x] T011 [US2] Refactor `deleteChapterFromDB` / inner `executeDelete` in `src/services/db.ts` (~lines 1323–1383): add `DELETION_MANIFESTS_STORE` to `storesToLock`, create and `put()` a `DeletionManifestRecord` (`id: manifest_chap_${Date.now()}_${id}_...`, `projectId: resolvedProjectId`, `chapterIds: [id]`, `physicalDbNames: ['crdt_${resolvedProjectId}_${id}']`, `status: 'pending'`) inside the same transaction that deletes chapter and CRDT state records. After transaction commit, call `deleteChapterCrdtDatabase(resolvedProjectId, id)` then `removeDeletionManifest(manifestId)`. On physical deletion failure, propagate error and retain manifest for recovery.
- [x] T012 [US2] Add test in `src/services/__tests__/projectDeleteQueue.test.ts`: verify that `deleteChapterFromDB` creates a pending manifest record with `chapterIds: [id]` and `physicalDbNames: ['crdt_${projectId}_${id}']` atomically with chapter catalog deletion.
- [x] T013 [US2] Add test in `src/services/__tests__/projectDeleteQueue.test.ts`: verify that after a simulated crash between catalog commit and physical deletion, `recoverPendingDeletions()` discovers the single-chapter manifest, deletes the physical DB, and removes the manifest.
- [x] T014 [US2] Add test in `src/services/__tests__/projectDeleteQueue.test.ts`: verify that if physical cleanup succeeds immediately (no crash), the manifest is removed from `deletion_manifests` store.
- [x] T015 [US2] Run `npm run lint && npm test && npm run build` — all must pass cleanly.

**Checkpoint**: Single-chapter deletion now has full durable manifest recovery parity with project and bulk deletion.

---

## Phase 5: User Story 3 — Cross-Boundary FK Validation on All Write Paths (Priority: P1/P2)

**Goal**: Enforce `assertChapterOwnership` in `saveProjectToDB` and `atomicSaveProjectBundle`, closing the bypass paths used by Google Drive sync and bundle imports.

**Independent Test**: Call `saveProjectToDB` or `atomicSaveProjectBundle` with a chapter that belongs to a different project; verify that the transaction aborts with a relational integrity violation and the chapter remains under its original project.

### Implementation for User Story 3

- [x] T016 [US3] Add ownership validation to `executeSaveProjectToDB()` in `src/services/db.ts` (~lines 363–411): for each chapter in `chaptersToSave`, read the existing chapter from `chaptersStore.get(chap.id)` inside the transaction. Call `assertChapterOwnership(existing, project.id, chap.id)`. If it throws, abort the transaction with `reject(err)`.
- [x] T017 [US3] Add ownership pre-validation to `executeAtomicSaveProjectBundle()` in `src/services/db.ts` (~lines 425–489): inside the transaction, before any `chaptersStore.put()` call, iterate all incoming `chapters` and for each, read existing record via `chaptersStore.get(chap.id)`. Call `assertChapterOwnership(existing, project.id, chap.id)`. If any throws, abort the entire transaction immediately via `transaction.abort()` and `reject(err)`. No `put()` operations should be enqueued before all validation completes.
- [x] T018 [US3] Add test in `src/services/__tests__/projectDeleteQueue.test.ts`: verify that `saveProjectToDB` rejects with a relational integrity violation when a chapter in `project.chapters` already belongs to a different project in storage.
- [x] T019 [US3] Add test in `src/services/__tests__/projectDeleteQueue.test.ts`: verify that `atomicSaveProjectBundle` rejects with a relational integrity violation when any incoming chapter already belongs to a different project, and that zero records are mutated (no partial writes).
- [x] T020 [US3] Add test in `src/services/__tests__/projectDeleteQueue.test.ts`: verify that `atomicSaveProjectBundle` succeeds normally when all chapters either don't exist in storage or belong to the same project.
- [x] T021 [US3] Run `npm run lint && npm test && npm run build` — all must pass cleanly.

**Checkpoint**: All storage write paths now enforce chapter ownership immutability.

---

## Phase 6: User Story 4 — Fail-Closed Persistence Release and Recovery Discovery (Priority: P2)

**Goal**: Remove error suppression in CRDT persistence disposal and manifest recovery discovery. Errors must propagate to callers.

**Independent Test**: Mock `destroyCrdtPersistence` failure and verify deletion rejects; mock DB read error in `getPendingDeletionManifests` and verify `recoverPendingDeletions` reports failure.

### Implementation for User Story 4

- [x] T022 [US4] Refactor `deleteChapterCrdtDatabase()` in `src/services/db.ts` (~line 830). Remove the outer `try/catch` block that swallows errors. Keep the inner `await destroyCrdtPersistence(...)` and `await executeDeleteDatabase(dbName)`. If either fails, the error must propagate.
- [x] T023 [US4] Refactor `deleteProjectCrdtDatabases()` in `src/services/db.ts` (~line 848). Remove `try/catch` around `destroyAllCrdtPersistencesForProject(...)` so that if provider destruction fails, the iteration aborts and propagates to caller before physical db eradication.
- [x] T024 [US4] Add/update test in `src/services/__tests__/projectDeleteQueue.test.ts`: verify that when `destroyCrdtPersistence` or `destroyAllCrdtPersistencesForProject` throws, the deletion operation is aborted, physical database is not deleted, and the error propagates to the caller. (The manifest must remain pending).
- [x] T025 [US4] Run `npm run lint && npm test && npm run build` to verify Fail-Closed error propagation cleanly.

**Checkpoint**: Full fail-closed semantics across persistence disposal and recovery discovery.

---

## Phase 7: User Story 5 — Discovery Consistency Across Concurrency Windows (Priority: P2)

**Goal**: Ensure that the manifest committed inside the atomic deletion transaction contains all chapter IDs discovered across all stores during the transaction, not just the pre-transaction snapshot.

**Independent Test**: Verify that chapters discovered mid-transaction from cursor traversal are included in the final manifest record.

### Implementation for User Story 5

- [x] T030 [US5] Update `executeDeleteProjectFromDB()` in `src/services/db.ts`: ensure the manifest `put()` operation is scheduled AFTER all cursor-based chapter discovery completes inside the transaction. The manifest's `chapterIds` and `physicalDbNames` must reflect the union of all chapter IDs found from `project.chapters`, `chaptersStore.index('projectId')`, and `crdtStore.index('projectId')`. This may require collecting IDs in a shared mutable set within the transaction callbacks and putting the manifest in a completion callback after all cursors finish.
- [x] T031 [US5] Add test in `src/services/__tests__/projectDeleteQueue.test.ts`: verify that when additional chapters are discovered during cursor traversal (beyond the initial `discoverProjectChapterIds` snapshot), the committed manifest includes ALL discovered chapter IDs and corresponding physical database names.
- [ ] T032 [US5] Run `npm run lint && npm test && npm run build` — all must pass cleanly.

**Checkpoint**: Manifest always reflects the authoritative, final set of chapters at transaction commit time.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, documentation alignment, and quality gate clearance.

- [x] T033 [P] Remove the now-unused standalone `recordDeletionManifest()` export from `src/services/db.ts` if no external callers remain (check `recordPendingDeletion` alias). If external callers exist, keep the export but add a deprecation comment.
- [x] T034 [P] Verify `crdtPersistenceRegistry.ts` in `src/services/crdtPersistenceRegistry.ts`: confirm that `destroyCrdtPersistence()` and `destroyAllCrdtPersistencesForProject()` correctly propagate errors (retain provider in registry on failure). No code change expected — verification only.
- [x] T035 Run full quality gate: `npm run lint && npm test && npm run build` — all must pass cleanly with 0 errors, 0 skipped tests, 0 regressions.
- [x] T036 Run `quickstart.md` verification scenarios against the final implementation to confirm all 4 scenarios pass.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational (Phase 2) — atomic manifest for project/bulk deletion
- **US2 (Phase 4)**: Depends on Foundational (Phase 2) — can run in parallel with US1
- **US3 (Phase 5)**: Depends on Setup (T001) — can run in parallel with US1 and US2
- **US4 (Phase 6)**: No dependency on US1–US3 — can run in parallel
- **US5 (Phase 7)**: Depends on US1 (T005) since it refines the manifest discovery within the atomic transaction
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Requires T004 (Foundational). No cross-story dependency.
- **US2 (P1)**: Requires T004 (Foundational). Independent of US1.
- **US3 (P1/P2)**: Requires T001 (`assertChapterOwnership`). Independent of US1/US2.
- **US4 (P2)**: No dependencies on other stories. T022 & T023 are parallel-safe.
- **US5 (P2)**: Refines US1's transaction structure. Depends on T005 being complete.

### Within Each User Story

- Implementation tasks before their corresponding tests (tests validate the implementation)
- Core logic changes before error-handling refinements
- `npm run lint && npm test && npm run build` checkpoint after each story

### Parallel Opportunities

- T001, T002, T003 can all run in parallel (different functions, no file conflicts within reasonable merge)
- T005 and T006 (US1) modify different functions — can run in parallel
- US1 (Phase 3) and US2 (Phase 4) can proceed in parallel
- US3 (Phase 5) can proceed in parallel with US1 and US2
- US4 (Phase 6) can proceed in parallel with all other stories
- T022 and T023 (US4) modify different functions — can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch both atomic transaction refactors in parallel (different functions):
Task: "Refactor executeDeleteProjectFromDB() atomic manifest in src/services/db.ts"
Task: "Refactor executeDeleteChaptersByProjectFromDB() atomic manifest in src/services/db.ts"

# Then run all three tests:
Task: "Test aborted transaction leaves zero manifests"
Task: "Test successful deletion creates and removes manifest"
Task: "Test bulk chapter deletion atomic manifest"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004)
3. Complete Phase 3: User Story 1 (T005–T010)
4. **STOP and VALIDATE**: Run `npm run lint && npm test && npm run build`
5. The most critical P1 data-loss vulnerability is now closed

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (atomic manifest) → Test independently → Validate (MVP!)
3. Add US2 (single chapter manifest) → Test independently → Validate
4. Add US3 (FK enforcement) → Test independently → Validate
5. Add US4 (fail-closed) → Test independently → Validate
6. Add US5 (discovery consistency) → Test independently → Validate
7. Polish → Final quality gate

### Parallel Team Strategy

With multiple developers:
1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 (atomic manifest) + US5 (discovery refinement)
   - Developer B: US2 (single chapter manifest) + US3 (FK enforcement)
   - Developer C: US4 (fail-closed semantics)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files or different functions, no conflicts
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All file paths refer to existing files in the repository; no new files are created except test additions to the existing test file
- `src/services/db.ts` is the single source file modified across all stories
- `src/services/__tests__/projectDeleteQueue.test.ts` is the single test file extended across all stories

