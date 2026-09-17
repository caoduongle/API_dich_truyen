# Phase 0 Research: CRDT Deletion Error Propagation and Undo Integrity Hardening

## Overview
This document records technical investigations, trade-off evaluations, and architectural decisions for resolving storage deletion error swallowing, editor CRDT undo hydration, backup snapshot consistency, comprehensive chapter discovery, bulk chapter CRDT cleanup, relational foreign-key integrity, and multi-instance persistence registry management.

---

### Decision 1: Fail-Closed Error Propagation on CRDT Database Deletion
- **Context**: `executeDeleteProjectFromDB` and `deleteChapterFromDB` wrapped `deleteProjectCrdtDatabases` / `deleteChapterCrdtDatabase` inside `try { ... } catch (crdtErr) { console.warn(...); }` blocks. When `deleteDatabase` failed (error or persistent blocked timeout), the warning was logged but the promise resolved successfully, falsely claiming complete deletion.
- **Decision**: Adopt Option A (Fail-Closed Deletion).
  - In `executeDeleteProjectFromDB`: Await `deleteProjectCrdtDatabases(id, chapterIdsToDelete)` inside `transaction.oncomplete`; if it rejects, immediately reject the deletion promise so callers know deletion was incomplete.
  - In `deleteChapterFromDB`: Await `deleteChapterCrdtDatabase(resolvedProjectId, id)`; if it rejects, propagate the exception.
- **Rationale**: Destructive deletion has an absolute invariant: no lingering data on disk. Reporting success when physical databases remain violates user privacy expectations, storage quotas, and can resurrect phantom documents.
- **Alternatives Considered**:
  - *Option B (Return Partial Failure Status)*: Rejected because `deleteProjectFromDB` and `deleteChapterFromDB` return `Promise<void>`. Changing return signatures across multiple layers (`useProjects`, `useZuminovelPublish`, `AutoTranslator`) introduces widespread interface breakage while still failing to stop invalid state transitions.

---

### Decision 2: Editor CRDT State Hydration on Undo Reopening
- **Context**: Project and chapter deletion undo restored records to `novel_translator_db` (`projects`, `chapters`, `crdt_states`). However, `useChapterCRDT` initializes by creating a fresh `Y.Doc` and connects `IndexeddbPersistence` to a new (initially empty) `crdt_${projectId}_${chapterId}` database. It never queried `crdt_states` or applied updates, breaking Yjs collaborative lineage upon Undo.
- **Decision**: In `useChapterCRDT.ts`, asynchronously query `getCrdtState(chapterId)` during session setup. If a serialized update exists in `crdt_states`:
  1. Apply `Y.applyUpdate(doc, crdtRecord.update, 'restore-hydration')`.
  2. Because `IndexeddbPersistence` is attached to `doc`, applying the update triggers the persistence provider to automatically save it into the new `crdt_${projectId}_${chapterId}` database.
- **Rationale**: Guarantees that undoing a project or chapter deletion restores both the textual representation and the full Yjs operational transformation history for local collaborative editing.
- **Alternatives Considered**:
  - *Reconstructing raw and polished strings directly*: Rejected because it bypasses Yjs lineage, creating duplicate edit vectors and conflicts if synced with remote peers or Google Drive.

---

### Decision 3: Snapshot Consistency for Deletion Undo (Queue Synchronization)
- **Context**: `handleDeleteProject` and `handleDeleteChapterHistory` in `useProjects.ts` read backup data (`getChaptersByProjectFromDB`, `getCrdtStatesByProject`, `getChapterFromDB`, `getCrdtState`) *before* enqueuing the delete operation. Any in-flight autosave or background write queued in `projectWriteChains` had not yet committed to IndexedDB, so the backup snapshot risked capturing outdated data.
- **Decision**: In `useProjects.ts`, call `await waitForQueueIdle(id)` (or `await waitForProjectWrites(id)`) prior to reading the backup snapshot.
- **Rationale**: `waitForQueueIdle` awaits both the in-flight project save chain and the project write lock, ensuring all pending keystrokes or translation flushes are fully committed before the backup is taken.
- **Alternatives Considered**:
  - *Taking backup inside the deletion transaction*: Rejected because taking a multi-store backup within the same IDB transaction as the deletion would require holding large read-write locks across projects, chapters, and CRDT stores simultaneously, increasing transaction timeout risks.

---

