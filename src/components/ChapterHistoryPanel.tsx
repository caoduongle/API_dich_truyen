import React, { useState } from 'react';
import { StoryProject, Chapter, ChapterMetadata } from '../types';
import { History, BookOpen, Clock, Trash2, RotateCcw } from 'lucide-react';
import { getChapterFromDB } from '../services/db';
import { useNotifications } from './NotificationSystem';
import { useVirtualList } from '../hooks/useVirtualList';
import { UI_CONFIG } from '@shared/constants';
import { SkeletonBlock } from './common/Skeleton';

interface ChapterHistoryPanelProps {
  activeProject: StoryProject;
  onUpdateProject: (updated: StoryProject) => void;
  onDeleteChapterHistory: (chapId: string) => void;
  onGoToTranslate: (chapter?: Chapter) => void;
  onResetChapters: (projectId: string, chapIds: string[]) => Promise<void>;
}

export default function ChapterHistoryPanel({
  activeProject,
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
    }
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
        <div className="bg-parchment border border-parchment-2 rounded-md p-8 text-center text-text-muted space-y-4 shadow-xs">
          <BookOpen className="w-12 h-12 text-text-muted mx-auto" />
          <p className="text-sm">Chưa có chương nào được lưu trữ riêng biệt tại đây.</p>
          <button
            onClick={() => onGoToTranslate()}
            className="inline-flex items-center gap-1.5 bg-polish hover:bg-[#A03522] text-white text-xs font-bold px-4 py-2.5 rounded-[2px] cursor-pointer shadow-xs transition-colors glow-polish"
          >
            Bắt đầu dịch ngay
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Chapter list */}
          <div className="bg-parchment border border-parchment-2 rounded-md overflow-hidden p-3 flex flex-col max-h-[500px] shadow-xs">
            {/* Batch Action Header */}
            <div className="flex items-center justify-between px-2 py-2 border-b border-parchment-2 mb-2">
              <label className="flex items-center gap-2 text-xs font-bold text-text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedChapterIds.length === chapters.length && chapters.length > 0}
                  onChange={handleSelectAll}
                  className="rounded-[2px] border-parchment-2 bg-ink text-polish focus:ring-polish w-3.5 h-3.5"
                />
                Chọn tất cả ({chapters.length})
              </label>
              
              {selectedChapterIds.length > 0 && (
                <button
                  onClick={handleResetSelectedToSource}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold px-2 py-1 rounded-[2px] shadow-xs cursor-pointer transition-all flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset ({selectedChapterIds.length})
                </button>
              )}
            </div>

            <span className="text-[10px] font-bold text-text-muted px-2 py-1 block tracking-wider uppercase">
              Chương đã biên soạn
            </span>
            
            {/* Virtualized list scroll container */}
            <div 
              className="overflow-y-auto flex-1 pr-1 custom-scrollbar"
              style={{ height: '400px' }}
              onScroll={onScroll}
            >
              <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
                {visibleItems.map(({ item: chap, style }) => {
                  const isSelected = selectedHistoryChapterId === chap.id;
                  const isChecked = selectedChapterIds.includes(chap.id);
                  return (
                    <div key={chap.id} style={style} className="py-[3px]">
                      <div
                        onClick={async () => {
                          setSelectedHistoryChapterId(chap.id);
                          setSelectedChapterDetails(null);
                          const fullChap = await getChapterFromDB(chap.id);
                          setSelectedChapterDetails(fullChap);
                          if (fullChap) {
                            if (!fullChap.polishedTranslation && !fullChap.rawTranslation) {
                              setHistoryViewTab('source');
                            } else if (!fullChap.polishedTranslation) {
                              setHistoryViewTab('raw');
                            } else {
                              setHistoryViewTab('polished');
                            }
                          }
                        }}
                        className={`p-3 rounded-[2px] transition-all cursor-pointer relative group flex justify-between items-start border h-full ${
                          isSelected
                            ? 'bg-parchment-2 border-polish shadow-xs'
                            : 'bg-ink border-parchment-2 hover:bg-parchment-2'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 flex-1 pr-6">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              setSelectedChapterIds(prev => 
                                e.target.checked 
                                  ? [...prev, chap.id] 
                                  : prev.filter(id => id !== chap.id)
                              );
                            }}
                            className="mt-0.5 rounded-[2px] border-parchment-2 bg-ink text-polish focus:ring-polish w-3.5 h-3.5 cursor-pointer"
                          />
                          <div className="flex-1">
                            <h4 className={`text-xs font-bold ${isSelected ? 'text-polish' : 'text-text-main'}`}>
                              {chap.title}
                            </h4>
                            <div className="flex items-center gap-1.5 text-[10px] text-text-muted mt-1 flex-wrap">
                              <Clock className="w-3 h-3 text-text-muted" />
                              <span>
                                {new Date(chap.createdAt).toLocaleDateString('vi-VN')}{' '}
                                {new Date(chap.createdAt).toLocaleTimeString('vi-VN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {chap.status === 'completed' && (
                                <span className="bg-polish/20 text-polish border border-polish/30 text-[9px] font-bold px-1.5 py-0.5 rounded-[2px]">
                                  ✓ Hoàn tất
                                </span>
                              )}
                              {chap.status === 'in_progress' && (
                                <span className="bg-draft/20 text-draft border border-draft/30 text-[9px] font-bold px-1.5 py-0.5 rounded-[2px]">
                                  📝 Bản thô
                                </span>
                              )}
                              {chap.status === 'not_started' && (
                                <span className="bg-ink text-text-muted border border-parchment-2 text-[9px] font-bold px-1.5 py-0.5 rounded-[2px]">
                                  🈷 Bản gốc
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
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
                          className="text-text-muted hover:text-rose-400 p-1 rounded-[2px] opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2 cursor-pointer"
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
                        <h3 className="text-base font-display font-bold text-text-main">{chap.title}</h3>
                        <p className="text-xs text-text-muted">
                          Lưu trữ lúc: {new Date(chap.createdAt).toLocaleString('vi-VN')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {chap.status !== 'not_started' && (
                          <button
                            onClick={() => handleResetSingleToSource(chap.id)}
                            className="text-xs font-semibold border border-amber-800/40 hover:bg-amber-950/20 text-amber-300 px-3 py-1.5 rounded-[2px] cursor-pointer transition-colors flex items-center gap-1"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reset về bản gốc
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            const fullChap = await getChapterFromDB(chap.id);
                            if (fullChap) {
                              onGoToTranslate(fullChap);
                            } else {
                              showToast({ message: "Không tìm thấy dữ liệu chương!", type: 'error' });
                            }
                          }}
                          className="text-xs font-bold bg-polish hover:bg-[#A03522] text-white px-3 py-1.5 rounded-[2px] cursor-pointer transition-colors shadow-xs"
                        >
                          Mở chỉnh sửa lại
                        </button>
                      </div>
                    </div>

                    {/* Tab switcher */}
                    <div className="flex gap-1 bg-ink rounded-[2px] p-1 w-fit border border-parchment-2">
                      {(
                        [
                          { key: 'source', label: '🈷 Bản gốc', available: !!chap.sourceText },
                          { key: 'raw', label: '📝 Dịch thô', available: !!chap.rawTranslation },
                          { key: 'polished', label: '✨ Dịch biên tập', available: !!chap.polishedTranslation },
                        ] as const
                      ).map(({ key, label, available }) => (
                        <button
                          key={key}
                          onClick={() => setHistoryViewTab(key)}
                          disabled={!available}
                          className={`text-[11px] font-bold px-3 py-1.5 rounded-[2px] transition-all cursor-pointer ${
                            historyViewTab === key
                              ? 'bg-polish text-white shadow-xs'
                              : available
                              ? 'text-text-muted hover:text-text-main'
                              : 'text-text-muted opacity-40 cursor-not-allowed'
                          }`}
                        >
                          {label}
                          {!available && <span className="ml-1 text-[10px] font-normal text-text-muted">(trống)</span>}
                        </button>
                      ))}
                    </div>

                    {/* Content panels */}
                    {historyViewTab === 'source' && (
                      <div className="space-y-1 p-4 rounded-md bg-ink border border-parchment-2 max-h-[420px] overflow-y-auto custom-scrollbar">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-2">
                          Văn bản tiếng Trung gốc
                        </span>
                        {chap.sourceText ? (
                          <p className="text-sm font-serif leading-relaxed text-text-main whitespace-pre-wrap">
                            {chap.sourceText}
                          </p>
                        ) : (
                          <p className="text-sm text-text-muted italic">Không có dữ liệu.</p>
                        )}
                      </div>
                    )}
                    {historyViewTab === 'raw' && (
                      <div className="space-y-1 p-4 rounded-md bg-draft/10 border border-draft/30 max-h-[420px] overflow-y-auto custom-scrollbar">
                        <span className="text-[10px] font-bold text-draft uppercase tracking-wider block mb-2">
                          Bản dịch thô (Giai đoạn 1)
                        </span>
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
                        <span className="text-[10px] font-bold text-polish uppercase tracking-wider block mb-2">
                          Bản dịch biên tập (Giai đoạn 2)
                        </span>
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
    </div>
  );
}
