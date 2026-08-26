# Contract: Hako Chapter Selection Runtime & Hook Interfaces

**Feature Branch**: `079-fix-hako-selection-crash`
**Date**: 2026-08-27
**Spec**: [spec.md](../spec.md)

## Component & Hook Interfaces

### 1. `useHakoReviewSession` Hook Contract

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
  
  // Accepts string or number and coerces to String internally
  toggleChapterSelection: (chapterId: string | number) => void;
  selectChapterRange: (chapterIds: (string | number)[]) => void;
  clearChapterSelection: () => void;
  updateChapterRawText: (chapterId: string | number, rawText: string) => void;
  
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

---

### 2. `HakoChapterSelector` Component Contract

```typescript
export interface HakoChapterSelectorProps {
  projects: StoryProject[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  selectedChapterIds: string[];
  chapters: Record<string, ProjectReviewChapter>;
  onToggleChapter: (chapterId: string) => void;
  onSelectRange: (chapterIds: string[]) => void;
  onClearSelection: () => void;
  onUpdateRawText: (chapterId: string, raw: string) => void;
  onStartAnalysis: () => void;
  isAnalyzing: boolean;
}
```

#### Row Guard Invariants

```tsx
{chapterList.map((ch, index) => {
  if (!ch) return null; // Invariant 1: Skip null/undefined slots
  
  const chapterIdStr = String(ch.chapterId || (ch as any).id || index);
  const isSelected = selectedChapterIds.some(id => String(id) === chapterIdStr);
  const chapterNumber = ch.chapterNumber ?? (index + 1);
  const title = ch.title || 'Chương không có tiêu đề';
  
  // Invariant 2: Stable, collision-free key
  return (
    <div key={ch.chapterId || `chap-row-${index}`}>
      {/* Safe render without throwing */}
    </div>
  );
})}
```

---

### 3. `HakoCheckerWorkspace` Aggregations Contract

```typescript
// Invariant: selectedChapters derivation MUST never contain undefined elements
const selectedChapters: ProjectReviewChapter[] = useMemo(() => {
  if (!session?.chapters || !session?.selectedChapterIds) return [];
  const selectedSet = new Set(session.selectedChapterIds.map(String));
  return Object.values(session.chapters).filter(
    (c): c is ProjectReviewChapter => Boolean(c && selectedSet.has(String(c.chapterId)))
  );
}, [session?.chapters, session?.selectedChapterIds]);

// Invariant: totalSelectedWords always returns a valid integer
const totalSelectedWords: number = useMemo(() => {
  return selectedChapters.reduce((sum, c) => sum + (c?.wordCount || 0), 0);
}, [selectedChapters]);
```
