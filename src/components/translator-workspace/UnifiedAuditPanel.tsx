import React, { useState, useMemo, useCallback } from 'react';
import {
  AlertCircle,
  Loader2,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  Wand2,
  Zap,
  X,
  Check,
} from 'lucide-react';
import type { QualityIssue } from '../../types/hakoChecker';
import type { DirectQaCritiqueIssue, DirectRewriteSentenceParams } from '../../services/directTranslationEngine';
import type { UnifiedAuditIssue, UnifiedSeverity } from '../../types/audit';
import {
  mapHakoIssueToUnified,
  mapQaIssueToUnified,
} from '../../services/auditBridgeService';
import { rewriteSentenceDirect } from '../../services/directTranslationEngine';
import { scrollAndSelectInTextarea } from '../../utils/textareaHighlight';
import { useNotifications } from '../NotificationSystem';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { Seal } from '../ui/Seal';
import { SkeletonBlock } from '../common/Skeleton';
import { cn } from '../../lib/cn';

export interface UnifiedAuditPanelProps {
  /** Danh sách lỗi quy tắc phát hiện từ Hako Quality Engine */
  hakoIssues: QualityIssue[];
  /** Danh sách góp ý đối chiếu ngữ nghĩa từ AI QA Critique */
  qaIssues: DirectQaCritiqueIssue[];
  /** Cờ trạng thái đang chạy kiểm duyệt AI */
  isCheckingQa: boolean;
  /** Hàm kích hoạt kiểm định chất lượng AI thủ công */
  onRunAiQaCritique: () => void;
  /** Callback khi người dùng click vào thẻ lỗi */
  onIssueClick?: (issue: UnifiedAuditIssue) => void;
  /** Cảnh báo lệch đoạn văn bản giữa bản gốc và bản dịch */
  isMismatch?: boolean;
  /** Số đoạn văn bản nguồn */
  sourceParaCount?: number;
  /** Số đoạn văn bản dịch */
  translationParaCount?: number;
  /** Thông báo lỗi nếu quá trình gọi AI QA Critique thất bại */
  qaError?: string | null;
  /** Tham chiếu tới textarea đang hoạt động trong trình soạn thảo để bôi chọn lỗi */
  activeTextareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  /** Callback áp dụng sửa lỗi tập trung từ workspace (Feature 104) */
  onApplyFix?: (issue: UnifiedAuditIssue) => boolean | Promise<boolean>;
  /** API Keys để thực hiện viết lại câu qua AI (Feature 104) */
  apiKeys?: string[];
  /** Model AI đang chọn (Feature 104) */
  selectedModel?: string;
  /** Callback tùy chọn thay thế việc gọi trực tiếp rewriteSentenceDirect (Feature 104, testability) */
  onRewriteSentence?: (params: DirectRewriteSentenceParams) => Promise<string>;
}

export type AuditFilterTab = 'all' | 'hako_rule' | 'ai_critique' | 'pending';

export interface HandleAuditIssueSelectionParams {
  issue: UnifiedAuditIssue;
  activeTextareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  onIssueClick?: (issue: UnifiedAuditIssue) => void;
  showToast?: ((options: { message: string; type?: 'info' | 'success' | 'warning' | 'error' } | string) => void) | null;
}

export function handleAuditIssueSelection({
  issue,
  activeTextareaRef,
  onIssueClick,
  showToast,
}: HandleAuditIssueSelectionParams): boolean {
  onIssueClick?.(issue);

  if (issue.targetText && issue.targetText.trim() !== '') {
    const textareaEl = activeTextareaRef?.current;
    const success = scrollAndSelectInTextarea(textareaEl, issue.targetText);
    if (!success) {
      showToast?.({
        message: 'Không tìm thấy đoạn văn này trong bản dịch hiện tại, có thể nội dung đã được sửa.',
        type: 'info',
      });
      return false;
    }
    return true;
  }
  return false;
}

