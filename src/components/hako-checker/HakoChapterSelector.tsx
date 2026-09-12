/**
 * HakoChapterSelector Component (Project-based Chapter Selector)
 * Feature: 080-hako-chapter-virtualization
 *
 * Cho phép moderator chọn một dự án dịch từ ứng dụng và chọn tối đa 12 chương đã có bản dịch.
 * Tích hợp Virtualization (useVirtualList) cho danh sách truyện dài (>20 chương)
 * và tra cứu Set O(1) để triệt tiêu độ trễ render, chống giật lag và ngăn ngừa sập trang trắng.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  CheckSquare,
  Square,
  Languages,
  Check,
  AlertCircle,
  AlertTriangle,
  FileCode,
  Sparkles,
  BookOpen,
  FolderOpen,
  X,
  Zap,
  Loader2,
} from 'lucide-react';
import { ProjectReviewChapter } from '../../types/hakoChecker';
import { StoryProject } from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Seal } from '../ui/Seal';
import { EmptyState } from '../ui/EmptyState';
import { cn } from '../../lib/cn';
import { useVirtualList } from '../../hooks/useVirtualList';
import { localQuotaTracker } from '../../services/localQuotaTracker';
import { migrateAndLoadApiKeys } from '../../hooks/useAIConfig';
import { getChapterFromDB } from '../../services/db';

export interface HakoChapterSelectorProps {
  projects: StoryProject[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  selectedChapterIds: (string | number)[];
  chapters: Record<string, ProjectReviewChapter>;
  onToggleChapter: (chapterId: string | number) => void;
  onSelectRange: (chapterIds: (string | number)[]) => void;
  onClearSelection: () => void;
  onUpdateRawText: (chapterId: string | number, raw: string) => void;
  onHydrateAllRaw?: () => Promise<{ successCount: number; totalCount: number; missingRawCount: number }>;
  onStartAnalysis: () => void;
  isAnalyzing: boolean;
  apiKeys?: string[];
}

const MAX_SELECTION_LIMIT = 12;
const VIRTUALIZATION_THRESHOLD = 20;
const ITEM_HEIGHT = 48;
const CONTAINER_HEIGHT = 480;

/**
 * Tính danh sách chapterId cho lô "N chương tiếp theo", dựa trên chương có số thứ
 * tự (chapterNumber) lớn nhất đang nằm trong selectedSet. Nếu chưa chọn gì (selectedSet
 * rỗng hoặc không khớp chương nào), coi mốc bắt đầu là 0 — tương đương chọn N chương
 * đầu tiên có thể dịch. Tách thành hàm thuần (không phụ thuộc React) để unit test trực
 * tiếp mà không cần render component hay giả lập sự kiện click trong DOM.
 */
export function computeNextBatchChapterIds(
  chapterList: ProjectReviewChapter[],
  translatableChapters: ProjectReviewChapter[],
  selectedSet: Set<string>,
  limit: number = MAX_SELECTION_LIMIT
): string[] {
  let maxSelectedNumber = 0;
  for (const ch of chapterList) {
    const chapterIdStr = String(ch.chapterId || (ch as any).id);
    if (selectedSet.has(chapterIdStr)) {
      const num = ch.chapterNumber ?? 0;
      if (num > maxSelectedNumber) maxSelectedNumber = num;
    }
  }

  return translatableChapters
    .filter((ch) => (ch.chapterNumber ?? 0) > maxSelectedNumber)
    .slice(0, limit)
    .map((c) => String(c.chapterId || (c as any).id));
}

