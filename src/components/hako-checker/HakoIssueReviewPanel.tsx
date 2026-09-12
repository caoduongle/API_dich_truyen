/**
 * HakoIssueReviewPanel Component
 * Feature: 075-moderator-quality-checker
 *
 * Bảng điều khiển kiểm duyệt danh sách lỗi: lọc theo mức độ, phân loại, trạng thái quyết định,
 * hiển thị thống kê tổng quan và kích hoạt xuất báo cáo kiểm định.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Filter,
  CheckCircle,
  CheckCircle2,
  HelpCircle,
  XCircle,
  X,
  Clock,
  Download,
  RotateCcw,
  Sparkles,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  BookOpenText,
  ExternalLink,
} from 'lucide-react';
import {
  QualityIssue,
  QualityIssueDecision,
  QualityIssueSeverity,
  QualityIssueCategory,
  ProjectReviewChapter,
  ReauditDiffSummary,
} from '../../types/hakoChecker';
import { HakoIssueCard } from './HakoIssueCard';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { Seal } from '../ui/Seal';
import { Modal } from '../ui/Modal';
import { useNotifications } from '../NotificationSystem';
import { cn } from '../../lib/cn';

export interface HakoIssueReviewPanelProps {
  issues: QualityIssue[];
  chapters: Record<string, ProjectReviewChapter>;
  onDecisionChange: (issueId: string, decision: QualityIssueDecision, note?: string) => void;
  onBatchDecisionChange?: (issueIds: string[], decision: QualityIssueDecision) => void;
  onOpenExportModal: () => void;
  onReanalyze: () => void;
  isAnalyzing: boolean;
  onOpenInTranslator?: (chapterId: string) => void;
  diffSummary?: ReauditDiffSummary | null;
  onDismissDiffSummary?: () => void;
}

export interface BatchConfirmState {
  action: 'confirmed' | 'dismissed';
  ids: string[];
  count: number;
}

export const BATCH_CONFIRM_THRESHOLD = 5;

export function HakoIssueReviewPanel({
  issues,
  chapters,
  onDecisionChange,
  onBatchDecisionChange,
  onOpenExportModal,
  onReanalyze,
  isAnalyzing,
  onOpenInTranslator,
  diffSummary,
  onDismissDiffSummary,
}: HakoIssueReviewPanelProps) {
  let notifications: ReturnType<typeof useNotifications> | null = null;
  try {
    notifications = useNotifications();
  } catch {
    notifications = null;
  }

  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterDecision, setFilterDecision] = useState<string>('all');
  const [filterChapterId, setFilterChapterId] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [confirmBatch, setConfirmBatch] = useState<BatchConfirmState | null>(null);

  const PAGE_SIZE = 20;

  // Stats calculation
  const stats = useMemo(() => {
    const total = issues.length;
    const confirmed = issues.filter((i) => i.decision === 'confirmed').length;
    const resolved = issues.filter((i) => i.decision === 'resolved').length;
    const reviewNeeded = issues.filter((i) => i.decision === 'review_needed').length;
    const dismissed = issues.filter((i) => i.decision === 'dismissed').length;
    const pending = issues.filter((i) => i.decision === 'pending').length;

    const critical = issues.filter((i) => i.severity === 'critical').length;
    const major = issues.filter((i) => i.severity === 'major').length;
    const minor = issues.filter((i) => i.severity === 'minor').length;
    const warning = issues.filter((i) => i.severity === 'warning').length;

    return {
      total,
      confirmed,
      resolved,
      reviewNeeded,
      dismissed,
      pending,
      critical,
      major,
      minor,
      warning,
    };
  }, [issues]);

  // Filtered issues list
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (filterSeverity !== 'all' && issue.severity !== filterSeverity) return false;
      if (filterCategory !== 'all' && issue.category !== filterCategory) return false;
      if (filterDecision !== 'all' && issue.decision !== filterDecision) return false;
      if (filterChapterId !== 'all' && issue.chapterId !== filterChapterId) return false;
      return true;
    });
  }, [issues, filterSeverity, filterCategory, filterDecision, filterChapterId]);

  // Pagination calculations (PAGE_SIZE = 20)
  const totalPages = Math.max(1, Math.ceil(filteredIssues.length / PAGE_SIZE));
  const effectivePage = Math.min(Math.max(1, currentPage), totalPages);

  // Reset to page 1 whenever any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterSeverity, filterCategory, filterDecision, filterChapterId]);

  // Clamp page if totalPages shrinks below currentPage (e.g. issues reviewed/deleted)
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [totalPages, currentPage]);

  // Sliced sub-array for the visible page
  const displayedIssues = useMemo(() => {
    if (filteredIssues.length <= PAGE_SIZE) {
      return filteredIssues;
    }
    const startIndex = (effectivePage - 1) * PAGE_SIZE;
    return filteredIssues.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredIssues, effectivePage]);

  // Unique chapters in the issue list for filter dropdown
  const chapterOptions = useMemo(() => {
    const map = new Map<string, string>();
    issues.forEach((i) => map.set(i.chapterId, i.chapterTitle));
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [issues]);

  // Danh sách các chương phát hiện có lỗi kèm số lượng lỗi
  const chaptersWithIssues = useMemo(() => {
    const map = new Map<string, { id: string; number: number; title: string; issueCount: number }>();
    issues.forEach((issue) => {
      const existing = map.get(issue.chapterId);
      if (existing) {
        existing.issueCount += 1;
      } else {
        map.set(issue.chapterId, {
          id: issue.chapterId,
          number: issue.chapterNumber,
          title: issue.chapterTitle,
          issueCount: 1,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.number - b.number);
  }, [issues]);

  // Batch action execution helper with undo toast notification
  const executeBatchMutation = (action: 'confirmed' | 'dismissed', ids: string[]) => {
    if (ids.length === 0) return;

    if (onBatchDecisionChange) {
      onBatchDecisionChange(ids, action);
    } else {
      ids.forEach((id) => {
        onDecisionChange(id, action);
      });
    }

    const actionText = action === 'confirmed' ? 'duyệt' : 'bỏ qua';
    notifications?.showToast({
      message: `Đã ${actionText} ${ids.length} lỗi.`,
      type: 'success',
      duration: 7000,
      undoLabel: 'Hoàn tác',
      onUndo: () => {
        if (onBatchDecisionChange) {
          onBatchDecisionChange(ids, 'pending');
        } else {
          ids.forEach((id) => {
            onDecisionChange(id, 'pending');
          });
        }
      },
    });
  };

  // Batch action: Confirm all / Dismiss all filtered issues
  const handleBatchConfirm = () => {
    const pendingIds = filteredIssues
      .filter((issue) => issue.decision === 'pending')
      .map((issue) => issue.id);

    if (pendingIds.length === 0) return;

    if (pendingIds.length > BATCH_CONFIRM_THRESHOLD) {
      setConfirmBatch({
        action: 'confirmed',
        ids: pendingIds,
        count: pendingIds.length,
      });
    } else {
      executeBatchMutation('confirmed', pendingIds);
    }
  };

  const handleBatchDismiss = () => {
    const pendingIds = filteredIssues
      .filter((issue) => issue.decision === 'pending')
      .map((issue) => issue.id);

    if (pendingIds.length === 0) return;

    if (pendingIds.length > BATCH_CONFIRM_THRESHOLD) {
      setConfirmBatch({
        action: 'dismissed',
        ids: pendingIds,
        count: pendingIds.length,
      });
    } else {
      executeBatchMutation('dismissed', pendingIds);
    }
  };

  return (
    <div className="space-y-4">
      {/* Re-audit Diff Summary Alert */}
      {diffSummary && (
        <div className="bg-success/15 border border-success/30 text-text-main rounded-md p-3.5 shadow-xs flex items-start justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-display font-bold text-success">
                Kết quả rà soát lại có đối chiếu quyết định
              </h4>
              <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                Đã tự động đối chiếu các quyết định kiểm định trước đó:
                {diffSummary.resolvedCount > 0 && (
                  <span className="font-bold text-success"> {diffSummary.resolvedCount} lỗi đã được khắc phục sau khi sửa bản dịch (Đã giải quyết).</span>
                )}
                {diffSummary.unresolvedCount > 0 && (
                  <span className="text-warning font-medium"> {diffSummary.unresolvedCount} lỗi đã xác nhận vẫn còn tồn tại.</span>
                )}
                {diffSummary.newCount > 0 && (
                  <span className="text-info font-medium"> Phát hiện {diffSummary.newCount} lỗi mới phát sinh.</span>
                )}
                {diffSummary.dismissedCount > 0 && (
                  <span className="text-text-muted"> {diffSummary.dismissedCount} lỗi đã bỏ qua tiếp tục được bảo toàn.</span>
                )}
              </p>
            </div>
          </div>
          {onDismissDiffSummary && (
            <button
              type="button"
              onClick={onDismissDiffSummary}
              className="text-text-muted hover:text-text-main p-1 rounded hover:bg-parchment-2 transition-colors cursor-pointer shrink-0"
              title="Đóng thông báo"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Overview Stats Bar & Export Trigger */}
      <div className="bg-parchment border border-parchment-2 rounded-md p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Seal character="評" tone="polish" className="text-[11px]" />
              <span className="text-xs font-display font-bold text-text-main">
                Kết quả kiểm định chất lượng:
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Total Badge */}
              <Badge tone="neutral" className="font-mono font-bold px-2 py-0.5">
                Tổng {stats.total} lỗi
              </Badge>

              {/* Confirmed Badge */}
              <Badge tone="polish" className="font-mono font-bold px-2 py-0.5 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                <span>{stats.confirmed} đã xác nhận</span>
              </Badge>

              {/* Resolved Badge */}
              {stats.resolved > 0 && (
                <Badge tone="success" className="font-mono font-bold px-2 py-0.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{stats.resolved} đã khắc phục</span>
                </Badge>
              )}

              {/* Review Needed Badge */}
              {stats.reviewNeeded > 0 && (
                <Badge tone="neutral" className="font-mono font-bold px-2 py-0.5 text-amber-300 border-amber-500/40 flex items-center gap-1">
                  <HelpCircle className="w-3 h-3 text-amber-400" />
                  <span>{stats.reviewNeeded} cần xem lại</span>
                </Badge>
              )}

              {/* Pending Badge */}
              {stats.pending > 0 && (
                <Badge tone="neutral" className="font-mono text-text-muted px-2 py-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{stats.pending} chờ duyệt</span>
                </Badge>
              )}

              {/* Dismissed Badge */}
              {stats.dismissed > 0 && (
                <Badge tone="neutral" className="font-mono text-text-muted/60 px-2 py-0.5 flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  <span>{stats.dismissed} đã bỏ qua</span>
                </Badge>
              )}
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onReanalyze}
              disabled={isAnalyzing}
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              className="text-xs"
            >
              Rà soát lại
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onOpenExportModal}
              icon={<Download className="w-3.5 h-3.5" />}
              className="text-xs font-bold"
            >
              Xuất báo cáo kiểm định
            </Button>
          </div>
        </div>
      </div>

      {/* Chapter Issues Breakdown & Quick Jump to Translator */}
      {chaptersWithIssues.length > 0 && (
        <div
          data-testid="chapter-issues-breakdown"
          className="bg-parchment border border-parchment-2 rounded-md p-4 shadow-xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2 border-b border-parchment-2/60">
            <div className="flex items-center gap-2">
              <BookOpenText className="w-4 h-4 text-polish shrink-0" />
              <h4 className="text-xs font-display font-bold text-text-main">
                {`Danh sách chương phát hiện lỗi (${chaptersWithIssues.length} chương):`}
              </h4>
            </div>
            <span className="text-[11px] text-text-muted">
              Nhấn để mở chương tương ứng trong Bàn Dịch để sửa lỗi
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {chaptersWithIssues.map((chap) => (
              <div
                key={chap.id}
                data-testid={`chapter-issue-row-${chap.id}`}
                className="bg-ink/30 border border-parchment-2 rounded-[3px] p-2.5 flex items-center justify-between gap-2 hover:border-polish/40 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs truncate">
                    <span className="font-mono font-bold text-polish shrink-0">#{chap.number}</span>
                    <span className="font-medium text-text-main truncate" title={chap.title}>
                      {chap.title}
                    </span>
                  </div>
                  <div className="text-[10px] text-text-muted mt-0.5 font-mono">
                    <span className="text-amber-400 font-bold">{chap.issueCount}</span> lỗi phát hiện
                  </div>
                </div>

                {onOpenInTranslator && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenInTranslator(chap.id)}
                    icon={<ExternalLink className="w-3 h-3" />}
                    className="text-[11px] h-7 px-2 shrink-0 font-medium"
                    title={`Mở chương #${chap.number} trong Bàn Dịch để sửa`}
                  >
                    Mở trong Bàn Dịch để sửa
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Multi-Criteria Filter Bar */}
      <div className="bg-ink/50 border border-parchment-2 rounded-md p-3.5 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flex items-center gap-1 text-text-muted font-bold tracking-wider uppercase text-[10px]">
              <Filter className="w-3 h-3 text-polish" />
              <span>Bộ lọc:</span>
            </span>

            {/* Severity Filter */}
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="bg-ink border border-parchment-2 rounded-[2px] px-2 py-1 text-xs text-text-main focus:outline-none focus:border-polish cursor-pointer"
            >
              <option value="all">Tất cả mức độ</option>
              <option value="critical">Nghiêm trọng ({stats.critical})</option>
              <option value="major">Lớn ({stats.major})</option>
              <option value="minor">Nhẹ ({stats.minor})</option>
              <option value="warning">Cảnh báo ({stats.warning})</option>
            </select>

            {/* Category Filter */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-ink border border-parchment-2 rounded-[2px] px-2 py-1 text-xs text-text-main focus:outline-none focus:border-polish cursor-pointer"
            >
              <option value="all">Tất cả phân loại</option>
              <option value="inconsistent_name">Tên riêng không nhất quán</option>
              <option value="pronoun_gender">Xưng hô / Giới tính mâu thuẫn</option>
              <option value="terminology_drift">Thuật ngữ không đồng bộ</option>
              <option value="raw_leak">Sót ký tự Raw / Hán tự</option>
              <option value="repetition">Trùng lặp đoạn văn</option>
              <option value="mistranslation">Dịch sai nghĩa gốc</option>
              <option value="omission">Bỏ sót câu / đoạn</option>
              <option value="hallucination">Dịch thừa / Bịa nghĩa</option>
              <option value="other">Lỗi biên tập khác</option>
            </select>

            {/* Decision Status Filter */}
            <select
              value={filterDecision}
              onChange={(e) => setFilterDecision(e.target.value)}
              className="bg-ink border border-parchment-2 rounded-[2px] px-2 py-1 text-xs text-text-main focus:outline-none focus:border-polish cursor-pointer"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="pending">Chờ duyệt ({stats.pending})</option>
              <option value="confirmed">Đã xác nhận ({stats.confirmed})</option>
              <option value="resolved">Đã khắc phục ({stats.resolved})</option>
              <option value="review_needed">Cần xem lại ({stats.reviewNeeded})</option>
              <option value="dismissed">Đã bỏ qua ({stats.dismissed})</option>
            </select>

            {/* Chapter Filter */}
            {chapterOptions.length > 1 && (
              <select
                value={filterChapterId}
                onChange={(e) => setFilterChapterId(e.target.value)}
                className="bg-ink border border-parchment-2 rounded-[2px] px-2 py-1 text-xs text-text-main focus:outline-none focus:border-polish cursor-pointer max-w-[200px] truncate"
              >
                <option value="all">Tất cả các chương ({chapterOptions.length})</option>
                {chapterOptions.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.title}
                  </option>
                ))}
              </select>
            )}

            {/* Reset Filter Button */}
            {(filterSeverity !== 'all' ||
              filterCategory !== 'all' ||
              filterDecision !== 'all' ||
              filterChapterId !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setFilterSeverity('all');
                  setFilterCategory('all');
                  setFilterDecision('all');
                  setFilterChapterId('all');
                }}
                className="text-[11px] text-polish hover:underline cursor-pointer ml-1"
              >
                Đặt lại bộ lọc
              </button>
            )}
          </div>

          {/* Quick Batch Actions */}
          <div className="flex items-center gap-1.5 ml-auto">
            {stats.pending > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleBatchConfirm}
                  className="text-[10px] text-polish hover:bg-polish/15 px-2 py-0.5 rounded-[2px] border border-polish/30 transition-colors cursor-pointer"
                  title="Xác nhận toàn bộ các lỗi đang chờ duyệt trong bộ lọc này"
                >
                  Duyệt nhanh tất cả
                </button>
                <button
                  type="button"
                  onClick={handleBatchDismiss}
                  className="text-[10px] text-text-muted hover:bg-parchment-2 px-2 py-0.5 rounded-[2px] border border-parchment-2 transition-colors cursor-pointer"
                  title="Bỏ qua toàn bộ các lỗi đang chờ duyệt trong bộ lọc này"
                >
                  Bỏ qua tất cả
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Issues List or Empty State */}
      {filteredIssues.length === 0 ? (
        <div className="bg-parchment border border-parchment-2 rounded-md p-8 shadow-xs">
          <EmptyState
            title="Không tìm thấy lỗi nào phù hợp"
            description={
              issues.length === 0
                ? "Không phát hiện lỗi chất lượng nào trên các chương đã chọn. Bản dịch đạt chuẩn xuất sắc!"
                : "Không có lỗi nào khớp với bộ lọc hiện tại. Thử xóa hoặc thay đổi bộ lọc."
            }
            icon={<CheckCheck className="w-10 h-10 text-polish" />}
            action={
              issues.length > 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setFilterSeverity('all');
                    setFilterCategory('all');
                    setFilterDecision('all');
                    setFilterChapterId('all');
                  }}
                  className="text-xs"
                >
                  Đặt lại bộ lọc
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-text-muted px-1">
            <span>
              {filteredIssues.length > PAGE_SIZE ? (
                <>
                  Hiển thị{' '}
                  <strong>
                    {(effectivePage - 1) * PAGE_SIZE + 1}–
                    {(effectivePage - 1) * PAGE_SIZE + displayedIssues.length}
                  </strong>{' '}
                  / {filteredIssues.length} lỗi
                </>
              ) : (
                <>
                  Hiển thị <strong>{filteredIssues.length}</strong> / {issues.length} lỗi
                </>
              )}
            </span>
          </div>

          {displayedIssues.map((issue) => (
            <HakoIssueCard
              key={issue.id}
              issue={issue}
              onDecisionChange={onDecisionChange}
              onOpenInTranslator={onOpenInTranslator}
            />
          ))}

          {/* Pagination Controls Bar */}
          {filteredIssues.length > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-parchment-2 pt-3 text-xs text-text-muted">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={effectivePage <= 1}
                icon={<ChevronLeft className="w-3.5 h-3.5" />}
              >
                Trang trước
              </Button>

              <span className="font-mono text-text-main font-semibold">
                Trang {effectivePage} / {totalPages}
              </span>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={effectivePage >= totalPages}
                className="flex-row-reverse"
                icon={<ChevronRight className="w-3.5 h-3.5" />}
              >
                Trang sau
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal for Large Batch Actions */}
      <Modal
        open={confirmBatch !== null}
        onClose={() => setConfirmBatch(null)}
        title="Xác nhận thao tác hàng loạt"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setConfirmBatch(null)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                if (confirmBatch) {
                  executeBatchMutation(confirmBatch.action, confirmBatch.ids);
                  setConfirmBatch(null);
                }
              }}
            >
              Xác nhận
            </Button>
          </div>
        }
      >
        <p className="text-xs text-text-muted leading-relaxed">
          Bạn sắp {confirmBatch?.action === 'confirmed' ? 'duyệt' : 'bỏ qua'} {confirmBatch?.count} lỗi. Tiếp tục?
        </p>
      </Modal>
    </div>
  );
}

export default HakoIssueReviewPanel;
