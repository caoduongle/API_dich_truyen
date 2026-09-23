# Phase 1 Data Model: Strict Glossary Runtime Validation and End-to-End Typing Hardening

**Feature**: `159-glossary-strict-validation` | **Date**: 2026-09-23 | **Spec**: [spec.md](spec.md)

---

## 1. Glossary Suggestion Schema

### Definition (`src/lib/text.ts`)
```ts
import { GlossaryItem, GlossaryType } from '../types';

export interface GlossarySuggestion extends Omit<GlossaryItem, 'id'> {
  term?: string;
  [key: string]: unknown;
}
```

### Invariants Inherited from `Omit<GlossaryItem, 'id'>`:
| Field | Type | Required in Storage | Validation Rule in `isGlossarySuggestionItem` |
| :--- | :--- | :--- | :--- |
| `chinese` (or `term`) | `string` | **Yes** | Required non-empty string (`trim().length > 0`) |
| `vietnamese` | `string` | **Yes** | Required string (`typeof === 'string'`) |
| `pinyin` | `string` | **Yes** (defaults to `""`) | If present, must be string (`typeof === 'string'`) |
| `type` | `GlossaryType` | **Yes** (defaults to `'other'`) | If present, must be in `['character', 'location', 'term', 'phrase', 'other']` |
| `note` | `string` | **Yes** (defaults to `""`) | If present, must be string (`typeof === 'string'`) |
| `sourceChapterId` | `string` | No | Optional string |
| `needsReview` | `boolean` | No | Optional boolean |

---

## 2. Validation Invariant Matrix (`isGlossarySuggestionItem`)

```text
isGlossarySuggestionItem(item: unknown): item is GlossarySuggestion
```

| Candidate Input | Result | Reason |
| :--- | :---: | :--- |
| `{}` | `false` | Missing `chinese` and `term` |
| `{"chinese": 123}` | `false` | `chinese` is not a string |
| `{"chinese": "", "vietnamese": "A"}` | `false` | `chinese` is empty whitespace |
| `{"chinese": "   ", "vietnamese": "A"}` | `false` | `chinese` trims to 0 length |
| `{"chinese": "萧炎", "vietnamese": null}` | `false` | `vietnamese` is not a string |
| `{"chinese": "萧炎", "vietnamese": 123}` | `false` | `vietnamese` is not a string |
| `{"chinese": "萧炎", "vietnamese": "Tiêu Viêm", "type": "unknown"}` | `false` | `type` is not a valid `GlossaryType` |
| `{"chinese": "萧炎", "vietnamese": "Tiêu Viêm", "pinyin": 123}` | `false` | `pinyin` is not a string |
| `{"chinese": "萧炎", "vietnamese": "Tiêu Viêm", "note": 123}` | `false` | `note` is not a string |
| `{"chinese": "萧炎", "vietnamese": "Tiêu Viêm"}` | `true` | Valid required fields; optional fields default safely |
| `{"term": "斗破", "vietnamese": "Đấu Phá"}` | `true` | Valid via `term` fallback |
| `{"chinese": "萧炎", "vietnamese": "Tiêu Viêm", "type": "character", "note": "Nhân vật chính"}` | `true` | Fully conforming item |

---

## 3. Entity Snap-Back Guard Schema (`src/lib/sinoNormalize.ts`)

```ts
export function validateAndSnapBackEntities(entities: any[], rawText: string): any[]
```

### Invariant:
- Any entity object where `!item || typeof item.chinese !== 'string' || !item.chinese.trim()` MUST be filtered out immediately.
- Prevents `rawText.includes("") === true` from matching empty string inputs.

---

## 4. Translation Service Type Hardening (`src/services/`)

### A. Chapter Translation QA Tracking (`src/services/chapterTranslationService.ts`)
```ts
// Before:
let detectedQaIssues: any[] = [];

// After:
let detectedQaIssues: DirectQaCritiqueIssue[] = [];
```

### B. Direct QA Critique Params (`src/services/translation/types.ts`)
```ts
// Before:
export interface DirectQaCritiqueParams {
  sourceText: string;
  translatedText: string;
  genre?: string;
  tone?: string;
  description?: string;
  glossary?: any[];
  ...
}

// After:
export interface DirectQaCritiqueParams {
  sourceText: string;
  translatedText: string;
  genre?: string;
  tone?: string;
  description?: string;
  glossary?: GlossaryItem[];
  ...
}
```
