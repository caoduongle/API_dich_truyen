# Contract: Gemini Client Error Taxonomy & AI Quality Engine Fast-Break

**Feature**: `094-all-keys-exhausted-break`  
**Date**: 2026-09-10  
**Status**: Ready  

## 1. `callGeminiDirect` Error Contract (`src/services/directGeminiClient.ts`)

### Behavior & Throw Specification:
1. When all API keys in `rawKeys` fail and the final attempt encounters HTTP 429 or `RESOURCE_EXHAUSTED`:
   - Thrown error MUST have `code` property equal to `'ALL_KEYS_EXHAUSTED'`.
   - Error message MUST begin with `Toàn bộ API Key đã hết hạn mức (429 RESOURCE_EXHAUSTED)`.
   - Internal `catch` in `callGeminiDirect` MUST rethrow this error without re-wrapping or stripping `code`.

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

---

## 2. `runAiQualityScan` Execution Contract (`src/services/hakoQualityEngine.ts`)

### Behavior & Early Termination Specification:
1. In `runAiQualityScan(input)`:
   - When calling `callGeminiDirect`:
     - If `err.name === 'AbortError'`: rethrow `err`.
     - If `err.code === 'ALL_KEYS_EXHAUSTED'`:
       - Append exactly ONE warning issue to `allAiIssues`.
       - Execute `break` to exit the loop immediately.
       - Return `allAiIssues` containing all previous successful chapter issues plus the single quota warning.
     - For any other error:
       - Append localized chapter warning issue.
       - Continue to next chapter.