export function HakoChapterSelector({
  projects,
  selectedProjectId,
  onSelectProject,
  selectedChapterIds,
  chapters,
  onToggleChapter,
  onSelectRange,
  onClearSelection,
  onUpdateRawText,
  onHydrateAllRaw,
  onStartAnalysis,
  isAnalyzing,
  apiKeys,
}: HakoChapterSelectorProps) {
  // Trạng thái API keys và kiểm tra hạn ngạch quota khả dụng
  const effectiveApiKeys = useMemo(() => {
    if (apiKeys && apiKeys.length > 0) return apiKeys;
    return migrateAndLoadApiKeys();
  }, [apiKeys]);

  const quotaAdvisory = useMemo(() => {
    const selectedCount = selectedChapterIds.length;
    if (selectedCount === 0) {
      return {
        hasQuotaRisk: false,
        warningMessage: null,
      };
    }

    const quotaStatus = localQuotaTracker.getQuotaStatus(effectiveApiKeys);
    const keySnapshots = quotaStatus.keys || [];

    // 1. Không có API key nào được thiết lập
    if (keySnapshots.length === 0) {
      return {
        hasQuotaRisk: true,
        warningMessage: `Quota khả dụng có thể không đủ cho toàn bộ ${selectedCount} chương đã chọn`,
      };
    }

    // 2. Có key ở trạng thái QuotaExhausted
    const hasExhaustedKey = keySnapshots.some(
      (k) => k.healthState === 'QuotaExhausted'
    );

    // 3. Lọc các key đang khả dụng (không bị blacklist, không QuotaExhausted hoặc AuthFailed)
    const availableKeys = keySnapshots.filter(
      (k) =>
        !k.runtime?.isBlacklisted &&
        k.healthState !== 'QuotaExhausted' &&
        k.healthState !== 'AuthFailed'
    );

    // Không còn key khả dụng nào
    if (availableKeys.length === 0) {
      return {
        hasQuotaRisk: true,
        warningMessage: `Quota khả dụng có thể không đủ cho toàn bộ ${selectedCount} chương đã chọn`,
      };
    }

    // Có ít nhất 1 key đã cạn hạn ngạch
    if (hasExhaustedKey) {
      return {
        hasQuotaRisk: true,
        warningMessage: `Quota khả dụng có thể không đủ cho toàn bộ ${selectedCount} chương đã chọn`,
      };
    }

    // 4. Ước tính tổng dung lượng còn lại trong ngày theo RPD limit
    let estimatedRemainingCalls = 0;
    try {
      const customLimitsRaw =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem('gemini_quota_custom_limits')
          : null;
      const customLimits = customLimitsRaw ? JSON.parse(customLimitsRaw) : {};
      for (const k of availableKeys) {
        const limit = customLimits[k.keyHash];
        const maxRpd =
          limit?.maxRpd && typeof limit.maxRpd === 'number' ? limit.maxRpd : 1500;
        const remaining = Math.max(0, maxRpd - (k.requestsToday || 0));
        estimatedRemainingCalls += remaining;
      }
    } catch {
      estimatedRemainingCalls = availableKeys.length * 1500;
    }

    if (estimatedRemainingCalls < selectedCount) {
      return {
        hasQuotaRisk: true,
        warningMessage: `Quota khả dụng có thể không đủ cho toàn bộ ${selectedCount} chương đã chọn`,
      };
    }

    return {
      hasQuotaRisk: false,
      warningMessage: null,
    };
  }, [selectedChapterIds.length, effectiveApiKeys]);
  // Trạng thái modal chỉnh sửa raw tiếng Trung cho một chapterId
  const [editingRawChapterId, setEditingRawChapterId] = useState<string | null>(null);
  const checkedRawIdsRef = useRef<Set<string>>(new Set());

  // Tự động nạp sourceText từ IndexedDB cho các chương được chọn nếu chưa có raw
  useEffect(() => {
    if (!selectedChapterIds || selectedChapterIds.length === 0) return;
    let isMounted = true;
    selectedChapterIds.forEach((id) => {
      const idStr = String(id);
      if (checkedRawIdsRef.current.has(idStr)) return;
      checkedRawIdsRef.current.add(idStr);

      const ch = chapters[idStr];
      if (!ch?.rawChineseContent || !ch.rawChineseContent.trim()) {
        getChapterFromDB(idStr)
          .then((fullChap) => {
            if (isMounted && fullChap?.sourceText?.trim()) {
              onUpdateRawText(idStr, fullChap.sourceText.trim());
            }
          })
          .catch((err) => {
            console.warn(`[HakoChapterSelector] Lỗi khi nạp sourceText chương ${idStr}:`, err);
          });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedChapterIds, chapters, onUpdateRawText]);

  // Xử lý mở modal chỉnh sửa raw và tự động nạp từ IndexedDB nếu chưa có
  const handleOpenRawModal = async (chapterIdStr: string) => {
    setEditingRawChapterId(chapterIdStr);
    const existingRaw = chapters[chapterIdStr]?.rawChineseContent;
    if (!existingRaw || !existingRaw.trim()) {
      try {
        const fullChap = await getChapterFromDB(chapterIdStr);
        if (fullChap?.sourceText?.trim()) {
          onUpdateRawText(chapterIdStr, fullChap.sourceText.trim());
        }
      } catch (err) {
        console.warn(`[HakoChapterSelector] Lỗi khi nạp sourceText cho modal chương ${chapterIdStr}:`, err);
      }
    }
  };

  // Trạng thái nạp raw toàn bộ chương
  const [isHydratingRaw, setIsHydratingRaw] = useState(false);
  const [rawHydrationFeedback, setRawHydrationFeedback] = useState<string | null>(null);
  const rawHydrationTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleBulkHydrateRaw = async () => {
    if (!onHydrateAllRaw || isHydratingRaw) return;
    setIsHydratingRaw(true);
    try {
      const res = await onHydrateAllRaw();
      if (rawHydrationTimerRef.current) {
        clearTimeout(rawHydrationTimerRef.current);
      }
      if (res.missingRawCount > 0) {
        setRawHydrationFeedback(
          `Đã nạp Raw cho ${res.successCount}/${res.totalCount} chương (${res.missingRawCount} chương chưa có bản gốc trong DB)`
        );
      } else {
        setRawHydrationFeedback(
          `Đã nạp Raw thành công cho ${res.successCount}/${res.totalCount} chương`
        );
      }
      rawHydrationTimerRef.current = setTimeout(() => {
        setRawHydrationFeedback(null);
      }, 4000);
    } catch (err) {
      console.error('[HakoChapterSelector] Lỗi khi nạp raw toàn bộ:', err);
      setRawHydrationFeedback('Có lỗi khi nạp raw từ cơ sở dữ liệu');
      rawHydrationTimerRef.current = setTimeout(() => {
        setRawHydrationFeedback(null);
      }, 3000);
    } finally {
      setIsHydratingRaw(false);
    }
  };

  // Tự động nạp raw trong background nếu còn chương chưa có raw khi mở dự án
  const hasAttemptedAutoHydrateRef = useRef<string | null>(null);
  useEffect(() => {
    if (!onHydrateAllRaw || !selectedProjectId) return;
    const chList = Object.values(chapters || {});
    if (chList.length === 0) return;

    const hasMissingRaw = chList.some((ch) => !ch?.rawChineseContent || !ch.rawChineseContent.trim());
    if (hasMissingRaw && hasAttemptedAutoHydrateRef.current !== selectedProjectId) {
      hasAttemptedAutoHydrateRef.current = selectedProjectId;
      onHydrateAllRaw().catch((err) => {
        console.warn('[HakoChapterSelector] Auto-hydration background error:', err);
      });
    }
  }, [chapters, selectedProjectId, onHydrateAllRaw]);

  // Trạng thái chọn theo khoảng chương (from ... to ...)
  const [fromChapterInput, setFromChapterInput] = useState<string>('');
  const [toChapterInput, setToChapterInput] = useState<string>('');

  // Trạng thái nhập số thứ tự 1 chương để chọn nhanh
  const [singleChapterInput, setSingleChapterInput] = useState<string>('');
  const [singleChapterMessage, setSingleChapterMessage] = useState<string | null>(null);
  const singleChapterTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (singleChapterTimerRef.current) {
        clearTimeout(singleChapterTimerRef.current);
      }
      if (rawHydrationTimerRef.current) {
        clearTimeout(rawHydrationTimerRef.current);
      }
    };
  }, []);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null;

  // Memoize sorted chapter list to avoid recalculating on every re-render
  const chapterList = useMemo(() => {
    return Object.values(chapters || {})
      .filter((c): c is ProjectReviewChapter => Boolean(c && (c.chapterId || (c as any).id)))
      .sort((a, b) => (a?.chapterNumber ?? 0) - (b?.chapterNumber ?? 0));
  }, [chapters]);

  // Đếm số chương đã có raw text tiếng Trung
  const rawChaptersCount = useMemo(() => {
    return chapterList.filter((c) => c && c.rawChineseContent && c.rawChineseContent.trim()).length;
  }, [chapterList]);

  // Memoize translatable chapters for quick selection
  const translatableChapters = useMemo(() => {
    return chapterList.filter((c) => c && c.translationType !== 'none');
  }, [chapterList]);

  // O(1) Set lookup for selected chapter IDs
  const selectedSet = useMemo(() => {
    return new Set((selectedChapterIds || []).map(String));
  }, [selectedChapterIds]);

  const isLimitReached = selectedChapterIds.length >= MAX_SELECTION_LIMIT;
  const isVirtualized = chapterList.length > VIRTUALIZATION_THRESHOLD;

  // Xác định lô 12 chương kế tiếp, tính từ chương có số thứ tự lớn nhất đang được chọn.
  const nextBatchChapterIds = useMemo(
    () => computeNextBatchChapterIds(chapterList, translatableChapters, selectedSet, MAX_SELECTION_LIMIT),
    [chapterList, translatableChapters, selectedSet]
  );

  // Virtual list hook for high-performance windowing
  const { visibleItems, totalHeight, onScroll } = useVirtualList({
    items: chapterList,
    itemHeight: ITEM_HEIGHT,
    containerHeight: CONTAINER_HEIGHT,
    overscan: 8,
  });

  const handleSelectAllTranslatable = () => {
    const idsToSelect = translatableChapters
      .slice(0, MAX_SELECTION_LIMIT)
      .map((c) => String(c.chapterId || (c as any).id));
    onSelectRange(idsToSelect);
  };

  const handleSelectNextBatch = () => {
    if (nextBatchChapterIds.length === 0) return;
    onSelectRange(nextBatchChapterIds);
  };

  const handleApplyRange = () => {
    const fromNum = parseInt(fromChapterInput, 10);
    const toNum = parseInt(toChapterInput, 10);
    if (isNaN(fromNum) || isNaN(toNum)) return;

    const minNum = Math.min(fromNum, toNum);
    const maxNum = Math.max(fromNum, toNum);

    const matched = chapterList.filter((ch, idx) => {
      const num = ch.chapterNumber ?? (idx + 1);
      return num >= minNum && num <= maxNum && ch.translationType !== 'none';
    });

    const idsToSelect = matched.map((ch, idx) =>
      String(ch.chapterId || (ch as any).id || `chap-${idx}`)
    );
    onSelectRange(idsToSelect);
  };

  const handleSingleChapterSubmit = () => {
    const targetNum = parseInt(singleChapterInput, 10);
    if (isNaN(targetNum)) return;

    if (singleChapterTimerRef.current) {
      clearTimeout(singleChapterTimerRef.current);
    }

    const found = chapterList.find((ch, idx) => {
      const num = ch.chapterNumber ?? (idx + 1);
      return num === targetNum;
    });

    if (!found) {
      setSingleChapterMessage(`Không tìm thấy chương #${targetNum}`);
      singleChapterTimerRef.current = setTimeout(() => {
        setSingleChapterMessage(null);
      }, 2500);
      return;
    }

    if (found.translationType === 'none') {
      setSingleChapterMessage(`Chương #${targetNum} chưa có bản dịch`);
      singleChapterTimerRef.current = setTimeout(() => {
        setSingleChapterMessage(null);
      }, 2500);
      return;
    }

    const chapterIdStr = String(found.chapterId || (found as any).id);
    onToggleChapter(chapterIdStr);
    setSingleChapterInput('');
    setSingleChapterMessage(null);
  };

  const editingChapter = editingRawChapterId ? chapters[editingRawChapterId] : null;

  const renderChapterRow = (ch: ProjectReviewChapter, index: number, isVirtualMode = false) => {
    if (!ch) return null;

    const chapterIdStr = String(ch.chapterId || (ch as any).id || `chap-${index}`);
    const isSelected = selectedSet.has(chapterIdStr);
    const rawText = ch.rawChineseContent || '';
    const hasRaw = !!rawText.trim();
    const isUntranslated = ch.translationType === 'none';
    const chapterNumber = ch.chapterNumber ?? (index + 1);
    const title = ch.title || 'Chương không có tiêu đề';
    const wordCount = typeof ch.wordCount === 'number' ? ch.wordCount : 0;

    return (
      <div
        key={ch.chapterId || `chap-row-${index}`}
        className={cn(
          'p-2.5 rounded-[3px] border transition-colors flex items-center justify-between gap-2.5',
          isVirtualMode ? 'h-[42px]' : 'mb-2',
          isSelected
            ? 'bg-parchment-2/40 border-polish/40 shadow-xs'
            : isUntranslated
            ? 'bg-ink/20 border-parchment-2/30 opacity-60'
            : 'bg-ink/30 border-parchment-2 hover:bg-parchment-2/20'
        )}
      >
        {/* Chapter Checkbox and Label */}
        <label
          className={cn(
            'flex items-center gap-2.5 flex-1 min-w-0 select-none text-xs',
            isUntranslated
              ? 'cursor-not-allowed'
              : isLimitReached && !isSelected
              ? 'opacity-50 cursor-not-allowed'
              : 'cursor-pointer'
          )}
        >
          <input
            type="checkbox"
            checked={isSelected}
            disabled={isUntranslated || (isLimitReached && !isSelected)}
            onChange={() => onToggleChapter(chapterIdStr)}
            className="sr-only"
          />

          {isSelected ? (
            <CheckSquare className="w-4 h-4 text-polish shrink-0" />
          ) : (
            <Square className="w-4 h-4 text-text-muted shrink-0" />
          )}

          <div className="flex items-center gap-2 truncate">
            <span className="font-mono text-text-muted text-[11px] shrink-0">
              #{chapterNumber}
            </span>
            <span
              className={cn(
                'truncate font-medium',
                isSelected ? 'text-text-main font-semibold' : 'text-text-main/90'
              )}
            >
              {title}
            </span>
          </div>
        </label>

        {/* Status Badges & Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Translation Status Badge */}
          {ch.translationType === 'polished' ? (
            <Badge tone="polish" className="text-[10px] px-1.5 py-0.5">
              {wordCount > 0 ? `Đã biên tập (${wordCount} từ)` : 'Đã biên tập'}
            </Badge>
          ) : ch.translationType === 'raw' ? (
            <Badge tone="neutral" className="text-[10px] px-1.5 py-0.5 border-amber-500/30 text-amber-300">
              {wordCount > 0 ? `Đã dịch thô (${wordCount} từ)` : 'Đã dịch thô'}
            </Badge>
          ) : (
            <Badge tone="neutral" className="text-[10px] px-1.5 py-0.5 opacity-60">
              Chưa có bản dịch
            </Badge>
          )}

          {/* Raw Chinese Edit Trigger */}
          {!isUntranslated && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenRawModal(chapterIdStr);
              }}
              title={
                hasRaw
                  ? 'Đã có văn bản raw tiếng Trung đối chiếu (bấm để xem/sửa)'
                  : 'Dán thêm văn bản raw tiếng Trung đối chiếu'
              }
              className={cn(
                'flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-[2px] border transition-colors cursor-pointer',
                hasRaw
                  ? 'bg-polish/20 border-polish/40 text-polish font-bold'
                  : 'bg-ink/50 border-parchment-2 text-text-muted hover:text-text-main'
              )}
            >
              <Languages className="w-3 h-3" />
              <span>{hasRaw ? 'Đã có Raw' : '+ Thêm Raw'}</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-parchment border border-parchment-2 rounded-md p-5 shadow-xs mb-6">
      {/* Project Picker Section */}
      <div className="mb-5 pb-4 border-b border-parchment-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <Seal character="專" tone="ink" className="text-[11px]" />
            <div>
              <h3 className="text-sm font-display font-bold text-text-main flex items-center gap-2">
                Dự án kiểm định chất lượng
              </h3>
              <p className="text-[11px] text-text-muted mt-0.5">
                Chọn một dự án dịch trong ứng dụng để rà soát các chương đã dịch
              </p>
            </div>
          </div>

          {/* Project Dropdown */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedProjectId || ''}
              onChange={(e) => onSelectProject(e.target.value)}
              disabled={isAnalyzing}
              className="w-full sm:w-64 bg-ink border border-parchment-2 rounded-md px-3 py-1.5 text-xs font-serif text-text-main focus:outline-none focus:border-polish transition-colors"
            >
              <option value="" disabled>
                -- Chọn một dự án dịch ({projects.length} dự án) --
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.chapters?.length || 0} chương)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected Project Summary Card */}
        {selectedProject && (
          <div className="flex items-center justify-between bg-ink/40 border border-parchment-2/60 rounded-md px-3.5 py-2.5 text-xs text-text-muted">
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-4 h-4 text-polish shrink-0" />
              <span className="font-bold text-text-main truncate max-w-xs sm:max-w-md">
                {selectedProject.title}
              </span>
              {selectedProject.author && (
                <span className="text-[11px] text-text-muted">
                  Tác giả: {selectedProject.author}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] flex-wrap">
              <span>Tổng {selectedProject.chapters?.length || 0} chương</span>
              <span className="text-polish font-medium">
                ({translatableChapters.length} chương có bản dịch)
              </span>
              <span
                data-testid="raw-coverage-badge"
                className={cn(
                  'font-medium',
                  rawChaptersCount === chapterList.length && chapterList.length > 0
                    ? 'text-success'
                    : 'text-amber-400'
                )}
              >
                ({rawChaptersCount}/{chapterList.length} đã có raw)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Chapters Selection Section */}
      {!selectedProject ? (
        <EmptyState
          icon={<FolderOpen className="w-10 h-10 text-text-muted" />}
          title="Chưa chọn dự án dịch"
          description="Vui lòng chọn một dự án dịch từ danh sách phía trên để nạp danh mục các chương cần kiểm định."
        />
      ) : chapterList.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="w-10 h-10 text-text-muted" />}
          title="Dự án chưa có chương nào"
          description="Dự án này hiện chưa có chương nào. Hãy thêm chương trong khu vực Dịch Thuật trước khi tiến hành kiểm định chất lượng."
        />
      ) : (
        <>
          {/* Controls Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-2 border-b border-parchment-2/50">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-display font-semibold text-text-main">
                Danh sách chương ({chapterList.length} chương)
              </span>
              <span className="text-[11px] text-text-muted">
                (Tối đa {MAX_SELECTION_LIMIT} chương mỗi đợt)
              </span>
              <span
                data-testid="header-raw-coverage"
                className="text-[10px] font-mono text-text-muted bg-ink/40 px-1.5 py-0.5 rounded-[2px] border border-parchment-2/50"
              >
                Đã có Raw: {rawChaptersCount}/{chapterList.length}
              </span>
              {isVirtualized && (
                <span className="text-[10px] font-mono text-polish bg-polish/10 px-1.5 py-0.5 rounded-[2px] border border-polish/20">
                  ⚡ Ảo hóa mượt mà
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <Badge
                tone={isLimitReached ? 'warning' : selectedChapterIds.length > 0 ? 'polish' : 'neutral'}
                className="text-xs px-2.5 py-1 font-mono font-bold"
              >
                Đã chọn: {selectedChapterIds.length} / {MAX_SELECTION_LIMIT}
              </Badge>

              {!isLimitReached && translatableChapters.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllTranslatable}
                  disabled={isAnalyzing}
                  className="text-[11px] text-polish hover:underline font-medium px-2 py-0.5 cursor-pointer"
                >
                  Chọn nhanh 12 chương đầu
                </button>
              )}

              {translatableChapters.length > 0 && (
                <button
                  type="button"
                  data-testid="select-next-batch-btn"
                  onClick={handleSelectNextBatch}
                  disabled={isAnalyzing || nextBatchChapterIds.length === 0}
                  title={
                    nextBatchChapterIds.length === 0
                      ? 'Đã chọn tới chương cuối cùng có thể kiểm định'
                      : `Chọn ${nextBatchChapterIds.length} chương tiếp theo sau chương đang chọn`
                  }
                  className={cn(
                    'text-[11px] font-medium px-2 py-0.5',
                    nextBatchChapterIds.length === 0
                      ? 'text-text-muted/50 cursor-not-allowed'
                      : 'text-polish hover:underline cursor-pointer'
                  )}
                >
                  Chọn 12 chương tiếp theo →
                </button>
              )}

              {selectedChapterIds.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClearSelection}
                  disabled={isAnalyzing}
                  className="text-[11px] h-7 px-2"
                >
                  Bỏ chọn tất cả
                </Button>
              )}
            </div>
          </div>

          {/* Quick Selection Tools (Range & Single Jump) */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-4 p-3 rounded-md bg-ink/20 border border-parchment-2/60">
            {/* Range Selection */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-medium text-text-muted">Chọn theo khoảng:</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  placeholder="Từ"
                  value={fromChapterInput}
                  onChange={(e) => setFromChapterInput(e.target.value)}
                  disabled={isAnalyzing}
                  className="w-16 bg-ink border border-parchment-2 rounded-md px-2 py-1 text-xs font-mono text-text-main focus:outline-none focus:border-polish transition-colors placeholder:text-text-muted/50"
                />
                <span className="text-xs text-text-muted">-</span>
                <input
                  type="number"
                  placeholder="Đến"
                  value={toChapterInput}
                  onChange={(e) => setToChapterInput(e.target.value)}
                  disabled={isAnalyzing}
                  className="w-16 bg-ink border border-parchment-2 rounded-md px-2 py-1 text-xs font-mono text-text-main focus:outline-none focus:border-polish transition-colors placeholder:text-text-muted/50"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleApplyRange}
                  disabled={
                    !fromChapterInput.trim() ||
                    !toChapterInput.trim() ||
                    isNaN(parseInt(fromChapterInput, 10)) ||
                    isNaN(parseInt(toChapterInput, 10)) ||
                    isAnalyzing
                  }
                  className="text-xs h-7 px-2.5"
                >
                  Chọn khoảng
                </Button>
              </div>
            </div>

            <div className="hidden md:block h-5 w-px bg-parchment-2/60" />

            {/* Single Chapter Jump */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-medium text-text-muted">Nhập số chương:</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  placeholder="Số chương..."
                  value={singleChapterInput}
                  onChange={(e) => {
                    setSingleChapterInput(e.target.value);
                    if (singleChapterMessage) setSingleChapterMessage(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSingleChapterSubmit();
                    }
                  }}
                  disabled={isAnalyzing}
                  className="w-28 bg-ink border border-parchment-2 rounded-md px-2.5 py-1 text-xs font-mono text-text-main focus:outline-none focus:border-polish transition-colors placeholder:text-text-muted/50"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSingleChapterSubmit}
                  disabled={
                    !singleChapterInput.trim() ||
                    isNaN(parseInt(singleChapterInput, 10)) ||
                    isAnalyzing
                  }
                  className="text-xs h-7 px-2.5"
                >
                  Chọn
                </Button>
              </div>
              {singleChapterMessage && (
                <span className="text-[11px] text-amber-400 font-medium animate-in fade-in duration-200">
                  {singleChapterMessage}
                </span>
              )}
            </div>

            {/* Bulk Hydrate Raw Button */}
            {onHydrateAllRaw && (
              <>
                <div className="hidden md:block h-5 w-px bg-parchment-2/60" />
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    data-testid="bulk-hydrate-raw-btn"
                    onClick={handleBulkHydrateRaw}
                    disabled={isAnalyzing || isHydratingRaw || chapterList.length === 0}
                    icon={
                      isHydratingRaw ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-polish" />
                      ) : (
                        <Zap className="w-3.5 h-3.5 text-polish" />
                      )
                    }
                    className="text-xs h-7 px-2.5 font-medium border-polish/30 hover:border-polish/60"
                    title="Tự động nạp văn bản raw tiếng Trung từ cơ sở dữ liệu cho toàn bộ chương"
                  >
                    {isHydratingRaw ? 'Đang nạp Raw...' : '⚡ Nạp Raw toàn bộ'}
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Feedback banner for bulk raw hydration */}
          {rawHydrationFeedback && (
            <div
              data-testid="raw-hydration-feedback"
              className="mb-4 text-[11px] text-polish bg-polish/10 border border-polish/30 px-3 py-1.5 rounded-[3px] flex items-center gap-2 animate-in fade-in duration-200"
            >
              <Check className="w-3.5 h-3.5 text-success shrink-0" />
              <span>{rawHydrationFeedback}</span>
            </div>
          )}

          {/* Chapter Items Container */}
          {isVirtualized ? (
            /* Virtualized Window for Long Chapter Lists */
            <div
              onScroll={onScroll}
              className="relative mb-5 max-h-[480px] h-[480px] overflow-y-auto pr-1 custom-scrollbar border border-parchment-2/40 rounded-[3px] bg-ink/10 p-1"
            >
              <div
                style={{
                  height: `${totalHeight}px`,
                  position: 'relative',
                  width: '100%',
                }}
              >
                {visibleItems.map(({ item: ch, index, style }) => (
                  <div
                    key={ch.chapterId || `chap-row-${index}`}
                    style={style}
                    className="pr-1"
                  >
                    {renderChapterRow(ch, index, true)}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Direct Mapping for Short Chapter Lists (<= 20 chapters) */
            <div className="space-y-2 mb-5 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
              {chapterList.map((ch, index) => renderChapterRow(ch, index, false))}
            </div>
          )}

          {/* Start Analysis CTA Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-parchment-2">
            <div className="flex flex-col gap-1.5 text-xs text-text-muted">
              {selectedChapterIds.length === 0 ? (
                <span className="flex items-center gap-1 text-text-muted">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Vui lòng chọn ít nhất 1 chương để bắt đầu kiểm định.</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-polish font-medium">
                  <Check className="w-3.5 h-3.5" />
                  <span>Đã sẵn sàng rà soát {selectedChapterIds.length} chương.</span>
                </span>
              )}

              {/* Advisory Quota Warning (Non-blocking) */}
              {quotaAdvisory.hasQuotaRisk && selectedChapterIds.length > 0 && (
                <div
                  data-testid="quota-advisory-warning"
                  className="flex items-center gap-1.5 text-[11px] text-amber-300 bg-amber-950/30 border border-amber-800/50 rounded-[3px] px-2.5 py-1 max-w-fit animate-in fade-in duration-150"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{quotaAdvisory.warningMessage}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
              {selectedChapterIds.length > 0 && (
                <span
                  data-testid="ai-call-estimate"
                  className="text-[11px] font-mono text-text-muted bg-parchment-2/40 px-2 py-1 rounded-[2px] border border-parchment-2/60 select-none"
                >
                  {`~${selectedChapterIds.length} lượt gọi AI`}
                </span>
              )}

              <Button
                type="button"
                data-testid="start-analysis-btn"
                variant="primary"
                size="md"
                onClick={onStartAnalysis}
                disabled={isAnalyzing || selectedChapterIds.length === 0}
                icon={<Sparkles className="w-4 h-4" />}
                className="font-bold px-5"
              >
                {isAnalyzing ? 'Đang phân tích...' : `Bắt đầu kiểm định (${selectedChapterIds.length} chương)`}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Raw Chinese Text Edit Modal (z-50) */}
      {editingRawChapterId && editingChapter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-parchment border border-parchment-2 rounded-md shadow-xl max-w-xl w-full p-5 text-text-main animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-parchment-2 mb-4">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-polish" />
                <h4 className="text-sm font-display font-bold">
                  Văn bản raw tiếng Trung: #{editingChapter.chapterNumber} {editingChapter.title}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setEditingRawChapterId(null)}
                className="text-text-muted hover:text-text-main p-1 rounded-[2px] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-text-muted mb-3">
              Văn bản raw được tự động nạp từ sourceText của dự án. Bạn có thể chỉnh sửa hoặc dán raw dị bản vào đây mà không ảnh hưởng tới dữ liệu gốc của dự án.
            </p>

            <textarea
              value={editingChapter.rawChineseContent || ''}
              onChange={(e) => onUpdateRawText(editingRawChapterId, e.target.value)}
              placeholder="Dán hoặc nhập nội dung chữ Hán nguyên tác vào đây..."
              rows={8}
              className="w-full bg-ink border border-parchment-2 rounded-[2px] p-3 text-xs font-serif text-text-main placeholder:text-text-muted/50 focus:outline-none focus:border-polish transition-all custom-scrollbar mb-3"
            />

            <div className="flex items-center justify-between pt-2 border-t border-parchment-2">
              <span className="text-[11px] text-text-muted font-mono">
                {editingChapter.rawChineseContent ? `${editingChapter.rawChineseContent.length} ký tự` : 'Chưa có dữ liệu'}
              </span>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setEditingRawChapterId(null)}
              >
                Hoàn tất & Đóng
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HakoChapterSelector;
