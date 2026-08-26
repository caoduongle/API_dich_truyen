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
  | 'dismissed';           // Moderator bác bỏ / bỏ qua

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
