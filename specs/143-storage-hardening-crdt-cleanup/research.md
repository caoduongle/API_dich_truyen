# Research & Technical Decisions: CRDT Storage Cleanup, Fail-Closed Chapter Safeguard, and Transaction Durability Hardening

**Feature**: `143-storage-hardening-crdt-cleanup`
**Date**: 2026-09-17

## 1. Complete y-indexeddb CRDT Persistence Eradication

### Problem
In `src/hooks/useChapterCRDT.ts`, each chapter session creates a dedicated client-side IndexedDB database using `y-indexeddb`:
```ts
const idbProvider = new IndexeddbPersistence(`crdt_${projectId}_${chapterId}`, doc);
```
When unmounting the hook, `idbProvider.destroy()` only closes the IndexedDB connection. When `deleteProjectFromDB(id)` was executed, it cleaned the primary database (`novel_translator_db`: `projects`, `chapters`, `crdt_states`, `terms`), but left the dedicated `crdt_${projectId}_${chapterId}` databases intact on the user's browser.
Recreating a project with the same ID or re-importing from Google Drive caused `y-indexeddb` to resurrect obsolete CRDT state, creating conflicts and leaking browser disk space.

### Decision
Implement `deleteProjectCrdtDatabases(projectId: string, chapterIds?: string[]): Promise<void>` in `src/services/db.ts`:
1. Query all chapter IDs of the project from `CHAPTERS_STORE` in `novel_translator_db` before records are purged.
2. For each known chapter ID, invoke `indexedDB.deleteDatabase(`crdt_${projectId}_${chapterId}`)` wrapped in an explicit Promise resolving on `onsuccess` or `onblocked`/`onerror`.
3. If `typeof indexedDB.databases === 'function'` is available, query `await indexedDB.databases()` and scan for any database names matching the prefix `crdt_${projectId}_`. Invoke `indexedDB.deleteDatabase(name)` on any discovered orphan databases.
4. Integrate `deleteProjectCrdtDatabases(id, knownChapterIds)` into `executeDeleteProjectFromDB(id)`.

### Rationale
Using both targeted chapter ID deletion and prefix-based database enumeration ensures 100% coverage in browsers that support `indexedDB.databases()` (Chrome, Edge, Safari 15.4+) while gracefully maintaining reliable deletion via chapter ID indexing in browsers or test environments without database enumeration.

### Alternatives Considered
- *Calling `idbProvider.clearData()`*: Requires active Y.Doc and provider instances for all chapters, which consumes substantial memory and requires opening connections before clearing. `indexedDB.deleteDatabase` directly wipes the entire database file from the browser storage layer cleanly.

---

## 2. Fail-Closed Orphan Guard for Chapters Lacking `projectId`

### Problem
In `saveChapterToDB(chapter)`, if `projectId` is missing on the input object and cannot be found from an existing chapter record in IndexedDB, the function previously fell back to saving directly into the `chapters` store without verifying parent project existence.
This allowed malformed payloads or partial cloud sync imports to create permanently orphaned chapters that could not be indexed, managed, or cleaned up by project deletion.

### Decision
Enforce a strict Fail-Closed policy:
1. In `saveChapterToDB(chapter)`:
   - Resolve `effectiveProjectId = chapter.projectId || (await findProjectId(chapter.id))`.
   - If `effectiveProjectId` is undefined or empty, abort immediately, log a diagnostic warning (`[saveChapterToDB] Aborted saving chapter: missing parent projectId`), and return cleanly without writing to `CHAPTERS_STORE`.
2. In Google Drive sync/import services (`driveGranularSync.ts`, `driveProjectSync.ts`):
   - Before saving downloaded chapters via `saveChapterToDB`, explicitly validate or inject `projectId: project.id` into the chapter object (`{ ...remoteChapterData, projectId: project.id }`).

### Rationale
Relational integrity in a client-side database must be guarded at the storage boundary. Never permit writes when the ownership relation cannot be proven.

### Alternatives Considered
- *Throwing an uncaught exception*: Could crash background sync loops or UI event handlers. Aborting cleanly with a descriptive log warning preserves application stability while guaranteeing zero orphan record creation.

---

## 3. Strict Transaction Durability (`transaction.oncomplete`)

### Problem
In `executeSaveChapterToDB`, `executeSaveChaptersToDB`, `executeSaveCrdtState`, `executeSaveCrdtStates`, and `executeDeleteCrdtStatesByProject`, the completion promise was resolved inside `putRequest.onsuccess` (or cursor advance) before `transaction.oncomplete` fired.
In IndexedDB, `request.onsuccess` only confirms that the operation was queued in the transaction; the data is not durable on disk until `transaction.oncomplete`. Resolving early causes race conditions where subsequent write queue tasks or Web Lock holders execute against incomplete disk state.

### Decision
Standardize all write transaction helpers to resolve strictly on `transaction.oncomplete`:
1. Remove `doResolve()` calls from `putRequest.onsuccess` and cursor termination.
2. Wire `transaction.oncomplete = () => resolve()`.
3. Wire `transaction.onerror = () => reject(transaction.error)`.
4. Wire `transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted'))`.
5. If an early clean exit is needed (e.g. parent project not found), resolve immediately or abort the transaction without writing.

### Rationale
Guarantees full ACID durability before resolving promises to caller hooks and serialization queues, eliminating phantom reads and out-of-order execution across write chains.

---

## 4. Resilient Web Lock Acquisition with Retry

### Problem
In `src/services/db.ts`, `withProjectLock(projectId, fn)` called `navigator.locks.request(...)` directly, whereas `withRetry` was only applied inside the executed callback `fn()`. If lock acquisition itself rejected (due to momentary lock contention, AbortController timeouts, or transient context interruptions), the failure was not retried.

### Decision
Wrap `navigator.locks.request` with `withRetry` inside `withProjectLock`:
```ts
export async function withProjectLock<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
  if (!projectId) return fn();
  if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
    return withRetry(
      () => navigator.locks.request(`project-lock-${projectId}`, async () => fn()),
      3,
      100,
      `withProjectLock:${projectId}`
    );
  }
  return fn();
}
```

### Rationale
Unifies the resilience layer: both the lock acquisition and the inner write operations are protected by exponential backoff retry mechanics.
