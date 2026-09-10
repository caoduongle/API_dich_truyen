import type { QualityIssue, QualityIssueCategory } from '../types/hakoChecker';
import type { DirectQaCritiqueIssue } from './directTranslationEngine';
import {
  UnifiedAuditIssue,
  mapHakoSeverity,
  mapQaSeverity,
} from '../types/audit';

/**
 * Tiêu đề thân thiện cho từng phân loại lỗi từ Hako Quality Engine
 */
const HAKO_CATEGORY_TITLES: Record<QualityIssueCategory, string> = {
  inconsistent_name: 'Tên riêng không nhất quán',
  pronoun_gender: 'Mâu thuẫn nhân xưng / giới tính',
  terminology_drift: 'Thuật ngữ không đồng bộ',
  raw_leak: 'Sót ký tự Hán tự / Raw',
  repetition: 'Trùng lặp đoạn văn',
  wrong_chapter: 'Đăng nhầm chương',
  mistranslation: 'Dịch sai lệch nghĩa gốc',
  omission: 'Bỏ sót nội dung so với raw',
  hallucination: 'Bịa thêm nội dung so với raw',
  other: 'Vấn đề chất lượng khác',
};

/**
 * Tiêu đề thân thiện cho từng phân loại lỗi từ AI QA Critique
 */
const QA_TYPE_TITLES: Record<DirectQaCritiqueIssue['type'], string> = {
  omission: 'Bỏ sót nội dung',
  addition: 'Thêm thắt nội dung',
  repetition: 'Lặp lại câu chữ',
  terminology: 'Sai lệch thuật ngữ',
  other: 'Lỗi kiểm duyệt khác',
};

/**
 * Xác định xem một category lỗi Hako có thể tự động sửa chữa bằng quy tắc thuật toán hay không.
 *
 * Rationale phân loại:
 * - 'raw_leak': autoFixable = true. Có thể tự động lọc bỏ hoặc thay thế các ký tự Hán tự/raw sót lại bằng quy tắc Regex/từ điển.
 * - 'repetition': autoFixable = true. Có thể tự động loại bỏ đoạn văn/câu bị lặp lại y hệt liền kề một cách an toàn.
 *
 * Các category còn lại đánh giá autoFixable = false:
 * - 'inconsistent_name', 'pronoun_gender', 'terminology_drift': Cần kiến thức bối cảnh truyện, thiết lập nhân vật và danh sách thuật ngữ; thay thế mù quáng dễ gây lỗi ngữ pháp hoặc mâu thuẫn ngôi xưng.
 * - 'mistranslation', 'omission', 'hallucination': Đòi hỏi đối chiếu dịch thuật sâu giữa 2 ngôn ngữ và viết lại câu; rule tĩnh không thể tự sinh bản dịch chuẩn.
 * - 'wrong_chapter', 'other': Các lỗi cấu trúc dữ liệu hoặc biên tập phức tạp, bắt buộc cần sự can thiệp thủ công của dịch giả/moderator.
 */
export function isHakoCategoryAutoFixable(category: QualityIssueCategory): boolean {
  return category === 'raw_leak' || category === 'repetition';
}

/**
 * Tạo định danh duy nhất cho QA Critique Issue khi chưa có ID
 */
export function generateQaIssueId(): string {
  return `qa-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Chuyển đổi QualityIssue từ Hako Quality Engine sang UnifiedAuditIssue chuẩn hóa
 */
export function mapHakoIssueToUnified(issue: QualityIssue): UnifiedAuditIssue {
  const severity = mapHakoSeverity(issue.severity);
  const title = HAKO_CATEGORY_TITLES[issue.category] || 'Lỗi chất lượng Hako';
  const autoFixable = isHakoCategoryAutoFixable(issue.category);
  const status = issue.decision === 'dismissed' ? 'ignored' : 'pending';

  return {
    id: issue.id,
    source: 'hako_rule',
    severity,
    title,
    message: issue.explanation,
    targetText: issue.vietnameseSnippet || undefined,
    suggestion: issue.suggestedFix || undefined,
    autoFixable,
    status,
  };
}

/**
 * Chuyển đổi DirectQaCritiqueIssue từ AI QA Critique sang UnifiedAuditIssue chuẩn hóa
 *
 * - status: Luôn khởi tạo là 'pending'
 * - autoFixable: Luôn là false vì lỗi ngữ nghĩa AI cần quy trình gọi AI re-write chuyên biệt (sẽ tinh chỉnh ở Prompt B5)
 */
export function mapQaIssueToUnified(
  issue: DirectQaCritiqueIssue,
  id?: string
): UnifiedAuditIssue {
  const severity = mapQaSeverity(issue.severity);
  const title = QA_TYPE_TITLES[issue.type] || 'Lỗi kiểm duyệt AI';

  return {
    id: id || generateQaIssueId(),
    source: 'ai_critique',
    severity,
    title,
    message: issue.description,
    targetText: issue.targetText !== undefined ? issue.targetText : undefined,
    suggestion: undefined,
    autoFixable: false,
    status: 'pending',
  };
}
