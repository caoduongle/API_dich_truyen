import React, { useState, useEffect } from 'react';
import { StoryProject, Chapter, ChapterMetadata } from '../types';
import { History, BookOpen, Clock, Trash2, RotateCcw } from 'lucide-react';
import { getChapterFromDB } from '../services/db';
import { useNotifications } from './NotificationSystem';

interface ChapterHistoryPanelProps {
  activeProject: StoryProject;
  onUpdateProject: (updated: StoryProject) => void;
  onDeleteChapterHistory: (chapId: string) => void;
  onGoToTranslate: (chapter?: Chapter) => void;
  onResetChapters: (projectId: string, chapIds: string[]) => Promise<void>;
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
    <div id="history-chapters-section" className="space-y-6">
      <div>
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-600" />
          Lịch Sử Lưu Trữ Dịch Thuật
        </h2>
        <p className="text-xs text-slate-500">
          Kho lưu trữ toàn bộ các chương hoặc đoạn truyện bạn đã lưu lại của bộ truyện{' '}
          <strong>&quot;{projectTitle}&quot;</strong>.
        </p>
      </div>

      {chapters.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 space-y-4 shadow-sm">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-sm">Chưa có chương nào được lưu trữ riêng biệt tại đây.</p>
          <button
            onClick={() => onGoToTranslate()}
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer shadow-sm transition-colors"
          >
            Bắt đầu dịch ngay
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Chapter list */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden p-2 space-y-1.5 max-h-[500px] overflow-y-auto shadow-sm">
            {/* Batch Action Header */}
            <div className="flex items-center justify-between px-2.5 py-2 border-b border-slate-100 mb-2">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedChapterIds.length === chapters.length && chapters.length > 0}
                  onChange={handleSelectAll}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                />
                Chọn tất cả ({chapters.length})
              </label>
              
              {selectedChapterIds.length > 0 && (
                <button
                  onClick={handleResetSelectedToSource}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold px-2 py-1 rounded shadow-xs cursor-pointer transition-colors flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset ({selectedChapterIds.length})
                </button>
              )}
            </div>

            <span className="text-[10px] font-bold text-slate-400 px-2.5 py-1 block tracking-wider uppercase">
              Chương đã biên soạn
            </span>
            
            {chapters.map((chap) => {
              const isSelected = selectedHistoryChapterId === chap.id;
              const isChecked = selectedChapterIds.includes(chap.id);
              return (
                <div
                  key={chap.id}
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
                  className={`p-2.5 rounded-lg transition-all cursor-pointer relative group flex justify-between items-start border ${
                    isSelected
                      ? 'bg-indigo-50 border-indigo-200 shadow-xs'
                      : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50'
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
                      className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <div className="flex-1">
                      <h4 className={`text-xs font-bold ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>
                        {chap.title}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1 flex-wrap">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>
                          {new Date(chap.createdAt).toLocaleDateString('vi-VN')}{' '}
                          {new Date(chap.createdAt).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {chap.status === 'completed' && (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-bold px-1 py-0.5 rounded">
                            ✓ Hoàn tất
                          </span>
                        )}
                        {chap.status === 'in_progress' && (
                          <span className="bg-amber-50 text-amber-700 border border-amber-100 text-[9px] font-bold px-1 py-0.5 rounded">
                            📝 Bản thô
                          </span>
                        )}
                        {chap.status === 'not_started' && (
                          <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[9px] font-bold px-1 py-0.5 rounded">
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
                    className="text-slate-400 hover:text-rose-600 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Chapter content viewer */}
          <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm min-h-[400px]">
            {selectedHistoryChapterId ? (
              (() => {
                const chap = selectedChapterDetails;
                if (!chap || chap.id !== selectedHistoryChapterId)
                  return <p className="text-slate-400 text-xs animate-pulse py-12 text-center">Đang tải dữ liệu chương...</p>;
                return (
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="border-b border-slate-100 pb-3 flex justify-between items-start">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">{chap.title}</h3>
                        <p className="text-xs text-slate-400">
                          Lưu trữ lúc: {new Date(chap.createdAt).toLocaleString('vi-VN')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {chap.status !== 'not_started' && (
                          <button
                            onClick={() => handleResetSingleToSource(chap.id)}
                            className="text-xs font-semibold border border-amber-600 hover:bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
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
                          className="text-xs font-semibold border border-indigo-600 hover:bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                        >
                          Mở chỉnh sửa lại
                        </button>
                      </div>
                    </div>

                    {/* Tab switcher */}
                    <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
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
                          className={`text-[11px] font-bold px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                            historyViewTab === key
                              ? 'bg-white text-indigo-700 shadow-sm'
                              : available
                              ? 'text-slate-500 hover:text-slate-800'
                              : 'text-slate-300 cursor-not-allowed'
                          }`}
                        >
                          {label}
                          {!available && <span className="ml-1 text-[10px] font-normal">(trống)</span>}
                        </button>
                      ))}
                    </div>

                    {/* Content panels */}
                    {historyViewTab === 'source' && (
                      <div className="space-y-1 p-3 rounded-lg bg-slate-50 border border-slate-200 max-h-[420px] overflow-y-auto">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                          Văn bản tiếng Trung gốc
                        </span>
                        {chap.sourceText ? (
                          <p className="text-sm font-sans leading-relaxed text-slate-800 whitespace-pre-wrap">
                            {chap.sourceText}
                          </p>
                        ) : (
                          <p className="text-sm text-slate-400 italic">Không có dữ liệu.</p>
                        )}
                      </div>
                    )}
                    {historyViewTab === 'raw' && (
                      <div className="space-y-1 p-3 rounded-lg bg-amber-50 border border-amber-200 max-h-[420px] overflow-y-auto">
                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block mb-2">
                          Bản dịch thô (Giai đoạn 1)
                        </span>
                        {chap.rawTranslation ? (
                          <p className="text-sm font-sans leading-relaxed text-slate-800 whitespace-pre-wrap">
                            {chap.rawTranslation}
                          </p>
                        ) : (
                          <p className="text-sm text-slate-400 italic">Chưa có bản dịch thô.</p>
                        )}
                      </div>
                    )}
                    {historyViewTab === 'polished' && (
                      <div className="space-y-1 p-3 rounded-lg bg-indigo-50 border border-indigo-200 max-h-[420px] overflow-y-auto">
                        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block mb-2">
                          Bản dịch biên tập (Giai đoạn 2)
                        </span>
                        {chap.polishedTranslation ? (
                          <p className="text-sm font-sans leading-relaxed text-slate-800 whitespace-pre-wrap">
                            {chap.polishedTranslation}
                          </p>
                        ) : (
                          <p className="text-sm text-slate-400 italic">Chưa có bản dịch biên tập.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2 pt-16">
                <BookOpen className="w-10 h-10 text-slate-300" />
                <p className="text-sm">Chọn một chương bên trái để xem nội dung</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
