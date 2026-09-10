# Contract: Review Panel Pagination & Navigation Controls

## 1. Component Boundaries & External Props

The public props of `HakoIssueReviewPanel` remain 100% backward compatible:

```ts
export interface HakoIssueReviewPanelProps {
  issues: QualityIssue[];
  chapters: Record<string, ProjectReviewChapter>;
  onDecisionChange: (issueId: string, decision: QualityIssueDecision, note?: string) => void;
  onBatchDecisionChange?: (issueIds: string[], decision: QualityIssueDecision) => void;
  onOpenExportModal: () => void;
  onReanalyze: () => void;
  isAnalyzing: boolean;
}
```

## 2. Pagination Behavior Invariants

1. **Capacity Limit**: At any given time, the DOM subtree renders at most 20 `<HakoIssueCard>` instances.
2. **Conditional Rendering of Controls**:
   - If `filteredIssues.length > 20`: Pagination control bar MUST be visible.
   - If `filteredIssues.length <= 20`: Pagination control bar MUST NOT be rendered.
3. **Button Disablement**:
   - "Trang trước": Disabled if and only if `effectivePage <= 1`.
   - "Trang sau": Disabled if and only if `effectivePage >= totalPages`.
4. **Batch Operations**:
   - "Duyệt nhanh tất cả" and "Bỏ qua tất cả" MUST operate on all pending items in `filteredIssues`, NOT just `displayedIssues`.
