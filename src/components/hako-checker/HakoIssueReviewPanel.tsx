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
  HakoReviewChapter,
} from '../../types/hakoChecker';
import { HakoIssueCard } from './HakoIssueCard';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { Seal } from '../ui/Seal';
import { cn } from '../../lib/cn';

export interface HakoIssueReviewPanelProps {
  issues: QualityIssue[];
  chapters: Record<string, HakoReviewChapter>;
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
  const [filterChapterUrl, setFilterChapterUrl] = useState<string>('all');

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
      if (filterChapterUrl !== 'all' && issue.chapterUrl !== filterChapterUrl) return false;
      return true;
    });
  }, [issues, filterSeverity, filterCategory, filterDecision, filterChapterUrl]);

  // Unique chapters in the issue list for filter dropdown
  const chapterOptions = useMemo(() => {
    const map = new Map<string, string>();
    issues.forEach((i) => map.set(i.chapterUrl, i.chapterTitle));
    return Array.from(map.entries()).map(([url, title]) => ({ url, title }));
  }, [issues]);

  return (
    <div className="space-y-4">
      {/* Top Header & Statistics Summary */}
      <div className="bg-parchment border border-parchment-2 rounded-md p-5 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-parchment-2">
          <div className="flex items-center gap-3">
            <Seal character="評" tone="polish" className="text-[12px]" />
            <div>
              <h3 className="text-base font-display font-bold text-text-main flex items-center gap-2">
                Kết quả kiểm định chất lượng bản dịch
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Tổng cộng phát hiện <strong>{stats.total} lỗi nghi vấn</strong> trên các chương đã chọn
              </p>
            </div>
          </div>

          {/* Action buttons: Export Report & Re-analyze */}
          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onReanalyze}
              disabled={isAnalyzing}
              icon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Rà soát lại
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onOpenExportModal}
              icon={<Download className="w-3.5 h-3.5" />}
              className="font-bold"
            >
              Xuất báo cáo ({stats.confirmed} lỗi)
            </Button>
          </div>
        </div>

        {/* Stats Count Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5 pt-4">
          <div
            onClick={() => setFilterDecision('confirmed')}
            className={cn(
              'p-2.5 rounded-[3px] border transition-all cursor-pointer select-none',
              filterDecision === 'confirmed'
                ? 'bg-polish/20 border-polish/60 ring-1 ring-polish/30'
                : 'bg-ink/50 border-parchment-2 hover:bg-parchment-2/30'
            )}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-polish mb-1">
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Đã xác nhận</span>
              </span>
              <span className="font-mono text-sm font-bold">{stats.confirmed}</span>
            </div>
            <p className="text-[10px] text-text-muted">Cần dịch giả sửa</p>
          </div>

          <div
            onClick={() => setFilterDecision('review_needed')}
            className={cn(
              'p-2.5 rounded-[3px] border transition-all cursor-pointer select-none',
              filterDecision === 'review_needed'
                ? 'bg-amber-950/50 border-amber-700 ring-1 ring-amber-700/30'
                : 'bg-ink/50 border-parchment-2 hover:bg-parchment-2/30'
            )}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-amber-300 mb-1">
              <span className="flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Cần xem lại</span>
              </span>
              <span className="font-mono text-sm font-bold">{stats.reviewNeeded}</span>
            </div>
            <p className="text-[10px] text-text-muted">Cần hội ý thêm</p>
          </div>

          <div
            onClick={() => setFilterDecision('dismissed')}
            className={cn(
              'p-2.5 rounded-[3px] border transition-all cursor-pointer select-none',
              filterDecision === 'dismissed'
                ? 'bg-ink/80 border-parchment-2 ring-1 ring-parchment-2'
                : 'bg-ink/50 border-parchment-2 hover:bg-parchment-2/30'
            )}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-text-muted mb-1">
              <span className="flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" />
                <span>Đã bỏ qua</span>
              </span>
              <span className="font-mono text-sm font-bold">{stats.dismissed}</span>
            </div>
            <p className="text-[10px] text-text-muted">Bác bỏ nghi vấn</p>
          </div>

          <div
            onClick={() => setFilterDecision('pending')}
            className={cn(
              'p-2.5 rounded-[3px] border transition-all cursor-pointer select-none',
              filterDecision === 'pending'
                ? 'bg-parchment-2/60 border-parchment-2 ring-1 ring-parchment-2'
                : 'bg-ink/50 border-parchment-2 hover:bg-parchment-2/30'
            )}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-text-main mb-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-text-muted" />
                <span>Chờ xử lý</span>
              </span>
              <span className="font-mono text-sm font-bold">{stats.pending}</span>
            </div>
            <p className="text-[10px] text-text-muted">Chưa duyệt</p>
          </div>

          <div
            onClick={() => {
              setFilterDecision('all');
              setFilterSeverity('all');
              setFilterCategory('all');
              setFilterChapterUrl('all');
            }}
            className="p-2.5 rounded-[3px] border border-parchment-2 bg-ink/30 hover:bg-parchment-2/30 transition-all cursor-pointer select-none hidden md:block"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-text-main mb-1">
              <span>Tổng số lỗi</span>
              <span className="font-mono text-sm font-bold">{stats.total}</span>
            </div>
            <p className="text-[10px] text-text-muted">Xem tất cả</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-parchment border border-parchment-2 rounded-md p-3.5 shadow-xs">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-text-muted font-bold uppercase tracking-wider text-[10px] shrink-0">
            <Filter className="w-3.5 h-3.5 text-polish" />
            <span>Bộ lọc:</span>
          </span>

          {/* Severity Filter */}
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-ink/70 border border-parchment-2 rounded-[2px] px-2.5 py-1 text-xs text-text-main focus:outline-none focus:border-polish cursor-pointer"
          >
            <option value="all">Mọi mức độ ({stats.total})</option>
            <option value="critical">Nghiêm trọng ({stats.critical})</option>
            <option value="major">Lớn ({stats.major})</option>
            <option value="minor">Nhẹ ({stats.minor})</option>
            <option value="warning">Cảnh báo ({stats.warning})</option>
          </select>

          {/* Category Filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-ink/70 border border-parchment-2 rounded-[2px] px-2.5 py-1 text-xs text-text-main focus:outline-none focus:border-polish cursor-pointer"
          >
            <option value="all">Mọi danh mục lỗi</option>
            <option value="inconsistent_name">Tên riêng không nhất quán</option>
            <option value="pronoun_gender">Xưng hô / Giới tính</option>
            <option value="terminology_drift">Thuật ngữ không đồng bộ</option>
            <option value="raw_leak">Sót Hán tự / Raw</option>
            <option value="repetition">Trùng lặp đoạn văn</option>
            <option value="mistranslation">Dịch sai nghĩa gốc</option>
            <option value="omission">Bỏ sót câu / đoạn</option>
            <option value="hallucination">Dịch thừa / Bịa nghĩa</option>
            <option value="other">Khác</option>
          </select>

          {/* Decision Status Filter */}
          <select
            value={filterDecision}
            onChange={(e) => setFilterDecision(e.target.value)}
            className="bg-ink/70 border border-parchment-2 rounded-[2px] px-2.5 py-1 text-xs text-text-main focus:outline-none focus:border-polish cursor-pointer"
          >
            <option value="all">Mọi trạng thái quyết định</option>
            <option value="pending">Chờ xử lý ({stats.pending})</option>
            <option value="confirmed">Đã xác nhận ({stats.confirmed})</option>
            <option value="review_needed">Cần xem lại ({stats.reviewNeeded})</option>
            <option value="dismissed">Đã bỏ qua ({stats.dismissed})</option>
          </select>

          {/* Chapter Filter */}
          {chapterOptions.length > 1 && (
            <select
              value={filterChapterUrl}
              onChange={(e) => setFilterChapterUrl(e.target.value)}
              className="bg-ink/70 border border-parchment-2 rounded-[2px] px-2.5 py-1 text-xs text-text-main focus:outline-none focus:border-polish cursor-pointer max-w-[200px] truncate"
            >
              <option value="all">Tất cả các chương ({chapterOptions.length})</option>
              {chapterOptions.map((ch) => (
                <option key={ch.url} value={ch.url}>
                  {ch.title}
                </option>
              ))}
            </select>
          )}

          {/* Clear Filters */}
          {(filterSeverity !== 'all' ||
            filterCategory !== 'all' ||
            filterDecision !== 'all' ||
            filterChapterUrl !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setFilterSeverity('all');
                setFilterCategory('all');
                setFilterDecision('all');
                setFilterChapterUrl('all');
              }}
              className="text-[11px] text-polish hover:underline font-medium ml-auto cursor-pointer"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Issue Cards List */}
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
                    setFilterChapterUrl('all');
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
