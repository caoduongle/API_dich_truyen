import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react';
import { FindReplaceModalProps, MatchLocation } from '../../types/textSearch';
import {
  findMatchesInText,
  replaceSingleMatch,
  replaceAllMatches,
  getNextMatchIndex,
  getPrevMatchIndex,
} from '../../utils/textSearch';
import { useNotifications } from '../NotificationSystem';
import { Button } from '../ui/Button';

/**
 * Hộp thoại Tìm và Thay thế văn bản trong Bàn Dịch.
 * Feature: 136-find-and-replace
 * Tuân thủ bảng màu "Mực & Chu Sa" (.agents/rules/design-system.md)
 */
export function FindReplaceModal({
  isOpen,
  onClose,
  targetText,
  onTextChange,
  textareaRef,
  initialSearchTerm = '',
  stageLabel,
}: FindReplaceModalProps) {
  const { showToast } = useNotifications();

  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [replaceTerm, setReplaceTerm] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Đồng bộ initialSearchTerm khi modal được mở hoặc props thay đổi
  useEffect(() => {
    if (isOpen) {
      if (initialSearchTerm) {
        setSearchTerm(initialSearchTerm);
      }
      // Tự động focus vào ô tìm kiếm khi mở modal
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialSearchTerm]);

  // Tính toán danh sách vị trí trùng khớp thời gian thực
  const matches = useMemo(() => {
    return findMatchesInText(targetText, searchTerm, matchCase);
  }, [targetText, searchTerm, matchCase]);

  // Cuộn và bôi đen vị trí khớp trong textarea
  const highlightMatch = useCallback(
    (index: number, matchList: MatchLocation[]) => {
      if (index < 0 || index >= matchList.length) return;
      const match = matchList[index];
      const textareaEl = textareaRef?.current;
      if (!textareaEl) return;

      try {
        textareaEl.focus();
        textareaEl.setSelectionRange(match.start, match.end);
      } catch {
        // Safe fallback
      }

      // Tính toán khoảng đệm cuộn 2 dòng trên
      const textBefore = textareaEl.value.slice(0, match.start);
      const lineCount = textBefore.split('\n').length - 1;
      let lineHeight = 21;
      if (typeof window !== 'undefined' && window.getComputedStyle) {
        try {
          const computed = window.getComputedStyle(textareaEl);
          const parsedLineHeight = parseFloat(computed.lineHeight);
          if (!isNaN(parsedLineHeight) && parsedLineHeight > 0) {
            lineHeight = parsedLineHeight;
          } else {
            const parsedFontSize = parseFloat(computed.fontSize);
            if (!isNaN(parsedFontSize) && parsedFontSize > 0) {
              lineHeight = parsedFontSize * 1.5;
            }
          }
        } catch {
          // Keep default lineHeight
        }
      }
      const bufferLines = 2;
      const targetScrollTop = Math.max(0, (lineCount - bufferLines) * lineHeight);
      textareaEl.scrollTop = targetScrollTop;
    },
    [textareaRef]
  );

  // Điều chỉnh currentMatchIndex khi danh sách matches thay đổi
  useEffect(() => {
    if (!isOpen) return;

    if (matches.length === 0) {
      setCurrentMatchIndex(-1);
    } else {
      setCurrentMatchIndex((prevIndex) => {
        let nextIndex = prevIndex;
        if (prevIndex < 0 || prevIndex >= matches.length) {
          nextIndex = 0;
        }
        highlightMatch(nextIndex, matches);
        return nextIndex;
      });
    }
  }, [isOpen, matches, highlightMatch]);

  // Đóng bằng phím Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Điều hướng kết quả kế tiếp (wrap-around)
  const handleNext = useCallback(() => {
    if (matches.length === 0) return;
    const nextIdx = getNextMatchIndex(currentMatchIndex, matches.length);
    setCurrentMatchIndex(nextIdx);
    highlightMatch(nextIdx, matches);
  }, [matches, currentMatchIndex, highlightMatch]);

  // Điều hướng kết quả trước đó (wrap-around)
  const handlePrev = useCallback(() => {
    if (matches.length === 0) return;
    const prevIdx = getPrevMatchIndex(currentMatchIndex, matches.length);
    setCurrentMatchIndex(prevIdx);
    highlightMatch(prevIdx, matches);
  }, [matches, currentMatchIndex, highlightMatch]);

  // Thay thế vị trí đơn lẻ đang chọn
  const handleReplaceSingle = useCallback(() => {
    if (matches.length === 0 || currentMatchIndex < 0) return;
    const currentMatch = matches[currentMatchIndex];
    const newText = replaceSingleMatch(targetText, currentMatch, replaceTerm);
    onTextChange(newText);

    // Tính toán kết quả mới ngay lập tức
    const newMatches = findMatchesInText(newText, searchTerm, matchCase);
    if (newMatches.length > 0) {
      const nextIdx = currentMatchIndex < newMatches.length ? currentMatchIndex : 0;
      setCurrentMatchIndex(nextIdx);
      highlightMatch(nextIdx, newMatches);
    } else {
      setCurrentMatchIndex(-1);
    }
  }, [
    matches,
    currentMatchIndex,
    targetText,
    replaceTerm,
    onTextChange,
    searchTerm,
    matchCase,
    highlightMatch,
  ]);

  // Thay thế toàn bộ hàng loạt
  const handleReplaceAll = useCallback(() => {
    if (!searchTerm || matches.length === 0) return;
    const result = replaceAllMatches(targetText, searchTerm, replaceTerm, matchCase);
    onTextChange(result.newText);

    if (result.count > 0) {
      showToast({
        message: `Đã thay thế ${result.count} vị trí`,
        type: 'success',
        duration: 4000,
      });
    } else {
      showToast({
        message: 'Không tìm thấy vị trí nào để thay thế',
        type: 'info',
        duration: 3000,
      });
    }
    setCurrentMatchIndex(-1);
  }, [targetText, searchTerm, replaceTerm, matchCase, matches.length, onTextChange, showToast]);

  // Xử lý phím Enter trong ô tìm kiếm
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        handlePrev();
      } else {
        handleNext();
      }
    }
  };

  // Xử lý phím Enter trong ô thay thế
  const handleReplaceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        handleReplaceAll();
      } else {
        handleReplaceSingle();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="find-replace-title"
      className="fixed top-20 right-4 sm:right-8 z-50 w-[calc(100vw-2rem)] sm:w-96 bg-ink border border-parchment-2 rounded-md shadow-2xl p-4 text-text-main animate-fadeIn backdrop-blur-xs select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-parchment-2/80 mb-3">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-draft" />
          <h3 id="find-replace-title" className="text-sm font-bold text-text-main">
            Tìm và Thay thế
          </h3>
          {stageLabel && (
            <span className="text-[10px] bg-parchment px-1.5 py-0.5 rounded-[2px] text-text-muted border border-parchment-2">
              {stageLabel}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Đóng"
          className="text-text-muted hover:text-text-main p-1 rounded-[2px] hover:bg-parchment-2/50 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Form Body */}
      <div className="space-y-3">
        {/* Trường Tìm kiếm */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="find-search-input" className="font-semibold text-text-muted">
              Tìm kiếm
            </label>
            <div>
              {!searchTerm ? (
                <span className="text-[11px] text-text-muted">Nhập văn bản</span>
              ) : matches.length === 0 ? (
                <span className="text-[11px] text-amber-500 font-medium">0 kết quả</span>
              ) : (
                <span className="text-[11px] text-polish font-bold">
                  {(currentMatchIndex < 0 ? 0 : currentMatchIndex) + 1}/{matches.length} kết quả
                </span>
              )}
            </div>
          </div>
          <div className="relative">
            <input
              id="find-search-input"
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Nhập văn bản cần tìm..."
              className="w-full text-xs bg-parchment border border-parchment-2 rounded-[2px] px-3 py-2 text-text-main placeholder:text-text-muted/60 focus:outline-none focus:border-draft transition-all"
            />
          </div>
        </div>

        {/* Trường Thay thế */}
        <div className="space-y-1">
          <label htmlFor="find-replace-input" className="text-xs font-semibold text-text-muted block">
            Thay thế bằng
          </label>
          <input
            id="find-replace-input"
            type="text"
            value={replaceTerm}
            onChange={(e) => setReplaceTerm(e.target.value)}
            onKeyDown={handleReplaceKeyDown}
            placeholder="Nhập văn bản thay thế..."
            className="w-full text-xs bg-parchment border border-parchment-2 rounded-[2px] px-3 py-2 text-text-main placeholder:text-text-muted/60 focus:outline-none focus:border-polish transition-all"
          />
        </div>

        {/* Tùy chọn Phân biệt chữ hoa/thường */}
        <div className="pt-0.5">
          <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-text-muted hover:text-text-main select-none">
            <input
              type="checkbox"
              id="find-match-case"
              checked={matchCase}
              onChange={(e) => setMatchCase(e.target.checked)}
              className="rounded-[2px] accent-polish border-parchment-2 cursor-pointer w-3.5 h-3.5"
            />
            <span>Phân biệt chữ hoa/thường</span>
          </label>
        </div>

        {/* Nút hành động */}
        <div className="flex items-center justify-between pt-2 border-t border-parchment-2/80 gap-1.5 flex-wrap">
          {/* Nhóm điều hướng Trước/Sau */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={matches.length === 0}
              className="px-2 py-1 text-[11px] min-h-[30px]"
              title="Tìm vị trí trước đó (Shift+Enter)"
              icon={<ChevronUp className="w-3.5 h-3.5" />}
            >
              Trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={matches.length === 0}
              className="px-2 py-1 text-[11px] min-h-[30px]"
              title="Tìm vị trí kế tiếp (Enter)"
              icon={<ChevronDown className="w-3.5 h-3.5" />}
            >
              Sau
            </Button>
          </div>

          {/* Nhóm Đóng / Thay thế / Thay tất cả */}
          <div className="flex items-center gap-1.5 ml-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="px-2.5 py-1 text-[11px] min-h-[30px]"
            >
              Đóng
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleReplaceSingle}
              disabled={matches.length === 0}
              className="px-2.5 py-1 text-[11px] min-h-[30px]"
              title="Thay thế vị trí đang chọn"
            >
              Thay thế
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleReplaceAll}
              disabled={matches.length === 0 || !searchTerm}
              className="px-2.5 py-1 text-[11px] min-h-[30px]"
              title="Thay thế toàn bộ các vị trí trong chương"
            >
              Thay tất cả
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
