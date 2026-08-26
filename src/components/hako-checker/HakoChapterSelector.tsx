/**
 * HakoChapterSelector Component (Project-based Chapter Selector)
 * Feature: 075-moderator-quality-checker
 *
 * Cho phép moderator chọn một dự án dịch từ ứng dụng và chọn tối đa 12 chương đã có bản dịch.
 * Tự động nạp sourceText làm raw và polishedTranslation/rawTranslation làm bản dịch.
 */

import React, { useState } from 'react';
import {
  CheckSquare,
  Square,
  Languages,
  Check,
  AlertCircle,
  FileCode,
  Sparkles,
  BookOpen,
  FolderOpen,
} from 'lucide-react';
import { ProjectReviewChapter } from '../../types/hakoChecker';
import { StoryProject } from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Seal } from '../ui/Seal';
import { EmptyState } from '../ui/EmptyState';
import { cn } from '../../lib/cn';

export interface HakoChapterSelectorProps {
  projects: StoryProject[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  selectedChapterIds: string[];
  chapters: Record<string, ProjectReviewChapter>;
  onToggleChapter: (chapterId: string) => void;
  onSelectRange: (chapterIds: string[]) => void;
  onClearSelection: () => void;
  onUpdateRawText: (chapterId: string, raw: string) => void;
  onStartAnalysis: () => void;
  isAnalyzing: boolean;
}

const MAX_SELECTION_LIMIT = 12;

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
  onStartAnalysis,
  isAnalyzing,
}: HakoChapterSelectorProps) {
  // Trạng thái mở/đóng drawer raw tiếng Trung cho từng chapterId
  const [openRawDrawers, setOpenRawDrawers] = useState<Record<string, boolean>>({});

  const toggleRawDrawer = (chapterId: string) => {
    setOpenRawDrawers((prev) => ({
      ...prev,
      [chapterId]: !prev[chapterId],
    }));
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null;
  const chapterList = Object.values(chapters).sort((a, b) => a.chapterNumber - b.chapterNumber);

  const translatableChapters = chapterList.filter((c) => c.translationType !== 'none');
  const isLimitReached = selectedChapterIds.length >= MAX_SELECTION_LIMIT;

  const handleSelectAllTranslatable = () => {
    const idsToSelect = translatableChapters.slice(0, MAX_SELECTION_LIMIT).map((c) => c.chapterId);
    onSelectRange(idsToSelect);
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
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span>Tổng {selectedProject.chapters?.length || 0} chương</span>
              <span className="text-polish font-medium">
                ({translatableChapters.length} chương có bản dịch)
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
            <div className="flex items-center gap-2">
              <span className="text-xs font-display font-semibold text-text-main">
                Danh sách chương ({chapterList.length} chương)
              </span>
              <span className="text-[11px] text-text-muted">
                (Tối đa {MAX_SELECTION_LIMIT} chương mỗi đợt)
              </span>
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

          {/* Chapter Items List */}
          <div className="space-y-2 mb-5 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
            {chapterList.map((ch) => {
              const isSelected = selectedChapterIds.includes(ch.chapterId);
              const isRawOpen = !!openRawDrawers[ch.chapterId];
              const rawText = ch.rawChineseContent || '';
              const hasRaw = !!rawText.trim();
              const isUntranslated = ch.translationType === 'none';

              return (
                <div
                  key={ch.chapterId}
                  className={cn(
                    'p-2.5 rounded-[3px] border transition-colors',
                    isSelected
                      ? 'bg-parchment-2/40 border-polish/40 shadow-xs'
                      : isUntranslated
                      ? 'bg-ink/20 border-parchment-2/30 opacity-60'
                      : 'bg-ink/30 border-parchment-2 hover:bg-parchment-2/20'
                  )}
                >
                  <div className="flex items-center justify-between gap-2.5">
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
                        onChange={() => onToggleChapter(ch.chapterId)}
                        className="sr-only"
                      />

                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-polish shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-text-muted shrink-0" />
                      )}

                      <div className="flex items-center gap-2 truncate">
                        <span className="font-mono text-text-muted text-[11px] shrink-0">
                          #{ch.chapterNumber}
                        </span>
                        <span
                          className={cn(
                            'truncate font-medium',
                            isSelected ? 'text-text-main font-semibold' : 'text-text-main/90'
                          )}
                        >
                          {ch.title}
                        </span>
                      </div>
                    </label>

                    {/* Status Badges & Controls */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Translation Status Badge */}
                      {ch.translationType === 'polished' ? (
                        <Badge tone="polish" className="text-[10px] px-1.5 py-0.5">
                          {ch.wordCount > 0 ? `Đã biên tập (${ch.wordCount} từ)` : 'Đã biên tập'}
                        </Badge>
                      ) : ch.translationType === 'raw' ? (
                        <Badge tone="neutral" className="text-[10px] px-1.5 py-0.5 border-amber-500/30 text-amber-300">
                          {ch.wordCount > 0 ? `Đã dịch thô (${ch.wordCount} từ)` : 'Đã dịch thô'}
                        </Badge>
                      ) : (
                        <Badge tone="neutral" className="text-[10px] px-1.5 py-0.5 opacity-60">
                          Chưa có bản dịch
                        </Badge>
                      )}

                      {/* Raw Drawer Toggle */}
                      {!isUntranslated && (
                        <button
                          type="button"
                          onClick={() => toggleRawDrawer(ch.chapterId)}
                          title={
                            hasRaw
                              ? 'Đã có văn bản raw tiếng Trung tự động hoặc dán đè'
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

                  {/* Expandable Raw Chinese Input Drawer */}
                  {isRawOpen && (
                    <div className="mt-2.5 pt-2.5 border-t border-parchment-2/40 bg-ink/50 p-2.5 rounded-[2px] animate-in fade-in duration-150">
                      <div className="flex items-center justify-between mb-1.5 text-[11px] text-text-muted">
                        <span className="flex items-center gap-1 font-medium text-text-main">
                          <FileCode className="w-3.5 h-3.5 text-polish" />
                          <span>Văn bản raw tiếng Trung đối chiếu (tự động nạp từ sourceText của dự án)</span>
                        </span>
                        {hasRaw && (
                          <Badge tone="neutral" className="text-[9px]">
                            {rawText.length} ký tự
                          </Badge>
                        )}
                      </div>

                      <textarea
                        value={rawText}
                        onChange={(e) => onUpdateRawText(ch.chapterId, e.target.value)}
                        placeholder="Văn bản gốc tiếng Trung được tự động nạp từ sourceText. Bạn có thể chỉnh sửa hoặc dán raw dị bản vào đây mà không làm thay đổi dữ liệu gốc của dự án..."
                        rows={3}
                        className="w-full bg-ink border border-parchment-2 rounded-[2px] p-2 text-xs font-serif text-text-main placeholder:text-text-muted/50 focus:outline-none focus:border-polish transition-all custom-scrollbar"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Start Analysis CTA Button */}
          <div className="flex items-center justify-between pt-3 border-t border-parchment-2">
            <div className="text-xs text-text-muted">
              {selectedChapterIds.length === 0 ? (
                <span className="flex items-center gap-1 text-text-muted">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Vui lòng chọn ít nhất 1 chương để bắt đầu kiểm định.</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-polish font-medium">
                  <Check className="w-3.5 h-3.5" />
                  <span>Đã sẵn sàng rà soát {selectedChapterIds.length} chương.</span>
                </span>
              )}
            </div>

            <Button
              type="button"
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
        </>
      )}
    </div>
  );
}

export default HakoChapterSelector;
