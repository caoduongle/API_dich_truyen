/**
 * HakoChapterSelector Component
 * Feature: 075-moderator-quality-checker
 *
 * Chọn tối đa 12 chương công khai từ danh mục tập/chương đã nạp của truyện.
 * Hỗ trợ chọn/bỏ chọn từng chương, chọn theo tập, mở rộng dán raw tiếng Trung đối chiếu.
 */

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Square,
  Languages,
  Check,
  AlertCircle,
  FileCode,
  Sparkles,
} from 'lucide-react';
import { HakoNovelMeta, HakoReviewChapter } from '../../types/hakoChecker';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Seal } from '../ui/Seal';
import { cn } from '../../lib/cn';

export interface HakoChapterSelectorProps {
  novelMeta: HakoNovelMeta;
  selectedUrls: string[];
  chapters: Record<string, HakoReviewChapter>;
  onToggleChapter: (url: string, chapterTitle?: string, volumeTitle?: string) => void;
  onSelectRange: (urls: string[]) => void;
  onClearSelection: () => void;
  onUpdateRawText: (url: string, raw: string) => void;
  onStartAnalysis: () => void;
  isAnalyzing: boolean;
}

const MAX_SELECTION_LIMIT = 12;

export function HakoChapterSelector({
  novelMeta,
  selectedUrls,
  chapters,
  onToggleChapter,
  onSelectRange,
  onClearSelection,
  onUpdateRawText,
  onStartAnalysis,
  isAnalyzing,
}: HakoChapterSelectorProps) {
  // Trạng thái mở/đóng accordion từng tập (mặc định mở tập đầu tiên)
  const [openVolumes, setOpenVolumes] = useState<Record<number, boolean>>({ 0: true });
  // Trạng thái mở/đóng drawer nhập raw tiếng Trung cho từng chapter URL
  const [openRawDrawers, setOpenRawDrawers] = useState<Record<string, boolean>>({});

  const toggleVolume = (index: number) => {
    setOpenVolumes((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const toggleRawDrawer = (url: string) => {
    setOpenRawDrawers((prev) => ({
      ...prev,
      [url]: !prev[url],
    }));
  };

  const selectVolumeChapters = (volumeChapters: Array<{ url: string; title: string }>, volumeTitle: string) => {
    const currentSelected = new Set(selectedUrls);
    const availableSlots = MAX_SELECTION_LIMIT - currentSelected.size;

    if (availableSlots <= 0) return;

    const urlsToAdd = volumeChapters
      .filter((c) => !currentSelected.has(c.url))
      .slice(0, availableSlots)
      .map((c) => c.url);

    const merged = Array.from(new Set([...selectedUrls, ...urlsToAdd]));
    onSelectRange(merged);
  };

  const isLimitReached = selectedUrls.length >= MAX_SELECTION_LIMIT;

  return (
    <div className="bg-parchment border border-parchment-2 rounded-md p-5 shadow-xs mb-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-parchment-2">
        <div className="flex items-center gap-2.5">
          <Seal character="選" tone="ink" className="text-[11px]" />
          <div>
            <h3 className="text-sm font-display font-bold text-text-main flex items-center gap-2">
              Chọn danh sách chương cần kiểm định
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">
              Đánh dấu từ 1 đến tối đa {MAX_SELECTION_LIMIT} chương cho mỗi đợt rà soát chất lượng
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {/* Selection counter badge */}
          <Badge
            tone={isLimitReached ? 'warning' : selectedUrls.length > 0 ? 'polish' : 'neutral'}
            className="text-xs px-2.5 py-1 font-mono font-bold"
          >
            Đã chọn: {selectedUrls.length} / {MAX_SELECTION_LIMIT}
          </Badge>

          {selectedUrls.length > 0 && (
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

      {/* Volumes & Chapters Accordions */}
      <div className="space-y-3 mb-5 max-h-[520px] overflow-y-auto pr-1 custom-scrollbar">
        {novelMeta.volumes.map((volume, volIdx) => {
          const isOpen = !!openVolumes[volIdx];
          const volumeSelectedCount = volume.chapters.filter((c) =>
            selectedUrls.includes(c.url)
          ).length;

          return (
            <div
              key={volIdx}
              className="border border-parchment-2 rounded-[3px] bg-ink/30 overflow-hidden"
            >
              {/* Volume Header */}
              <div
                onClick={() => toggleVolume(volIdx)}
                className="flex items-center justify-between px-3.5 py-2.5 bg-ink/60 hover:bg-parchment-2/30 transition-colors cursor-pointer select-none border-b border-parchment-2/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isOpen ? (
                    <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />
                  )}
                  <span className="text-xs font-display font-semibold text-text-main truncate">
                    {volume.volumeTitle}
                  </span>
                  <span className="text-[10px] text-text-muted font-mono">
                    ({volume.chapters.length} chương)
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {volumeSelectedCount > 0 && (
                    <Badge tone="polish" className="text-[9px]">
                      {volumeSelectedCount} đã chọn
                    </Badge>
                  )}

                  {!isLimitReached && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectVolumeChapters(volume.chapters, volume.volumeTitle);
                      }}
                      className="text-[10px] text-polish hover:underline font-medium px-1.5 py-0.5 cursor-pointer"
                    >
                      + Chọn tập này
                    </button>
                  )}
                </div>
              </div>

              {/* Volume Chapters List */}
              {isOpen && (
                <div className="p-2 divide-y divide-parchment-2/30">
                  {volume.chapters.map((ch) => {
                    const isSelected = selectedUrls.includes(ch.url);
                    const isRawOpen = !!openRawDrawers[ch.url];
                    const rawText = chapters[ch.url]?.rawChineseContent || '';
                    const hasRaw = !!rawText.trim();

                    return (
                      <div
                        key={ch.url}
                        className={cn(
                          'p-2 rounded-[2px] transition-colors',
                          isSelected
                            ? 'bg-parchment-2/40 border border-polish/30 my-1'
                            : 'hover:bg-parchment-2/20'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <label
                            className={cn(
                              'flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer select-none text-xs',
                              isLimitReached && !isSelected && 'opacity-50 cursor-not-allowed'
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isLimitReached && !isSelected}
                              onChange={() =>
                                onToggleChapter(ch.url, ch.title, volume.volumeTitle)
                              }
                              className="sr-only"
                            />

                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-polish shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-text-muted shrink-0" />
                            )}

                            <span
                              className={cn(
                                'truncate font-medium',
                                isSelected ? 'text-text-main font-semibold' : 'text-text-muted'
                              )}
                            >
                              {ch.title}
                            </span>
                          </label>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Raw Chinese text indicator / toggle */}
                            <button
                              type="button"
                              onClick={() => toggleRawDrawer(ch.url)}
                              title={
                                hasRaw
                                  ? 'Đã có văn bản raw tiếng Trung đối chiếu'
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
                              <span>{hasRaw ? 'Đã dán Raw' : '+ Thêm Raw'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Expandable Raw Chinese Input Drawer */}
                        {isRawOpen && (
                          <div className="mt-2.5 pt-2.5 border-t border-parchment-2/40 bg-ink/50 p-2.5 rounded-[2px] animate-in fade-in duration-150">
                            <div className="flex items-center justify-between mb-1.5 text-[11px] text-text-muted">
                              <span className="flex items-center gap-1 font-medium text-text-main">
                                <FileCode className="w-3.5 h-3.5 text-polish" />
                                <span>Văn bản gốc tiếng Trung (Raw) đối chiếu cho chương này</span>
                              </span>
                              {hasRaw && (
                                <Badge tone="neutral" className="text-[9px]">
                                  {rawText.length} ký tự
                                </Badge>
                              )}
                            </div>

                            <textarea
                              value={rawText}
                              onChange={(e) => onUpdateRawText(ch.url, e.target.value)}
                              placeholder="Dán toàn bộ văn bản tiếng Trung gốc của chương này vào đây để AI đối chiếu song ngữ chuyên sâu (phát hiện sai nghĩa, sót câu, thêm thắt)..."
                              rows={3}
                              className="w-full bg-ink border border-parchment-2 rounded-[2px] p-2 text-xs font-serif text-text-main placeholder:text-text-muted/50 focus:outline-none focus:border-polish transition-all custom-scrollbar"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Start Analysis CTA Button */}
      <div className="flex items-center justify-between pt-3 border-t border-parchment-2">
        <div className="text-xs text-text-muted">
          {selectedUrls.length === 0 ? (
            <span className="flex items-center gap-1 text-text-muted">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Vui lòng chọn ít nhất 1 chương để bắt đầu kiểm định.</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-polish font-medium">
              <Check className="w-3.5 h-3.5" />
              <span>Đã sẵn sàng rà soát {selectedUrls.length} chương.</span>
            </span>
          )}
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={onStartAnalysis}
          disabled={isAnalyzing || selectedUrls.length === 0}
          icon={<Sparkles className="w-4 h-4" />}
          className="font-bold px-5"
        >
          {isAnalyzing ? 'Đang phân tích...' : `Bắt đầu kiểm định (${selectedUrls.length} chương)`}
        </Button>
      </div>
    </div>
  );
}

export default HakoChapterSelector;
