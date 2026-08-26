/**
 * HakoReportExportModal Component
 * Feature: 075-moderator-quality-checker
 *
 * Modal tổng hợp thống kê và xuất báo cáo kiểm định chất lượng ra định dạng Markdown/Text
 * Hỗ trợ sao chép vào clipboard chỉ với 1 cú click.
 */

import React, { useState } from 'react';
import {
  Copy,
  Check,
  FileText,
  AlertTriangle,
  Layers,
  Sparkles,
} from 'lucide-react';
import { QualityReviewSession, QualityReport } from '../../types/hakoChecker';
import { generateQualityReport } from '../../services/hakoQualityEngine';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Seal } from '../ui/Seal';

export interface HakoReportExportModalProps {
  open: boolean;
  onClose: () => void;
  session: QualityReviewSession | null;
}

export function HakoReportExportModal({ open, onClose, session }: HakoReportExportModalProps) {
  const [copied, setCopied] = useState(false);

  if (!open || !session) return null;

  const report: QualityReport = generateQualityReport(session);
  const { stats, confirmedIssues, formattedMarkdown } = report;

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(formattedMarkdown);
      } else {
        // Fallback for older clipboard environments
        const textArea = document.createElement('textarea');
        textArea.value = formattedMarkdown;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('[HakoReportExportModal] Failed to copy to clipboard:', err);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="4xl"
      title="Báo cáo kiểm định chất lượng bản dịch"
      description="Bản tổng hợp các lỗi đã được moderator xác nhận kèm trích đoạn bằng chứng và hướng dẫn sửa đổi"
      icon={<FileText className="w-4 h-4 text-polish" />}
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-[11px] text-text-muted">
            Đã chọn <strong>{confirmedIssues.length} lỗi</strong> vào báo cáo
          </span>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
            >
              Đóng
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleCopy}
              icon={copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
              className="font-bold"
            >
              {copied ? 'Đã sao chép vào Clipboard!' : 'Sao chép vào Clipboard'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Statistics Dashboard Header */}
        <div className="bg-ink/50 border border-parchment-2 rounded-[3px] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-parchment-2/50">
            <div className="flex items-center gap-2">
              <Seal character="報" tone="polish" className="text-[11px]" />
              <span className="text-xs font-display font-bold text-text-main">
                {report.novelTitle}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Badge tone="neutral" className="text-[10px]">
                {report.totalChaptersReviewed} chương kiểm tra
              </Badge>
              <Badge tone="polish" className="text-[10px]">
                {confirmedIssues.length} lỗi đã xác nhận
              </Badge>
            </div>
          </div>

          {/* Severity Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-ink/70 p-2 rounded-[2px] border border-red-900/40">
              <span className="text-[10px] text-red-400 font-bold uppercase block">Nghiêm trọng</span>
              <span className="text-sm font-mono font-bold text-red-300">{stats.bySeverity.critical}</span>
            </div>

            <div className="bg-ink/70 p-2 rounded-[2px] border border-amber-900/40">
              <span className="text-[10px] text-amber-400 font-bold uppercase block">Lớn</span>
              <span className="text-sm font-mono font-bold text-amber-300">{stats.bySeverity.major}</span>
            </div>

            <div className="bg-ink/70 p-2 rounded-[2px] border border-parchment-2">
              <span className="text-[10px] text-text-muted font-bold uppercase block">Nhẹ</span>
              <span className="text-sm font-mono font-bold text-text-main">{stats.bySeverity.minor}</span>
            </div>

            <div className="bg-ink/70 p-2 rounded-[2px] border border-parchment-2">
              <span className="text-[10px] text-sky-400 font-bold uppercase block">Cảnh báo</span>
              <span className="text-sm font-mono font-bold text-sky-300">{stats.bySeverity.warning}</span>
            </div>
          </div>
        </div>

        {/* Formatted Markdown Preview */}
        <div>
          <div className="flex items-center justify-between mb-1.5 text-xs text-text-muted">
            <span className="font-semibold text-text-main">Xem trước nội dung văn bản:</span>
            <span className="text-[10px] font-mono">Định dạng Markdown</span>
          </div>

          <div className="relative">
            <pre className="w-full bg-ink border border-parchment-2 rounded-[3px] p-4 text-xs font-mono text-text-main leading-relaxed overflow-x-auto max-h-[380px] custom-scrollbar whitespace-pre-wrap select-all">
              {formattedMarkdown}
            </pre>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default HakoReportExportModal;
