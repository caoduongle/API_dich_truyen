import React, { useState } from 'react';
import { StoryProject, Chapter, ChapterMetadata } from '../types';
import {
  History,
  BookOpen,
  Clock,
  Trash2,
  RotateCcw,
  ArrowRight,
  FileX,
  Sparkles,
  AlertTriangle,
  FilePlus2,
  X,
} from 'lucide-react';
import { getChapterFromDB, saveChapterToDB } from '../services/db';
import { useNotifications } from './NotificationSystem';
import { useVirtualList } from '../hooks/useVirtualList';
import { UI_CONFIG } from '../config/constants';
import { SkeletonBlock } from './common/Skeleton';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { EmptyState } from './ui/EmptyState';
import { ParagraphMetricsBadge } from './workspace/ParagraphMetricsBadge';

/**
 * Kiểm tra xem chương có bị thiếu văn bản gốc tiếng Trung hay không
 */
export function isChapterMissingSource(chap: Partial<Chapter>): boolean {
  return !chap.sourceText || chap.sourceText.trim().length === 0;
}

interface ChapterHistoryPanelProps {
  activeProject: StoryProject;
  onUpdateProject: (updated: StoryProject) => void;
  onDeleteChapterHistory: (chapId: string) => void;
  onGoToTranslate: (chapter?: Chapter) => void;
  onResetChapters: (projectId: string, chapIds: string[]) => Promise<void>;
}

export function transformChapterDeletePolished(chap: Chapter): Chapter {
  const hasRaw = !!chap.rawTranslation && chap.rawTranslation.trim().length > 0;
  return {
    ...chap,
    polishedTranslation: '',
    translatedLines: hasRaw ? chap.rawTranslation.split(/\n+/).map((l) => l.trim()).filter(Boolean) : [],
    status: hasRaw ? 'in_progress' : 'not_started',
    updatedAt: new Date().toISOString(),
  };
}

export function transformChapterDeleteRaw(chap: Chapter): Chapter {
  const hasPolished = !!chap.polishedTranslation && chap.polishedTranslation.trim().length > 0;
  return {
    ...chap,
    rawTranslation: '',
    translatedLines: hasPolished ? chap.polishedTranslation.split(/\n+/).map((l) => l.trim()).filter(Boolean) : [],
    status: hasPolished ? 'completed' : 'not_started',
    updatedAt: new Date().toISOString(),
  };
}

export function transformChapterPromotePolishedToRaw(chap: Chapter): Chapter {
  return {
    ...chap,
    rawTranslation: chap.polishedTranslation,
    polishedTranslation: '',
    translatedLines: chap.polishedTranslation.split(/\n+/).map((l) => l.trim()).filter(Boolean),
    status: 'in_progress',
    updatedAt: new Date().toISOString(),
  };
}

export function transformChaptersBatch(
  chapters: Chapter[],
  action: 'deletePolished' | 'deleteRaw' | 'promotePolishedToRaw'
): { updatedChapters: Chapter[]; modifiedCount: number } {
  let modifiedCount = 0;
  const updatedChapters = chapters.map((chap) => {
    if (action === 'deletePolished') {
      if (chap.polishedTranslation && chap.polishedTranslation.trim().length > 0) {
        modifiedCount++;
        return transformChapterDeletePolished(chap);
      }
    } else if (action === 'deleteRaw') {
      if (chap.rawTranslation && chap.rawTranslation.trim().length > 0) {
        modifiedCount++;
        return transformChapterDeleteRaw(chap);
      }
    } else if (action === 'promotePolishedToRaw') {
      if (chap.polishedTranslation && chap.polishedTranslation.trim().length > 0) {
        modifiedCount++;
        return transformChapterPromotePolishedToRaw(chap);
      }
    }
    return chap;
  });
  return { updatedChapters, modifiedCount };
}

