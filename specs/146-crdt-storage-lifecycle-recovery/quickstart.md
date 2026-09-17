# Quickstart: CRDT Storage Lifecycle Recovery and Invariant Hardening

## Overview
This guide provides actionable verification procedures to validate durable deletion manifests, startup recovery, strict rejection semantics for ownership violations, atomic snapshot+delete critical sections, canonical project ID verification, and fail-closed persistence cleanup.

---

## 1. Prerequisites & Quality Gates
Before running tests, ensure the environment is configured:

```bash
# Type check (MUST be clean)
npm run lint

# Run all unit tests
npm test

# Verify production build
npm run build
```

---

## 2. Automated Test Verification

### Scenario 1: Recovery of Orphan Physical DBs via Deletion Manifest (P1)
**Objective**: Verify that when physical database deletion is interrupted or fails, the durable manifest is preserved and startup recovery (`recoverPendingDeletions`) purges the remaining physical databases.

**Command**:
```bash
npx vitest run src/services/__tests__/projectDeleteQueue.test.ts -t "recovers pending physical databases from deletion manifest"
```

**Expected Outcome**:
- Deletion manifest is recorded with `status: 'pending'` before catalog commits.
- If physical deletion fails, the manifest remains in `deletion_manifests`.
- Calling `recoverPendingDeletions()` detects the pending manifest, deletes the physical databases, and retires the manifest.

---

### Scenario 2: Strict Rejection on Relational Ownership Violations (P1)
**Objective**: Verify that attempting to re-parent an existing chapter, or saving CRDT state for a missing chapter / mismatched project, actively rejects the Promise instead of silently dropping the write.

**Command**:
```bash
npx vitest run src/services/__tests__/projectDeleteQueue.test.ts -t "rejects on ownership violation"
```

**Expected Outcome**:
- `saveChapterToDB` with mismatched `projectId` rejects with `Relational integrity violation`.
- `saveCrdtState` with non-existent `chapterId` rejects with `Chapter does not exist`.
- `saveCrdtState` with mismatched `projectId` rejects with `Relational integrity violation`.
- Zero silent drops: the Promise rejects.

---

### Scenario 3: Atomic Critical Section for Deletion Snapshot and Removal (P2)
**Objective**: Verify that capturing an undo backup snapshot and executing project deletion occur within an unbroken exclusive lock, preventing intervening autosave writes.

**Command**:
```bash
npx vitest run src/hooks/__tests__/useProjects.test.ts -t "exclusive section"
```

**Expected Outcome**:
- In-flight writes are flushed, snapshot is captured, and deletion executes within `runInProjectExclusiveSection`.
- No newly arrived edits can be enqueued or executed between snapshot read and deletion commit.

---

### Scenario 4: Canonical `projectId` Enforcement in Chapter Operations (P2)
**Objective**: Verify that `deleteChapterFromDB` rejects if caller supplies a conflicting `projectId`, and that editor CRDT hydration ignores state records from mismatched projects.

**Command**:
```bash
npx vitest run src/services/__tests__/projectDeleteQueue.test.ts -t "canonical projectId"
```

**Expected Outcome**:
- `deleteChapterFromDB('c1', 'wrong_proj')` rejects with `Mismatched projectId`.
- `deleteChapterFromDB('c1')` automatically resolves and uses the chapter's stored `projectId`.
- `useChapterCRDT` aborts hydration if `crdtRecord.projectId !== currentProjectId`.

---

### Scenario 5: Fail-Closed Discovery and Safe Persistence Destruction (P2)
**Objective**: Verify that discovery errors during deletion reject rather than proceeding partially, and persistence providers are retained in registry if closure fails.

**Command**:
```bash
npx vitest run src/services/__tests__/projectDeleteQueue.test.ts -t "fail-closed discovery"
```

**Expected Outcome**:
- If `deleteProjectCrdtDatabases` encounters a discovery error, it rejects immediately.
- If `destroyCrdtPersistence` encounters a provider error, the provider reference is kept in the registry for subsequent retry.
