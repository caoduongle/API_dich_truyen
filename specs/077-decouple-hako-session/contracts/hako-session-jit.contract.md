# Contract: Hako Quality Session & JIT Data Operations

**Feature**: `077-decouple-hako-session`
**Date**: 2026-08-27
**Status**: Ready

## 1. Type Definitions Contract (`src/types/hakoChecker.ts`)

```typescript
/**
 * Lightweight chapter metadata for storage in QualityReviewSession.
 * DOES NOT contain full text strings (vietnameseContent is decoupled).
 */
export interface HakoChapterMeta {
  chapterId: string;
  title: string;
  chapterNumber: number;
  translationType: 'polished' | 'raw' | 'none';
  wordCount: number;
  status: 'pending' | 'loaded' | 'analyzing' | 'done' | 'error';
  errorMessage?: string;
  rawChineseContent?: string;
}

/**
 * Backwards-compatible alias for UI components, with optional full text.
 */
export interface ProjectReviewChapter extends HakoChapterMeta {
  vietnameseContent?: string;
}

/**
 * Ephemeral full-text chapter payload used strictly at runtime during scan execution.
 */
export interface HakoChapterFull extends HakoChapterMeta {
  vietnameseContent: string;
  rawChineseContent?: string;
}

export interface QualityReviewSession {
  id: string;
  projectId: string;
  projectTitle: string;
  selectedChapterIds: string[]; // Max 12 IDs
  chapters: Record<string, ProjectReviewChapter>;
  issues: QualityIssue[];
  createdAt: string;
  updatedAt: string;
  status: 'idle' | 'analyzing' | 'completed' | 'error';
  error?: {
    code: string;
    message: string;
  };
}
```

---

## 2. Store Sanitization Contract (`src/services/hakoSessionStore.ts`)

### 2.1 `sanitizeSession(session: QualityReviewSession): QualityReviewSession`
- **Input**: Any `QualityReviewSession` instance.
- **Behavior**:
  - Clones metadata, `selectedChapterIds`, `issues`, and top-level properties.
  - Transforms `chapters` record so every entry has `vietnameseContent` removed / undefined.
  - Ensures payload size remains minimal (< 50 KB).
- **Return**: Sanitized `QualityReviewSession`.

### 2.2 `saveSession(session: QualityReviewSession): Promise<QualityReviewSession>`
- **Precondition**: Sanitizes session payload via `sanitizeSession` prior to calling `store.put()`.
- **Postcondition**: Stored record in IndexedDB `hako_quality_sessions` never contains full-text strings.

### 2.3 `getSession(id: string)`, `getLatestSession()`, `listSessions()`
- **Postcondition**: Returned records are passed through `sanitizeSession` to guarantee any legacy persisted data containing full text is cleaned on read.

---

## 3. Hook Interface Contract (`src/hooks/useHakoReviewSession.ts`)

```typescript
export interface UseHakoReviewSessionReturn {
  session: QualityReviewSession | null;
  isLoadingSession: boolean;
  isAnalyzing: boolean;
  analysisProgress: { current: number; total: number; message: string };
  error: { code: string; message: string } | null;
  setError: (err: { code: string; message: string } | null) => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  setAnalysisProgress: (progress: { current: number; total: number; message: string }) => void;
  selectProject: (project: StoryProject) => Promise<void>;
  toggleChapterSelection: (chapterId: string) => void;
  selectChapterRange: (chapterIds: string[]) => void;
  clearChapterSelection: () => void;
  updateChapterRawText: (chapterId: string, rawText: string) => void;
  updateSessionChaptersAndIssues: (
    chapters: Record<string, ProjectReviewChapter>,
    issues: QualityIssue[]
  ) => Promise<void>;
  updateIssueDecision: (
    issueId: string,
    decision: QualityIssueDecision,
    moderatorNote?: string
  ) => Promise<void>;
  resetCurrentSession: () => Promise<void>;
}
```

### Behaviors & Timing Guarantees:
1. `selectProject(project)`: Synchronously creates metadata map from `project.chapters` without invoking `getChapterFromDB`. Total duration $< 10\text{ms}$.
2. `toggleChapterSelection(id)`: Synchronously toggles ID in React state. Total duration $< 2\text{ms}$. Debounces persistent store write by 300ms.
3. `selectChapterRange(ids)`: Synchronously bounds IDs to max 12 items. Total duration $< 2\text{ms}$.
