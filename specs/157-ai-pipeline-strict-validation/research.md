# Phase 0 Research: AI Pipeline Strict Validation and Structural Integrity

**Feature**: `157-ai-pipeline-strict-validation`  
**Date**: 2026-09-22  
**Status**: Completed  

## 1. QA Critique Validation & Issue Filtering

### Context & Problem
Commit `601a9a58` introduced structured parsing for QA critique with fallback:
```ts
export function isQaCritiqueResponse(data: unknown): data is QaCritiqueResponse {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  const hasValidIssues = obj.issues === undefined || Array.isArray(obj.issues);
  const hasValidFlag = obj.isValid === undefined || typeof obj.isValid === 'boolean';
  return hasValidIssues && hasValidFlag;
}
```
Because both `obj.issues` and `obj.isValid` permitted `undefined`, calling `isQaCritiqueResponse({})` evaluated to `true`. When Gemini returned an empty `{}` or truncated object, `qaCritique.ts` interpreted it as valid and defaulted to `{ isValid: true, issues: [] }`, silently marking a broken critique as "no errors found".

Furthermore, in `qaCritique.ts`, any non-null object in `issues` was coerced into a warning card even if it lacked `description` or was completely empty (`{}`), causing phantom warnings to appear in the UI.

### Decisions
1. **Tighten `isQaCritiqueResponse`**:
   - `isValid` must be strictly `typeof obj.isValid === 'boolean'`.
   - `issues` must be strictly `Array.isArray(obj.issues)`.
   - Empty object `{}` or objects missing either field return `false`.
2. **Item-Level Filtering (`isQaCritiqueIssue`)**:
   - Define a strict item validator function `isQaCritiqueIssue(item: unknown)`:
     - Must be an object (`typeof item === 'object' && item !== null`).
     - `description`: Must be a non-empty string (`typeof desc === 'string' && desc.trim().length > 0`).
     - `targetText`: Must be a string (`typeof targetText === 'string'`), with empty string allowed specifically for omission errors.
     - `type`: Must map to valid enum (`omission`, `addition`, `repetition`, `terminology`, `other`).
     - `severity`: Must map to valid enum (`critical`, `warning`, `info`).
   - In `qaCritique.ts`, filter out malformed or primitive items using `.filter(isQaCritiqueIssue)` instead of coercing empty dictionaries into warning objects.

### Alternatives Considered
- *Permitting undefined `isValid` and inferring from `issues.length === 0`*: Rejected because the Gemini prompt schema explicitly requires both `isValid` and `issues`. Permitting either to be omitted weakens schema compliance and allows empty objects to bypass validation.
- *Coercing missing description to "[Lỗi không rõ]"*: Rejected because it clutters the reviewer's workspace with unhelpful, non-actionable warning cards. Dropping invalid items preserves signal-to-noise ratio.

---

## 2. Discovered Entity Type Enforcement (Option A)

### Context & Problem
Spec 156 required entity validation to ensure `chinese`, `vietnamese`, `pinyin`, and `note` are strings. `validateDiscoveredEntity` prevented runtime crashes by coercing non-string types to empty strings:
```ts
pinyin: typeof obj.pinyin === 'string' ? obj.pinyin.trim() : '',
vietnamese: typeof obj.vietnamese === 'string' ? obj.vietnamese.trim() : '',
```
While crash-safe, a payload such as `{ chinese: "张三", pinyin: 123, vietnamese: null }` was accepted with coerced empty strings rather than rejected as a malformed entity.

### Decisions (Option A Chosen)
- `chinese`: Required non-empty string (`typeof obj.chinese === 'string' && obj.chinese.trim().length > 0`). If missing, empty, or non-string, return `null`.
- `vietnamese`, `pinyin`, `note`: Optional string fields.
  - If `undefined`: Allowed, defaults to `""`.
  - If present but **not a string** (e.g. `number`, `boolean`, `null`, `object`, `array`): Reject entity by returning `null`.
