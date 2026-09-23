# Walkthrough: Runtime Architecture & Security Hardening

## Overview
- **Feature Directory**: `specs/160-runtime-architecture-hardening`
- **Specification**: [spec.md](./spec.md)
- **Implementation Plan**: [plan.md](./plan.md)
- **Tasks**: [tasks.md](./tasks.md)
- **Status**: Completed & Verified

This feature completes the runtime architecture and security hardening across all priority items identified in the architecture audit.

---

## Changes Implemented

### 1. Multi-Platform Security Headers Parity (Nginx & Penta-Parity)
- **Files Modified**:
  - `nginx/default.conf.template`: Added all 8 canonical HTTP security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, `Content-Security-Policy`).
  - `src/tests/cspParity.test.ts`: Expanded to test Penta-Parity across all 5 configuration sources (`vercel.json`, `render.yaml`, `public/_headers`, `vite.config.ts`, `nginx/default.conf.template`) including CSP and non-CSP headers.

### 2. Quota Usage Continuity Across Tab Reloads
- **Files Modified**:
  - `src/services/localQuotaTracker.ts`: Added rolling window serialization and restoration for `recentAttempts` and `recentTokens`. Prunes records older than 60 seconds upon hydration.
  - `src/services/__tests__/localQuotaTracker.test.ts`: Added tests verifying that sliding window timestamps and token volume survive simulated page reloads and prune stale entries.

### 3. Preserving Translation Keys on AI Safety Moderation Filter
- **Files Modified**:
  - `src/types/runtimeHardening.ts`: Canonical contracts and error types.
  - `src/services/gemini/types.ts`: Added `CONTENT_BLOCKED` to `GeminiErrorCode` and introduced `GeminiRequestError`.
  - `src/services/gemini/geminiErrorClassifier.ts`: Added detection for prompt safety / content blocks and re-exported `GeminiRequestError`.
  - `src/services/gemini/geminiClient.ts`: In `executeLogicalGeminiCall`, if an error is classified as `CONTENT_BLOCKED`, it throws `GeminiRequestError` immediately without rotating through alternative API keys.
  - `src/services/gemini/__tests__/geminiClient.test.ts`: Added tests verifying zero key rotation and zero retries when AI content moderation filter blocks content.

### 4. Fresh and Reliable Quality Assurance (QA) Critique State
- **Files Modified**:
  - `src/services/chapterTranslationService.ts`: Tracked `qaRunSucceeded` and updated `detectedQaIssues` so that a clean QA run with 0 issues erases previously recorded stale issues (`[]`). On failure or skipped runs, previous issues are preserved.
  - `src/services/__tests__/chapterTranslationService.test.ts`: Added test cases verifying erasure of stale QA issues on clean pass, and preservation on run failure.

### 5. Throttled Concurrency for Deep Glossary Term Extraction
- **Files Modified**:
  - `src/services/directGlossaryEngine.ts`: Replaced unbounded `Promise.all` with `mapWithConcurrencyLimit(parts, 2, ...)` during recursive text splitting on safety/empty fallback.
  - `src/services/__tests__/directGlossaryEngine.test.ts`: Added unit tests confirming that split extraction operates with bounded concurrency of at most 2.

### 6. Responsive Workspace During High-Frequency Translation
- **Files Modified**:
  - `src/services/localQuotaTracker.ts`: Replaced synchronous per-attempt `sessionStorage.setItem` calls with 300ms debouncing (`scheduleSave`). Added `flushToStorage()` and attached `pagehide` and `visibilitychange` lifecycle listeners.
  - `src/services/__tests__/localQuotaDebounce.test.ts`: Added jsdom-based unit tests for debounced writes and instant lifecycle flushing.

---

## Validation & Quality Gates

All mandated project quality checks were executed and passed cleanly:

| Check | Command | Result |
| :--- | :--- | :--- |
| **Type Check** | `npm run lint` (`tsc --noEmit`) | **Passed (0 errors)** |
| **Unit & Integration Tests** | `npm test` (`vitest run`) | **Passed (98 test files, 946 tests)** |
| **Production Build** | `npm run build` (`tsc && vite build`) | **Passed (13.47s, dist generated)** |

### Specific Regression Test Runs
```bash
npm test -- src/tests/cspParity.test.ts
npm test -- src/services/__tests__/localQuotaTracker.test.ts
npm test -- src/services/gemini/__tests__/geminiClient.test.ts
npm test -- src/services/__tests__/chapterTranslationService.test.ts
npm test -- src/services/__tests__/directGlossaryEngine.test.ts
npm test -- src/services/__tests__/localQuotaDebounce.test.ts
```
All targets passed with 100% success rate and zero regressions.
