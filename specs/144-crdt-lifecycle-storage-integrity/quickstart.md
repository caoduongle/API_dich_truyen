# Quickstart: CRDT Lifecycle, Storage Integrity, and Lock Isolation Hardening

**Feature**: `144-crdt-lifecycle-storage-integrity`  
**Date**: 2026-09-17

---

## Overview

This guide explains how to verify the storage hardening and CRDT lifecycle integrity improvements across the test suite and local environment.

---

## 1. Automated Verification Commands

Run the full verification battery from repository root:

```bash
# 1. TypeScript type check
npm run lint

# 2. Run unit and integration tests
npm test

# 3. Production build
npm run build
```

---

## 2. Targeted Test Suites

To verify specific aspects of this feature directly:

```bash
# Verify project delete queue, CRDT database deletion, and prefix safety
npx vitest run src/services/__tests__/projectDeleteQueue.test.ts

# Verify Web Lock isolation and single callback execution on errors
npx vitest run src/services/__tests__/projectWriteLock.test.ts

# Verify chapter deletion and CRDT state synchronization
npx vitest run src/hooks/__tests__/useChapterCRDT.test.ts
```

---

## 3. Key Scenarios Covered

1. **Physical CRDT DB Deletion**: `deleteProjectCrdtDatabases` waits for `onsuccess` and does not resolve on `onblocked` or `onerror`.
2. **No Prefix Collisions**: Project `proj_100` does not delete `crdt_proj_100_200_chap1`.
3. **Single Chapter Cleanup**: Deleting Chapter A removes its records from `chapters` and `crdt_states`, and deletes database `crdt_${projectId}_${chapterId}`.
4. **Lock Retry Isolation**: If a callback throws inside `withProjectLock`, `navigator.locks.request` resolves without retrying the callback.
5. **Fail-Closed CRDT Saves**: `saveCrdtState` and `saveCrdtStates` reject/omit records lacking `projectId`.
6. **Project Bundle Mismatch Protection**: `atomicSaveProjectBundle` rejects bundles where any CRDT item has a conflicting `projectId`.
7. **Undo Durability**: Project deletion undo restores project, chapters, and CRDT states.
