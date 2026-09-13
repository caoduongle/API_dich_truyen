/**
 * Contract: Hako Review Scope & Decision Sync
 * Feature: 130-hako-review-scope-sync
 */

import {
  QualityIssue,
  QualityIssueDecision,
  ProjectReviewChapter,
  ReauditDiffSummary,
  IssueReconciliationResult,
} from '../../../src/types/hakoChecker';

export interface HakoIssueReviewPanelPropsContract {
  issues: QualityIssue[];
  chapters: Record<string, ProjectReviewChapter>;
  selectedChapterIds?: (string | number)[];
  onDecisionChange: (issueId: string, decision: QualityIssueDecision, note?: string) => void;
  onBatchDecisionChange?: (issueIds: string[], decision: QualityIssueDecision) => void;
  onOpenExportModal: () => void;
  onReanalyze: () => void;
  isAnalyzing: boolean;
  onOpenInTranslator?: (chapterId: string) => void;
  diffSummary?: ReauditDiffSummary | null;
  onDismissDiffSummary?: () => void;
}

export interface ReconcileIssuesWithDecisionsContract {
  (
    previousIssues: QualityIssue[],
    scannedIssues: QualityIssue[],
    scannedChapterIds: string[],
    chaptersContentMap?: Record<string, string>
  ): IssueReconciliationResult;
}
