# Contract: Hako Incremental Review Persistence & Partial State Operations

**Feature**: `093-incremental-hako-persistence`  
**Date**: 2026-09-10  
**Status**: Ready  

## 1. Type Interface Contract (`src/types/hakoChecker.ts`)

```typescript
export interface QualityReviewSession {
  id: string;
  projectId: string;
  projectTitle: string;
  selectedChapterIds: string[];    // Maximum 12 chapter IDs
  chapters: Record<string, ProjectReviewChapter>;
  issues: QualityIssue[];
  createdAt: string;
  updatedAt: string;
  status: 'idle' | 'analyzing' | 'completed' | 'partial' | 'error';
  error?: {
    code: string;
    message: string;
  };
}
```

---

## 2. Hook API Contract (`src/hooks/useHakoReviewSession.ts`)

### 2.1 `updateSessionChaptersAndIssues`
```typescript
updateSessionChaptersAndIssues: (
  chapters: Record<string, ProjectReviewChapter>,
  issues: QualityIssue[],
  status?: 'completed' | 'partial' | 'analyzing'
) => Promise<void>;
```

#### Contract Guarantees:
1. **Default Status**: When `status` argument is omitted, it defaults to `'completed'`.
2. **Payload Sanitization**: Strips any ephemeral `vietnameseContent` strings from `chapters` before serializing to IndexedDB via `persistSession(updated, 0)`.
3. **Timestamp Update**: Updates `updatedAt` to `new Date().toISOString()`.
4. **State Synchronization**: Synchronously updates React state (`setSession`) and `sessionRef.current` so subsequent calls within the same event loop or tick read the latest persisted state.

---

## 3. Workspace Pipeline Contract (`src/components/hako-checker/HakoCheckerWorkspace.tsx`)

### 3.1 Per-Chapter Scan Contract
```typescript
for (let i = 0; i < jitChapters.length; i++) {
  // Check abort signal before starting chapter
  if (abortControllerRef.current?.signal.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  // 1. Heuristic Scan for jitChapters[i]
  // 2. AI Scan for jitChapters[i] via runAiQualityScan({ chapters: [jitChapters[i]], ... })
  // 3. Mark jitChapters[i].status = 'done'
  // 4. Incremental save:
  const isLast = (i === jitChapters.length - 1);
  await updateSessionChaptersAndIssues(
    updatedChaptersRecord,
    allDetectedIssues,
    isLast ? 'completed' : 'analyzing'
  );
}
```

### 3.2 Catch-Block Fail-Safe Contract
```typescript
catch (err: any) {
  const isAborted = err.name === 'AbortError' || abortControllerRef.current?.signal.aborted;
  // Mark currently active chapter if incomplete
  // Save ALL detected issues collected up to this point
  await updateSessionChaptersAndIssues(
    updatedChaptersRecord,
    allDetectedIssues,
    'partial'
  );
}
```

### 3.3 UI Rendering Contract
```typescript
// Review Panel is rendered when project is selected and session status is 'completed' OR 'partial':
{hasProjectSelected && (session.status === 'completed' || session.status === 'partial') && (
  // If 'partial', show informative warning banner with completed count vs total count
  // Render HakoIssueReviewPanel with session.issues and session.chapters
)}
```
