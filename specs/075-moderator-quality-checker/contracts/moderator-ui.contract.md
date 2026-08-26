# Contract: Moderator Workspace UI Components

**Feature**: `075-moderator-quality-checker`
**Date**: 2026-08-27
**Status**: Completed

---

## 1. Component Hierarchy & Navigation

- **Navigation Integration**:
  - Main Tab: `hako-checker` (Alt+6 keyboard shortcut).
  - Title: `Kiểm Định Chất Lượng`.
  - Icon: `ShieldCheck` from `lucide-react`.

- **Component Hierarchy**:
  ```text
  src/components/hako-checker/
  ├── HakoCheckerWorkspace.tsx          # Main workspace container
  ├── HakoProjectSelector.tsx           # Project dropdown & Chapter selector (1-12 limit) with raw drawers
  ├── HakoIssueReviewPanel.tsx          # Issue filtering, stats, decision buttons (Confirm/Review/Dismiss)
  ├── HakoIssueCard.tsx                 # Detailed card with snippets, raw diff, moderator note
  └── HakoReportExportModal.tsx         # Summary stats & formatted report copy modal
  ```

---

## 2. Component Contracts & Props

### `HakoCheckerWorkspace`
```typescript
export interface HakoCheckerWorkspaceProps {
  apiKeys: string[];
  selectedModel?: string;
}
```

### `HakoProjectSelector` (or `HakoChapterSelector`)
```typescript
export interface HakoProjectSelectorProps {
  projects: StoryProject[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  selectedChapterIds: string[];
  chapters: Record<string, ProjectReviewChapter>;
  onToggleChapter: (chapterId: string) => void;
  onSelectRange: (chapterIds: string[]) => void;
  onClearSelection: () => void;
  onUpdateRawText: (chapterId: string, rawText: string) => void;
  onStartAnalysis: () => void;
  isAnalyzing: boolean;
}
```

### `HakoIssueReviewPanel`
```typescript
export interface HakoIssueReviewPanelProps {
  issues: QualityIssue[];
  chapters: Record<string, ProjectReviewChapter>;
  onDecisionChange: (issueId: string, decision: QualityIssueDecision, note?: string) => void;
  onOpenExportModal: () => void;
  onReanalyze: () => void;
  isAnalyzing: boolean;
}
```

### `HakoIssueCard`
```typescript
export interface HakoIssueCardProps {
  issue: QualityIssue;
  onDecisionChange: (issueId: string, decision: QualityIssueDecision, note?: string) => void;
}
```

### `HakoReportExportModal`
```typescript
export interface HakoReportExportModalProps {
  open: boolean;
  onClose: () => void;
  session: QualityReviewSession | null;
}
```
