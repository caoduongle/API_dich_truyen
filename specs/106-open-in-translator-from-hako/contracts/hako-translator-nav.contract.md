# Interface Contract: Hako Checker to Translator Navigation

## 1. `HakoCheckerWorkspaceProps` Contract
Location: `src/components/hako-checker/HakoCheckerWorkspace.tsx`

```typescript
export interface HakoCheckerWorkspaceProps {
  apiKeys: string[];
  selectedModel?: string;
  /**
   * Callback invoked to open a specific chapter in the Translator Workspace (BilingualEditor).
   * @param chapterId ID of the chapter to open and edit
   */
  onOpenInTranslator?: (chapterId: string) => void;
}
```

## 2. `HakoIssueReviewPanelProps` Contract
Location: `src/components/hako-checker/HakoIssueReviewPanel.tsx`

```typescript
export interface HakoIssueReviewPanelProps {
  issues: QualityIssue[];
  chapters: Record<string, ProjectReviewChapter>;
  onDecisionChange: (issueId: string, decision: QualityIssueDecision, note?: string) => void;
  onBatchDecisionChange?: (issueIds: string[], decision: QualityIssueDecision) => void;
  onOpenExportModal: () => void;
  onReanalyze: () => void;
  isAnalyzing: boolean;
  /**
   * Callback to open a specific chapter in Translator Workspace.
   */
  onOpenInTranslator?: (chapterId: string) => void;
}
```

## 3. `HakoIssueCardProps` Contract (Optional enhancement)
Location: `src/components/hako-checker/HakoIssueCard.tsx`

```typescript
export interface HakoIssueCardProps {
  issue: QualityIssue;
  onDecisionChange: (issueId: string, decision: QualityIssueDecision, note?: string) => void;
  /**
   * Optional callback to jump to editor for this issue's chapter.
   */
  onOpenInTranslator?: (chapterId: string) => void;
}
```

## 4. `AppContent` Handler Contract
Location: `src/App.tsx`

```typescript
/**
 * Resolves chapter from IndexedDB and opens it in the Translator workspace.
 * Reuses handleGoToTranslate without mutating tab-switching infrastructure.
 */
const handleOpenChapterFromHakoChecker = useCallback(
  async (chapterId: string): Promise<void> => {
    try {
      const chapter = await getChapterFromDB(chapterId);
      if (!chapter) {
        showToast({ message: 'Không tìm thấy dữ liệu chương!', type: 'error' });
        return;
      }
      handleGoToTranslate(chapter);
    } catch (err) {
      console.error('[AppContent] handleOpenChapterFromHakoChecker error:', err);
      showToast({
        message: 'Lỗi khi tải dữ liệu chương: ' + (err instanceof Error ? err.message : String(err)),
        type: 'error',
      });
    }
  },
  [handleGoToTranslate, showToast]
);
```

## 5. UI Elements Contract
- Button label: `"Mở trong Bàn Dịch để sửa"`
- Primitive component: `Button` from `src/components/ui/Button.tsx`
- Sizing / Variant:
  - In chapter summary bar: `variant="outline"`, `size="sm"`, with icon e.g. `<ExternalLink className="w-3.5 h-3.5" />` or `<BookOpen className="w-3.5 h-3.5" />`.
  - In issue cards: `variant="ghost"`, `size="sm"`, or link-style button.
