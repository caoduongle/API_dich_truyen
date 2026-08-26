# Data Model: Moderator Project Quality Checker Workspace

**Feature**: `075-moderator-quality-checker`
**Date**: 2026-08-27
**Status**: Completed

---

## 1. Entity Definitions & Types

```typescript
export type QualityIssueCategory =
  | 'inconsistent_name'    // Tên riêng nhân vật/địa danh không nhất quán
  | 'pronoun_gender'       // Nhân xưng, giới tính mâu thuẫn
  | 'terminology_drift'    // Thuật ngữ/chiêu thức dịch không đồng bộ
  | 'raw_leak'             // Sót ký tự tiếng Trung / Hán tự chưa dịch
  | 'repetition'           // Lặp đoạn / lặp câu liên tiếp / đăng nhầm
  | 'wrong_chapter'        // Nhầm nội dung chương khác
  | 'mistranslation'       // Dịch sai lệch nghĩa gốc (so với raw)
  | 'omission'             // Bỏ sót câu/đoạn (so với raw)
  | 'hallucination'        // Bịa thêm nội dung không có trong raw
  | 'other';               // Lỗi biên tập khác

export type QualityIssueSeverity =
  | 'critical'             // Lỗi nghiêm trọng (sai giới tính nhân vật chính, sót raw hàng loạt, sai lệch nghĩa nặng)
  | 'major'                // Lỗi lớn (tên riêng thay đổi, mất đoạn văn, thuật ngữ cốt lõi bị đổi)
  | 'minor'                // Lỗi nhỏ (lỗi ngữ pháp nhẹ, từ đệm không tự nhiên)
  | 'warning';             // Cảnh báo nghi vấn (cần moderator xem xét xác nhận)

export type QualityIssueDecision =
  | 'pending'              // Chờ moderator xem xét
  | 'confirmed'            // Moderator xác nhận là lỗi cần sửa
  | 'review_needed'        // Moderator đánh dấu cần hội ý thêm với dịch giả
  | 'dismissed';           // Moderator bác bỏ / bỏ qua (không phải lỗi)

export interface ProjectReviewChapter {
  chapterId: string;
  title: string;
  chapterNumber: number;
  vietnameseContent: string;
  rawChineseContent?: string;
  translationType: 'polished' | 'raw' | 'none';
  wordCount: number;
  status: 'pending' | 'loaded' | 'analyzing' | 'done' | 'error';
  errorMessage?: string;
}

export interface QualityIssue {
  id: string;                      // UUID định danh lỗi
  chapterId: string;
  chapterTitle: string;
  category: QualityIssueCategory;
  severity: QualityIssueSeverity;
  vietnameseSnippet: string;       // Đoạn trích bản dịch tiếng Việt làm bằng chứng
  rawSnippet?: string;             // Đoạn trích raw tiếng Trung đối ứng (nếu có)
  explanation: string;             // Lời giải thích lý do nghi ngờ lỗi
  suggestedFix?: string;           // Gợi ý sửa lỗi nếu có
  decision: QualityIssueDecision;  // Quyết định của moderator
  moderatorNote?: string;          // Ghi chú của moderator
  detectedBy: 'heuristic' | 'ai';  // Nguồn phát hiện
  createdAt: string;
}

export interface QualityReviewSession {
  id: string;
  projectId: string;
  projectTitle: string;
  selectedChapterIds: string[];    // Tối đa 12 chapter IDs
  chapters: Record<string, ProjectReviewChapter>;
  issues: QualityIssue[];
  createdAt: string;
  updatedAt: string;
  status: 'idle' | 'analyzing' | 'completed' | 'error';
  error?: {
    code: string;
    message: string;
  };
}

export interface QualityReportStats {
  totalIssues: number;
  confirmedCount: number;
  reviewNeededCount: number;
  dismissedCount: number;
  pendingCount: number;
  bySeverity: Record<QualityIssueSeverity, number>;
  byCategory: Record<QualityIssueCategory, number>;
}

export interface QualityReport {
  sessionId: string;
  projectTitle: string;
  projectId: string;
  generatedAt: string;
  totalChaptersReviewed: number;
  stats: QualityReportStats;
  confirmedIssues: QualityIssue[];
  formattedMarkdown: string;
}
```

---

## 2. Validation & Business Rules

1. **Max Chapters Limit**: `selectedChapterIds.length` MUST be between 1 and 12 inclusive before starting analysis.
2. **Translation Content Resolution**:
   - If `Chapter.polishedTranslation` exists and is non-empty, use it with `translationType = 'polished'`.
   - Else if `Chapter.rawTranslation` exists and is non-empty, use it with `translationType = 'raw'`.
   - Else, mark chapter as `translationType = 'none'` and disable it from selection.
3. **Raw Chinese Text Resolution**:
   - Default `rawChineseContent = Chapter.sourceText`.
   - Moderator can paste custom raw text in the drawer to override for that review session without modifying the project's original `sourceText`.
4. **Decisions Persistence**: Changing `QualityIssue.decision` or `QualityIssue.moderatorNote` MUST immediately update the session in local storage / IndexedDB with timestamp `updatedAt`.

---

## 3. State Transitions

```mermaid
stateDiagram-v2
  [*] --> IDLE: Mở tab Kiểm Định
  IDLE --> PROJECT_SELECTED: Chọn dự án dịch
  PROJECT_SELECTED --> SELECTING_CHAPTERS: Chọn tối đa 12 chương
  SELECTING_CHAPTERS --> ANALYZING: Bấm Bắt đầu kiểm định
  ANALYZING --> COMPLETED: Rà soát Heuristic + AI hoàn tất
  COMPLETED --> MODERATOR_REVIEWING: Moderator duyệt danh sách lỗi
  MODERATOR_REVIEWING --> REPORT_EXPORTED: Sao chép / Xuất báo cáo
```
