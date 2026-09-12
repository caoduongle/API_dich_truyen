# Interface Contracts: Hako Quality Inspection

**Feature**: `120-hako-truncation-omission-detection`  
**Date**: 2026-09-12  

## 1. Heuristic Scan Contract (`runHeuristicQualityScan`)

### Function Signature
```typescript
export interface HeuristicScanInput {
  chapterId?: string;
  url?: string;
  title: string;
  chapterNumber: number;
  vietnameseContent: string;
  rawChineseContent?: string;      // Optional raw Chinese source text
  translationType?: 'polished' | 'raw' | 'none';
}

export function runHeuristicQualityScan(chapter: HeuristicScanInput): QualityIssue[];
```

### Invariants & Guarantees
- **Execution Time**: Must return synchronously in < 2ms per chapter.
- **Determinism**: Identical text input always produces identical `QualityIssue[]` results.
- **Omission Guard Output**:
  - If triggered, issue contains:
    - `category`: `'omission'`
    - `severity`: `'critical'` (if raw ratio < 35% or structural paragraph mismatch) or `'major'` (if no raw but < 150 words).
    - `vietnameseSnippet`: Last non-empty sentence of `vietnameseContent`.
    - `rawSnippet`: Beginning of omitted raw text if available.
    - `explanation`: Detailed metrics indicating word/character count comparison and percentage.
    - `suggestedFix`: Clear actionable recommendation.

---

## 2. AI Semantic Scan Contract (`runAiQualityScan`)

### Input Signature
```typescript
export interface AiQualityScanInput {
  apiKeys: string[];
  model?: string;
  projectTitle: string;
  chapters: Array<{
    chapterId?: string;
    url?: string;
    title: string;
    chapterNumber: number;
    vietnameseContent: string;
    rawChineseContent?: string;
  }>;
  onProgress?: (chapterIndex: number, total: number, message: string) => void;
  signal?: AbortSignal;
}

export function runAiQualityScan(input: AiQualityScanInput): Promise<QualityIssue[]>;
```

### Response Schema & Parsing Rules
```typescript
// Gemini JSON Output Schema
{
  type: 'object',
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: [...] },
          severity: { type: 'string', enum: ['critical', 'major', 'minor', 'warning'] },
          vietnameseSnippet: { type: 'string' }, // Nullable/optional for omission
          rawSnippet: { type: 'string' },
          explanation: { type: 'string' },
          suggestedFix: { type: 'string' }
        },
        required: ['category', 'severity', 'explanation'] // vietnameseSnippet is NOT strictly required
      }
    }
  },
  required: ['issues']
}
```

- **Parsing Invariant**:
  - An issue of category `omission` with valid `rawSnippet` or `explanation` MUST NOT be discarded if `vietnameseSnippet` is empty.
  - If `vietnameseSnippet` is empty, fallback to the last 120 characters of `vietnameseContent` as the anchor.

---

## 3. Modal Raw Hydration Contract (`HakoChapterSelector`)

### Modal Open Contract
When user clicks `+ Thêm Raw` or `Đã có Raw` for chapter with ID `chapterIdStr`:
```typescript
async function handleOpenRawModal(chapterId: string): Promise<void> {
  setEditingRawChapterId(chapterId);
  const currentRaw = chapters[chapterId]?.rawChineseContent;
  if (!currentRaw || !currentRaw.trim()) {
    // Fetch sourceText from IndexedDB
    const fullChap = await getChapterFromDB(chapterId);
    if (fullChap?.sourceText?.trim()) {
      onUpdateRawText(chapterId, fullChap.sourceText.trim());
    }
  }
}
```
- Guarantees that the textarea is automatically populated with the actual Chinese raw characters stored in IndexedDB, replacing "Chưa có dữ liệu" with the actual character count.
