# Contract: Virtualized Hako Chapter Selector & Session Store

## 1. Component Contract: `HakoChapterSelector`

```typescript
export interface HakoChapterSelectorProps {
  /** List of story projects available in the workspace */
  projects: StoryProject[];
  /** Currently selected project ID or null */
  selectedProjectId: string | null;
  /** Callback fired when user selects a project */
  onSelectProject: (projectId: string) => void;
  /** Array of currently selected chapter IDs (max 12) */
  selectedChapterIds: string[];
  /** Dictionary of sanitized chapter records */
  chapters: Record<string, ProjectReviewChapter>;
  /** Toggle selection for a single chapter */
  onToggleChapter: (chapterId: string) => void;
  /** Select a specific slice/range of chapters */
  onSelectRange: (chapterIds: string[]) => void;
  /** Clear all active selections */
  onClearSelection: () => void;
  /** Update custom raw text snippet for a chapter */
  onUpdateRawText: (chapterId: string, raw: string) => void;
  /** Trigger quality scan analysis */
  onStartAnalysis: () => void;
  /** Flag indicating whether scan analysis is running */
  isAnalyzing: boolean;
}
```

### Virtualization Behavior
- When `Object.keys(chapters).length > 20`:
  - Renders a scrollable container with fixed inner height spacer (`totalHeight = items.length * itemHeight`).
  - Only maps visible rows calculated by `useVirtualList({ items, itemHeight: 48, containerHeight: 480, overscan: 8 })`.
- When `Object.keys(chapters).length <= 20`:
  - Directly maps standard list items for simplicity.

---

## 2. Hook Contract: `useHakoReviewSession`

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

### Persistence Invariants
- `toggleChapterSelection`, `selectChapterRange`, `clearChapterSelection` MUST update React state synchronously.
- Database write MUST be debounced (300ms) and invoke `saveSession(sanitizedSession)`.
- Cleanup MUST occur on unmount via timer ref clearance.