### Decision 4: Exhaustive Chapter Discovery from All Sources
- **Context**: `executeDeleteProjectFromDB` collected chapter IDs solely by iterating over `CHAPTERS_STORE` and `CRDT_STATES_STORE`. It failed to inspect `project.chapters` in `PROJECTS_STORE`. If a chapter had been detached from `CHAPTERS_STORE` but remained in `project.chapters`, its dedicated `crdt_${projectId}_${chapterId}` database was missed.
- **Decision**: In both `executeDeleteProjectFromDB` and `deleteProjectCrdtDatabases`, read the project entity (`projectsStore.get(id)` / `PROJECTS_STORE`) and aggregate all chapter IDs found in `project.chapters` alongside `CHAPTERS_STORE` and `CRDT_STATES_STORE`.
- **Rationale**: Guarantees zero dangling or orphaned physical databases even in corrupt or partially synchronized project hierarchies.
- **Alternatives Considered**:
  - *Restoring wildcard/prefix scanning (`startsWith`)*: Strictly rejected due to cross-project collision risks where `proj_100` deletes databases belonging to `proj_100_200`.

---

### Decision 5: Complete Lifecycle for `deleteChaptersByProjectFromDB`
- **Context**: `executeDeleteChaptersByProjectFromDB` deleted rows from `CHAPTERS_STORE` but left `CRDT_STATES_STORE` entries and dedicated physical CRDT databases untouched.
- **Decision**: Update `executeDeleteChaptersByProjectFromDB` to:
  1. Lock `[CHAPTERS_STORE, CRDT_STATES_STORE]` (and `PROJECTS_STORE` if present).
  2. Collect all chapter IDs belonging to `projectId`.
  3. Delete matching records from both `CHAPTERS_STORE` and `CRDT_STATES_STORE`.
  4. In `transaction.oncomplete`, call `await deleteProjectCrdtDatabases(projectId, Array.from(chapterIds))`.
- **Rationale**: Unifies the deletion lifecycle across single chapter, project chapters, and whole project deletion, preventing orphaned CRDT records.
- **Alternatives Considered**:
  - *Deleting the function entirely*: Rejected because it is exported in public database interfaces and tested in project management hooks.

---

### Decision 6: Relational Foreign-Key Ownership Invariants
- **Context**: `saveChapterToDB` verified parent project existence, but did not check if the chapter already existed under a different `projectId`, allowing inadvertent re-parenting. Similarly, `saveCrdtState` did not verify whether the target chapter belonged to the designated project.
- **Decision**:
  - In `executeSaveChapterToDB`: If an existing chapter with the same ID already exists in `CHAPTERS_STORE`, assert `existing.projectId === incoming.projectId`. If mismatched, abort with a diagnostic error/warning (fail-closed).
  - In `executeSaveCrdtState`: Verify that the target chapter in `CHAPTERS_STORE` belongs to `record.projectId`. If mismatched, abort with a diagnostic warning.
- **Rationale**: Enforces relational data boundary invariants across client-side stores, preventing cross-project contamination from malformed imports or concurrent mutations.
- **Alternatives Considered**:
  - *Silent overwriting / re-parenting*: Rejected because chapters belong strictly to a single parent project in the application schema.

---

### Decision 7: Multi-Instance Persistence Registry & Collision-Safe Scoping
- **Context**:
  1. `crdtPersistenceRegistry.ts` used `Map<string, CrdtPersistenceProvider>`, allowing only one provider per database name. In React (strict mode, fast refresh, multiple tabs/modals), a newer provider overwrote an older provider, leaving the older instance unclosed and holding an active IDB connection that blocks deletion.
  2. The fallback branch in `destroyAllCrdtPersistencesForProject` used `dbName.startsWith("crdt_" + projectId + "_")`. For Project A (`proj_100`) and Project B (`proj_100_200`), deleting Project A matched and destroyed providers belonging to Project B.
- **Decision**:
  1. Change registry store to `Map<string, Set<CrdtPersistenceProvider>>`. Every provider registering for a `dbName` is tracked. Destroying a `dbName` awaits destruction of all providers in the set.
  2. Allow optional `projectId` registration or track metadata: `registerCrdtPersistence(dbName, provider, projectId)`. Provider destruction targets exact known chapter IDs or checks explicitly registered `projectId`, avoiding substring prefix scanning.
- **Rationale**: Guarantees all active connections are released before physical deletion and eliminates accidental cross-project session disruption.
- **Alternatives Considered**:
  - *Disallowing multiple providers in client code*: Unreliable due to React component mounting/unmounting lifecycle asynchronous timings.