export function UnifiedAuditPanel({
  hakoIssues = [],
  qaIssues = [],
  isCheckingQa,
  onRunAiQaCritique,
  onIssueClick,
  isMismatch = false,
  sourceParaCount = 0,
  translationParaCount = 0,
  qaError = null,
  activeTextareaRef,
  onApplyFix,
  apiKeys,
  selectedModel,
  onRewriteSentence,
}: UnifiedAuditPanelProps) {
  const [activeTab, setActiveTab] = useState<AuditFilterTab>('all');

  // Feature 104: Local state for resolved tracking, rewriting, and previews
  const [resolvedIssueIds, setResolvedIssueIds] = useState<Set<string>>(new Set());
  const [rewritingIssueId, setRewritingIssueId] = useState<string | null>(null);
  const [pendingPreviews, setPendingPreviews] = useState<Record<string, string>>({});

  let notifications: ReturnType<typeof useNotifications> | null = null;
  try {
    notifications = useNotifications();
  } catch {
    notifications = null;
  }
  const showToast = notifications?.showToast;

  const handleIssueCardClick = (issue: UnifiedAuditIssue) => {
    handleAuditIssueSelection({
      issue,
      activeTextareaRef,
      onIssueClick,
      showToast,
    });
  };

  // Gộp danh sách lỗi từ 2 nguồn sang UnifiedAuditIssue[]
  const unifiedIssues = useMemo<UnifiedAuditIssue[]>(() => {
    const hakoMapped = (hakoIssues || []).map(mapHakoIssueToUnified);
    const qaMapped = (qaIssues || []).map((issue) => mapQaIssueToUnified(issue));
    // Override status for resolved issues
    return [...hakoMapped, ...qaMapped].map((issue) => ({
      ...issue,
      status: resolvedIssueIds.has(issue.id) ? 'resolved' as const : issue.status,
    }));
  }, [hakoIssues, qaIssues, resolvedIssueIds]);

  // Thống kê số lượng theo danh mục lọc
  const stats = useMemo(() => {
    const total = unifiedIssues.length;
    const hakoCount = unifiedIssues.filter((i) => i.source === 'hako_rule').length;
    const qaCount = unifiedIssues.filter((i) => i.source === 'ai_critique').length;
    const pendingCount = unifiedIssues.filter((i) => i.status === 'pending').length;
    return { total, hakoCount, qaCount, pendingCount };
  }, [unifiedIssues]);

  // Lọc danh sách theo tab đang chọn
  const filteredIssues = useMemo(() => {
    switch (activeTab) {
      case 'hako_rule':
        return unifiedIssues.filter((i) => i.source === 'hako_rule');
      case 'ai_critique':
        return unifiedIssues.filter((i) => i.source === 'ai_critique');
      case 'pending':
        return unifiedIssues.filter((i) => i.status === 'pending');
      case 'all':
      default:
        return unifiedIssues;
    }
  }, [unifiedIssues, activeTab]);

  const getSeverityBadge = (severity: UnifiedSeverity) => {
    switch (severity) {
      case 'error':
        return { tone: 'danger' as const, label: 'Lỗi' };
      case 'warning':
        return { tone: 'warning' as const, label: 'Cảnh báo' };
      case 'info':
      default:
        return { tone: 'neutral' as const, label: 'Góp ý' };
    }
  };

  // Feature 104: Handle "Sửa ngay" click
  const handleQuickFix = useCallback(
    async (e: React.MouseEvent, issue: UnifiedAuditIssue) => {
      e.stopPropagation();
      if (!onApplyFix) return;
      try {
        const result = await onApplyFix(issue);
        if (result) {
          setResolvedIssueIds((prev) => new Set(prev).add(issue.id));
        }
      } catch (err: any) {
        showToast?.({
          message: err?.message || 'Lỗi khi áp dụng sửa nhanh.',
          type: 'error',
        });
      }
    },
    [onApplyFix, showToast]
  );

  // Feature 104: Handle "Nhờ AI viết lại câu này" click
  const handleRequestRewrite = useCallback(
    async (e: React.MouseEvent, issue: UnifiedAuditIssue) => {
      e.stopPropagation();
      if (rewritingIssueId) return; // prevent concurrent rewrites on same card

      setRewritingIssueId(issue.id);
      try {
        let rewrittenText: string;

        if (onRewriteSentence) {
          // Use injected callback (for testing)
          rewrittenText = await onRewriteSentence({
            targetText: issue.targetText || '',
            context: issue.message,
            issueMessage: issue.message,
            apiKeys: apiKeys || [],
            model: selectedModel,
          });
        } else {
          // Call service directly
          const result = await rewriteSentenceDirect({
            targetText: issue.targetText || '',
            context: issue.message,
            issueMessage: issue.message,
            apiKeys: apiKeys || [],
            model: selectedModel,
          });
          rewrittenText = result.rewrittenSentence;
        }

        // Show preview
        setPendingPreviews((prev) => ({
          ...prev,
          [issue.id]: rewrittenText,
        }));
      } catch (err: any) {
        showToast?.({
          message: err?.message || 'Lỗi khi yêu cầu AI viết lại câu.',
          type: 'error',
        });
      } finally {
        setRewritingIssueId(null);
      }
    },
    [rewritingIssueId, onRewriteSentence, apiKeys, selectedModel, showToast]
  );

  // Feature 104: Handle preview "Áp dụng" click
  const handleApplyPreview = useCallback(
    async (e: React.MouseEvent, issue: UnifiedAuditIssue) => {
      e.stopPropagation();
      if (!onApplyFix) return;

      const previewText = pendingPreviews[issue.id];
      if (!previewText) return;

      // Create a modified issue with the AI suggestion
      const modifiedIssue: UnifiedAuditIssue = {
        ...issue,
        suggestion: previewText,
        autoFixable: true,
      };

      try {
        const result = await onApplyFix(modifiedIssue);
        if (result) {
          setResolvedIssueIds((prev) => new Set(prev).add(issue.id));
          // Remove preview
          setPendingPreviews((prev) => {
            const next = { ...prev };
            delete next[issue.id];
            return next;
          });
        }
      } catch (err: any) {
        showToast?.({
          message: err?.message || 'Lỗi khi áp dụng gợi ý AI.',
          type: 'error',
        });
      }
    },
    [onApplyFix, pendingPreviews, showToast]
  );

  // Feature 104: Handle preview "Hủy" click
  const handleDismissPreview = useCallback(
    (e: React.MouseEvent, issueId: string) => {
      e.stopPropagation();
      setPendingPreviews((prev) => {
        const next = { ...prev };
        delete next[issueId];
        return next;
      });
    },
    []
  );

  return (
    <div className="space-y-3">
      {/* Cảnh báo lệch đoạn văn bản (Paragraph Mismatch Alert) */}
      {isMismatch && (
        <div className="bg-amber-950/20 border border-amber-800/40 text-amber-300 p-3 rounded-[2px] flex items-start gap-2.5 text-xs animate-slideDown">
          <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-amber-300">Cảnh báo lệch đoạn văn bản:</p>
            <p className="leading-relaxed text-text-main mt-0.5">
              Số lượng đoạn của bản dịch đang không khớp với văn bản gốc (Gốc: <strong>{sourceParaCount}</strong> đoạn, Dịch: <strong>{translationParaCount}</strong> đoạn). 
              Vui lòng kiểm tra lại để tránh lệch dòng khi hiển thị song ngữ.
            </p>
          </div>
        </div>
      )}

      {/* Panel Kiểm Định Chất Lượng Hợp Nhất */}
      <div className="border border-parchment-2 bg-ink/70 rounded-md p-3 space-y-3 shadow-xs">
        {/* Header Action Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2.5 border-b border-parchment-2/50">
          <div className="flex items-center gap-2">
            <Seal character="評" tone="polish" className="text-[10px]" />
            <h4 className="font-display font-bold text-xs text-text-main">
              Thẩm định chất lượng
            </h4>
            <Badge tone="neutral" className="font-mono text-[10px] px-1.5 py-0.2">
              {`${stats.total} vấn đề`}
            </Badge>
          </div>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onRunAiQaCritique}
            disabled={isCheckingQa}
            icon={
              isCheckingQa ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )
            }
            className="text-xs font-bold shrink-0 cursor-pointer"
          >
            {isCheckingQa ? 'Đang thẩm định AI...' : 'Chạy AI Thẩm định'}
          </Button>
        </div>

        {/* Tab lọc danh mục */}
        <div className="flex items-center gap-1 bg-ink p-1 rounded-[2px] border border-parchment-2 overflow-x-auto text-[11px]">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={cn(
              "px-2.5 py-1 font-semibold rounded-[2px] transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5",
              activeTab === 'all'
                ? "bg-parchment-2 text-text-main shadow-xs"
                : "text-text-muted hover:text-text-main hover:bg-parchment/40"
            )}
          >
            <span>Tất cả</span>
            <span className="font-mono text-[10px] opacity-80">{`(${stats.total})`}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('hako_rule')}
            className={cn(
              "px-2.5 py-1 font-semibold rounded-[2px] transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5",
              activeTab === 'hako_rule'
                ? "bg-parchment-2 text-text-main shadow-xs"
                : "text-text-muted hover:text-text-main hover:bg-parchment/40"
            )}
          >
            <span>Quy chuẩn Hako</span>
            <span className="font-mono text-[10px] opacity-80">{`(${stats.hakoCount})`}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ai_critique')}
            className={cn(
              "px-2.5 py-1 font-semibold rounded-[2px] transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5",
              activeTab === 'ai_critique'
                ? "bg-parchment-2 text-text-main shadow-xs"
                : "text-text-muted hover:text-text-main hover:bg-parchment/40"
            )}
          >
            <span>Góp ý AI</span>
            <span className="font-mono text-[10px] opacity-80">{`(${stats.qaCount})`}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={cn(
              "px-2.5 py-1 font-semibold rounded-[2px] transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5",
              activeTab === 'pending'
                ? "bg-parchment-2 text-text-main shadow-xs"
                : "text-text-muted hover:text-text-main hover:bg-parchment/40"
            )}
          >
            <span>Chưa xử lý</span>
            <span className="font-mono text-[10px] opacity-80">{`(${stats.pendingCount})`}</span>
          </button>
        </div>

        {/* Trạng thái lỗi (Error State) */}
        {qaError && (
          <div className="bg-polish/10 border border-polish/40 text-polish p-3 rounded-[2px] flex items-start justify-between gap-2.5 text-xs animate-slideDown">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-polish shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-polish">Lỗi thẩm định AI:</p>
                <p className="text-text-main mt-0.5 leading-relaxed">{qaError}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onRunAiQaCritique}
              disabled={isCheckingQa}
              icon={<RotateCcw className="w-3 h-3" />}
              className="text-xs shrink-0 cursor-pointer"
            >
              Thử lại
            </Button>
          </div>
        )}

        {/* Vùng hiển thị nội dung: Loading / Empty / Danh sách issue */}
        {isCheckingQa ? (
          /* Trạng thái đang tải (Loading State) */
          <div className="space-y-2 py-1">
            <div className="flex items-center gap-2 text-xs text-text-muted px-1">
              <Loader2 className="w-3.5 h-3.5 text-polish animate-spin" />
              <span>Đang tiến hành kiểm duyệt AI đối soát bản dịch...</span>
            </div>
            <SkeletonBlock className="h-16 w-full rounded-[2px]" />
            <SkeletonBlock className="h-16 w-full rounded-[2px]" />
          </div>
        ) : filteredIssues.length === 0 ? (
          /* Trạng thái rỗng (Empty State) */
          <EmptyState
            icon={<CheckCircle2 className="w-5 h-5 text-polish" />}
            title="Không có vấn đề cần xử lý"
            description={
              activeTab === 'all'
                ? "Bản dịch hiện tại đã thỏa mãn các quy tắc chất lượng và kiểm duyệt."
                : "Không có vấn đề nào thuộc danh mục lọc này."
            }
            action={
              activeTab === 'all' && stats.qaCount === 0 ? (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={onRunAiQaCritique}
                  icon={<Sparkles className="w-3.5 h-3.5" />}
                  className="text-xs cursor-pointer"
                >
                  Chạy AI Thẩm định
                </Button>
              ) : undefined
            }
            className="py-6"
          />
        ) : (
          /* Danh sách thẻ lỗi thu gọn (Compact Issue Cards) */
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {filteredIssues.map((issue) => {
              const badge = getSeverityBadge(issue.severity);
              const isResolved = issue.status === 'resolved';
              const isRewriting = rewritingIssueId === issue.id;
              const hasPreview = issue.id in pendingPreviews;
              const showQuickFix = issue.autoFixable && issue.suggestion && !isResolved && onApplyFix;
              const showRewriteBtn =
                issue.source === 'ai_critique' &&
                issue.targetText &&
                !isResolved &&
                !hasPreview &&
                (apiKeys?.length || onRewriteSentence);

              return (
                <div
                  key={issue.id}
                  onClick={() => handleIssueCardClick(issue)}
                  className={cn(
                    "group bg-parchment/60 hover:bg-parchment border border-parchment-2 hover:border-polish/40 rounded-[2px] p-2.5 space-y-1.5 transition-all cursor-pointer shadow-xs",
                    isResolved && "opacity-60"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge tone={badge.tone} className="text-[10px] font-bold px-1.5 py-0.2">
                        {badge.label}
                      </Badge>
                      <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
                        {issue.source === 'hako_rule' ? 'Quy chuẩn Hako' : 'Góp ý AI'}
                      </span>
                    </div>
                    {isResolved ? (
                      <Badge tone="neutral" className="text-[10px] font-bold px-1.5 py-0.2 text-emerald-400 border-emerald-800/50 bg-emerald-950/40">
                        Đã sửa
                      </Badge>
                    ) : issue.autoFixable ? (
                      <span className="text-[10px] text-polish font-medium bg-polish/10 px-1 rounded-[2px]">
                        Có thể sửa nhanh
                      </span>
                    ) : null}
                  </div>

                  <p className="text-xs font-bold text-text-main group-hover:text-polish transition-colors leading-snug">
                    {issue.title}
                  </p>

                  <p className="text-[11px] text-text-muted leading-relaxed">
                    {issue.message}
                  </p>

                  {issue.targetText && (
                    <div className="bg-ink/80 border border-parchment-2 rounded-[2px] px-2 py-1 text-[11px] font-mono text-text-muted line-clamp-2">
                      <span className="text-text-muted/60 mr-1 select-none">Trích đoạn:</span>
                      <span className="text-text-main">{issue.targetText}</span>
                    </div>
                  )}

                  {/* Feature 104: AI Rewrite Preview */}
                  {hasPreview && (
                    <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-[2px] p-2 space-y-1.5 mt-1">
                      <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                        Gợi ý viết lại từ AI
                      </p>
                      <div className="text-[11px] text-text-main leading-relaxed bg-ink/60 rounded-[2px] px-2 py-1.5 font-mono">
                        {pendingPreviews[issue.id]}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={(e) => handleApplyPreview(e, issue)}
                          icon={<Check className="w-3 h-3" />}
                          className="text-[10px] cursor-pointer"
                        >
                          Áp dụng
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={(e) => handleDismissPreview(e, issue.id)}
                          icon={<X className="w-3 h-3" />}
                          className="text-[10px] cursor-pointer"
                        >
                          Hủy
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Feature 104: Action buttons */}
                  {!isResolved && !hasPreview && (showQuickFix || showRewriteBtn) && (
                    <div className="flex items-center gap-1.5 pt-0.5">
                      {showQuickFix && (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={(e) => handleQuickFix(e, issue)}
                          icon={<Zap className="w-3 h-3" />}
                          className="text-[10px] cursor-pointer"
                        >
                          Sửa ngay
                        </Button>
                      )}
                      {showRewriteBtn && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={(e) => handleRequestRewrite(e, issue)}
                          disabled={isRewriting}
                          icon={
                            isRewriting ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Wand2 className="w-3 h-3" />
                            )
                          }
                          className="text-[10px] cursor-pointer"
                        >
                          {isRewriting ? 'Đang viết lại...' : 'Nhờ AI viết lại câu này'}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default UnifiedAuditPanel;
