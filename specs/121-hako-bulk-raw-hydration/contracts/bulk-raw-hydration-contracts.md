# Interface Contracts: Hako Bulk Raw Hydration

**Branch**: `121-hako-bulk-raw-hydration` | **Spec**: [spec.md](../spec.md)

## 1. `useHakoReviewSession` Contract Extension

The review session hook extends its return signature with a dedicated bulk hydration action:

```typescript
export interface UseHakoReviewSessionReturn {
  // ... existing fields ...
  
  /**
   * Tự động nạp hoặc cập nhật văn bản raw (sourceText) từ IndexedDB cho toàn bộ chương của dự án hiện tại
   * @returns Thống kê số chương nạp thành công, tổng số chương và số chương còn thiếu raw
   */
  hydrateAllChaptersRaw: () => Promise<{
    successCount: number;
    totalCount: number;
    missingRawCount: number;
  }>;
}
```

## 2. `HakoChapterSelector` Component Props Contract

The chapter selector component accepts the bulk hydration trigger:

```typescript
export interface HakoChapterSelectorProps {
  chapters: Record<string, ProjectReviewChapter>;
  selectedChapterIds: string[];
  totalAvailableWords: number;
  isAnalyzing: boolean;
  onToggleChapter: (chapterId: string) => void;
  onSelectRange: (fromChapter: number, toChapter: number) => void;
  onClearSelection: () => void;
  onSelectAll?: () => void;
  onUpdateRawText: (chapterId: string, rawText: string) => void;
  /** Callback kích hoạt nạp raw cho toàn bộ chương */
  onHydrateAllRaw?: () => Promise<{
    successCount: number;
    totalCount: number;
    missingRawCount: number;
  }>;
}
```

## 3. Database Query Contract

Uses the existing `getChaptersByProjectFromDB` function:

```typescript
export const getChaptersByProjectFromDB: (projectId: string) => Promise<Chapter[]>;
```
- **Input**: `projectId` (string)
- **Output**: Array of `Chapter` records belonging to that project, each with `id`, `title`, `sourceText`, `rawTranslation`, `polishedTranslation`.
- **Guarantee**: Executes single indexed query on `CHAPTERS_STORE` using index `projectId`.
