# Data Model: Batch Issue Decisions & Shared Connection Caching

## Entities & Type Definitions

The existing data types in `src/types/hakoChecker.ts` remain strictly unchanged per constitutional constraints. This feature enhances state manipulation and lifecycle caching.

### 1. QualityIssueDecision
Status of an issue in the moderation workflow:
```ts
export type QualityIssueDecision = 'pending' | 'confirmed' | 'review_needed' | 'dismissed';
```

### 2. QualityIssue
A single detected finding:
```ts
export interface QualityIssue {
  id: string;
  chapterId: string;
  chapterTitle: string;
  chapterNumber: number;
  category: QualityIssueCategory;
  severity: QualityIssueSeverity;
  vietnameseSnippet: string;
  rawSnippet?: string;
  explanation: string;
  suggestedFix?: string;
  decision: QualityIssueDecision;
  moderatorNote?: string;
  detectedBy: 'heuristic' | 'ai';
  createdAt: string;
}
```

### 3. QualityReviewSession
The aggregate root stored in IndexedDB (`HakoQualityCheckerDB`):
```ts
export interface QualityReviewSession {
  id: string;
  projectId: string;
  projectTitle: string;
  selectedChapterIds: string[];
  chapters: Record<string, ProjectReviewChapter>;
  issues: QualityIssue[];
  createdAt: string;
  updatedAt: string;
  status: 'idle' | 'analyzing' | 'completed' | 'partial';
  error?: { code: string; message: string };
}
```

## State Mutation Flow

```
[UI Panel: Batch Action Clicked]
           │
           ▼
[Extract matching pending IDs: string[]]
           │
           ▼
[onBatchDecisionChange(ids, decision)]
           │
           ▼
[useHakoReviewSession: updateMultipleIssueDecisions]
           │
           ├──► Set lookup: idSet.has(issue.id)
           ├──► Immutable map: current.issues.map(...)
           │
           ▼
[setSession(updated) & sessionRef.current = updated]
           │
           ▼
[persistSession(updated, 0) -> EXACTLY 1 CALL]
           │
           ▼
[hakoSessionStore: saveSession(updated)]
           │
           ▼
[Cached dbPromise: IDBDatabase -> transaction('readwrite').put()]
```
