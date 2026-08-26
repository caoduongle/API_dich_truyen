# Contract: Quality Checker Service & Heuristics

**Feature**: `075-moderator-quality-checker`
**Date**: 2026-08-27
**Status**: Completed

## 1. Overview
Defines the functional contract for analyzing chapter texts to discover translation and editorial quality issues via rule-based heuristics and AI semantic checks.

---

## 2. Heuristic Check Interface

```typescript
export interface HeuristicScanInput {
  chapterUrl: string;
  chapterTitle: string;
  vietnameseContent: string;
}

export function runHeuristicQualityScan(input: HeuristicScanInput): QualityIssue[];
```

### Heuristic Rules:
1. **Raw Leak Detection (`raw_leak`)**:
   - Matches CJK characters: `[\u4e00-\u9fa5\u3040-\u30ff]`.
   - Severity: `critical` if >= 5 occurrences, `major` if 1-4 occurrences.
   - Evidence snippet: Extract sentence or paragraph containing the raw characters.
2. **Consecutive Paragraph Duplication (`repetition`)**:
   - Matches identical or near-identical consecutive non-empty lines (length > 20 characters).
   - Severity: `major`.
3. **Placeholder / Error Marker Detection (`other`)**:
   - Matches placeholder tags (e.g. `[chưa dịch]`, `[raw thiếu]`, `TODO`, `FIXME`).
   - Severity: `warning`.

---

## 3. AI Semantic Quality Scan Interface

```typescript
export interface AiQualityScanInput {
  apiKeys: string[];
  model?: string;
  novelTitle: string;
  chapters: Array<{
    url: string;
    title: string;
    vietnameseContent: string;
    rawChineseContent?: string;
  }>;
  onProgress?: (chapterIndex: number, total: number, message: string) => void;
  signal?: AbortSignal;
}

export async function runAiQualityScan(input: AiQualityScanInput): Promise<QualityIssue[]>;
```

### AI Response Schema:
```json
{
  "issues": [
    {
      "chapterTitle": "string",
      "category": "inconsistent_name | pronoun_gender | terminology_drift | repetition | wrong_chapter | mistranslation | omission | hallucination | other",
      "severity": "critical | major | minor | warning",
      "vietnameseSnippet": "string",
      "rawSnippet": "string (optional)",
      "explanation": "string",
      "suggestedFix": "string (optional)"
    }
  ]
}
```
