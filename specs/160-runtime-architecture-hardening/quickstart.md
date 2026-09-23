# Quickstart & Verification Guide: Runtime Architecture & Security Hardening

**Feature**: [Runtime Architecture & Security Hardening](spec.md)
**Branch**: `160-runtime-architecture-hardening`
**Date**: 2026-09-23

This guide provides step-by-step instructions to validate that the runtime architecture and security enhancements function correctly end-to-end.

---

## Prerequisites

- Node.js LTS (>= 20.x, recommended 24.x)
- PowerShell (Windows) or bash
- Repository dependencies installed (`npm install`)

---

## Verification Scenarios

### 1. Nginx Security Headers & Multi-Platform Penta-Parity
Validates that Docker/Nginx configuration enforces all 8 standard security headers matching Vercel, Render, and static hosting profiles.

```bash
# Run multi-platform header parity tests
npm test -- src/tests/cspParity.test.ts
```

**Expected Outcome**:
- `cspParity.test.ts` passes with 5 validated targets: `render.yaml`, `vercel.json`, `public/_headers`, `vite.config.ts`, and `nginx/default.conf.template`.
- All 8 headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `COOP`, `CORP`, `Permissions-Policy`, `HSTS`, `CSP`) match byte-for-byte or parsed AST equivalence.

---

### 2. Quota Sliding Window State Persistence
Validates that 60-second sliding window attempts and token buckets survive page reloads and prune expired metrics properly.

```bash
# Run local quota tracker tests
npm test -- src/services/__tests__/localQuotaTracker.test.ts
```

**Expected Outcome**:
- Rapid calls within 60 seconds are retained across simulated `loadFromStorage()` calls.
- Calling `getQuotaStatus()` after reload correctly reports `requestsThisMinute` and `tokensThisMinute`.
- Metrics older than 60,000ms are pruned and do not leak into subsequent window snapshots.

---

### 3. Asynchronous Quota Persistence Debouncing
Validates that quota writes to session storage are batched and flushed on exit events without blocking the hot path.

```bash
# Run debounce and storage flush tests
npm test -- src/services/__tests__/localQuotaDebounce.test.ts
```

**Expected Outcome**:
- 20 consecutive API attempt recordings trigger at most 1 synchronous storage serialization before debounce timer fires.
- Explicit `flushToStorage()` or simulated `visibilitychange` event forces immediate flush.

---

### 4. Content Filter Key Rotation Prevention
Validates that prompt rejections from provider safety filters do NOT rotate to subsequent keys.

```bash
# Run Gemini client safety error handling tests
npm test -- src/services/gemini/__tests__/geminiClient.test.ts
```

**Expected Outcome**:
- When Gemini returns `finishReason: 'SAFETY'` or `blockReason: 'SAFETY'`, the client throws `GeminiRequestError` with `code: 'CONTENT_BLOCKED'`.
- Exactly 1 provider attempt is recorded; 0 retry attempts are logged; no other keys in the pool are called.

---

### 5. Stale QA Critique Cleanup
Validates that when a subsequent QA critique pass succeeds with zero issues, prior chapter QA issues are cleared.

```bash
# Run chapter translation service QA cleanup tests
npm test -- src/services/__tests__/chapterTranslationService.test.ts
```

**Expected Outcome**:
- A chapter starting with 3 prior QA issues ends with 0 QA issues after a successful QA run that detects 0 issues.
- A failed QA run (simulated network rejection) preserves the 3 existing issues.

---

### 6. Bounded Concurrency for Glossary Splitting
Validates that recursive multi-fragment glossary extraction respects bounded concurrency limits.

```bash
# Run direct glossary engine concurrency tests
npm test -- src/services/__tests__/directGlossaryEngine.test.ts
```

**Expected Outcome**:
- Multi-fragment text splitting processes sub-chunks through `mapWithConcurrencyLimit` with max concurrency = 2.
- No burst 429 rate limit errors occur during multi-chunk analysis.

---

## Comprehensive Regression Suite

Before marking the implementation ready, execute the full non-negotiable quality gate:

```bash
npm run lint    # Type check (tsc --noEmit)
npm test        # Vitest suite (all test files must pass)
npm run build   # Production bundle compilation
```
