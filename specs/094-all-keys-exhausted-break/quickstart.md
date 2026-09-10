# Quickstart: All API Keys Exhausted Fast-Break Verification

**Feature**: `094-all-keys-exhausted-break`  
**Date**: 2026-09-10  
**Status**: Ready  

## 1. Automated Test Verification

Run targeted unit tests for `hakoQualityEngine`:
```powershell
npx vitest run src/services/__tests__/hakoQualityEngine.test.ts
```

**Expected Results**:
1. All existing heuristic and report generator tests pass.
2. New test case executes:
   - Sets up 3 chapters.
   - Mocks `callGeminiDirect` to throw `err` with `err.code = 'ALL_KEYS_EXHAUSTED'` on Chapter 1.
   - Asserts:
     - `callGeminiDirect` is called exactly 1 time (not 3 times).
     - Returned `issues` contains exactly 1 warning issue (not 3 issues).
     - Issue explanation indicates quota exhaustion.

## 2. Full Quality Gate Verification

```powershell
npm run lint
npm test
npm run build
```

**Expected Results**: All quality gates pass with 0 errors.
