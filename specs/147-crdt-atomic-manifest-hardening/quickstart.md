# Quickstart & Verification Guide: CRDT Atomic Deletion Manifest & Storage Integrity Hardening

**Feature**: `147-crdt-atomic-manifest-hardening`
**Date**: 2026-09-18

## Prerequisites

- Node.js runtime with npm installed.
- Repository checked out at branch `147-crdt-atomic-manifest-hardening`.

## Verification Scenarios

### Scenario 1: Verify Atomic Manifest & Catalog Deletion (US1)

- **Objective**: Prove that aborting a deletion transaction leaves zero manifests and keeps catalog data intact.
- **Test Command**:
  ```bash
  npx vitest run src/services/__tests__/projectDeleteQueue.test.ts -t "atomic manifest"
  ```
- **Expected Outcome**:
  - Aborted project deletions leave 0 records in `deletion_manifests`.
  - Catalog records in `projects` and `chapters` remain completely untouched.
  - Active physical CRDT databases are not deleted.

---

### Scenario 2: Verify Single Chapter Deletion Manifest & Recovery (US2)

- **Objective**: Prove that `deleteChapterFromDB` writes a deletion manifest atomically and cleans up on recovery if interrupted.
- **Test Command**:
  ```bash
  npx vitest run src/services/__tests__/projectDeleteQueue.test.ts -t "single chapter manifest"
  ```
- **Expected Outcome**:
  - `deleteChapterFromDB` writes a manifest with `chapterIds: [id]` and `physicalDbNames: ['crdt_${projectId}_${id}']`.
  - After interrupted deletion, `recoverPendingDeletions()` deletes the physical database and cleans the manifest.

---

### Scenario 3: Verify Cross-Boundary Chapter Ownership Guard (US3)

- **Objective**: Prove that `saveProjectToDB` and `atomicSaveProjectBundle` reject re-parenting existing chapters.
- **Test Command**:
  ```bash
  npx vitest run src/services/__tests__/projectDeleteQueue.test.ts -t "re-parent"
  ```
- **Expected Outcome**:
  - Passing a foreign chapter ID to `saveProjectToDB` throws `Relational integrity violation`.
  - Passing a foreign chapter ID to `atomicSaveProjectBundle` aborts transaction and throws before any write occurs.

---

### Scenario 4: Verify Fail-Closed Persistence Release & Recovery Discovery (US4)

- **Objective**: Prove that destroy failures stop physical DB deletion and manifest read errors are propagated.
- **Test Command**:
  ```bash
  npx vitest run src/services/__tests__/projectDeleteQueue.test.ts -t "fail-closed"
  ```
- **Expected Outcome**:
  - When `destroyCrdtPersistence` throws, `deleteChapterCrdtDatabase` rejects and does not delete the database.
  - When manifest read throws, `recoverPendingDeletions` does not return clean `{ recoveredCount: 0, failedCount: 0 }`.

---

## Full Quality Gate Command Sequence

Per Project Constitution Principle I:
```bash
npm run lint    # tsc --noEmit
npm test        # vitest run
npm run build   # tsc && vite build
```
