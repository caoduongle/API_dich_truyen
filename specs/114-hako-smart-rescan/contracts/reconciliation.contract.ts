/**
 * Contract: Smart Re-audit & Decision Reconciliation
 * Feature: 114-hako-smart-rescan
 */

import {
  QualityIssue,
  QualityIssueCategory,
  QualityIssueDecision,
  QualityIssueSeverity,
} from '../../../src/types/hakoChecker';

export interface ReauditDiffSummary {
  resolvedCount: number;
  unresolvedCount: number;
  dismissedCount: number;
  newCount: number;
  totalCurrent: number;
}

export interface IssueReconciliationResult {
  reconciledIssues: QualityIssue[];
  diffSummary: ReauditDiffSummary;
}

export interface ReconciliationContract {
  /**
   * Tạo chuỗi chữ ký (fingerprint) định danh duy nhất cho một lỗi
   */
  generateIssueFingerprint(
    chapterId: string,
    category: QualityIssueCategory,
    snippet: string
  ): string;

  /**
   * Hòa giải danh sách lỗi mới quét được với danh sách lỗi và quyết định đã có từ trước
   */
  reconcileIssuesWithDecisions(
    previousIssues: QualityIssue[],
    scannedIssues: QualityIssue[],
    scannedChapterIds: string[]
  ): IssueReconciliationResult;
}

