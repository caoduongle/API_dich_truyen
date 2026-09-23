# Internal Contracts: Strict Glossary Runtime Validation and End-to-End Typing Hardening

**Feature**: `159-glossary-strict-validation` | **Date**: 2026-09-23 | **Spec**: [spec.md](spec.md)

---

## 1. Glossary Suggestion Item Guard Contract

### Function Signature
```ts
export function isGlossarySuggestionItem(item: unknown): item is GlossarySuggestion;
```

### Preconditions
- `item` may be any value: `null`, `undefined`, primitive, object, or array.

### Postconditions
- Returns `true` **if and only if**:
  1. `item` is a non-null object (`typeof item === 'object' && item !== null`).
  2. `item.chinese` is a string with `item.chinese.trim().length > 0` OR `item.term` is a string with `item.term.trim().length > 0`.
  3. `item.vietnamese` is a string (`typeof item.vietnamese === 'string'`).
  4. If `item.type !== undefined`, `['character', 'location', 'term', 'phrase', 'other'].includes(item.type)`.
  5. If `item.pinyin !== undefined`, `typeof item.pinyin === 'string'`.
  6. If `item.note !== undefined`, `typeof item.note === 'string'`.
- Returns `false` otherwise.

---

## 2. Sino-Snapback Guard Contract (`src/lib/sinoNormalize.ts`)

### Function Signature
```ts
export function validateAndSnapBackEntities(entities: any[], rawText: string): any[];
```

### Postconditions
- Any element in `entities` lacking a non-empty `chinese` property (`!item || typeof item.chinese !== 'string' || !item.chinese.trim()`) is discarded from the result array.
- Guaranteed: No empty string `chinese: ""` can match `rawText.includes("")` or appear in the returned array.

---

## 3. Direct Glossary Engine Internal Typing Contract (`src/services/directGlossaryEngine.ts`)

### Function Signatures
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
```

### Internal Invariant
- Parsing logic consumes raw arrays typed as `unknown[]` (never `as any[]`).
- Elements are mapped only after passing `isGlossarySuggestionItem`.
- Malformed, empty, or corrupt items are filtered out before reaching callers or normalization.

---

## 4. Translation Service Type Contracts

### `src/services/translation/types.ts`
```ts
export interface DirectQaCritiqueParams {
  sourceText: string;
  translatedText: string;
  genre?: string;
  tone?: string;
  description?: string;
  glossary?: GlossaryItem[]; // strongly-typed, replaces any[]
  apiKeys: string[];
  model?: string;
  startKeyIndex?: number;
  signal?: AbortSignal;
}
```

### `src/services/chapterTranslationService.ts`
```ts
let detectedQaIssues: DirectQaCritiqueIssue[] = []; // strongly-typed, replaces any[]
```
