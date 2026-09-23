# Technical Research: Runtime Hardening Completion & Architecture Polish

**Feature**: `161-runtime-hardening-completion`  
**Date**: 2026-09-23  

## Overview
This document consolidates architectural decisions, rationale, and implementation strategies for the 5 targeted runtime hardening items identified during the main branch code review.

---

## 1. Sliding-Window Storage Ingestion & Symmetrical Cap 100

### Problem
`LocalQuotaTracker` enforces a 60-second rolling window for `recentAttempts` and `recentTokens`. During serialization (`saveToStorage`), entries are filtered to `timestamp > now - 60_000` and capped with `.slice(-100)`. However, during deserialization (`loadFromStorage`), the data was filtered without `.slice(-100)`. A corrupted, tampered, or oversized session storage payload could inject thousands of items into client memory.

### Decision
Create a shared, type-safe sanitization helper:
```ts
export function sanitizeRecentAttempts(
  raw: unknown,
  minuteThreshold: number,
  maxFutureTimestamp: number,
  maxEntries: number = 100
): CallAttemptEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (a: unknown): a is CallAttemptEntry =>
        typeof (a as any)?.timestamp === 'number' &&
        (a as any).timestamp > minuteThreshold &&
        (a as any).timestamp <= maxFutureTimestamp
    )
    .slice(-maxEntries);
}

export function sanitizeRecentTokens(
  raw: unknown,
  minuteThreshold: number,
  maxFutureTimestamp: number,
  maxEntries: number = 100
): CallTokenEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (t: unknown): t is CallTokenEntry =>
        typeof (t as any)?.timestamp === 'number' &&
        typeof (t as any)?.tokens === 'number' &&
        (t as any).timestamp > minuteThreshold &&
        (t as any).timestamp <= maxFutureTimestamp
    )
    .slice(-maxEntries);
}
```

### Rationale
- Symmetrical enforcement guarantees that memory consumption is strictly bounded during both ingestion and persistence.
- Eliminates repetitive filtering code across 4 ingestion paths (key attempts, key tokens, model attempts, model tokens) and 4 persistence paths.

---

## 2. Asynchronous Debounced Storage on Error Hot Path (`recordFailure`)

### Problem
In `LocalQuotaTracker`, `recordFailure()` was calling `this.flushToStorage(now)` synchronously. In high-frequency translation scenarios with rate-limit or service-overload cascades, multiple failures trigger consecutive blocking `sessionStorage.setItem` and `JSON.stringify` calls on the main thread, violating the architectural principle of debounced storage.

### Decision
Change `recordFailure()` to call `this.scheduleSave(now)` instead of `this.flushToStorage(now)`.

### Rationale & Lifecycle Safety
- **Debounced write**: In-memory state (error counts, circuit breaker status, cooldown timestamp) updates instantly. Serialization is coalesced into a 300ms window.
- **Durability guarantee**: Tab closure or navigation triggers `pagehide` or `visibilitychange` (state = 'hidden'), both of which call `flushToStorage()`, ensuring no lost failure state before tab unload.
- **Manual flush**: Retained as an explicit public method on `LocalQuotaTracker` for deterministic unit testing and controlled flushing.

---

## 3. Comprehensive Structured `GeminiRequestError` Hierarchy

### Problem
`geminiClient.ts` previously threw generic `Error` instances with monkey-patched dynamic properties `(lastError as any).code = ...` and `(lastError as any).status = ...` for `RESOURCE_NOT_FOUND`, `BAD_REQUEST`, `ALL_KEYS_EXHAUSTED`, and `ETIMEDOUT`. Only `CONTENT_BLOCKED` utilized `GeminiRequestError`.

### Decision
Fully standardize the error taxonomy:
1. All fatal and non-retryable Gemini errors thrown in `geminiClient.ts` instantiate `GeminiRequestError`:
   - `RESOURCE_NOT_FOUND`: `code: 'RESOURCE_NOT_FOUND'`, `category: 'RESOURCE_NOT_FOUND'`, `status: 404`, `isRetryable: false`.
   - `BAD_REQUEST`: `code: 'BAD_REQUEST'`, `category: 'UNRECOGNIZED'`, `status: 400`, `isRetryable: false`.
   - `ALL_KEYS_EXHAUSTED`: `code: 'ALL_KEYS_EXHAUSTED'`, `category: 'QUOTA_EXHAUSTED_RPD'`, `status: 429`, `isRetryable: false`.
   - `ETIMEDOUT`: `code: 'ETIMEDOUT'`, `category: 'NETWORK_FAILURE'`, `isRetryable: true`.
   - `CONTENT_BLOCKED`: `code: 'CONTENT_BLOCKED'`, `category: 'CONTENT_BLOCKED'`, `status: 200`, `isRetryable: false`.
2. Convert all catch clauses in `geminiClient.ts` from `catch (err: any)` to `catch (err: unknown)`.
3. Provide type-guard helper `isGeminiRequestError(err: unknown): err is GeminiRequestError`.

### Rationale
- Downstream handlers (e.g. `chapterTranslationService.ts`, UI notifications) can inspect `error.code` safely with full TypeScript compiler support and zero `any` assertions.
- Aligns with the project's Core Principle I (Strict Quality Gates & Verification).

---

## 4. Strict Unknown Error Handling in `directGlossaryEngine.ts`

### Problem
`directGlossaryEngine.ts` contained `isSafetyOrEmptyErrorDirect(err: any)` and multiple `catch (error: any)` blocks.

### Decision
1. Implement `getErrorMessage(error: unknown): string`:
   ```ts
   export function getErrorMessage(error: unknown): string {
     if (error instanceof Error) return error.message;
     if (typeof error === 'string') return error;
     if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
       return (error as { message: string }).message;
     }
     return String(error || '');
   }
   ```
2. Update `isSafetyOrEmptyErrorDirect(err: unknown): boolean`:
   ```ts
   export function isSafetyOrEmptyErrorDirect(err: unknown): boolean {
     if (err instanceof GeminiRequestError && err.code === 'CONTENT_BLOCKED') return true;
     const msg = getErrorMessage(err);
     return msg.includes('bộ lọc an toàn') || msg.includes('phản hồi rỗng');
   }
   ```
3. Convert all `catch (error: any)` to `catch (error: unknown)` across `directGlossaryEngine.ts`.

### Rationale
- Completely removes technical debt and prevents unhandled runtime exceptions when catching non-Error throws.

---

## 5. Node.js 24 LTS Runtime Modernization

### Problem
GitHub Actions CI output warns that Node.js 20 is nearing deprecation. Docker and README still reference Node 20.

### Decision
1. `.github/workflows/ci.yml`: Update `node-version: '24'`.
2. `Dockerfile`: Update `FROM node:24-alpine AS builder`.
3. `README.md`: Update requirement section to `- Node.js 24 LTS.`.

### Rationale
- Node.js 24 LTS provides improved V8 performance, native web standard parity, and eliminates CI deprecation warnings without any breaking changes to the frontend build pipeline.
