/**
 * TypeScript types for Moderator Project Quality Checker Workspace
 * Feature: 075-moderator-quality-checker
 */

export type QualityIssueCategory =
  | 'inconsistent_name'    // Tên riêng nhân vật/địa danh không nhất quán
  | 'pronoun_gender'       // Nhân xưng, giới tính mâu thuẫn
  | 'terminology_drift'    // Thuật ngữ/chiêu thức dịch không đồng bộ
  | 'raw_leak'             // Sót ký tự tiếng Trung / Hán tự chưa dịch
  | 'repetition'           // Lặp đoạn / lặp câu liên tiếp / đăng nhầm
  | 'wrong_chapter'        // Đăng nhầm nội dung chương khác
  | 'mistranslation'       // Dịch sai lệch nghĩa gốc (yêu cầu raw)
  | 'omission'             // Bỏ sót câu/đoạn so với raw (yêu cầu raw)
  | 'hallucination'        // Bịa thêm nội dung không có trong raw (yêu cầu raw)
  | 'other';               // Lỗi biên tập khác

export type QualityIssueSeverity =
  | 'critical'             // Lỗi nghiêm trọng
  | 'major'                // Lỗi lớn
  | 'minor'                // Lỗi nhỏ
  | 'warning';             // Cảnh báo nghi vấn

export type QualityIssueDecision =
  | 'pending'              // Chờ moderator xem xét
  | 'confirmed'            // Moderator xác nhận là lỗi cần sửa
  | 'review_needed'        // Moderator đánh dấu cần hội ý thêm
  | 'dismissed'            // Moderator bác bỏ / bỏ qua
  | 'resolved';            // Lỗi đã được khắc phục sau khi sửa bản dịch

export interface HakoChapterMeta {
  chapterId: string;
  title: string;
  chapterNumber: number;
  translationType: 'polished' | 'raw' | 'none';
  wordCount: number;
  status: 'pending' | 'loaded' | 'analyzing' | 'done' | 'error';
  errorMessage?: string;
  rawChineseContent?: string;
}

export interface ProjectReviewChapter extends HakoChapterMeta {
  vietnameseContent?: string;
}

export interface HakoChapterFull extends HakoChapterMeta {
  vietnameseContent: string;
  rawChineseContent?: string;
}

export interface QualityIssue {
  id: string;                      // UUID định danh lỗi
  chapterId: string;
  chapterTitle: string;
  chapterNumber: number;           // Số thứ tự chương
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
  resolvedAt?: string;             // Thời điểm xác định đã khắc phục
  isNew?: boolean;                 // Lỗi mới phát sinh trong lần quét lại
}

export interface ReauditDiffSummary {
  resolvedCount: number;           // Số lỗi đã được khắc phục
  unresolvedCount: number;         // Số lỗi đã xác nhận nhưng vẫn tồn tại
  dismissedCount: number;          // Số lỗi bác bỏ được bảo toàn
  newCount: number;                // Số lỗi mới phát hiện
  totalCurrent: number;            // Tổng số lỗi còn hoạt động
}

export interface IssueReconciliationResult {
  reconciledIssues: QualityIssue[];
  diffSummary: ReauditDiffSummary;
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
  status: 'idle' | 'analyzing' | 'completed' | 'partial' | 'error';
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
  resolvedCount: number;
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
