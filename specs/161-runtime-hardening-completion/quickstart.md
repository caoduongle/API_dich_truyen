# Quickstart: Runtime Hardening Completion & Architecture Polish

**Feature**: `161-runtime-hardening-completion`  
**Date**: 2026-09-23  

This guide provides runnable scenarios to verify the 5 runtime architecture and error hardening improvements.

---

## 1. Prerequisites & Environment Setup

Verify local node environment and install dependencies:
```bash
node -v   # Expected: v20.x or v24.x LTS
npm test -- --version
```

---

## 2. Test Execution Commands

### Scenario 1: Quota Ingestion Symmetrical Cap 100
Verify that `LocalQuotaTracker.loadFromStorage()` caps both key and model `recentAttempts` and `recentTokens` at 100 entries when reading corrupted or bloated storage:
```bash
npm test -- src/services/__tests__/localQuotaTracker.test.ts
```
**Expected Outcome**: New test scenario verifies that passing an array with >100 valid items results in strictly 100 entries loaded into in-memory state.

---

### Scenario 2: Debounced Storage on `recordFailure`
Verify that `recordFailure()` schedules a 300ms debounce instead of calling `flushToStorage()` synchronously:
```bash
npm test -- src/services/__tests__/localQuotaDebounce.test.ts
```
**Expected Outcome**: Storage writes are deferred during rapid consecutive failures and flushed on lifecycle events.

---

### Scenario 3: Complete Structured `GeminiRequestError` Hierarchy
Verify that `RESOURCE_NOT_FOUND`, `BAD_REQUEST`, `ALL_KEYS_EXHAUSTED`, and `ETIMEDOUT` errors thrown by the Gemini client are instances of `GeminiRequestError` without dynamic property monkey-patching:
```bash
npm test -- src/services/gemini/__tests__/geminiClient.test.ts
```
**Expected Outcome**: Assertions verify `error instanceof GeminiRequestError` and check `error.code` across all failure scenarios.

---

### Scenario 4: Type-Safe Error Handling in Direct Glossary Engine
Verify that `directGlossaryEngine.ts` handles errors safely with `unknown` and `getErrorMessage`:
```bash
npm test -- src/services/__tests__/directGlossaryEngine.test.ts
```
**Expected Outcome**: All 6 tests pass without runtime exceptions or type-casting issues.

---

### Scenario 5: Full Quality Gate & Build Verification
Verify repository-wide type safety, full test pass, and production build:
```bash
npm run lint    # Type check (tsc --noEmit)
npm test        # All 98 test files / 946+ tests
npm run build   # Production bundle build
```
**Expected Outcome**: 0 lint errors, 100% test pass, clean production build in `dist/`.
