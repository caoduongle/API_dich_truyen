# Phase 1 Data Model: Strict AI Pipeline Validation and Structural Integrity

**Feature**: `157-ai-pipeline-strict-validation`  
**Date**: 2026-09-22  
**Status**: Completed  

## 1. Core Data Structures & Validation Schemas

### 1.1 QA Critique Response & Issue Items

```ts
export interface QaCritiqueIssue {
  type: 'omission' | 'addition' | 'repetition' | 'terminology' | 'other';
  severity: 'critical' | 'warning' | 'info';
  targetText: string;
  description: string;
}

export interface QaCritiqueResponse {
  isValid: boolean;
  issues: unknown[];
  [key: string]: unknown;
}
```

#### Validation Rules:
- `isQaCritiqueResponse(data: unknown): data is QaCritiqueResponse`:
  - `data !== null && typeof data === 'object'`
  - `typeof data.isValid === 'boolean'` (strictly required; neither missing nor non-boolean allowed)
  - `Array.isArray(data.issues)` (strictly required; neither missing nor non-array allowed)
  - Result: `{}` -> `false`, `{ isValid: true }` -> `false`, `{ issues: [] }` -> `false`, `{ isValid: true, issues: [] }` -> `true`.
- `isQaCritiqueIssue(item: unknown): item is QaCritiqueIssue`:
  - `item !== null && typeof item === 'object'`
  - `typeof item.description === 'string' && item.description.trim().length > 0`
  - `typeof item.targetText === 'string'` (empty string allowed only for `type === 'omission'`)
  - `['omission', 'addition', 'repetition', 'terminology', 'other'].includes(item.type)`
  - `['critical', 'warning', 'info'].includes(item.severity)`
  - Result: Any item failing these criteria is dropped via `.filter()`.

---

### 1.2 Discovered Entity Model (Option A)

```ts
export interface DiscoveredEntity {
  chinese: string;
  pinyin: string;
  vietnamese: string;
  type: GlossaryType;
  note: string;
  needsReview?: boolean;
}
```

#### Validation Rules (`validateDiscoveredEntity(item: unknown): DiscoveredEntity | null`):
- `item !== null && typeof item === 'object'`
- `typeof item.chinese === 'string' && item.chinese.trim().length > 0`: Required non-empty string.
- Optional fields (`vietnamese`, `pinyin`, `note`):
  - If `undefined`: Accepted, assigned default `""`.
  - If present and `typeof item[field] !== 'string'`: **Rejected** (returns `null`).
- `type`:
  - If present and valid enum (`'character' | 'location' | 'term' | 'phrase' | 'other'`): Retained.
  - If missing or unrecognized string: Normalized to `'other'`.
  - If present and complex object/array: **Rejected** (returns `null`).
- `needsReview`: If boolean, retained; otherwise defaulted to `false`.

---

### 1.3 Cumulative Request Deadline State

```ts
interface CumulativeDeadlineState {
  logicalStartTime: number;
  overallDeadlineMs: number;
  elapsedMs: number;
  remainingMs: number;
  attemptTimeoutMs: number;
}
```

#### Transition Rules:
1. `logicalStartTime = Date.now()` recorded before attempt loop begins.
2. At the start of each attempt:
   - `elapsedMs = Date.now() - logicalStartTime`
   - `remainingMs = overallDeadlineMs - elapsedMs`
   - If `remainingMs <= 50`: Abort immediately with `TimeoutError` (`code: 'ETIMEDOUT'`).
   - Else: `attemptTimeoutMs = Math.min(remainingMs, 60_000)` (no minimum floor).

---

### 1.4 Secondary Structured Models

```ts
export interface QuickTermResponse {
  chinese: string;
  pinyin?: string;
  vietnamese?: string;
  type?: GlossaryType;
  note?: string;
}

export interface GlossarySuggestionsResponse {
  suggestions: unknown[];
}

export interface GuidelinesAnalysisResponse {
  genre?: string;
  tone?: string;
  description?: string;
}

export interface AlignChapterResponse {
  alignments: unknown[];
}

export interface HakoQualityScanResponse {
  issues: unknown[];
}
```

#### Validation Rules:
- `isQuickTermResponse`: Checks that `data` is an object with `chinese: string`. Optional string fields must be strings if defined.
- `isGlossarySuggestionsResponse`: Checks `Array.isArray(data.suggestions)`.
- `isGuidelinesAnalysisResponse`: Checks that any defined properties among `genre`, `tone`, `description` are strings.
- `isAlignChapterResponse`: Checks `Array.isArray(data.alignments)`.
- `isHakoQualityScanResponse`: Checks `Array.isArray(data.issues)`.
