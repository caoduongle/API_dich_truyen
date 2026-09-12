# Data Model: Hako Bulk Raw Hydration

**Branch**: `121-hako-bulk-raw-hydration` | **Spec**: [spec.md](spec.md)

## 1. Entities

### `ProjectReviewChapter` (Existing Entity in `src/types/hakoChecker.ts`)
Represents an individual chapter's review state in the Hako Quality Checker:

| Field | Type | Description |
|---|---|---|
| `chapterId` | `string` | Unique chapter identifier linking to `Chapter.id` in IndexedDB |
| `title` | `string` | Chapter title |
| `chapterNumber` | `number` | Display chapter number |
| `translationType` | `'polished' \| 'raw' \| 'none'` | Translation stage |
| `wordCount` | `number` | Calculated Vietnamese word count |
| `status` | `'pending' \| 'analyzing' \| 'done' \| 'error'` | Inspection status |
| `rawChineseContent` | `string \| undefined` | **Full original Chinese source text** (hydrated from `Chapter.sourceText`) |

### `QualityReviewSession` (Existing Entity in `src/types/hakoChecker.ts`)
The overall review session for the active project:

| Field | Type | Description |
|---|---|---|
| `projectId` | `string` | Active project ID |
| `projectTitle` | `string` | Active project title |
| `selectedChapterIds` | `string[]` | Currently selected chapter IDs |
| `chapters` | `Record<string, ProjectReviewChapter>` | Map of chapter ID to review metadata with hydrated `rawChineseContent` |
| `issues` | `QualityIssue[]` | Quality issues found during inspection |
| `status` | `'idle' \| 'scanning' \| 'completed'` | Overall session status |

### `BulkHydrationResult` (New Interface)
Result returned from bulk raw hydration operations:

```typescript
export interface BulkHydrationResult {
  /** Số chương đã nạp hoặc cập nhật raw thành công */
  successCount: number;
  /** Tổng số chương trong dự án */
  totalCount: number;
  /** Số chương thực sự chưa có sourceText trong database */
  missingRawCount: number;
}
```

## 2. State Lifecycle & Transitions

```
[Project Selected]
        │
        ▼
[Fetch getChaptersByProjectFromDB(projectId)]
        │
        ├── All chapters have sourceText ──► [All chapters display "Đã có Raw (X ký tự)"]
        │
        └── Some chapters lack sourceText ──► [Populated: "Đã có Raw" | Missing: "+ Thêm Raw"]
                                                        │
                                                        ▼
                                                [User clicks "⚡ Nạp Raw toàn bộ"]
                                                        │
                                                        ▼
                                                [Re-query DB & update session state]
```
