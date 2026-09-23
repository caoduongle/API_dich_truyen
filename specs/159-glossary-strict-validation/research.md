# Phase 0 Research: Strict Glossary Runtime Validation and End-to-End Typing Hardening

**Feature**: `159-glossary-strict-validation` | **Date**: 2026-09-23 | **Spec**: [spec.md](spec.md)

---

## 1. Problem Space & Technical Findings

### Problem 1: Response-Level vs. Item-Level Glossary Validation
- **Current State**: `isGlossarySuggestionsResponse(data)` in `src/lib/text.ts` only checks `Array.isArray(data.suggestions)`. It does not validate individual array elements.
- **Vulnerability**: In `src/services/directGlossaryEngine.ts`, `callGlossaryAnalysisDirect` and `extractGlossaryDirect` parse the response and map every element through a fallback object builder:
  ```ts
  const suggestions: GlossarySuggestion[] = rawSuggestions.map((item: any) => ({
    chinese: typeof item?.chinese === 'string' ? item.chinese : (typeof item?.term === 'string' ? item.term : ''),
    vietnamese: typeof item?.vietnamese === 'string' ? item.vietnamese : '',
    pinyin: typeof item?.pinyin === 'string' ? item.pinyin : '',
    type: (['character', 'location', 'term', 'phrase', 'other'].includes(item?.type) ? item.type : 'other') as GlossaryType,
    note: typeof item?.note === 'string' ? item.note : '',
    ...
  }));
  ```
- **Consequence**: Corrupt AI elements such as `{}`, `{"chinese": 123}`, or `{"vietnamese": null}` are coerced into `{ chinese: "", vietnamese: "", pinyin: "", type: "other", note: "" }`.
- **Secondary Consequence in `sinoNormalize.ts`**:
  `validateAndSnapBackEntities` checks `if (rawText.includes(chineseVal)) return item;`. When `chineseVal === ""`, `rawText.includes("")` evaluates to `true`. This allows phantom empty glossary cards to be returned and stored into the project glossary.

### Problem 2: Lingering `any[]` Across Internal Pipelines
- While `directGlossaryEngine.ts` exported interfaces use `GlossarySuggestion[]`, internally it still casts raw parsed JSON using:
  - `const rawSuggestions = (...) as any[];` (line 77)
  - `const rawList = (...) as any[];` (line 290)
- In `src/services/chapterTranslationService.ts` (line 378):
  - `let detectedQaIssues: any[] = [];`
- In `src/services/translation/types.ts` (line 118):
  - `glossary?: any[];` in `DirectQaCritiqueParams`
- Eliminating these remaining untyped arrays will achieve 100% compile-time type safety across the entire AI pipeline.

### Problem 3: Documentation & Spec Drift for `GlossarySuggestion`
- In `specs/158-qa-issue-strict-hardening/data-model.md`, `GlossarySuggestion` was specified as an interface containing `term: string` and optional fields.
- In production code (`src/lib/text.ts`), it is implemented as:
  ```ts
  export interface GlossarySuggestion extends Omit<GlossaryItem, 'id'> {
    term?: string;
    [key: string]: unknown;
  }
  ```
- The specification and data model documents must be aligned with this concrete production definition.

---

## 2. Technical Decisions & Rationales

### Decision 1: Introduce Dedicated Item-Level Guard `isGlossarySuggestionItem`
- **Choice**: Add `isGlossarySuggestionItem(item: unknown): item is GlossarySuggestion` in `src/lib/text.ts`.
- **Validation Rules**:
  1. `item` is a non-null object.
  2. `item.chinese` is a string with `trim().length > 0` OR `item.term` is a string with `trim().length > 0`.
  3. `item.vietnamese` is a string (`typeof item.vietnamese === 'string'`).
  4. If `item.type` is present (`!== undefined`), it must belong to `['character', 'location', 'term', 'phrase', 'other']`.
  5. If `item.pinyin` is present (`!== undefined`), it must be a string.
  6. If `item.note` is present (`!== undefined`), it must be a string.
- **Rationale**: Rejects invalid types (`chinese: 123`, `vietnamese: null`), empty objects (`{}`), and empty strings (`chinese: ""`). Conforming items are mapped cleanly, while malformed items are dropped.
- **Alternatives Considered**: Modifying `isGlossarySuggestionsResponse` to reject the entire batch if any single item is invalid. Rejected because a single hallucinated item shouldn't cause the user to lose 20 valid extracted terms from a large chapter. Item-level filtering preserves good items while discarding corrupt items (identical to QA critique and Hako scanner behavior).

### Decision 2: Guard against Empty Chinese Strings in `validateAndSnapBackEntities`
- **Choice**: At the beginning of `validateAndSnapBackEntities` mapping loop in `src/lib/sinoNormalize.ts`:
  ```ts
  if (!item || typeof item.chinese !== "string" || !item.chinese.trim()) {
    return null; // or skip filtering
  }
  ```
- **Rationale**: Guarantees defense-in-depth so that even if an empty string bypassed upstream guards, it will never match `rawText.includes("")` or produce a phantom entry.

### Decision 3: Type `rawSuggestions` as `unknown[]` and Filter with Predicate
- **Choice**:
  ```ts
  const rawSuggestions = (parsed && Array.isArray(parsed.suggestions) ? parsed.suggestions : []) as unknown[];
  const validItems = rawSuggestions.filter(isGlossarySuggestionItem);
  const suggestions: GlossarySuggestion[] = validItems.map((item) => ({
    chinese: item.chinese ? item.chinese.trim() : (item.term ? item.term.trim() : ''),
    vietnamese: item.vietnamese.trim(),
    pinyin: (item.pinyin || '').trim(),
    type: item.type || 'other',
    note: (item.note || '').trim(),
    ...(item.sourceChapterId ? { sourceChapterId: item.sourceChapterId } : {}),
    ...(typeof item.needsReview === 'boolean' ? { needsReview: item.needsReview } : {}),
  }));
  ```
- **Rationale**: Completely removes `any[]` internally. TypeScript can statically verify that every item processed has passed `isGlossarySuggestionItem`.

### Decision 4: Type `detectedQaIssues` as `DirectQaCritiqueIssue[]` and `glossary` as `GlossaryItem[]`
- **Choice**:
  - In `src/services/chapterTranslationService.ts`: `let detectedQaIssues: DirectQaCritiqueIssue[] = [];`
  - In `src/services/translation/types.ts`: `glossary?: GlossaryItem[];` in `DirectQaCritiqueParams`
- **Rationale**: Eliminates the remaining untyped arrays across the translation service boundary.
