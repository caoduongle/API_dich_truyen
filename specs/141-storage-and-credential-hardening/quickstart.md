# Quickstart & Verification Guide: Storage Security & Consistency Hardening

**Feature**: `141-storage-and-credential-hardening`  
**Date**: 2026-09-17  
**Status**: Ready  

---

## 1. Prerequisites & Environment Setup

Run standard quality checks to ensure base stability:
```bash
npm run lint    # tsc --noEmit (Type check)
npm test        # vitest run (Test suite)
npm run build   # tsc && vite build (Production bundle)
```

---

## 2. Validation Scenarios

### Scenario A: Project Delete Serialization (Resurrection Guard)
1. **Target**: `src/services/db.ts` & `src/hooks/useProjects.ts`
2. **Setup**:
   - Create a test project `proj-race-test`.
   - Dispatch a simulated slow write via `saveProjectToDB(project)`.
   - Immediately dispatch `deleteProjectFromDB(project.id)`.
3. **Verification**:
   - Await completion of both operations.
   - Query `getProjectsFromDB()` and `getChaptersByProjectFromDB(project.id)`.
   - Assert project does not exist (0% resurrection).
   - Assert `projectWriteChains` Map does not retain the `proj-race-test` entry after completion.

---

### Scenario B: API Key Persistence Policy & Storage Audit
1. **Target**: `src/hooks/useAIConfig.ts` & `src/utils/storageAudit.ts`
2. **Scenario B1 (Default: `rememberKeys = true`)**:
   - Add API keys `['AIzaSyKey1', 'AIzaSyKey2']`.
   - Inspect `sessionStorage.getItem('gemini_api_keys')` -> Present.
   - Inspect `localStorage.getItem('app_ui_prefs')` -> `savedKeys` matches.
   - Run `verifyStorageIntegrity()` -> `isValid === true`.
3. **Scenario B2 (User toggles `rememberKeys = false`)**:
   - Toggle `rememberKeys` to false.
   - Inspect `localStorage.getItem('app_ui_prefs')` -> `savedKeys: []`.
   - Inspect `sessionStorage.getItem('gemini_api_keys')` -> Still present for active session.
   - Run `verifyStorageIntegrity()` -> `isValid === true`.
4. **Scenario B3 (Violation Detection & Sanitization)**:
   - Manually set `app_ui_prefs` with `{ rememberKeys: false, savedKeys: ['AIzaSyForbidden'] }`.
   - Run `verifyStorageIntegrity()` -> `isValid === false`, flags violation.
   - Run `sanitizeLocalStorage()` -> Purges `savedKeys: []`, restores integrity.

---

### Scenario C: Atomic Google Drive Monolithic Pull
1. **Target**: `src/services/google-drive/driveProjectSync.ts`
2. **Setup**:
   - Mock Google Drive API client returning `project_p1.json` and a corrupted/throwing response for `chapters_p1.json`.
3. **Execution**:
   - Call `pullAllFromDrive()`.
4. **Verification**:
   - Error caught and reported to sync progress callback.
   - Assert IndexedDB stores (`projects` and `chapters`) have 0 records for `p1`.

---

### Scenario D: Gemini Error 404 Key Rotation Filter
1. **Target**: `src/services/gemini/geminiErrorClassifier.ts` & `src/services/gemini/geminiClient.ts`
2. **Setup**:
   - Configure 3 API keys in pool: `['key1', 'key2', 'key3']`.
   - Mock Gemini API returning HTTP 404 with error `"models/invalid-model is not found"`.
3. **Execution**:
   - Call `callGeminiAPI(...)`.
4. **Verification**:
   - Throws `RESOURCE_NOT_FOUND` error on attempt 1.
   - Assert total attempts = 1.
   - Assert keys 2 and 3 were never called or penalized in `localQuotaTracker`.

---

### Scenario E: Canonical CRDT Store & Bilingual Splitter
1. **Target**: `src/services/db.ts` & `src/services/translation/bilingualSplit.ts`
2. **Verification**:
   - Check `atomicSaveProjectBundle` uses `crdt_states` as canonical.
   - Run bilingual splitter tests; verify documentation and paragraph boundary preservation tests pass.
