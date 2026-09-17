# Quickstart: CRDT Deletion Error Propagation and Undo Integrity Hardening

## Overview
This guide provides actionable verification procedures to validate that storage deletion error propagation, editor CRDT undo hydration, backup snapshot consistency, comprehensive chapter discovery, and relational foreign-key integrity function correctly.

---

## 1. Prerequisites & Quality Gates
Before running tests, ensure the environment is configured and dependencies are installed.

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

### Scenario 1: Fail-Closed Rejection on CRDT Database Deletion Error (P1)
**Objective**: Verify that when `indexedDB.deleteDatabase` errors or times out on `onblocked`, `deleteProjectFromDB` and `deleteChapterFromDB` reject rather than swallowing the error.

**Command**:
```bash
npx vitest run src/services/__tests__/projectDeleteQueue.test.ts -t "rejects when deleteDatabase errors out"
```

**Expected Outcome**:
- `deleteProjectFromDB('p_err')` rejects with the underlying database deletion error.
- `deleteChapterFromDB('c_err', 'p_err')` rejects with the underlying database deletion error.
- Zero false-positive success resolutions when physical databases cannot be deleted.

---

### Scenario 2: Editor CRDT State Hydration on Undo Reopening (P2)
**Objective**: Verify that when a deleted project or chapter is restored via Undo, opening the chapter in `useChapterCRDT` hydates the Y.Doc from the restored `crdt_states` snapshot.

**Command**:
```bash
npx vitest run src/hooks/__tests__/useChapterCRDT.test.ts
```

**Expected Outcome**:
- `doc.getText('rawTranslation')` and `doc.getText('polishedTranslation')` contain the restored state.
- `IndexeddbPersistence` automatically re-persists the restored document updates into the newly created dedicated database.

---

### Scenario 3: Snapshot Consistency for Deletion Undo (P2)
**Objective**: Verify that deleting a project immediately after a rapid write operation awaits write completion before capturing the undo snapshot.

**Command**:
```bash
npx vitest run src/hooks/__tests__/useProjects.test.ts -t "Undo"
```

**Expected Outcome**:
- `waitForQueueIdle` flushes pending saves before `getChaptersByProjectFromDB` and `getCrdtStatesByProject` run.
- Restoring via Undo restores the latest modifications, not outdated state.

---

### Scenario 4: Exhaustive Chapter Discovery & Bulk Cleanup (P2)
**Objective**: Verify that project deletion derives chapter IDs from `project.chapters`, `chapters` store, and `crdt_states` store, and that `deleteChaptersByProjectFromDB` purges CRDT states and databases.

**Command**:
```bash
npx vitest run src/services/__tests__/projectDeleteQueue.test.ts -t "exhaustive"
```

**Expected Outcome**:
- Chapters present only in `project.chapters` are targeted and their dedicated databases purged.
- `deleteChaptersByProjectFromDB` deletes entries from `CHAPTERS_STORE`, `CRDT_STATES_STORE`, and purges dedicated databases.

---

### Scenario 5: Relational Foreign-Key Ownership Integrity (P2)
**Objective**: Verify that saving a chapter under a mismatched `projectId` or saving CRDT state for a chapter belonging to another project fails closed.

**Command**:
```bash
npx vitest run src/services/__tests__/projectDeleteQueue.test.ts -t "foreign-key"
```

**Expected Outcome**:
- Attempting to save an existing chapter with a different `projectId` aborts without overwriting.
- Attempting to save CRDT state with a mismatched project association aborts without corrupting storage.

---

### Scenario 6: Multi-Instance Persistence Registry & Collision Isolation (P2)
**Objective**: Verify that multiple providers per `dbName` are all destroyed, and that project provider cleanup does not touch projects sharing prefix substrings (e.g. `proj_100` vs `proj_100_200`).

**Command**:
```bash
npx vitest run src/services/__tests__/projectDeleteQueue.test.ts -t "registry"
```

**Expected Outcome**:
- Multiple registered providers for a single `dbName` are all invoked with `destroy()`.
- Destroying providers for `proj_100` leaves providers for `proj_100_200` active and intact.
