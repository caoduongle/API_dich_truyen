# Quickstart & Validation Guide

## Validation Workflow

This feature relies on automated unit tests to verify the new storage invariants.

### Prerequisites

Ensure you have the latest dependencies and the test suite is functional.

```bash
npm install
```

### Run Tests

Run the CRDT storage specific tests:

```bash
npm run test -- src/services/__tests__/projectDeleteQueue.test.ts src/services/__tests__/bundleSync.test.ts
```

Or run all tests:

```bash
npm test
```

### Expected Outcomes

1. `atomicSaveProjectBundle` will throw an error if passed a CRDT state that doesn't correspond to the provided chapters, or if the `projectId` fields mismatch.
2. `deleteChapterFromDB` will throw an error if the chapter does not exist in the DB, instead of silently succeeding or returning.
3. `getCrdtState` will return `null` if the expected project ID is passed and does not match the actual record.
4. No type errors during `npm run lint`.