export default function ChapterHistoryPanel({
  activeProject,
  onUpdateProject,
  onDeleteChapterHistory,
  onGoToTranslate,
  onResetChapters,
}: ChapterHistoryPanelProps) {
  const { showToast, showConfirm } = useNotifications();
  const { chapters, title: projectTitle } = activeProject;
  const [selectedHistoryChapterId, setSelectedHistoryChapterId] = useState<string | null>(null);
  const [selectedChapterDetails, setSelectedChapterDetails] = useState<Chapter | null>(null);
  const [historyViewTab, setHistoryViewTab] = useState<'source' | 'raw' | 'polished'>('polished');
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
  const [recoveryModalChap, setRecoveryModalChap] = useState<Chapter | null>(null);
  const [recoverySourceInput, setRecoverySourceInput] = useState('');

  const { visibleItems, totalHeight, onScroll } = useVirtualList<ChapterMetadata>({
    items: chapters,
    itemHeight: UI_CONFIG.VIRTUAL_LIST_ITEM_HEIGHT,
    containerHeight: UI_CONFIG.VIRTUAL_LIST_CONTAINER_HEIGHT,
    overscan: UI_CONFIG.VIRTUAL_LIST_OVERSCAN
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedChapterIds(chapters.map((c) => c.id));
    } else {
      setSelectedChapterIds([]);
    }
  };

  const handleResetSelectedToSource = async () => {
    if (selectedChapterIds.length === 0) return;
    const confirmed = await showConfirm({
      title: 'Reset các chương đã chọn',
      message: `Bạn có chắc chắn muốn reset ${selectedChapterIds.length} chương đã chọn về bản gốc tiếng Trung? Thao tác này sẽ xóa toàn bộ bản dịch thô và bản dịch biên tập.`,
      confirmText: 'Xác nhận reset',
      cancelText: 'Hủy',
      type: 'warning'
    });
    if (confirmed) {
      await onResetChapters(activeProject.id, selectedChapterIds);
      if (selectedHistoryChapterId && selectedChapterIds.includes(selectedHistoryChapterId)) {
        const updated = await getChapterFromDB(selectedHistoryChapterId);
        setSelectedChapterDetails(updated);
        setHistoryViewTab('source');
      }
      setSelectedChapterIds([]);
      showToast({ message: `Đã reset ${selectedChapterIds.length} chương về bản gốc tiếng Trung.`, type: 'info' });
    }
  };

  const handleDeleteSelectedPolished = async () => {
    if (selectedChapterIds.length === 0) return;
    const count = selectedChapterIds.length;
    const confirmed = await showConfirm({
      title: 'Xóa bản biên tập hàng loạt',
      message: `Bạn có chắc muốn xóa bản dịch biên tập của ${count} chương đã chọn? Bản dịch thô của các chương này sẽ được giữ nguyên 100%.`,
      confirmText: 'Xác nhận xóa',
      cancelText: 'Hủy',
      type: 'warning',
    });
    if (!confirmed) return;

    let modifiedCount = 0;
    const updatedMap = new Map<string, Chapter>();

    for (const chapId of selectedChapterIds) {
      const chap = await getChapterFromDB(chapId);
      if (chap && chap.polishedTranslation && chap.polishedTranslation.trim().length > 0) {
        const updated = transformChapterDeletePolished(chap);
        await saveChapterToDB(updated);
        updatedMap.set(chapId, updated);
        modifiedCount++;
      }
    }

    if (modifiedCount > 0) {
      const updatedChaptersMeta = activeProject.chapters.map((c) => {
        const updated = updatedMap.get(c.id);
        return updated ? { ...c, status: updated.status, updatedAt: updated.updatedAt } : c;
      });
      onUpdateProject({ ...activeProject, chapters: updatedChaptersMeta });

      if (selectedHistoryChapterId && updatedMap.has(selectedHistoryChapterId)) {
        const activeUpdated = updatedMap.get(selectedHistoryChapterId)!;
        setSelectedChapterDetails(activeUpdated);
        setHistoryViewTab(activeUpdated.rawTranslation ? 'raw' : 'source');
      }
      showToast({ message: `Đã xóa bản dịch biên tập của ${modifiedCount} chương đã chọn.`, type: 'info' });
    } else {
      showToast({ message: 'Không có chương nào trong danh sách đã chọn có bản dịch biên tập.', type: 'info' });
    }
    setSelectedChapterIds([]);
  };

  const handleDeleteSelectedRaw = async () => {
    if (selectedChapterIds.length === 0) return;
    const count = selectedChapterIds.length;
    const confirmed = await showConfirm({
      title: 'Xóa bản dịch thô hàng loạt',
      message: `Bạn có chắc muốn xóa bản dịch thô của ${count} chương đã chọn?`,
      confirmText: 'Xác nhận xóa',
      cancelText: 'Hủy',
      type: 'warning',
    });
    if (!confirmed) return;

    let modifiedCount = 0;
    const updatedMap = new Map<string, Chapter>();

    for (const chapId of selectedChapterIds) {
      const chap = await getChapterFromDB(chapId);
      if (chap && chap.rawTranslation && chap.rawTranslation.trim().length > 0) {
        const updated = transformChapterDeleteRaw(chap);
        await saveChapterToDB(updated);
        updatedMap.set(chapId, updated);
        modifiedCount++;
      }
    }

    if (modifiedCount > 0) {
      const updatedChaptersMeta = activeProject.chapters.map((c) => {
        const updated = updatedMap.get(c.id);
        return updated ? { ...c, status: updated.status, updatedAt: updated.updatedAt } : c;
      });
      onUpdateProject({ ...activeProject, chapters: updatedChaptersMeta });

      if (selectedHistoryChapterId && updatedMap.has(selectedHistoryChapterId)) {
        const activeUpdated = updatedMap.get(selectedHistoryChapterId)!;
        setSelectedChapterDetails(activeUpdated);
        setHistoryViewTab(activeUpdated.polishedTranslation ? 'polished' : 'source');
      }
      showToast({ message: `Đã xóa bản dịch thô của ${modifiedCount} chương đã chọn.`, type: 'info' });
    } else {
      showToast({ message: 'Không có chương nào trong danh sách đã chọn có bản dịch thô.', type: 'info' });
    }
    setSelectedChapterIds([]);
  };

  const handlePromoteSelectedPolishedToRaw = async () => {
    if (selectedChapterIds.length === 0) return;
    const count = selectedChapterIds.length;
    const confirmed = await showConfirm({
      title: 'Chuyển thành bản dịch thô hàng loạt',
      message: `Bạn có chắc muốn chuyển bản biên tập thành bản dịch thô cho ${count} chương đã chọn? Bản dịch thô mới sẽ sẵn sàng làm bản nháp để chuốt văn tiếp.`,
      confirmText: 'Xác nhận chuyển',
      cancelText: 'Hủy',
      type: 'info',
    });
    if (!confirmed) return;

    let modifiedCount = 0;
    const updatedMap = new Map<string, Chapter>();

    for (const chapId of selectedChapterIds) {
      const chap = await getChapterFromDB(chapId);
      if (chap && chap.polishedTranslation && chap.polishedTranslation.trim().length > 0) {
        const updated = transformChapterPromotePolishedToRaw(chap);
        await saveChapterToDB(updated);
        updatedMap.set(chapId, updated);
        modifiedCount++;
      }
    }

    if (modifiedCount > 0) {
      const updatedChaptersMeta = activeProject.chapters.map((c) => {
        const updated = updatedMap.get(c.id);
        return updated ? { ...c, status: updated.status, updatedAt: updated.updatedAt } : c;
      });
      onUpdateProject({ ...activeProject, chapters: updatedChaptersMeta });

      if (selectedHistoryChapterId && updatedMap.has(selectedHistoryChapterId)) {
        const activeUpdated = updatedMap.get(selectedHistoryChapterId)!;
        setSelectedChapterDetails(activeUpdated);
        setHistoryViewTab('raw');
      }
      showToast({ message: `Đã chuyển bản biên tập thành bản thô cho ${modifiedCount} chương thành công.`, type: 'success' });
    } else {
      showToast({ message: 'Không có chương nào trong danh sách đã chọn có bản dịch biên tập.', type: 'info' });
    }
    setSelectedChapterIds([]);
  };

  const handleResetSingleToSource = async (chapId: string) => {
    const confirmed = await showConfirm({
      title: 'Reset chương về bản gốc',
      message: 'Bạn có chắc chắn muốn reset chương này về bản gốc tiếng Trung? Thao tác này sẽ xóa toàn bộ bản dịch thô và bản dịch biên tập.',
      confirmText: 'Xác nhận reset',
      cancelText: 'Hủy',
      type: 'warning'
    });
    if (confirmed) {
      await onResetChapters(activeProject.id, [chapId]);
      const updated = await getChapterFromDB(chapId);
      setSelectedChapterDetails(updated);
      setHistoryViewTab('source');
    }
  };

  const handleDeletePolishedTranslation = async (chap: Chapter) => {
    const confirmed = await showConfirm({
      title: 'Xóa bản dịch biên tập',
      message: `Bạn có chắc muốn xóa bản dịch biên tập của chương "${chap.title}"? Bản dịch thô sẽ được giữ nguyên 100%.`,
      confirmText: 'Xác nhận xóa',
      cancelText: 'Hủy',
      type: 'warning',
    });
    if (!confirmed) return;

    const updatedChap = transformChapterDeletePolished(chap);
    await saveChapterToDB(updatedChap);
    setSelectedChapterDetails(updatedChap);
    setHistoryViewTab(updatedChap.rawTranslation ? 'raw' : 'source');

    const updatedChaptersMeta = activeProject.chapters.map((c) =>
      c.id === chap.id ? { ...c, status: updatedChap.status, updatedAt: updatedChap.updatedAt } : c
    );
    onUpdateProject({ ...activeProject, chapters: updatedChaptersMeta });
    showToast({ message: `Đã xóa bản dịch biên tập của chương "${chap.title}".`, type: 'info' });
  };

  const handleDeleteRawTranslation = async (chap: Chapter) => {
    const confirmed = await showConfirm({
      title: 'Xóa bản dịch thô',
      message: `Bạn có chắc muốn xóa bản dịch thô của chương "${chap.title}"?`,
      confirmText: 'Xác nhận xóa',
      cancelText: 'Hủy',
      type: 'warning',
    });
    if (!confirmed) return;

    const updatedChap = transformChapterDeleteRaw(chap);
    await saveChapterToDB(updatedChap);
    setSelectedChapterDetails(updatedChap);
    setHistoryViewTab(updatedChap.polishedTranslation ? 'polished' : 'source');

    const updatedChaptersMeta = activeProject.chapters.map((c) =>
      c.id === chap.id ? { ...c, status: updatedChap.status, updatedAt: updatedChap.updatedAt } : c
    );
    onUpdateProject({ ...activeProject, chapters: updatedChaptersMeta });
    showToast({ message: `Đã xóa bản dịch thô của chương "${chap.title}".`, type: 'info' });
  };

  const handlePromotePolishedToRaw = async (chap: Chapter) => {
    const confirmed = await showConfirm({
      title: 'Chuyển thành bản dịch thô',
      message: `Bạn có chắc muốn chuyển bản biên tập hiện tại thành bản dịch thô của chương "${chap.title}"? Bản dịch thô mới sẽ sẵn sàng làm bản nháp để chuốt văn tiếp.`,
      confirmText: 'Xác nhận chuyển',
      cancelText: 'Hủy',
      type: 'info',
    });
    if (!confirmed) return;

    const updatedChap = transformChapterPromotePolishedToRaw(chap);
    await saveChapterToDB(updatedChap);
    setSelectedChapterDetails(updatedChap);
    setHistoryViewTab('raw');

    const updatedChaptersMeta = activeProject.chapters.map((c) =>
      c.id === chap.id ? { ...c, status: updatedChap.status, updatedAt: updatedChap.updatedAt } : c
    );
    onUpdateProject({ ...activeProject, chapters: updatedChaptersMeta });
    showToast({ message: `Đã chuyển bản biên tập thành bản dịch thô thành công.`, type: 'success' });
  };

  const handleSaveRecoveredSource = async () => {
    if (!recoveryModalChap) return;
    const trimmedSource = recoverySourceInput.trim();
    if (!trimmedSource) {
      showToast({ message: 'Vui lòng nhập nội dung bản gốc tiếng Trung.', type: 'warning' });
      return;
    }

    const paragraphs = trimmedSource.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const updatedChap: Chapter = {
      ...recoveryModalChap,
      sourceText: trimmedSource,
      paragraphs: paragraphs.length > 0 ? paragraphs : recoveryModalChap.paragraphs,
      updatedAt: new Date().toISOString(),
    };

    await saveChapterToDB(updatedChap);
    setSelectedChapterDetails(updatedChap);
    setHistoryViewTab('source');
    setRecoveryModalChap(null);
    setRecoverySourceInput('');

    const updatedChaptersMeta = activeProject.chapters.map((c) =>
      c.id === updatedChap.id ? { ...c, updatedAt: updatedChap.updatedAt } : c
    );
    onUpdateProject({ ...activeProject, chapters: updatedChaptersMeta });
    showToast({ message: `Đã khôi phục bản gốc cho chương "${updatedChap.title}" thành công.`, type: 'success' });
  };

  return (
    <div id="history-chapters-section" className="space-y-6 text-text-main">
      <div>
        <h2 className="text-sm font-display font-bold text-text-main uppercase tracking-wider flex items-center gap-2">
          <History className="w-4 h-4 text-polish" />
          Lịch Sử Lưu Trữ Dịch Thuật
        </h2>
        <p className="text-xs text-text-muted">
          Kho lưu trữ toàn bộ các chương hoặc đoạn truyện bạn đã lưu lại của bộ truyện{' '}
          <strong className="text-text-main">&quot;{projectTitle}&quot;</strong>.
        </p>
      </div>

      {chapters.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="w-8 h-8 text-text-muted" />}
          title="Chưa có chương nào được lưu trữ riêng biệt tại đây"
          description="Hãy tải sách và bắt đầu dịch chương trong Không gian dịch thuật để theo dõi tiến trình!"
          action={
            <Button
              variant="primary"
              size="md"
              onClick={() => onGoToTranslate()}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Mở bàn dịch ngay
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Chapter list left sidebar */}
          <div className="space-y-3 bg-parchment border border-parchment-2 rounded-md p-4 shadow-xs">
            <div className="border-b border-parchment-2 pb-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedChapterIds.length === chapters.length && chapters.length > 0}
                    onChange={handleSelectAll}
                    className="rounded-[2px] accent-polish w-3.5 h-3.5 cursor-pointer"
                    title="Chọn tất cả các chương"
                  />
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    Danh Sách Chương ({chapters.length})
                  </span>
                </div>
                {selectedChapterIds.length > 0 && (
                  <span className="text-[11px] font-semibold text-polish">
                    Đã chọn {selectedChapterIds.length}
                  </span>
                )}
              </div>

              {selectedChapterIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-parchment-2/50">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetSelectedToSource}
                    icon={<RotateCcw className="w-3 h-3" />}
                    className="text-[11px] text-warning border-warning/40 hover:bg-warning/10 hover:text-warning py-0.5 px-2 min-h-[28px] sm:min-h-[28px]"
                    title="Reset toàn bộ các chương đã chọn về bản gốc tiếng Trung (xóa cả bản thô và bản biên tập)"
                  >
                    Reset ({selectedChapterIds.length})
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteSelectedPolished}
                    icon={<FileX className="w-3 h-3" />}
                    className="text-[11px] text-warning border-warning/40 hover:bg-warning/10 hover:text-warning py-0.5 px-2 min-h-[28px] sm:min-h-[28px]"
                    title="Xóa bản dịch biên tập của các chương đã chọn, giữ nguyên 100% bản dịch thô"
                  >
                    Xóa biên tập ({selectedChapterIds.length})
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteSelectedRaw}
                    icon={<Trash2 className="w-3 h-3" />}
                    className="text-[11px] text-warning border-warning/40 hover:bg-warning/10 hover:text-warning py-0.5 px-2 min-h-[28px] sm:min-h-[28px]"
                    title="Xóa bản dịch thô của các chương đã chọn"
                  >
                    Xóa bản thô ({selectedChapterIds.length})
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePromoteSelectedPolishedToRaw}
                    icon={<Sparkles className="w-3 h-3 text-polish" />}
                    className="text-[11px] text-text-main border-parchment-2 hover:bg-parchment-2 py-0.5 px-2 min-h-[28px] sm:min-h-[28px]"
                    title="Chuyển bản biên tập hiện tại thành bản dịch thô cho các chương đã chọn để chuốt tiếp"
                  >
                    Thành bản thô ({selectedChapterIds.length})
                  </Button>
                </div>
              )}
            </div>

            <div
              className="overflow-y-auto max-h-[500px]"
              onScroll={onScroll}
            >
              <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
                {visibleItems.map(({ item: chap, style }) => {
                  const isSelected = selectedHistoryChapterId === chap.id;
                  const isChecked = selectedChapterIds.includes(chap.id);
                  return (
                    <div
                      key={chap.id}
                      style={style}
                      className="px-0.5 py-1"
                    >
                      <div
                        onClick={async () => {
                          setSelectedHistoryChapterId(chap.id);
                          const fullChap = await getChapterFromDB(chap.id);
                          setSelectedChapterDetails(fullChap);
                          if (fullChap?.polishedTranslation) {
                            setHistoryViewTab('polished');
                          } else if (fullChap?.rawTranslation) {
                            setHistoryViewTab('raw');
                          } else {
                            setHistoryViewTab('source');
                          }
                        }}
                        className={`group relative p-3 rounded-[2px] border transition-all cursor-pointer flex flex-col gap-1.5 ${
                          isSelected
                            ? 'bg-parchment-2 border-polish shadow-xs'
                            : 'bg-ink/60 border-parchment-2 hover:bg-parchment-2/50'
                        }`}
                      >
                        <div className="flex items-start gap-2 pr-6">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              e.stopPropagation();
                              if (e.target.checked) {
                                setSelectedChapterIds(prev => [...prev, chap.id]);
                              } else {
                                setSelectedChapterIds(prev => prev.filter(id => id !== chap.id));
                              }
                            }}
                            className="mt-0.5 rounded-[2px] accent-polish w-3 h-3 cursor-pointer shrink-0"
                          />
                          <h4 className="text-xs font-bold text-text-main line-clamp-1 flex-1 font-serif">
                            {chap.title}
                          </h4>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-text-muted pl-5">
                          <span className="flex items-center gap-1 font-sans">
                            <Clock className="w-3 h-3 text-text-muted" />
                            {new Date(chap.createdAt).toLocaleDateString('vi-VN')}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded-[2px] font-bold text-[9px] border ${
                            chap.status === 'completed'
                              ? 'bg-polish/15 text-polish border-polish/30'
                              : chap.status === 'in_progress'
                              ? 'bg-draft/20 text-draft border-draft/30'
                              : 'bg-ink text-text-muted border-parchment-2'
                          }`}>
                            {chap.status === 'completed' ? 'Đã biên tập' : chap.status === 'in_progress' ? 'Đang dịch' : 'Chưa dịch'}
                          </span>
                        </div>

                        <button
                          type="button"
                          aria-label={`Xóa lịch sử chương ${chap.title}`}
                          onClick={async (e) => {
                            e.stopPropagation();
                            const confirmed = await showConfirm({
                              title: 'Xóa lịch sử dịch chương',
                              message: `Bạn có chắc muốn xóa lịch sử dịch của chương "${chap.title}" khỏi hệ thống?`,
                              confirmText: 'Xác nhận xóa',
                              cancelText: 'Hủy',
                              type: 'danger'
                            });
                            if (confirmed) {
                              onDeleteChapterHistory(chap.id);
                              if (selectedHistoryChapterId === chap.id) setSelectedHistoryChapterId(null);
                              setSelectedChapterIds(prev => prev.filter(id => id !== chap.id));
                            }
                          }}
                          className="text-text-muted hover:text-danger p-1 rounded-[2px] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-danger transition-opacity absolute right-2 top-2 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Chapter content viewer */}
          <div className="md:col-span-2 bg-parchment border border-parchment-2 rounded-md p-5 shadow-xs min-h-[400px]">
            {selectedHistoryChapterId ? (
              (() => {
                const chap = selectedChapterDetails;
                if (!chap || chap.id !== selectedHistoryChapterId)
                  return (
                    <div className="space-y-4 animate-fade-in">
                      <div className="border-b border-parchment-2 pb-3 flex justify-between items-start">
                        <div className="space-y-2 w-1/2">
                          <SkeletonBlock className="h-5 w-3/4" />
                          <SkeletonBlock className="h-3 w-1/3" />
                        </div>
                        <SkeletonBlock className="h-8 w-28 rounded" />
                      </div>
                      <div className="space-y-3 pt-2">
                        <SkeletonBlock className="h-4 w-full" />
                        <SkeletonBlock className="h-4 w-5/6" />
                        <SkeletonBlock className="h-4 w-4/5" />
                        <SkeletonBlock className="h-32 w-full rounded mt-4" />
                      </div>
                    </div>
                  );
                return (
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="border-b border-parchment-2 pb-3 flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-display font-bold text-text-main">{chap.title}</h3>
                          {isChapterMissingSource(chap) && (
                            <Badge tone="warning" className="flex items-center gap-1 text-[10px]">
                              <AlertTriangle className="w-3 h-3 text-warning" />
                              Thiếu bản gốc
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-text-muted">
                          Lưu trữ lúc: {new Date(chap.createdAt).toLocaleString('vi-VN')}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {isChapterMissingSource(chap) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setRecoveryModalChap(chap);
                              setRecoverySourceInput('');
                            }}
                            icon={<FilePlus2 className="w-3.5 h-3.5 text-polish" />}
                            className="text-polish border-polish/40 hover:bg-polish/10"
                            title="Bổ sung bản gốc tiếng Trung mà không ảnh hưởng bản dịch hiện có"
                          >
                            Bổ sung bản gốc
                          </Button>
                        )}

                        {chap.status !== 'not_started' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResetSingleToSource(chap.id)}
                            icon={<RotateCcw className="w-3.5 h-3.5" />}
                            className="text-warning border-warning/40 hover:bg-warning/10 hover:text-warning"
                            title="Reset toàn bộ về bản gốc tiếng Trung (xóa cả bản thô và bản biên tập)"
                          >
                            Reset về bản gốc
                          </Button>
                        )}

                        {!!chap.polishedTranslation && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeletePolishedTranslation(chap)}
                            icon={<FileX className="w-3.5 h-3.5" />}
                            className="text-warning border-warning/40 hover:bg-warning/10 hover:text-warning"
                            title="Xóa bản dịch biên tập, giữ nguyên 100% bản dịch thô"
                          >
                            Xóa bản biên tập
                          </Button>
                        )}

                        {!!chap.rawTranslation && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteRawTranslation(chap)}
                            icon={<Trash2 className="w-3.5 h-3.5" />}
                            className="text-warning border-warning/40 hover:bg-warning/10 hover:text-warning"
                            title="Xóa bản dịch thô của chương"
                          >
                            Xóa bản dịch thô
                          </Button>
                        )}

                        {!!chap.polishedTranslation && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePromotePolishedToRaw(chap)}
                            icon={<Sparkles className="w-3.5 h-3.5 text-polish" />}
                            className="text-text-main border-parchment-2 hover:bg-parchment-2"
                            title="Chuyển bản biên tập hiện tại thành bản dịch thô để sẵn sàng chuốt tiếp"
                          >
                            Chuyển thành bản thô
                          </Button>
                        )}

                        <Button
                          variant="primary"
                          size="sm"
                          onClick={async () => {
                            const fullChap = await getChapterFromDB(chap.id);
                            if (fullChap) {
                              onGoToTranslate(fullChap);
                            } else {
                              showToast({ message: "Không tìm thấy dữ liệu chương!", type: 'error' });
                            }
                          }}
                        >
                          Mở chỉnh sửa lại
                        </Button>
                      </div>
                    </div>

                    {/* Tab switcher */}
                    <div role="tablist" aria-label="Phiên bản văn bản chương" className="flex gap-1 bg-ink rounded-[2px] p-1 w-fit border border-parchment-2">
                      {(
                        [
                          { key: 'source', label: 'Bản gốc', available: true },
                          { key: 'raw', label: 'Dịch thô', available: !!chap.rawTranslation },
                          { key: 'polished', label: 'Dịch biên tập', available: !!chap.polishedTranslation },
                        ] as const
                      ).map(({ key, label, available }) => (
                        <button
                          key={key}
                          type="button"
                          role="tab"
                          aria-selected={historyViewTab === key}
                          onClick={() => setHistoryViewTab(key)}
                          disabled={!available}
                          className={`text-[11px] font-bold px-3 py-1.5 min-h-[36px] sm:min-h-0 rounded-[2px] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-polish ${
                            historyViewTab === key
                              ? 'bg-polish text-white shadow-xs'
                              : available
                              ? 'text-text-muted hover:text-text-main'
                              : 'text-text-muted opacity-40 cursor-not-allowed'
                          }`}
                        >
                          {label}
                          {key === 'source' && isChapterMissingSource(chap) ? (
                            <span className="ml-1 text-[10px] font-normal text-warning">(thiếu)</span>
                          ) : !available ? (
                            <span className="ml-1 text-[10px] font-normal text-text-muted">(trống)</span>
                          ) : null}
                        </button>
                      ))}
                    </div>

                    {/* Content panels */}
                    {historyViewTab === 'source' && (
                      <div className="space-y-1 p-4 rounded-md bg-ink border border-parchment-2 max-h-[420px] overflow-y-auto custom-scrollbar">
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">
                            Văn bản tiếng Trung gốc
                          </span>
                          <ParagraphMetricsBadge text={chap.sourceText} />
                        </div>
                        {chap.sourceText ? (
                          <p className="text-sm font-serif leading-relaxed text-text-main whitespace-pre-wrap">
                            {chap.sourceText}
                          </p>
                        ) : (
                          <div className="p-4 rounded-[3px] border border-amber-500/30 bg-amber-500/10 text-xs space-y-2">
                            <div className="flex items-center gap-1.5 font-bold text-amber-400">
                              <AlertTriangle className="w-4 h-4" />
                              Chương này hiện chưa có bản gốc tiếng Trung
                            </div>
                            <p className="text-text-muted">
                              Bạn có thể bổ sung lại nội dung tiếng Trung gốc. Bản dịch biên tập và dịch thô hiện có sẽ được giữ nguyên 100%.
                            </p>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                setRecoveryModalChap(chap);
                                setRecoverySourceInput('');
                              }}
                            >
                              Bổ sung bản gốc ngay
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                    {historyViewTab === 'raw' && (
                      <div className="space-y-1 p-4 rounded-md bg-draft/10 border border-draft/30 max-h-[420px] overflow-y-auto custom-scrollbar">
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                          <span className="text-[10px] font-bold text-draft uppercase tracking-wider block">
                            Bản dịch thô (Giai đoạn 1)
                          </span>
                          <ParagraphMetricsBadge text={chap.rawTranslation} referenceText={chap.sourceText} />
                        </div>
                        {chap.rawTranslation ? (
                          <p className="text-sm font-sans leading-relaxed text-text-main whitespace-pre-wrap">
                            {chap.rawTranslation}
                          </p>
                        ) : (
                          <p className="text-sm text-text-muted italic">Chưa có bản dịch thô.</p>
                        )}
                      </div>
                    )}
                    {historyViewTab === 'polished' && (
                      <div className="space-y-1 p-4 rounded-md bg-parchment-2 border border-polish/30 max-h-[420px] overflow-y-auto custom-scrollbar">
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                          <span className="text-[10px] font-bold text-polish uppercase tracking-wider block">
                            Bản dịch biên tập (Giai đoạn 2)
                          </span>
                          <ParagraphMetricsBadge text={chap.polishedTranslation} referenceText={chap.rawTranslation || chap.sourceText} />
                        </div>
                        {chap.polishedTranslation ? (
                          <p className="text-sm font-sans leading-relaxed text-text-main whitespace-pre-wrap">
                            {chap.polishedTranslation}
                          </p>
                        ) : (
                          <p className="text-sm text-text-muted italic">Chưa có bản dịch biên tập.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-text-muted space-y-2 pt-16">
                <BookOpen className="w-10 h-10 text-text-muted opacity-40" />
                <p className="text-sm">Chọn một chương bên trái để xem nội dung</p>
              </div>
            )}
          </div>
        </div>
      )}

      {recoveryModalChap && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="recovery-modal-title"
          className="fixed inset-0 bg-ink/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
        >
          <div className="bg-parchment border border-parchment-2 rounded-md max-w-2xl w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between border-b border-parchment-2 pb-3">
              <div>
                <h3 id="recovery-modal-title" className="text-base font-display font-bold text-text-main flex items-center gap-2">
                  <FilePlus2 className="w-4 h-4 text-polish" />
                  Bổ sung / Khôi phục bản gốc tiếng Trung
                </h3>
                <p className="text-xs text-text-muted mt-1">
                  Chương: <strong className="text-text-main">{recoveryModalChap.title}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRecoveryModalChap(null)}
                className="text-text-muted hover:text-text-main p-1 rounded cursor-pointer"
                aria-label="Đóng modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-text-muted">
                Dán nội dung chữ Hán gốc vào ô bên dưới. Thao tác này sẽ phục hồi bản gốc và tự động phân chia đoạn (paragraphs) mà hoàn toàn KHÔNG làm thay đổi bản dịch biên tập đã có.
              </p>
              <textarea
                value={recoverySourceInput}
                onChange={(e) => setRecoverySourceInput(e.target.value)}
                placeholder="Dán nội dung chữ Hán tại đây..."
                rows={8}
                className="w-full bg-ink border border-parchment-2 rounded-[2px] p-3 text-sm font-serif text-text-main custom-scrollbar resize-none focus:outline-none focus:border-polish"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-parchment-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRecoveryModalChap(null)}
              >
                Hủy
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveRecoveredSource}
                disabled={!recoverySourceInput.trim()}
              >
                Lưu bản gốc
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
