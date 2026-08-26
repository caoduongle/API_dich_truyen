/**
 * HakoIssueReviewPanel Component
 * Feature: 075-moderator-quality-checker
 *
 * Bảng điều khiển kiểm duyệt danh sách lỗi: lọc theo mức độ, phân loại, trạng thái quyết định,
 * hiển thị thống kê tổng quan và kích hoạt xuất báo cáo kiểm định.
 */

import React, { useState, useMemo } from 'react';
import {
  Filter,
  CheckCircle,
  HelpCircle,
  XCircle,
  Clock,
  Download,
  RotateCcw,
  Sparkles,
  CheckCheck,
} from 'lucide-react';
import {
  QualityIssue,
  QualityIssueDecision,
  QualityIssueSeverity,
  QualityIssueCategory,
  ProjectReviewChapter,
} from '../../types/hakoChecker';
import { HakoIssueCard } from './HakoIssueCard';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { Seal } from '../ui/Seal';
import { cn } from '../../lib/cn';

export interface HakoIssueReviewPanelProps {
  issues: QualityIssue[];
  chapters: Record<string, ProjectReviewChapter>;
  onDecisionChange: (issueId: string, decision: QualityIssueDecision, note?: string) => void;
  onOpenExportModal: () => void;
  onReanalyze: () => void;
  isAnalyzing: boolean;
}

export function HakoIssueReviewPanel({
  issues,
  chapters,
  onDecisionChange,
  onOpenExportModal,
  onReanalyze,
  isAnalyzing,
}: HakoIssueReviewPanelProps) {
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterDecision, setFilterDecision] = useState<string>('all');
  const [filterChapterId, setFilterChapterId] = useState<string>('all');

  // Stats calculation
  const stats = useMemo(() => {
    const total = issues.length;
    const confirmed = issues.filter((i) => i.decision === 'confirmed').length;
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

  // Unique chapters in the issue list for filter dropdown
  const chapterOptions = useMemo(() => {
    const map = new Map<string, string>();
    issues.forEach((i) => map.set(i.chapterId, i.chapterTitle));
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [issues]);

  // Batch action: Confirm all / Dismiss all filtered issues
  const handleBatchConfirm = () => {
    filteredIssues.forEach((issue) => {
      if (issue.decision === 'pending') {
        onDecisionChange(issue.id, 'confirmed');
      }
    });
  };

  const handleBatchDismiss = () => {
    filteredIssues.forEach((issue) => {
      if (issue.decision === 'pending') {
        onDecisionChange(issue.id, 'dismissed');
      }
    });
  };

  return (
    <div className="space-y-4">
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
              Hiển thị <strong>{filteredIssues.length}</strong> / {issues.length} lỗi
            </span>
          </div>

          {filteredIssues.map((issue) => (
            <HakoIssueCard
              key={issue.id}
              issue={issue}
              onDecisionChange={onDecisionChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default HakoIssueReviewPanel;
