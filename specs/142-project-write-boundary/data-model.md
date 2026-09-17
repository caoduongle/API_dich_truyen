# Data Model & Storage Schema: Project Write Boundary Serialization & Quota Error Isolation

**Feature**: `142-project-write-boundary`  
**Date**: 2026-09-17  
**Status**: Completed  

---

## 1. Storage Domain Entities & Serialization Boundary Mapping

| Entity | Primary Store | Storage Scope | Serialization Boundary | Eviction / Deletion Semantics |
| :--- | :--- | :--- | :--- | :--- |
| **StoryProject** | IndexedDB (`projects`) | Persistent Client | `projectWriteChains.get(projectId)` + Web Locks | Explicit user deletion |
| **Chapter** | IndexedDB (`chapters`) | Persistent Client | `projectWriteChains.get(chapter.projectId)` + Web Locks | Cascades with parent project; aborted if project deleted |
| **CRDT State** | IndexedDB (`crdt_states`) | Persistent Client | `projectWriteChains.get(record.projectId)` + Web Locks | Cascades with parent project; aborted if project deleted |
| **Active API Keys** | `sessionStorage['gemini_api_keys']` | Session Ephemeral | In-memory Hook state | Cleared on tab close |
| **Remembered Keys** | `localStorage['app_ui_prefs'].savedKeys` | Persistent Browser | User Preference Hook | Allowed only when `rememberKeys === true` |
| **Quota Metrics** | `LocalQuotaTracker` | Runtime Session | Single Authority Tracker | Reset on PST midnight or session reload |

---

## 2. Project Write Boundary Entity Definitions

### Project Write Chain Map
In `src/services/db.ts`:
```ts
const projectWriteChains = new Map<string, Promise<void>>();
```
- **Key**: `projectId` (string)
- **Value**: `Promise<void>` representing the tail of the FIFO queue for all writes, updates, and deletes involving `projectId`.

### Serialization Operations
The following operations MUST join the `projectWriteChains.get(projectId)` queue:
1. `saveProjectToDB(project)`
2. `atomicSaveProjectBundle(project, chapters, crdtStates)`
3. `deleteProjectFromDB(projectId)`
4. `saveChapterToDB(chapter)`
5. `saveChaptersToDB(chapters)`
6. `saveCrdtState(record)`
7. `saveCrdtStates(records)`

---

## 3. Parent Existence Verification Invariant (Tombstone Guard)

When `saveChapterToDB(chapter)` or `saveCrdtState(record)` executes its internal IndexedDB transaction:
1. Resolve `targetProjectId = chapter.projectId || (lookup existing in DB).projectId`.
2. Within the write operation, query `PROJECTS_STORE.get(targetProjectId)`.
3. **If parent project does NOT exist**:
   - Log diagnostic warning: `[IndexedDB] Aborting write for chapter ${chapter.id}: parent project ${targetProjectId} does not exist.`
   - Abort the put operation cleanly (no-op).
   - Return without persisting an orphan record.
4. **If parent project exists**:
   - Proceed with normal safe merge and put.

---

## 4. Gemini Error Classification & Quota Data Model

In `src/services/gemini/types.ts`:
```ts
export type ClassifiedErrorCategory =
  | 'RATE_LIMIT_RPM'
  | 'QUOTA_EXHAUSTED_RPD'
  | 'AUTH_FAILURE'
  | 'RESOURCE_NOT_FOUND' // Non-retryable, non-credential error
  | 'SERVICE_OVERLOAD'
  | 'CONTENT_BLOCKED'
  | 'NETWORK_FAILURE'
  | 'UNRECOGNIZED';
```

### Quota State Invariant on 404
When `classified.category === 'RESOURCE_NOT_FOUND'`:
- `recordProviderAttempt(key, model, startTime)`: Recorded.
- `recordFailure(key, ...)`: **Omitted**.
- `keyStats.errorsTotal`: Unchanged.
- `keyStats.consecutiveErrors`: Unchanged (0).
- `keyStats.circuitBreakerStatus`: Unchanged (`Closed`).
- `keyStats.healthState`: Unchanged (`Healthy`).
- `summaryStats.logicalRequestsTotal`: Incremented by `recordLogicalStart`.
- `summaryStats.failedRequestsTotal`: Incremented by `recordLogicalFailure`.
