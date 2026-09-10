# Contract: Batch Decision & Store Lifecycle

## 1. `useHakoReviewSession` Return Interface

```ts
export interface UseHakoReviewSessionReturn {
  // Existing fields
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
    issues: QualityIssue[],
    status?: 'completed' | 'partial' | 'analyzing'
  ) => Promise<void>;
  updateIssueDecision: (
    issueId: string,
    decision: QualityIssueDecision,
    moderatorNote?: string
  ) => Promise<void>;
  resetCurrentSession: () => Promise<void>;

  // NEW METHOD:
  updateMultipleIssueDecisions: (
    issueIds: string[],
    decision: QualityIssueDecision
  ) => Promise<void>;
}
```

### Behavior Contract for `updateMultipleIssueDecisions(issueIds, decision)`:
1. **Preconditions**: `sessionRef.current` exists and `issueIds.length > 0`.
2. **State Transition**: All issues in `session.issues` where `issue.id ∈ issueIds` have `issue.decision` transitioned to `decision`. All other issues remain untouched.
3. **Storage Invariant**: Calls `persistSession(updated, 0)` exactly once. Does not execute iterative or debounced writes.
4. **Idempotence**: Calling with empty `issueIds` is a no-op and executes zero database writes.

---

## 2. `HakoIssueReviewPanel` Component Props

```ts
export interface HakoIssueReviewPanelProps {
  issues: QualityIssue[];
  chapters: Record<string, ProjectReviewChapter>;
  onDecisionChange: (issueId: string, decision: QualityIssueDecision, note?: string) => void;
  onBatchDecisionChange?: (issueIds: string[], decision: QualityIssueDecision) => void; // NEW OPTIONAL PROP
  onOpenExportModal: () => void;
  onReanalyze: () => void;
  isAnalyzing: boolean;
}
```

### Behavior Contract:
1. When user clicks "Xác nhận tất cả":
   - Identifies all `issue` in `filteredIssues` with `issue.decision === 'pending'`.
   - If none found, does nothing.
   - If `onBatchDecisionChange` is provided: calls `onBatchDecisionChange(pendingIds, 'confirmed')`.
   - If not provided: falls back to calling `onDecisionChange(id, 'confirmed')` per issue.
2. When user clicks "Bác bỏ tất cả":
   - Identifies all `issue` in `filteredIssues` with `issue.decision === 'pending'`.
   - If none found, does nothing.
   - If `onBatchDecisionChange` is provided: calls `onBatchDecisionChange(pendingIds, 'dismissed')`.
   - If not provided: falls back to calling `onDecisionChange(id, 'dismissed')` per issue.

---

## 3. `hakoSessionStore` Database Lifecycle Contract

```ts
// Module-level connection promise cache
let dbPromise: Promise<IDBDatabase> | null = null;

// Internal getter
function openDatabase(): Promise<IDBDatabase>
```

### Invariants:
1. `openDatabase()` returns the same `Promise<IDBDatabase>` if `dbPromise !== null`.
2. If `db.onclose` fires, `dbPromise` is set to `null`.
3. If `db.onversionchange` fires, `db.close()` is called and `dbPromise` is set to `null`.
4. If `indexedDB.open` errors or rejects, `dbPromise` is set to `null`.
