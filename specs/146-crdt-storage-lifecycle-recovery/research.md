# Phase 0 Research: CRDT Storage Lifecycle Recovery and Invariant Hardening

## Decision 1: Durable Deletion Manifest Pattern for Physical Storage Recovery

### Context
When deleting a project or chapter, the system deletes primary records in `novel_translator_db` (`projects`, `chapters`, `crdt_states`) and deletes dedicated physical IndexedDB databases (`crdt_${projectId}_${chapterId}`). If primary records commit successfully but physical database deletion fails (e.g. browser storage blocked, crash, tab close), all canonical metadata containing chapter IDs is gone. Because prefix scanning is prohibited to prevent collateral damage, physical databases become permanently orphaned with no way to identify them on restart.

### Decision
Introduce a durable `deletion_manifests` object store in `novel_translator_db` (schema v5 upgrade):
1. Prior to committing destructive catalog deletions, a deletion manifest entry is created:
   ```ts
   interface DeletionManifest {
     id: string; // e.g. "proj_${projectId}" or "chap_${chapterId}"
     projectId: string;
     chapterIds: string[];
     physicalDbNames: string[];
     createdAt: string;
     status: 'pending' | 'completed';
   }
   ```
2. The manifest record is committed alongside or immediately before the primary catalog deletion.
3. Physical database deletions are executed.
4. When all physical databases are confirmed deleted via `indexedDB.deleteDatabase`, the manifest entry is removed.
5. On application startup or DB initialization (`initDB`), an initialization recovery worker `recoverPendingDeletions()` scans `deletion_manifests` for any `pending` manifests, re-executes physical database deletions, and clears resolved manifests.

### Rationale
- Purely client-side and crash-safe: survives tab reloads, browser restarts, and process crashes.
- Zero reliance on unsafe prefix scanning across browser-level `indexedDB.databases()`.
- Idempotent: `indexedDB.deleteDatabase()` succeeds cleanly even if a target DB was already deleted.

### Alternatives Considered
- `localStorage` manifest: Vulnerable to 5MB storage limits, unavailable in private browsing mode or cross-context scenarios, and desynchronized from IndexedDB transactions.
- Re-enabling prefix matching on `indexedDB.databases()`: Rejected because `indexedDB.databases()` is not universally supported in Firefox/Safari, and substring prefix collisions (`proj_100` vs `proj_100_200`) cause catastrophic data loss of sibling projects.

---

## Decision 2: Active Rejection & Transaction Abort for Ownership Invariants

### Context
Currently, foreign-key invariant checks in `executeSaveChapterToDB`, `executeSaveChaptersToDB`, `executeSaveCrdtState`, and `executeSaveCrdtStates` log a `console.warn(...)` and `return;` without rejecting the promise or aborting the IndexedDB transaction. This produces a "silent write drop" where callers receive a resolved promise as if saving succeeded, but no data was stored. Furthermore, `executeSaveCrdtState` does not reject when the referenced chapter is missing (`!chapter`).

### Decision
1. In `executeSaveChapterToDB` and `executeSaveChaptersToDB`: If `existing && existing.projectId && existing.projectId !== incomingProjectId`, immediately trigger `transaction.abort()` and `reject(new Error(`Relational integrity violation: Cannot re-parent chapter ${id} from project ${existing.projectId} to ${incomingProjectId}`))`.
2. In `executeSaveCrdtState` and `executeSaveCrdtStates`:
   - If `!chapter`: trigger `transaction.abort()` and `reject(new Error(`Relational integrity violation: Chapter ${record.chapterId} does not exist in store`))`.
   - If `chapter.projectId !== record.projectId`: trigger `transaction.abort()` and `reject(new Error(`Relational integrity violation: Chapter ${record.chapterId} belongs to project ${chapter.projectId}, not ${record.projectId}`))`.
3. In `useChapterCRDT`: update error handling to log and surface rejection if auto-save encounters an integrity error.

### Rationale
- Guarantees strict fail-closed semantics: any caller attempting an illegal re-parenting or orphan state write receives an explicit rejection.
- Zero risk of silent data loss.

