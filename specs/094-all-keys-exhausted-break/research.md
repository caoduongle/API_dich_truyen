# Research: All API Keys Exhausted Fast-Break & Error Taxonomy

**Feature**: `094-all-keys-exhausted-break`  
**Date**: 2026-09-10  
**Status**: Completed  

## 1. Problem Statement & Root Cause Analysis

### Background
In `src/services/directGeminiClient.ts`, the `callGeminiDirect()` function iterates through an array of API keys (`rawKeys`), attempting requests with each key until one succeeds or all fail.
When all keys fail due to rate limiting (HTTP 429 / `RESOURCE_EXHAUSTED`), it executes:
```typescript
if (attempt === rawKeys.length - 1) {
  if (response.status === 429 || errStatus === 'RESOURCE_EXHAUSTED') {
    throw new Error(`Toàn bộ API Key đã hết hạn mức (429 RESOURCE_EXHAUSTED). Chi tiết: ${errMsg}`);
  }
  throw lastError;
}
```
Currently, this throws a standard generic `Error` without any distinguishing metadata property.

### The Consequence in `runAiQualityScan`
In `src/services/hakoQualityEngine.ts`, `runAiQualityScan()` processes chapters in a loop:
```typescript
for (let idx = 0; idx < chapters.length; idx++) {
  try {
    const res = await callGeminiDirect(...);
    // parse issues...
  } catch (err: any) {
    if (err.name === 'AbortError') throw err;
    allAiIssues.push({
      // push localized warning issue
    });
    // Continues to next chapter!
  }
}
```
If quota exhaustion occurs on Chapter 1 of $N$ chapters:
1. Every remaining chapter ($2 \dots N$) calls `callGeminiDirect()`.
2. Each remaining chapter retries ALL exhausted API keys, failing each one sequentially with network round-trips.
3. Each chapter pushes an identical warning issue to `allAiIssues`.
4. Result: Extreme user delay, wasteful network traffic, and $N$ redundant warning issues polluting the review report.

---

## 2. Architectural Decisions & Patterns

### Decision 1: Error Property Annotation (`code = 'ALL_KEYS_EXHAUSTED'`)
- **Chosen Approach**: In `src/services/directGeminiClient.ts`:
  ```typescript
  if (attempt === rawKeys.length - 1) {
    if (response.status === 429 || errStatus === 'RESOURCE_EXHAUSTED') {
      const quotaErr = new Error(`Toàn bộ API Key đã hết hạn mức (429 RESOURCE_EXHAUSTED). Chi tiết: ${errMsg}`);
      (quotaErr as any).code = 'ALL_KEYS_EXHAUSTED';
      throw quotaErr;
    }
    throw lastError;
  }
  ```
  Additionally, in the `catch` block of `callGeminiDirect`:
  ```typescript
  catch (err: any) {
    if (err.name === 'AbortError' || err.code === 'ALL_KEYS_EXHAUSTED') {
      throw err;
    }
    // ...
  }
  ```
- **Rationale**:
  - Re-throwing immediately in the internal `catch` prevents `formatGeminiNetworkError(err)` from swallowing the custom `code` property or wrapping it into a generic network error.
  - Zero changes to the existing Vietnamese error message string, preserving UI consistency and backwards compatibility.
- **Alternatives Considered**:
  - *Custom Error subclass (e.g. `class AllKeysExhaustedError extends Error`)*: Rejected because assigning property `.code` is lighter, avoids transpilation/prototype inheritance issues in bundle, and is standard in Node.js/browser error handling.

### Decision 2: Circuit-Breaker Fast Break in `runAiQualityScan`
- **Chosen Approach**:
  In `src/services/hakoQualityEngine.ts`, within the `catch` block of `runAiQualityScan`:
  ```typescript
  catch (err: any) {
    if (err.name === 'AbortError') throw err;
    console.warn(`[hakoQualityEngine] AI scan failed for chapter "${chapter.title}":`, err);

    if (err.code === 'ALL_KEYS_EXHAUSTED') {
      allAiIssues.push({
        id: generateIssueId(),
        chapterId,
        chapterTitle: chapter.title,
        chapterNumber: chapter.chapterNumber,
        category: 'other',
        severity: 'warning',
        vietnameseSnippet: chapter.title,
        explanation: `Toàn bộ API Key đã hết hạn mức (429 RESOURCE_EXHAUSTED). Dừng phân tích AI cho các chương còn lại.`,
        decision: 'pending',
        detectedBy: 'ai',
        createdAt: new Date().toISOString(),
      });
      break; // Immediately exit chapter loop
    }

    // Standard localized error for other error types
    allAiIssues.push({ ... });
  }
  ```
- **Rationale**:
  - Emits exactly 1 general warning issue on the chapter where quota ran out.
  - Immediately halts the chapter loop via `break`.
  - Preserves all issues collected from chapters analyzed prior to the break.
  - Non-quota errors (`err.code !== 'ALL_KEYS_EXHAUSTED'`) still continue to subsequent chapters, maintaining fault isolation.

---

## 3. Boundary & Compatibility Verification

- **Files in Scope**:
  1. `src/services/directGeminiClient.ts`
  2. `src/services/hakoQualityEngine.ts`
  3. `src/services/__tests__/hakoQualityEngine.test.ts` (new unit tests)
- **Files explicitly NOT modified**:
  - `src/services/chapterTranslationService.ts` (out of scope)
  - `src/services/directTranslationEngine.ts` (out of scope)
  - `src/types.ts` / IndexedDB schemas (strictly prohibited)
- **Zero New Dependencies**: Reuses existing types and error structures.
