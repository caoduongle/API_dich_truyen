# Walkthrough: Runtime Hardening Completion & Architecture Polish

**Feature**: `161-runtime-hardening-completion`  
**Status**: Completed  
**Date**: 2026-09-23  

---

## 1. Overview of Changes

This feature completes the 5 architectural hardening and runtime reliability priorities identified for API_dich_truyen:

1. **Quota Tracker Ingestion Symmetrical Bounding (US1)**:
   - Symmetrically capped `recentAttempts` and `recentTokens` arrays at 100 entries on `loadFromStorage` using `sanitizeRecentAttempts` and `sanitizeRecentTokens` with `.slice(-100)` for both keys and models.
   - Guarded against unbounded memory growth or corrupted `sessionStorage` states.

2. **Debounced Failure Recording Hot Path (US2)**:
   - Replaced synchronous `this.flushToStorage(now)` in `recordFailure()` with `this.scheduleSave(now)` (300ms debounce).
   - Preserved atomic lifecycle flushing via existing `pagehide` and `visibilitychange` listeners.

3. **Complete Structured `GeminiRequestError` Hierarchy (US3)**:
   - Replaced all ad-hoc dynamic `(err as any).code = ...` assignments in `src/services/gemini/geminiClient.ts` with typed instances of `GeminiRequestError`.
   - Standardized `BAD_REQUEST` (400), `RESOURCE_NOT_FOUND` (404), `ALL_KEYS_EXHAUSTED` (429), and `ETIMEDOUT`.
   - Converted catch clauses to `catch (err: unknown)`.

4. **Strict Unknown Error Handling in Direct Glossary Engine (US4)**:
   - Refactored `src/services/directGlossaryEngine.ts` to replace `catch (error: any)` with `catch (error: unknown)`.
   - Implemented type-safe `isSafetyOrEmptyErrorDirect` and safe message extraction using `getErrorMessage(error: unknown)`.

5. **Build and CI Environment Modernization to Node.js 24 LTS (US5)**:
   - Updated `.github/workflows/ci.yml` matrix / action steps to `node-version: '24'`.
   - Updated `Dockerfile` Stage 1 builder base to `FROM node:24-alpine AS builder`.
   - Updated `README.md` system requirements to specify `Node.js 24 LTS`.

---

## 2. Key Code Changes

| Component / File | Changes Made |
| :--- | :--- |
| `src/types/runtimeHardening.ts` | Added typed sliding-window and error extractor signatures. |
| `src/services/localQuotaTracker.ts` | Added `sanitizeRecentAttempts`, `sanitizeRecentTokens` with slice(-100), debounced `recordFailure()` via `this.scheduleSave(now)`. |
| `src/services/gemini/geminiErrorClassifier.ts` | Added `getErrorMessage(error: unknown)` and `isGeminiRequestError(error: unknown)` helpers. |
| `src/services/gemini/geminiClient.ts` | Refactored `executeLogicalGeminiCall` to throw `GeminiRequestError` across 400, 404, 429, timeout paths. |
| `src/services/directGlossaryEngine.ts` | Cleaned `catch (error: any)` to `catch (error: unknown)`, implemented safe safety-block checking. |
| `.github/workflows/ci.yml` | Updated to Node.js 24 LTS. |
| `Dockerfile` | Upgraded builder stage to `node:24-alpine`. |
| `README.md` | Updated runtime requirements to Node.js 24 LTS. |

---

## 3. Verification Results

All required verification checks passed cleanly:

### 3.1 Type Checking (`npm run lint`)
```bash
npm run lint
# Output:
# > ai-dich-truyen-trung-viet-full@1.0.0 lint
# > tsc --noEmit
# Result: 0 errors
```

### 3.2 Unit & Integration Tests (`npm test`)
```bash
npm test
# Output:
# Test Files  98 passed (98)
#      Tests  954 passed (954)
#   Duration  12.90s
```
- Total test files: **98** (100% pass)
- Total tests: **954** (all passed, +8 new tests, 0 skipped, 0 failed)

### 3.3 Production Build (`npm run build`)
```bash
npm run build
# Output:
# > ai-dich-truyen-trung-viet-full@1.0.0 build
# > tsc && vite build
# ✓ 2300 modules transformed.
# ✓ built in 7.99s
```
