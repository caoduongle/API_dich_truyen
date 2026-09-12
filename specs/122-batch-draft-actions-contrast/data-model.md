# Data Model: Batch Draft Actions and State Transitions

## Entities

### 1. `Chapter` (Full Document in IndexedDB)
```typescript
interface Chapter {
  id: string;
  projectId: string;
  title: string;
  sourceText: string;
  processedSourceText?: string;
  rawTranslation?: string;
  polishedTranslation?: string;
  translatedLines: string[];
  status: 'not_started' | 'in_progress' | 'completed';
  createdAt: string;
  updatedAt: string;
}
```

### 2. `ChapterMetadata` (Lightweight Array in `StoryProject`)
```typescript
interface ChapterMetadata {
  id: string;
  title: string;
  order: number;
  status: 'not_started' | 'in_progress' | 'completed';
  createdAt: string;
  updatedAt: string;
}
```

## State Transitions per Batch Action

| Batch Action | Eligibility Criterion | Pre-State | Transformation | Post-State |
|---|---|---|---|---|
| **Batch Delete Polished** | `chap.polishedTranslation.trim().length > 0` | Any (`completed` or `in_progress`) | `polishedTranslation = ''`<br>`translatedLines = split(rawTranslation)` | If `hasRaw`: `'in_progress'`<br>Else: `'not_started'` |
| **Batch Delete Raw** | `chap.rawTranslation.trim().length > 0` | Any (`completed` or `in_progress`) | `rawTranslation = ''`<br>`translatedLines = split(polishedTranslation)` | If `hasPolished`: `'completed'`<br>Else: `'not_started'` |
| **Batch Promote Polished to Raw** | `chap.polishedTranslation.trim().length > 0` | `'completed'` or `in_progress` | `rawTranslation = polishedTranslation`<br>`polishedTranslation = ''`<br>`translatedLines = split(rawTranslation)` | `'in_progress'` |
| **Batch Reset to Source** | All selected | Any | `rawTranslation = ''`<br>`polishedTranslation = ''`<br>`translatedLines = []` | `'not_started'` |

## Atomic Project Metadata Synchronization

After updating the full documents in IndexedDB, the lightweight project metadata is updated in a single pass:

```typescript
const updatedMap = new Map(updatedChapters.map((c) => [c.id, c]));
const updatedChaptersMeta = activeProject.chapters.map((c) => {
  const updated = updatedMap.get(c.id);
  return updated ? { ...c, status: updated.status, updatedAt: updated.updatedAt } : c;
});
onUpdateProject({ ...activeProject, chapters: updatedChaptersMeta });
```
