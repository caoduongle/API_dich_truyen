# Research & Architectural Decisions: Storage Security & Consistency Hardening

**Feature**: `141-storage-and-credential-hardening`  
**Date**: 2026-09-17  
**Status**: Completed  

---

## 1. Research Topic: Project Deletion Race Condition & Write Queue Serialization

### Context & Problem
In `src/services/db.ts`, `saveProjectToDB` and `atomicSaveProjectBundle` use `projectWriteChains.set(projectId, nextChain)` to ensure per-project write serialization. However, `deleteProjectFromDB(id)` opened an independent `IDBTransaction` directly via `withRetry()`, completely bypassing `projectWriteChains`.
In `src/hooks/useProjects.ts`, `handleUpdateProject` dispatches `enqueueProjectSave(updatedProj)`, and immediately afterwards a user can trigger `handleDeleteProject(id)`. Because `deleteProjectFromDB(id)` was not queued on `projectWriteChains.get(id)`, the delete could execute and finish *before* the queued save, and then the save would write the deleted project back into IndexedDB ("resurrection bug").

### Decision
1. Wrap `deleteProjectFromDB(id: string)` in `projectWriteChains.get(id)`.
2. Execution flow:
   ```ts
   export const deleteProjectFromDB = async (id: string): Promise<void> => {
     if (!id) return;
     const currentChain = projectWriteChains.get(id) || Promise.resolve();
     const nextChain = currentChain
       .catch(() => {})
       .then(async () => {
         await executeDeleteProjectFromDB(id);
       })
       .finally(() => {
         if (projectWriteChains.get(id) === nextChain) {
           projectWriteChains.delete(id);
         }
       });
     projectWriteChains.set(id, nextChain);
     return nextChain;
   };
   ```
3. In addition, attach the `.finally()` cleanup to `saveProjectToDB` and `atomicSaveProjectBundle` so when the last queued operation for a `projectId` settles, the entry is deleted from the `projectWriteChains` Map.

### Alternatives Considered
- *Global write lock (Single Mutex)*: Rejected because writes to project A should not block writes or deletes on project B. Per-project chaining gives maximum concurrency while preventing races on the same project.
- *Canceling pending saves*: In JavaScript/IndexedDB, once a promise chain has started or is queued, aborting scheduled microtasks requires complex abort controllers and can cause inconsistent in-memory state. Queueing delete behind pending saves guarantees clean FIFO ordering: the delete naturally runs last and leaves the store empty.

---

## 2. Research Topic: API Key LocalStorage Policy & Storage Integrity Audit

### Context & Problem
The application allows users to store API keys across browser sessions via the "Ghi nhớ API Key trên trình duyệt này" (`rememberKeys`) toggle in Settings (default: ON).
In `useAIConfig.ts`, keys are synced to `sessionStorage['gemini_api_keys']` and, if `rememberKeys === true`, to `localStorage.app_ui_prefs.savedKeys`.
However:
1. `storageAudit.ts` declared an invariant that no API keys should ever be in `localStorage`, but its checker `verifyStorageIntegrity()` only checked `localStorage.getItem('gemini_api_keys')`. It never checked `app_ui_prefs.savedKeys`.
2. This created a policy mismatch between the security documentation / audit checker and the runtime behavior.
3. User instruction: **Do NOT eliminate `rememberKeys`**. Keep it as an explicit user toggle in settings, defaulted to ON (`true`).

### Decision
1. **Harmonize Policy**:
   - `gemini_api_keys` (un-nested root key in `localStorage`): **Forbidden**. Always migrated to session and purged.
   - `app_ui_prefs.savedKeys`: **Permitted ONLY when `rememberKeys === true`** (or unset, defaulting to true). This represents user-authorized convenience storage on the local client machine.
   - If `rememberKeys === false`: `savedKeys` **MUST be empty (`[]`)**.
2. **Upgrade `verifyStorageIntegrity()`**:
   - Inspect `localStorage.getItem('app_ui_prefs')`.
   - Parse JSON safely. If `prefs.rememberKeys === false` and `Array.isArray(prefs.savedKeys)` with length > 0: flag a critical security violation (`"Phát hiện API key trong localStorage khi tùy chọn rememberKeys đã bị tắt"`).
   - If raw un-nested keys (`gemini_api_keys`) exist: flag violation.
3. **Upgrade `sanitizeLocalStorage()`**:
   - If `rememberKeys === false` but `savedKeys` contains keys: update `app_ui_prefs` with `savedKeys: []`.
   - If `gemini_api_keys` exists: remove it.
4. **Update `useAIConfig.ts`**:
   - When `rememberKeys` is toggled to `false`, immediately update `app_ui_prefs` with `savedKeys: []`.
   - When application loads: if `app_ui_prefs.rememberKeys === false` and `savedKeys` has remnants, clean them.

### Alternatives Considered
- *Encrypt keys in localStorage with a fixed client key*: False sense of security; symmetric keys embedded in client JS provide 0 additional security against XSS or physical access over plain localStorage.
- *Force session-only storage (remove rememberKeys)*: Rejected per user instruction; users with multiple keys need persistent convenience across reboots.

---

## 3. Research Topic: Atomic Google Drive Legacy Restore

