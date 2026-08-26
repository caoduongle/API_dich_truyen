/**
 * HakoIssueCard Component
 * Feature: 075-moderator-quality-checker
 *
 * Hiển thị thẻ chi tiết cho một lỗi chất lượng được phát hiện kèm trích dẫn bằng chứng,
 * đoạn raw tiếng Trung đối ứng (nếu có), các nút quyết định và ô nhập ghi chú của moderator.
 */

import React, { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Info,
  Check,
  HelpCircle,
  X,
  MessageSquare,
  Sparkles,
  Cpu,
  FileCode,
  CheckCircle2,
  XCircle,
  Copy,
} from 'lucide-react';
import {
  QualityIssue,
  QualityIssueDecision,
  QualityIssueSeverity,
  QualityIssueCategory,
} from '../../types/hakoChecker';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/cn';

export interface HakoIssueCardProps {
  issue: QualityIssue;
  onDecisionChange: (issueId: string, decision: QualityIssueDecision, note?: string) => void;
}

const CATEGORY_NAMES: Record<QualityIssueCategory, string> = {
  inconsistent_name: 'Tên riêng không nhất quán',
  pronoun_gender: 'Xưng hô / Giới tính mâu thuẫn',
  terminology_drift: 'Thuật ngữ không đồng bộ',
  raw_leak: 'Sót ký tự Hán / Raw chưa dịch',
  repetition: 'Trùng lặp đoạn văn',
  wrong_chapter: 'Đăng nhầm chương',
  mistranslation: 'Dịch sai nghĩa gốc',
  omission: 'Bỏ sót câu / đoạn',
  hallucination: 'Dịch thừa / Bịa nghĩa',
  other: 'Lỗi biên tập khác',
};

