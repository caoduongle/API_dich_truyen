# Internal Contracts: Strict QA Issue Validation & Secondary Pipeline Hardening

**Feature**: `158-qa-issue-strict-hardening` | **Date**: 2026-09-22 | **Spec**: [spec.md](spec.md)

---

## 1. QA Critique Issue Guard Contract

### Function Signature
```ts
export function isQaCritiqueIssue(item: unknown): item is QaCritiqueIssue;
```

### Preconditions
- `item` may be any primitive, null, undefined, object, or array.

### Postconditions
- Returns `true` **if and only if**:
  1. `item` is a non-null object.
  2. `typeof item.targetText === 'string'`.
  3. `item.type` is exactly one of `'omission' | 'addition' | 'repetition' | 'terminology' | 'other'`.
  4. `item.severity` is exactly one of `'critical' | 'warning' | 'info'`.
  5. `typeof item.description === 'string' && item.description.trim().length > 0` OR `typeof item.message === 'string' && item.message.trim().length > 0`.
- Returns `false` otherwise.

---

## 2. Hako AI Scan Issue Guard Contract

### Function Signature
```ts
export function isHakoQualityScanIssue(item: unknown): item is HakoQualityScanRawIssue;
```

### Preconditions
- `item` is an element from `HakoQualityScanResponse.issues`.

### Postconditions
- Returns `true` **if and only if**:
  1. `item` is a non-null object.
  2. `typeof item.explanation === 'string' && item.explanation.trim().length > 0`.
  3. `item.category` is a string belonging to `QualityIssueCategory`.
  4. `item.severity` is a string belonging to `QualityIssueSeverity`.
  5. Optional fields (`vietnameseSnippet`, `rawSnippet`, `suggestedFix`) are either `undefined` or `typeof === 'string'`.
- Returns `false` otherwise.

---

## 3. Glossary Engine Typing Contract

### Function Signatures (`src/services/directGlossaryEngine.ts`)
```ts
export interface AnalyzeGlossaryDirectResult {
  suggestions: GlossarySuggestion[];
  successKeyIndex: number;
  truncated?: boolean;
  originalLength?: number;
  analyzedLength?: number;
}

export interface ExtractGlossaryDirectResult {
  glossary: GlossarySuggestion[];
  successKeyIndex: number;
  warning?: string;
}

export async function analyzeGlossaryDirect(
  params: AnalyzeGlossaryDirectParams
): Promise<AnalyzeGlossaryDirectResult>;

export async function extractGlossaryDirect(
  params: ExtractGlossaryDirectParams
): Promise<ExtractGlossaryDirectResult>;
```

### Invariant
No `any[]` types exposed across `directGlossaryEngine.ts` interface boundaries.

---

## 4. Prompt Sanitization Guard Contract

### Contract Rules
1. `quickTranslateTermDirect`:
   ```ts
   const sanitizedGenre = options.genre ? sanitizePromptInput(options.genre) : '';
   ```
2. `hakoQualityEngine.runAiQualityScan`:
   ```ts
   const cleanProjectTitle = sanitizePromptInput(projectTitle || 'Không có tiêu đề');
   const cleanChapterTitle = sanitizePromptInput(chapter.title || 'Không có tiêu đề');
   ```
All string concatenations into system instruction and prompt bodies MUST consume the sanitized variables.
