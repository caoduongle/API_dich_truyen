# Research & Architectural Decisions: Project Write Boundary Serialization & Quota Error Isolation

**Feature**: `142-project-write-boundary`  
**Date**: 2026-09-17  
**Status**: Completed  

---

## 1. Research Topic: Chapter & CRDT Write Boundary Serialization & Orphan Record Prevention

### Context & Problem
In `3744d6a`, `deleteProjectFromDB(id)` was unified with `saveProjectToDB` and `atomicSaveProjectBundle` through `projectWriteChains.get(projectId)`.
However:
1. `saveChapterToDB(chapter)` and `saveChaptersToDB(chapters)` still executed on an independent write path without queueing on `projectWriteChains`.
2. `saveCrdtState(record)` and `saveCrdtStates(records)` also bypassed `projectWriteChains`.
3. If an auto-save operation (`useChapterCRDT.ts`) or Google Drive granular sync (`driveGranularSync.ts`) writes a chapter while `deleteProjectFromDB(projectId)` is executing or queued, the chapter write can settle after deletion, causing child-record resurrection (orphan chapters and dangling CRDT states in IndexedDB).

### Decision
1. **Unified Project-Level Boundary**:
   All operations targeting records within a project's write set (`projects`, `chapters`, `crdt_states`) must serialize through `projectWriteChains.get(projectId)`:
   - `saveProjectToDB(project)`
   - `atomicSaveProjectBundle(project, chapters, crdtStates)`
   - `deleteProjectFromDB(projectId)`
   - `saveChapterToDB(chapter)`
   - `saveChaptersToDB(chapters)`
   - `saveCrdtState(record)`
   - `saveCrdtStates(records)`

2. **Parent Existence Guard (Tombstone / Deletion Guard)**:
   When `saveChapterToDB` or `saveCrdtState` executes from the queue:
   - Inspect whether the parent project exists in `PROJECTS_STORE`.
   - If the parent project does not exist (was deleted), cleanly abort the write without writing to `chapters` or `crdt_states`.
   - If `chapter.projectId` is not provided on incoming payload, resolve `projectId` by looking up the existing record in `CHAPTERS_STORE`.

3. **Memory Cleanup**:
   Every chained promise attaches `.finally()` to delete `projectWriteChains.delete(projectId)` once settled if no newer operations are queued for that project.

---

## 2. Research Topic: Gemini HTTP 404 / Model Not Found Quota Semantics

### Context & Problem
In commit `3744d6a`, HTTP 404 was added to `classifyGeminiError` as non-retryable `RESOURCE_NOT_FOUND`, and `geminiClient.ts` stops immediately without rotating keys.
However:
1. Before failing fast, `geminiClient.ts` called `localQuotaTracker.recordFailure(currentKey, modelName, ...)`.
2. `recordFailure` increments `failedAttemptsTotal`, `keyStats.errorsTotal`, and `keyStats.consecutiveErrors`, and may trip `circuitBreakerStatus` to `Degraded`.
3. An HTTP 404 response (model not found, invalid model name, deprecated API path) is a resource/configuration error, NOT a failure of the API key credential or key quota limit.
4. Marking the key as having an error skews local quota statistics and unfairly penalizes a valid API key.

### Decision
1. **Separate Non-Credential Model Errors**:
   In `geminiClient.ts`, if `response.status === 404` or `classified.category === 'RESOURCE_NOT_FOUND'`:
   - `recordProviderAttempt()` has already recorded the outbound HTTP attempt.
   - Do **NOT** call `localQuotaTracker.recordFailure()`.
   - The key's health metrics (`errorsTotal`, `consecutiveErrors`, `circuitBreakerStatus`, `healthState`) remain completely untouched and clean.
   - Fail fast immediately: throw `RESOURCE_NOT_FOUND` without rotating to subsequent keys and without retry.
2. **Logical Request Failure Tracking**:
   The outer `callGemini()` wrapper catches the error and calls `localQuotaTracker.recordLogicalFailure()`, accurately recording that the user's logical translation request did not succeed, while keeping individual API keys healthy.

---

## 3. Research Topic: Cross-Tab Project Serialization via Web Locks API

### Context & Problem
`projectWriteChains` is an in-memory `Map` within a single JavaScript execution context.
If a user has multiple tabs open on the same novel:
1. Tab A may auto-save chapter 1 while Tab B deletes the project.
2. Tab A and Tab B have separate `projectWriteChains` Maps and cannot synchronize via in-memory promises.
3. IndexedDB transactions serialize individual transactions, but do not prevent race conditions between distinct read-modify-write chains across tabs.

### Decision
1. **Web Locks API (`navigator.locks`) Integration**:
   - Modern browsers (Chrome 69+, Edge 79+, Firefox 96+, Safari 15.4+) support the standard Web Locks API (`navigator.locks`).
   - Wrap project-level write operations in `withProjectLock(projectId, callback)`:
     ```ts
     export async function withProjectLock<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
       if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
         return navigator.locks.request(`project-write-${projectId}`, async () => fn());
       }
       return fn();
     }
     ```
   - In Node.js test environments or legacy browsers where `navigator.locks` is undefined, `withProjectLock` transparently falls back to executing `fn()` directly.
   - Inside `fn()`, `projectWriteChains` handles microtask and promise queueing.
   - Zero external libraries required. Strict compliance with Constitution Principle II.