### Context & Problem
In `src/services/google-drive/driveProjectSync.ts`, `pullAllFromDrive()` handles monolithic sync:
```ts
if (action === 'pull' && remote) {
  if (remote.projectFileId) {
    const projectData = await client.downloadJsonFile<StoryProject>(...);
    await saveProjectToDB(projectData);
  }
  if (remote.chaptersFileId) {
    const chaptersData = await client.downloadJsonFile<Chapter[]>(...);
    for (const chap of chaptersData) {
      await saveChapterToDB(chap);
    }
  }
}
```
If downloading `chapters_${id}.json` fails or throws halfway through the loop, the project metadata is already saved in IndexedDB, but chapters are missing or partially imported.

### Decision
Refactor legacy restore in `pullAllFromDrive()` to download both files into memory first, and then commit them in one atomic transaction using the existing `atomicSaveProjectBundle()`:
```ts
} else if (action === 'pull' && remote) {
  let projectData: StoryProject | null = null;
  let chaptersData: Chapter[] = [];

  if (remote.projectFileId) {
    projectData = await client.downloadJsonFile<StoryProject>(accessToken, remote.projectFileId);
  }
  if (remote.chaptersFileId) {
    chaptersData = await client.downloadJsonFile<Chapter[]>(accessToken, remote.chaptersFileId);
  }

  if (projectData) {
    await atomicSaveProjectBundle(projectData, chaptersData || []);
  }
  downloadedCount++;
}
```
If either download fails, an exception is thrown before any IndexedDB transaction is opened, leaving the local database completely untouched.

---

## 4. Research Topic: Canonical CRDT Store Name Standardization

### Context & Problem
Production migration `src/services/dbMigration.ts` creates `CRDT_STATES_STORE = 'crdt_states'`.
However, several specifications and contract documents (`spec-140`, `data-model.md`) referenced `crdt_docs`.
In `src/services/db.ts`, `atomicSaveProjectBundle` used a runtime fallback checking both `crdt_states` and `crdt_docs`.

### Decision
1. Declare `crdt_states` as the official canonical store name in all specifications, type definitions, and architecture contracts.
2. Maintain the runtime fallback `db.objectStoreNames.contains('crdt_docs')` in `db.ts` and `dbMigration.ts` purely as a backward-compatible safety net for pre-existing local databases.

---

## 5. Research Topic: Gemini Error Classification & 404 Key Rotation Filter

### Context & Problem
In `src/services/gemini/geminiErrorClassifier.ts`, HTTP 404 (or model not found) was unhandled and fell into category `UNRECOGNIZED` with `isRetryable: true`.
In `src/services/gemini/geminiClient.ts`, lines 107-117:
- HTTP 400 stops retry (`if (response.status === 400) throw lastError;`).
- HTTP 404, however, falls through and triggers `findNextKey()`, rotating across all configured API keys.
If a user selects an invalid or deprecated model name, every key in the pool will receive a 404, causing delays, burning retry counts, and incrementing failure statistics against healthy API keys.

### Decision
1. Update `geminiErrorClassifier.ts`:
   ```ts
   if (httpStatus === 404) {
     return {
       category: 'RESOURCE_NOT_FOUND',
       httpStatus: 404,
       rpcStatus: 'NOT_FOUND',
       reason: 'ModelOrResourceNotFound',
       details,
       recommendedCooldownMs: 0,
       isRetryable: false,
       message: `Mô hình AI hoặc tài nguyên không tồn tại (HTTP 404): ${message}`,
     };
   }
   ```
2. In `geminiClient.ts`:
   ```ts
   if (response.status === 400 || response.status === 404 || classified.category === 'RESOURCE_NOT_FOUND') {
     throw lastError;
   }
   ```
   Do not rotate keys or record retry. Fail fast immediately.

---

## 6. Research Topic: Bilingual Splitter Token Estimation Heuristic

### Context & Problem
`maxTokensPerChunk` in `src/services/translation/bilingualSplit.ts` packs bilingual text into chunks using `estimateTokenCount()`.
Because `estimateTokenCount` is a heuristic (1.1-1.25 tokens/word for Latin/Vietnamese, character estimation for CJK), and because the algorithm deliberately avoids splitting a single paragraph to preserve semantic coherence, a single paragraph that exceeds `maxTokensPerChunk` will form a chunk by itself with `estimatedTokens > maxTokensPerChunk`.
Furthermore, actual Gemini request payloads contain prompts, system instructions, and schema definitions.

### Decision
1. Retain the greedy paragraph-preserving algorithm (it is functionally correct).
2. Clarify in code comments and interface JSDoc (`src/services/translation/types.ts`):
   - `maxTokensPerChunk` is a soft target packing heuristic (`Target packing budget`), NOT a hard provider token ceiling.
   - Individual paragraphs exceeding `maxTokensPerChunk` are kept intact by design.

---

## 7. Research Topic: Architecture Documentation & Storage Tier Registry Alignment

### Context & Problem
`src/utils/storageAudit.ts` defined `sourceOfTruth` types as `ServerSession`, `ServerQuota`, `ServerModelRegistry`, `ServerCache`, which was inherited from an earlier Express/Redis server architecture. The project is now a pure client-side SPA.

### Decision
Update `StorageTierContract` in `src/utils/storageAudit.ts`:
```ts
export interface StorageTierContract {
  domain: StorageDomain;
  sourceOfTruth:
    | 'IndexedDB'
    | 'SessionStorage'
    | 'LocalStorage'
    | 'ReactMemory'
    | 'EphemeralMemory';
  cacheLayer: 'None' | 'ReactMemory' | 'LocalStorage';
  ...
}
```
Update all entries in `STORAGE_TIER_REGISTRY` to align 100% with the client-side architecture.