### Alternatives Considered
- Returning a `StorageResult<T>` with error code: While useful for high-level UI APIs, internal DB functions (`saveChapterToDB`, `saveCrdtState`) return `Promise<void>` across dozens of call sites. Changing their return type to an object result would break TypeScript contracts throughout the app. Rejecting the promise conforms to standard async error handling.

---

## Decision 3: Atomic Critical Section for Deletion Snapshot and Removal

### Context
In `useProjects.ts`, `handleDeleteProject` and `handleDeleteChapterHistory` called `await waitForQueueIdle(projectId)`, then read the backup snapshot, then queued deletion via `enqueueProjectDelete(projectId)`. An active editor window emitting debounced autosaves can enqueue a write between the snapshot read and the delete command, causing Undo to restore an older snapshot than what was deleted.

### Decision
Provide `runInProjectExclusiveSection(projectId: string, action: () => Promise<T>): Promise<T>` in `projectStorageQueue.ts`.
1. The exclusive section is queued onto the project's write serialization chain (`projectWriteChains`).
2. Inside the exclusive callback, all prior in-flight writes have finished.
3. The callback reads the backup snapshot (`readBackup()`) and executes the low-level deletion transaction (`executeDeleteProjectFromDB` or `executeDeleteChapterFromDB`) without yielding the queue.
4. No other write can be scheduled or executed during this window.

### Rationale
- Atomically binds snapshot capture and deletion execution.
- Completely eliminates the race condition without adding external lock libraries.

---

## Decision 4: Canonical `projectId` Verification in Chapter Operations

### Context
`deleteChapterFromDB(id, projectId)` accepted an optional `projectId` parameter from the caller. If the caller passed a mismatched or incorrect `projectId`, the function used the incorrect value to queue writes and clean up CRDT storage without checking storage. Furthermore, `useChapterCRDT` hydrated document state without verifying that `crdtRecord.projectId === projectId`.

### Decision
1. In `deleteChapterFromDB(id, projectId)`:
   - Always load the stored chapter record first: `const existing = await getChapterFromDB(id)`.
   - If `existing` exists:
     - `const canonicalProjectId = existing.projectId;`
     - If `projectId && projectId !== canonicalProjectId`: throw/reject with `new Error(\`Mismatched projectId for chapter \${id}: expected \${canonicalProjectId}, got \${projectId}\`)`.
     - Use `canonicalProjectId` for queue serialization, database transaction, and CRDT database cleanup.
2. In `useChapterCRDT.ts`:
   - When calling `getCrdtState(chapterId)`, verify `if (crdtRecord.projectId !== projectId)` before applying `Y.applyUpdate`. If mismatched, warn and abort hydration.
3. In `getCrdtState(chapterId, projectId)`:
   - Allow passing `projectId` to `getCrdtState`. If passed, assert `record.projectId === projectId`.

### Rationale
- Guarantees that the physical database name deleted (`crdt_${canonicalProjectId}_${id}`) matches reality.
- Prevents cross-project hydration contamination.

---

## Decision 5: Fail-Closed Discovery and Safe Persistence Provider Release

### Context
1. `deleteProjectCrdtDatabases` caught discovery errors, logged a warning, and proceeded to delete whatever partial list of DBs it had discovered, falsely resolving as success while leaving undiscovered databases on disk.
2. `destroyCrdtPersistence(dbName)` deleted the provider Set from `activePersistences` *before* invoking `provider.destroy()`. If `provider.destroy()` threw an exception, the provider reference was lost, preventing subsequent cleanup retries.

### Decision
1. In `deleteProjectCrdtDatabases`: Remove the try/catch swallow around discovery. If collecting chapter IDs from `projects`, `chapters`, or `crdt_states` throws, immediately propagate the error and reject the promise.
2. In `destroyCrdtPersistence(dbName)`:
   - Await `Promise.all(promises)` for all providers in the set.
   - Only remove `activePersistences.delete(dbName)` when all provider destroy promises resolve.
   - If a provider destroy rejects, keep the provider in the set (or rethrow) so that subsequent calls to `destroyCrdtPersistence` or `recoverPendingDeletions` can retry closing the connection.
