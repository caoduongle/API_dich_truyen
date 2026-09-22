# Phase 0 Research: Strict QA Issue Validation & Secondary Pipeline Hardening

**Feature**: `158-qa-issue-strict-hardening` | **Date**: 2026-09-22 | **Spec**: [spec.md](spec.md)

---

## 1. QA Critique Issue Validation Hardening (`isQaCritiqueIssue`)

### Problem
In commit `2f234ef`, `isQaCritiqueIssue` in `src/lib/text.ts` relaxed property checking by checking types only when defined (`obj.targetText !== undefined`, `obj.type !== undefined`, `obj.severity !== undefined`). Consequently:
- Payloads such as `{"description": "Lỗi ngữ pháp"}` or `{"type": "omission", "description": "Thiếu câu"}` evaluate to `true`.
- Downstream in `src/services/translation/qaCritique.ts`, `normalizeIssueType` defaulted missing `type` to `'other'`, `normalizeIssueSeverity` defaulted missing `severity` to `'warning'`, and `targetText` defaulted to `""`.
- Incomplete AI outputs were coerced into synthetic warning cards rather than rejected as malformed.

### Decision
Require all 4 primary fields strictly:
1. `type`: required string, must match `'omission' | 'addition' | 'repetition' | 'terminology' | 'other'`.
2. `severity`: required string, must match `'critical' | 'warning' | 'info'`.
3. `targetText`: required string (`typeof obj.targetText === 'string'`). For omissions, empty string `""` is valid, but missing/undefined/null is rejected.
4. `description` or `message`: required string with `trim().length > 0`.

### Rationale
Strict type predicate enforcement at the boundary ensures that only fully-formed issues are accepted into the audit bridge, completely eliminating phantom cards created from partial or corrupted AI outputs.

### Alternatives Considered
- *Permissive normalization with warning flags*: Rejected because allowing corrupted issues degrades audit confidence and directly contradicts Spec 157/158 requirements.

---

## 2. Hako AI Quality Scan Item-Level Validation

### Problem
`isHakoQualityScanResponse(data)` currently only verifies that `data.issues` is an array (`Array.isArray(obj.issues)`). It does not validate the elements inside the array. Items such as `{ category: 123, severity: {}, explanation: true }` pass the guard, forcing downstream logic in `hakoQualityEngine.ts` to rely on runtime type casts `(item.category as QualityIssueCategory)`.

### Decision
Implement an item-level validator predicate `isHakoQualityScanIssue(item: unknown): item is HakoQualityScanRawIssue` in `src/lib/text.ts`:
- Required `explanation`: non-empty string.
- Required `category`: string matching `QualityIssueCategory` enum (`'mistranslation' | 'omission' | 'addition' | 'grammar' | 'terminology' | 'spelling' | 'punctuation' | 'formatting' | 'other'`).
- Required `severity`: string matching `QualityIssueSeverity` enum (`'critical' | 'major' | 'minor' | 'suggestion'`).
- Optional `vietnameseSnippet`, `rawSnippet`, `suggestedFix`: must be strings if present.
In `hakoQualityEngine.ts`, filter raw AI issue entries with `isHakoQualityScanIssue` before mapping into workspace issue entities.

### Rationale
Enforcing item-level schema validation prevents invalid enum values or corrupted types from entering the Hako Quality Checker state without crashing or generating uninformative issues.

### Alternatives Considered
- *Zod schema validation*: Rejected due to Constitution Principle II (Dependency Minimization); native TypeScript type guards provide zero-overhead validation without new dependencies.

---

## 3. Strongly-Typed Glossary Pipeline (`directGlossaryEngine.ts`)

### Problem
`directGlossaryEngine.ts` uses `any[]` for `suggestions` across internal functions (`callGlossaryAnalysisDirect`, `analyzeGlossaryWithContentSplitDirect`) and public interface definitions (`AnalyzeGlossaryDirectResult`, `ExtractGlossaryDirectResult`).

### Decision
Define a unified `GlossarySuggestion` interface in `src/lib/text.ts` (reused across services):
```ts
export interface GlossarySuggestion {
  term: string;
  vietnamese: string;
  note?: string;
  pinyin?: string;
  type?: GlossaryType;
  sourceChapterId?: string;
}
```
Update all function signatures, return types, and interface declarations in `src/services/directGlossaryEngine.ts` to use `GlossarySuggestion[]` or `DiscoveredEntity[]` instead of `any[]`.

### Rationale
Eliminates compiler blind spots and ensures boundary type safety between AI responses, persistence schemas, and React hooks.

---

## 4. AI Prompt Input Sanitization (Defense-in-Depth)

### Problem
1. In `quickTranslateTermDirect` (`src/services/directGeminiClient.ts`), `options.genre` was directly concatenated into the prompt template without calling `sanitizePromptInput`.
2. In `runAiQualityScan` (`src/services/hakoQualityEngine.ts`), `projectTitle` and `chapter.title` were directly interpolated into prompts without calling `sanitizePromptInput`.

### Decision
1. In `quickTranslateTermDirect`:
   ```ts
   const sanitizedGenre = options.genre ? sanitizePromptInput(options.genre) : '';
   const genreNote = sanitizedGenre
     ? `\nBộ truyện thuộc thể loại: ${sanitizedGenre}. Hãy ưu tiên từ ngữ và cách dịch phù hợp với phong cách thể loại này.`
     : '';
   ```
2. In `hakoQualityEngine.ts`:
   ```ts
   const cleanProjectTitle = sanitizePromptInput(projectTitle || 'Không có tiêu đề');
   const cleanChapterTitle = sanitizePromptInput(chapter.title || 'Không có tiêu đề');
   ```

### Rationale
Guarantees that 100% of user-provided metadata strings interpolated into AI instructions are sanitized against control character injection, header tampering, or prompt delimiter collisions.
