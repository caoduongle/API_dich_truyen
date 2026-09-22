# Phase 1 Data Model: Strict QA Issue Validation & Secondary Pipeline Hardening

**Feature**: `158-qa-issue-strict-hardening` | **Date**: 2026-09-22 | **Spec**: [spec.md](spec.md)

---

## 1. QA Critique Issue Schema

### Definition (`src/lib/text.ts`)
```ts
export type QaCritiqueIssueType = 'omission' | 'addition' | 'repetition' | 'terminology' | 'other';
export type QaCritiqueIssueSeverity = 'critical' | 'warning' | 'info';

export interface QaCritiqueIssue {
  type: QaCritiqueIssueType;
  severity: QaCritiqueIssueSeverity;
  targetText: string;
  description?: string;
  message?: string;
}
```

### Validation Invariants (`isQaCritiqueIssue`)
| Field | Type | Required? | Validation Rules |
| :--- | :--- | :--- | :--- |
| `type` | string | **Yes** | Must be in `['omission', 'addition', 'repetition', 'terminology', 'other']` |
| `severity` | string | **Yes** | Must be in `['critical', 'warning', 'info']` |
| `targetText` | string | **Yes** | Must satisfy `typeof targetText === 'string'` (empty string `""` allowed for omissions) |
| `description` / `message` | string | **Yes** | At least one must be present as a string with `trim().length > 0` |

---

## 2. Hako AI Quality Scan Issue Schema

### Definition (`src/lib/text.ts` / `src/services/hakoQualityEngine.ts`)
```ts
export interface HakoQualityScanRawIssue {
  category: QualityIssueCategory;
  severity: QualityIssueSeverity;
  explanation: string;
  vietnameseSnippet?: string;
  rawSnippet?: string;
  suggestedFix?: string;
}
```

### Validation Invariants (`isHakoQualityScanIssue`)
| Field | Type | Required? | Validation Rules |
| :--- | :--- | :--- | :--- |
| `explanation` | string | **Yes** | Non-empty string (`trim().length > 0`) |
| `category` | string | **Yes** | Must be in valid `QualityIssueCategory` enum set |
| `severity` | string | **Yes** | Must be in valid `QualityIssueSeverity` enum set |
| `vietnameseSnippet` | string | No | If defined, must be string |
| `rawSnippet` | string | No | If defined, must be string |
| `suggestedFix` | string | No | If defined, must be string |

---

## 3. Glossary Suggestion Schema

### Definition (`src/lib/text.ts`)
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

### Validation Invariants (`isGlossarySuggestionsResponse`)
- Must be `{ suggestions: unknown[] }`.
- In `directGlossaryEngine.ts`, each item mapped from `suggestions` guarantees non-empty string `term`, string `vietnamese`, and optional typed properties.

---

## 4. Prompt Sanitization Contracts

### Sanitized Inputs
| Parameter | Source Function | Destination | Invariant |
| :--- | :--- | :--- | :--- |
| `options.genre` | `quickTranslateTermDirect` | AI System Instruction | `sanitizePromptInput(genre)` before interpolation |
| `projectTitle` | `hakoQualityEngine.runAiQualityScan` | User Prompt | `sanitizePromptInput(projectTitle)` before interpolation |
| `chapter.title` | `hakoQualityEngine.runAiQualityScan` | User Prompt | `sanitizePromptInput(chapter.title)` before interpolation |
