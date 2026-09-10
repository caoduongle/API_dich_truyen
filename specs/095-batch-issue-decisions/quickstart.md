# Quickstart: Batch Issue Decisions & Store Connection Caching

## Verification & Execution Guide

### 1. Run Quality Gates

```bash
# Type check
npm run lint

# Run all unit tests
npm test

# Build production bundle
npm run build
```

### 2. Targeted Unit Test Execution

Run specifically the test suite verifying batch decision update:

```bash
npx vitest run src/hooks/__tests__/useHakoReviewSession.test.ts
```

### 3. Key Test Assertions

The test must assert:
1. Session starts with 20 issues, all in `'pending'` status.
2. `updateMultipleIssueDecisions(issueIds, 'confirmed')` is called once with all 20 IDs.
3. In-memory session state reflects all 20 issues having `decision: 'confirmed'`.
4. `saveSession` spy receives exactly 1 call (`expect(saveSessionSpy).toHaveBeenCalledTimes(1)`).
5. Calling with a partial list of 10 IDs updates only those 10 and leaves the remaining 10 untouched, again calling `saveSession` exactly 1 time.