- `type`: Optional enum string. If unrecognized or non-string, normalize to `'other'` as long as the property itself is not a complex nested structure.

### Alternatives Considered
- *Option B (Full Strict Rejection)*: Requiring all fields to be explicitly present and non-empty. Rejected because Gemini models frequently omit optional `pinyin` or `note` when unavailable, which would discard valid terminology.
- *Option C (Lenient Coercion)*: Current behavior of converting any non-string to `""`. Rejected because it allows structurally corrupted entities (e.g., number types or null objects) to pollute the glossary.

---

## 3. Hard Cumulative Deadline Ceiling

### Context & Problem
In `src/services/gemini/geminiClient.ts`:
```ts
const attemptTimeoutMs = Math.max(1000, Math.min(remainingMs, 60_000));
```
If `remainingMs` is 300ms, `attemptTimeoutMs` is elevated to 1000ms. An in-flight request can take up to 1000ms, causing the total logical request time to exceed the 60,000ms deadline by 700ms.

### Decisions
- Remove `Math.max(1000, ...)` floor.
- Enforce strict deadline bounds:
  ```ts
  if (remainingMs <= 50) {
    const deadlineError = new Error(
      `Quá hạn thời gian yêu cầu Gemini API (Cumulative Deadline: ${Math.round(overallDeadlineMs / 1000)}s).`
    );
    (deadlineError as any).name = 'TimeoutError';
    (deadlineError as any).code = 'ETIMEDOUT';
    throw deadlineError;
  }
  const attemptTimeoutMs = Math.min(remainingMs, 60_000);
  ```
- Any remaining budget under 50ms immediately triggers cumulative timeout error before dispatch, preventing socket setup overhead that cannot possibly succeed.

### Alternatives Considered
- *Using AbortController linked to global deadline*: `AbortSignal.timeout(overallDeadlineMs)` or an explicit single timer across all attempts. Rejected because each rotation attempt needs individual connection abort handling while tracking key failure reasons (e.g. 429 quota exhaustion vs timeout). Bounding `attemptTimeoutMs = Math.min(remainingMs, 60_000)` achieves the exact same deadline guarantee while maintaining clean per-attempt error classification.

---

## 4. Secondary Structured AI Output Boundary Unification (Option A)

### Context & Problem
Secondary AI endpoints across the codebase still use raw `safeParseJson()` or `parseGeminiStructuredResponse<any>()` without validator predicates:
1. `directGeminiClient.ts` (`generateQuickTermDetailsDirect`): uses `parseGeminiStructuredResponse<any>` with no `validator`.
2. `hakoQualityEngine.ts` (`runAiQualityScan`): uses `parseGeminiStructuredResponse<any>` with no `validator`.
3. `directGlossaryEngine.ts` (`callGlossaryAnalysisDirect`, `analyzeGuidelinesDirect`, `extractGlossaryDirect`, `alignChapterDirect`): uses `safeParseJson` directly without runtime type guards.

### Decisions (Option A Chosen)
- Unify all secondary structured endpoints by introducing runtime schema validators and passing them to structured parsers:
  1. `isQuickTermResponse(data: unknown): data is QuickTermResponse`: validates that returned object has required string fields (`chinese`, `vietnamese`, `type`).
  2. `isHakoQualityScanResponse(data: unknown): data is { issues: unknown[] }`: validates `issues` is an array.
  3. `isGlossarySuggestionsResponse(data: unknown)`: validates `suggestions` is an array.
  4. `isGuidelinesAnalysisResponse(data: unknown)`: validates `genre`, `tone`, `description` are strings if present.
  5. `isAlignChapterResponse(data: unknown)`: validates `alignments` is an array.

### Alternatives Considered
- *Deferring secondary services to a later sprint*: Rejected because Option A was explicitly selected by the user to completely eliminate JSON boundary technical debt across the entire codebase.
