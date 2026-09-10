import type { QualityIssueSeverity } from './hakoChecker';
import type { DirectQaCritiqueIssue } from '../services/directTranslationEngine';

/**
 * Nguồn phát hiện lỗi chất lượng:
 * - 'hako_rule': Kiểm định bằng quy tắc hoặc quét bán tự động từ Hako Engine
 * - 'ai_critique': Kiểm định ngữ nghĩa đối chiếu văn bản qua Gemini QA Critique
 */
export type IssueSource = 'hako_rule' | 'ai_critique';

/**
 * Mức độ nghiêm trọng hợp nhất (3 mức chuẩn hóa)
 */
export type UnifiedSeverity = 'error' | 'warning' | 'info';

/**
 * Bảng quy đổi mức độ nghiêm trọng từ Hako sang Unified Severity:
 * - 'critical' | 'major' -> 'error' (Lỗi nghiêm trọng cần khắc phục)
 * - 'minor' | 'warning' -> 'warning' (Cảnh báo nghi vấn / lỗi nhỏ)
 */
export const HAKO_SEVERITY_MAP: Record<QualityIssueSeverity, UnifiedSeverity> = {
  critical: 'error',
  major: 'error',
  minor: 'warning',
  warning: 'warning',
};

/**
 * Bảng quy đổi mức độ nghiêm trọng từ AI QA Critique sang Unified Severity:
 * - 'critical' -> 'error'
 * - 'warning' -> 'warning'
 * - 'info' -> 'info'
 */
export const QA_SEVERITY_MAP: Record<DirectQaCritiqueIssue['severity'], UnifiedSeverity> = {
  critical: 'error',
  warning: 'warning',
  info: 'info',
};

/**
 * Hàm quy đổi severity từ Hako Quality Engine
 */
export function mapHakoSeverity(severity: QualityIssueSeverity): UnifiedSeverity {
  return HAKO_SEVERITY_MAP[severity] ?? 'warning';
}

/**
 * Hàm quy đổi severity từ AI QA Critique
 */
export function mapQaSeverity(severity: DirectQaCritiqueIssue['severity']): UnifiedSeverity {
  return QA_SEVERITY_MAP[severity] ?? 'warning';
}

/**
 * Cấu trúc lỗi chất lượng thống nhất cho toàn bộ hệ thống kiểm duyệt và biên tập
 */
export interface UnifiedAuditIssue {
  id: string;
  source: IssueSource;
  severity: UnifiedSeverity;
  title: string;
  message: string;
  targetText?: string;
  suggestion?: string;
  autoFixable: boolean;
  status: 'pending' | 'resolved' | 'ignored';
}
