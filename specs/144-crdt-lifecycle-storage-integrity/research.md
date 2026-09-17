# Research & Technical Decisions: CRDT Lifecycle, Storage Integrity, and Lock Isolation Hardening

**Feature**: `144-crdt-lifecycle-storage-integrity`
**Date**: 2026-09-17

## 1. Reliable CRDT Database Deletion Without Blocked/Error False Positives

### Problem
`deleteProjectCrdtDatabases` previously resolved its promise on `onblocked` and `onerror` events:
```ts
req.onsuccess = () => resolve();
req.onerror = () => resolve();
req.onblocked = () => resolve();
```
In IndexedDB semantics:
- `onblocked` means open connections from active tabs or unmounted components prevent database deletion. Resolving on `onblocked` signals completion to the caller while the database remains alive on disk.
- When the user creates or imports a project with the same ID, the unpurged database resurrects old draft states.

### Decision
1. In `deleteProjectCrdtDatabases`:
   - Only resolve the deletion promise upon `req.onsuccess`.
   - On `req.onerror`: reject immediately with the request error.
   - On `req.onblocked`: log a warning and await `onsuccess`, with a bounded safety timeout (5000ms) that rejects if connections fail to close.
2. In the application lifecycle:
   - Provide `destroyActiveCrdtPersistence(dbName)` and `destroyAllCrdtPersistencesForProject(projectId)` registry in `src/services/crdtDocManager.ts` / `src/hooks/useChapterCRDT.ts`.
   - Before executing `deleteDatabase`, destroy active memory instances so open connections are closed immediately, preventing `onblocked` from triggering.

---

## 2. Exact CRDT Database Targeting vs. Prefix Collisions

### Problem
CRDT database names follow the pattern:
```text
crdt_${projectId}_${chapterId}
```
If project IDs share prefixes (e.g. Project A = `proj_123` and Project B = `proj_123_456`), using `name.startsWith("crdt_" + projectId + "_")` causes deleting Project A to match and delete Project B's chapters (`crdt_proj_123_456_chap1`).

### Decision
Eliminate ambiguous prefix sweeping with `startsWith`:
1. Always compute exact target database names from known chapter IDs:
   `crdt_${projectId}_${chapterId}`.
2. Collect chapter IDs from all relevant stores in `novel_translator_db`:
   - `CHAPTERS_STORE` index `projectId`.
   - `project.chapters` array from `PROJECTS_STORE`.
   - `CRDT_STATES_STORE` index `projectId`.
3. Only delete databases whose names match the exact computed identifiers.

---

## 3. Complete CRDT Cleanup on Single Chapter Deletion

### Problem
`deleteChapterFromDB(chapterId)` only deleted the record from `CHAPTERS_STORE`. It left stale data in `CRDT_STATES_STORE` and left the dedicated database `crdt_${projectId}_${chapterId}` intact on disk.

### Decision
Update `deleteChapterFromDB`:
1. Look up the chapter to obtain its `projectId`.
2. Within an atomic transaction covering `[CHAPTERS_STORE, CRDT_STATES_STORE]`, delete the chapter from both stores.
3. Upon `transaction.oncomplete`, destroy active persistence instances and delete `crdt_${projectId}_${chapterId}` via `indexedDB.deleteDatabase`.
4. Serialize the entire operation within `enqueueProjectWrite(projectId)`.

---

## 4. Strict Fail-Closed Semantics for CRDT State Persistence

### Problem
`saveCrdtState` and `saveCrdtStates` previously had paths where records lacking `projectId` could be saved into `CRDT_STATES_STORE` without parent project validation.

### Decision
Align CRDT persistence with chapter persistence:
- In `saveCrdtState(record)`: If `!record.projectId`, log a diagnostic warning and return cleanly without persisting.
- In `saveCrdtStates(records)`: Filter records, omitting any without `projectId`.

---

## 5. Project Boundary Validation in Atomic Bundle Saves

### Problem
`atomicSaveProjectBundle` normalized CRDT items with:
```ts
projectId: ('projectId' in item && item.projectId) ? item.projectId : project.id
```
If an item arrived with a foreign `projectId` (e.g. Project B while bundle is for Project A), foreign data would be committed into Project A's transaction.

### Decision
Enforce strict validation:
```ts
for (const item of crdtStates) {
  if ('projectId' in item && item.projectId && item.projectId !== project.id) {
    throw new Error(
      `[atomicSaveProjectBundle] Mismatched projectId in CRDT state: chapter ${item.chapterId} has projectId "${item.projectId}" which does not match bundle projectId "${project.id}".`
    );
  }
}
```
If any mismatch occurs, the bundle save throws before opening/committing the transaction.

---

## 6. Isolated Lock Acquisition Retry in Web Locks

### Problem
In `withProjectLock`:
```ts
return withRetry(
  () => navigator.locks.request(`project-lock-${projectId}`, async () => fn()),
  3, 50, ...
);
```
If `fn()` threw an application exception, `locks.request` rejected, causing `withRetry` to re-acquire the lock and re-execute `fn()`.

### Decision
Decouple lock acquisition retry from callback execution using an Outcome wrapper:
```ts
type LockOutcome<T> = { ok: true; value: T } | { ok: false; error: unknown };

const outcome = await withRetry(
  async () => {
    return navigator.locks.request(`project-lock-${projectId}`, async () => {
      try {
        const value = await fn();
        return { ok: true as const, value };
      } catch (error) {
        return { ok: false as const, error };
      }
    });
  },
  3,
  50,
  `withProjectLock:${projectId}`
);

if (!outcome.ok) {
  throw outcome.error;
}
return outcome.value;
```
When `fn()` throws, `locks.request` resolves `{ ok: false, error }`, so `withRetry` does not retry. `fn()` is executed at most once.

---

## 7. Unified Transaction Durability & Undo Integrity

### Problem
`deleteChapterFromDB` and `deleteChaptersByProjectFromDB` resolved on request/cursor rather than `transaction.oncomplete`. In addition, `handleDeleteProject` backed up chapters on delete but not `crdt_states`, so Undo restored chapters without CRDT lineage.

### Decision
1. Update `deleteChapterFromDB` and `deleteChaptersByProjectFromDB` to resolve strictly on `transaction.oncomplete`.
2. Add `getCrdtStatesByProject(projectId)` helper in `src/services/db.ts`.
3. In `handleDeleteProject` in `src/hooks/useProjects.ts`:
   - Back up `backedUpCrdtStates = await getCrdtStatesByProject(id)`.
   - On Undo: restore `saveProjectToDB`, `saveChaptersToDB`, and `saveCrdtStates(backedUpCrdtStates)`.