export function HakoIssueCard({ issue, onDecisionChange }: HakoIssueCardProps) {
  const [isEditingNote, setIsEditingNote] = useState(!!issue.moderatorNote);
  const [noteText, setNoteText] = useState(issue.moderatorNote || '');
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyRaw = async () => {
    if (!issue.rawSnippet) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(issue.rawSnippet);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = issue.rawSnippet;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy raw text:', err);
    }
  };

  const handleSaveNote = () => {
    onDecisionChange(issue.id, issue.decision, noteText);
  };

  const severityBadge = () => {
    switch (issue.severity) {
      case 'critical':
        return (
          <Badge tone="danger" className="text-[10px] uppercase font-bold flex items-center gap-1">
            <AlertOctagon className="w-3 h-3 text-red-400" />
            <span>Nghiêm trọng</span>
          </Badge>
        );
      case 'major':
        return (
          <Badge tone="warning" className="text-[10px] uppercase font-bold flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>Lớn</span>
          </Badge>
        );
      case 'minor':
        return (
          <Badge tone="neutral" className="text-[10px] uppercase font-medium flex items-center gap-1">
            <Info className="w-3 h-3 text-text-muted" />
            <span>Nhẹ</span>
          </Badge>
        );
      case 'warning':
      default:
        return (
          <Badge tone="neutral" className="text-[10px] uppercase font-medium flex items-center gap-1">
            <Info className="w-3 h-3 text-sky-400" />
            <span>Cảnh báo</span>
          </Badge>
        );
    }
  };

  const decisionBadge = () => {
    switch (issue.decision) {
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-polish bg-polish/15 border border-polish/40 px-2 py-0.5 rounded-[2px]">
            <CheckCircle2 className="w-3 h-3" />
            <span>Đã xác nhận lỗi</span>
          </span>
        );
      case 'review_needed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-950/40 border border-amber-800/60 px-2 py-0.5 rounded-[2px]">
            <HelpCircle className="w-3 h-3" />
            <span>Cần xem lại</span>
          </span>
        );
      case 'dismissed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-text-muted bg-ink/70 border border-parchment-2 px-2 py-0.5 rounded-[2px]">
            <XCircle className="w-3 h-3" />
            <span>Đã bỏ qua</span>
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] text-text-muted bg-parchment-2/40 px-2 py-0.5 rounded-[2px]">
            <span>Chờ duyệt</span>
          </span>
        );
    }
  };

  return (
    <div
      className={cn(
        'border rounded-[3px] p-4 transition-all duration-150',
        issue.decision === 'confirmed'
          ? 'bg-parchment border-polish/50 shadow-xs'
          : issue.decision === 'dismissed'
          ? 'bg-ink/30 border-parchment-2/40 opacity-70'
          : issue.decision === 'review_needed'
          ? 'bg-parchment border-amber-700/50'
          : 'bg-parchment border-parchment-2'
      )}
    >
      {/* Top Header: Severity + Category + Detected By + Chapter */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 pb-2 border-b border-parchment-2/50">
        <div className="flex flex-wrap items-center gap-2">
          {severityBadge()}

          <span className="text-xs font-bold text-text-main">
            {CATEGORY_NAMES[issue.category] || issue.category}
          </span>

          <span className="inline-flex items-center gap-1 text-[10px] text-text-muted bg-ink/60 px-1.5 py-0.5 rounded-[2px] border border-parchment-2">
            {issue.detectedBy === 'ai' ? (
              <>
                <Sparkles className="w-2.5 h-2.5 text-polish" />
                <span>AI</span>
              </>
            ) : (
              <>
                <Cpu className="w-2.5 h-2.5 text-text-muted" />
                <span>Heuristic</span>
              </>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-text-muted font-medium truncate max-w-[200px]" title={issue.chapterTitle}>
            {issue.chapterTitle}
          </span>
          {decisionBadge()}
        </div>
      </div>

      {/* Vietnamese Evidence Snippet */}
      <div className="mb-3">
        <div className="text-[10px] uppercase font-bold text-text-muted tracking-wider mb-1">
          Trích đoạn bản dịch làm bằng chứng:
        </div>
        <div className="bg-ink/60 border-l-4 border-polish/80 border border-parchment-2 rounded-r-[2px] p-2.5 text-xs text-text-main leading-relaxed font-sans selection:bg-polish/30">
          "{issue.vietnameseSnippet}"
        </div>
      </div>

      {/* Optional Raw Chinese Snippet */}
      {issue.rawSnippet && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] uppercase font-bold text-text-muted tracking-wider mb-1">
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <FileCode className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              <span>Đoạn gốc tiếng Trung đối ứng (Raw):</span>
            </div>
            <button
              type="button"
              onClick={handleCopyRaw}
              title="Sao chép đoạn gốc tiếng Trung"
              className="flex items-center gap-1 text-[10px] font-medium text-text-muted hover:text-text-main px-1.5 py-0.5 rounded-[2px] bg-ink/50 border border-parchment-2 hover:border-polish/40 transition-colors cursor-pointer"
            >
              {isCopied ? (
                <>
                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Đã chép</span>
                </>
              ) : (
                <>
                  <Copy className="w-2.5 h-2.5" />
                  <span>Sao chép</span>
                </>
              )}
            </button>
          </div>
          <div className="bg-parchment/60 border-l-4 border-amber-600/80 border border-parchment-2 rounded-r-[2px] p-2.5 text-xs text-text-main font-medium leading-relaxed cjk-raw-snippet select-text">
            "{issue.rawSnippet}"
          </div>
        </div>
      )}

      {/* Explanation & Suggested Fix */}
      <div className="space-y-1.5 mb-3 text-xs">
        <div className="text-text-main leading-relaxed">
          <strong className="text-text-muted font-semibold">Giải thích: </strong>
          {issue.explanation}
        </div>

        {issue.suggestedFix && (
          <div className="text-text-muted text-[11px] leading-relaxed bg-parchment-2/30 p-2 rounded-[2px] border border-parchment-2/60">
            <strong className="text-polish font-medium">Gợi ý sửa: </strong>
            {issue.suggestedFix}
          </div>
        )}
      </div>

      {/* Moderator Note Field */}
      {isEditingNote ? (
        <div className="mb-3 pt-2 border-t border-parchment-2/50">
          <div className="flex items-center justify-between mb-1 text-[11px] text-text-muted font-medium">
            <span>Ghi chú của Moderator cho dịch giả / biên tập:</span>
            <button
              type="button"
              onClick={() => {
                setIsEditingNote(false);
                setNoteText(issue.moderatorNote || '');
              }}
              className="text-[10px] text-text-muted hover:text-text-main cursor-pointer"
            >
              Hủy
            </button>
          </div>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onBlur={handleSaveNote}
            placeholder="Nhập hướng dẫn sửa lỗi, thống nhất cách dịch hoặc lý do..."
            rows={2}
            className="w-full bg-ink/80 border border-parchment-2 rounded-[2px] p-2 text-xs text-text-main placeholder:text-text-muted/50 focus:outline-none focus:border-polish transition-all custom-scrollbar"
          />
        </div>
      ) : (
        issue.moderatorNote && (
          <div
            onClick={() => setIsEditingNote(true)}
            className="mb-3 text-[11px] text-text-main bg-ink/40 p-2 rounded-[2px] border border-parchment-2 cursor-pointer hover:border-polish/40 transition-colors"
          >
            <span className="text-text-muted font-semibold">Ghi chú Moderator: </span>
            <span>{issue.moderatorNote}</span>
          </div>
        )
      )}

      {/* Action Decision Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-parchment-2">
        <div className="flex items-center gap-1.5">
          {!isEditingNote && !issue.moderatorNote && (
            <button
              type="button"
              onClick={() => setIsEditingNote(true)}
              className="inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-text-main hover:bg-parchment-2 px-2 py-1 rounded-[2px] transition-colors cursor-pointer"
            >
              <MessageSquare className="w-3 h-3" />
              <span>+ Thêm ghi chú</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant={issue.decision === 'dismissed' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onDecisionChange(issue.id, 'dismissed', noteText)}
            icon={<X className="w-3.5 h-3.5" />}
            className="text-xs h-7.5 px-2.5"
            title="Bác bỏ hoặc bỏ qua lỗi này"
          >
            Bác bỏ
          </Button>

          <Button
            type="button"
            variant={issue.decision === 'review_needed' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onDecisionChange(issue.id, 'review_needed', noteText)}
            icon={<HelpCircle className="w-3.5 h-3.5 text-amber-400" />}
            className="text-xs h-7.5 px-2.5"
            title="Đánh dấu cần hội ý thêm"
          >
            Cần xem lại
          </Button>

          <Button
            type="button"
            variant={issue.decision === 'confirmed' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => onDecisionChange(issue.id, 'confirmed', noteText)}
            icon={<Check className="w-3.5 h-3.5" />}
            className="text-xs h-7.5 px-3 font-semibold"
            title="Xác nhận đây là lỗi cần dịch giả sửa"
          >
            Xác nhận lỗi
          </Button>
        </div>
      </div>
    </div>
  );
}

export default HakoIssueCard;
