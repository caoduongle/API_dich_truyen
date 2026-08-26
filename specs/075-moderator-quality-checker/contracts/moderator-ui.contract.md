# Contract: Moderator Workspace UI Components

**Feature**: `075-moderator-quality-checker`
**Date**: 2026-08-27
**Status**: Completed

## 1. Component Hierarchy & Navigation

- **Navigation Integration**:
  - Main Tab: `hako-checker` (Alt+6 keyboard shortcut).
  - Title in Vietnamese: `Kiểm Định Hako`.
  - Icon: `ShieldCheck` from `lucide-react`.

- **Component Hierarchy**:
  ```text
  src/components/hako-checker/
  ├── HakoCheckerWorkspace.tsx          # Main workspace container
  ├── HakoNovelImporter.tsx             # URL input & metadata fetcher + rate-limit handler
  ├── HakoChapterSelector.tsx           # Multi-select for up to 12 chapters + raw input accordions
  ├── HakoIssueReviewPanel.tsx          # Issue filtering, decision buttons (Confirm/Review/Dismiss)
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

### `HakoNovelImporter`
```typescript
export interface HakoNovelImporterProps {
  novelUrl: string;
  onUrlChange: (url: string) => void;
  onFetchMeta: (url: string) => Promise<void>;
  isLoading: boolean;
  error?: { message: string; code: string; retryAfterSeconds?: number };
}
```

### `HakoChapterSelector`
```typescript
export interface HakoChapterSelectorProps {
  novelMeta: HakoNovelMeta;
  selectedUrls: Set<string>;
  onToggleChapter: (url: string) => void;
  onSelectRange: (urls: string[]) => void;
  onClearSelection: () => void;
  rawTexts: Record<string, string>;
  onUpdateRawText: (url: string, raw: string) => void;
  onStartAnalysis: () => void;
  isAnalyzing: boolean;
}
```

### `HakoIssueReviewPanel`
```typescript
export interface HakoIssueReviewPanelProps {
  issues: QualityIssue[];
  chapters: Record<string, HakoReviewChapter>;
  onDecisionChange: (issueId: string, decision: QualityIssueDecision) => void;
  onNoteChange: (issueId: string, note: string) => void;
  onOpenExportModal: () => void;
  onReanalyze: () => void;
}
```
