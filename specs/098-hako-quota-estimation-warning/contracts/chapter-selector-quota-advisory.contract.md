# Interface Contract: Chapter Selector Quota Advisory & Call Estimation

**Feature**: `098-hako-quota-estimation-warning`  
**Date**: 2026-09-10

## 1. Component Props Contract

```typescript
export interface HakoChapterSelectorProps {
  projects: StoryProject[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  selectedChapterIds: (string | number)[];
  chapters: Record<string, ProjectReviewChapter>;
  onToggleChapter: (chapterId: string | number) => void;
  onSelectRange: (chapterIds: (string | number)[]) => void;
  onClearSelection: () => void;
  onUpdateRawText: (chapterId: string | number, raw: string) => void;
  onStartAnalysis: () => void;
  isAnalyzing: boolean;
  /** Optional API keys array to evaluate quota health; falls back to migrateAndLoadApiKeys() if omitted */
  apiKeys?: string[];
}
```

## 2. Visual Layout Contract

In `HakoChapterSelector.tsx`:
In the action footer area (around line 535 where Start Analysis CTA lives):

```tsx
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-parchment-2">
  <div className="flex flex-col gap-1.5 text-xs">
    {/* Readiness status / Chapter count */}
    <div className="text-text-muted flex items-center gap-2">
      {selectedChapterIds.length === 0 ? (
        <span className="flex items-center gap-1 text-text-muted">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Vui lòng chọn ít nhất 1 chương để bắt đầu kiểm định.</span>
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-polish font-medium">
          <Check className="w-3.5 h-3.5" />
          <span>Đã sẵn sàng rà soát {selectedChapterIds.length} chương.</span>
          <span className="text-text-muted font-mono text-[11px] bg-parchment-2/40 px-1.5 py-0.5 rounded-[2px] border border-parchment-2/50">
            ~{selectedChapterIds.length} lượt gọi AI
          </span>
        </span>
      )}
    </div>

    {/* Advisory Quota Warning (Non-blocking) */}
    {quotaAdvisory.hasQuotaRisk && selectedChapterIds.length > 0 && (
      <div
        data-testid="quota-advisory-warning"
        className="flex items-center gap-1.5 text-[11px] text-amber-300 bg-amber-950/30 border border-amber-800/50 rounded-[3px] px-2 py-1 max-w-fit"
      >
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>{quotaAdvisory.warningMessage}</span>
      </div>
    )}
  </div>

  {/* CTA Button */}
  <Button
    type="button"
    variant="primary"
    size="md"
    onClick={onStartAnalysis}
    disabled={isAnalyzing || selectedChapterIds.length === 0}
    icon={<Sparkles className="w-4 h-4" />}
    className="font-bold px-5 shrink-0"
  >
    {isAnalyzing ? 'Đang phân tích...' : `Bắt đầu kiểm định (${selectedChapterIds.length} chương)`}
  </Button>
</div>
```

## 3. Behavior Guarantees

| Situation | Estimation Tag | Advisory Warning | Start Button Disabled |
|-----------|----------------|------------------|-----------------------|
| $N = 0$ chapters selected | Hidden | Hidden | Yes (empty selection) |
| $N = 3$, keys healthy | `"~3 lượt gọi AI"` | Hidden | No (clickable) |
| $N = 3$, 1 key QuotaExhausted | `"~3 lượt gọi AI"` | Visible (amber) | No (clickable) |
| $N = 3$, all keys unavailable | `"~3 lượt gọi AI"` | Visible (amber) | No (clickable) |
| $N = 3$, analyzing active | `"~3 lượt gọi AI"` | State preserved | Yes (`isAnalyzing`) |
