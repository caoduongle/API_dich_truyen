# Quickstart Validation Guide: CRDT Storage Cleanup & Transaction Durability

**Feature**: `143-storage-hardening-crdt-cleanup`
**Date**: 2026-09-17

## Prerequisites
- Node.js environment with dependencies installed (`node_modules`).
- Unit test runner (`npm test` / Vitest).

## Validation Scenarios

### Scenario 1: CRDT Database Cleanup on Project Deletion
1. Create a project `p_test_1` with chapters `c1`, `c2`.
2. Open fake or real IndexedDB databases named `crdt_p_test_1_c1` and `crdt_p_test_1_c2`.
3. Invoke `deleteProjectFromDB('p_test_1')`.
4. Verify that `indexedDB.deleteDatabase` was called for `crdt_p_test_1_c1` and `crdt_p_test_1_c2`, leaving zero leftover CRDT databases on disk.

### Scenario 2: Fail-Closed Orphan Guard for Unparented Chapters
1. Invoke `saveChapterToDB({ id: 'chap_new_orphan', title: 'Orphan' } as any)`.
2. Verify that the function logs a warning and returns cleanly.
3. Verify that `getChapterFromDB('chap_new_orphan')` returns `null` or `undefined` (no orphan record written).

### Scenario 3: Transaction Completion Timing
1. Hook an IndexedDB transaction during `saveChapterToDB`.
2. Track timestamp when `putRequest.onsuccess` fires vs when the returned promise resolves.
3. Verify that resolution happens strictly on `transaction.oncomplete`.

### Scenario 4: Web Lock Acquisition Retry
1. Mock `navigator.locks.request` to fail with transient rejection on the first call and succeed on the second.
2. Invoke `withProjectLock('p_retry', async () => 'ok')`.
3. Verify that the function retries and returns `'ok'`.

## Test Execution Commands
```bash
npm test -- src/services/__tests__/projectDeleteQueue.test.ts
npm test -- src/services/__tests__/projectWriteLock.test.ts
npm run lint
npm test
npm run build
```
