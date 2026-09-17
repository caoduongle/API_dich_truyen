# Quickstart: Project Write Boundary Serialization & Quota Error Isolation

**Feature**: `142-project-write-boundary`  
**Date**: 2026-09-17  

---

## Overview
This feature completes storage and quota hardening by:
1. Routing all chapter (`saveChapterToDB`, `saveChaptersToDB`) and CRDT state writes (`saveCrdtState`, `saveCrdtStates`) through the same project serialization boundary (`projectWriteChains.get(projectId)`) as project saves and deletions.
2. Preventing child-record resurrection: If a parent project has been deleted, subsequent queued chapter or CRDT writes cleanly abort without creating orphan records in IndexedDB.
3. Isolating Gemini HTTP 404 (`RESOURCE_NOT_FOUND`) errors from API key error tracking so valid keys are not penalized for model/endpoint errors.
4. Providing cross-tab project serialization using the Web Locks API (`navigator.locks`) with seamless in-memory fallback.

---

## 1. Verifying Project Write Serialization & Orphan Resurrection Guard

Run the dedicated test suite simulating concurrent chapter writes and project deletion:
```bash
npx vitest run src/services/__tests__/projectDeleteQueue.test.ts
```

### Scenario Tested
- **Test 1**: Concurrent chapter save and project delete. Verifies chapter save completes, followed by project delete, leaving 0 chapters and 0 project records.
- **Test 2**: Chapter save queued *after* project delete has committed. Verifies the chapter write checks parent existence, aborts cleanly, and creates 0 orphan records.
- **Test 3**: In-memory `projectWriteChains` Map cleans up settled promises to prevent memory leaks.

---

## 2. Verifying Gemini 404 Non-Credential Quota Semantics

Run the Gemini client test suite:
```bash
npx vitest run src/services/gemini/__tests__/geminiClient.test.ts
```

### Scenario Tested
- Simulates HTTP 404 from Gemini API.
- Asserts request fails fast on attempt 1 with `RESOURCE_NOT_FOUND`.
- Asserts keys 2..N are NOT called (no rotation).
- Asserts `localQuotaTracker.getQuotaStatus()` shows:
  - `retriesTotal === 0`
  - `keyStats.errorsTotal === 0` (no key health penalty)
  - `keyStats.consecutiveErrors === 0`
  - `keyStats.healthState !== 'QuotaExhausted'` and not degraded by 404

---

## 3. Mandatory Constitution Quality Gates

Run all three non-negotiable quality checks:
```bash
npm run lint    # TypeScript typecheck (must be 0 errors)
npm test        # Vitest suite (must pass 100%)
npm run build   # Production bundle build (must succeed)
```
