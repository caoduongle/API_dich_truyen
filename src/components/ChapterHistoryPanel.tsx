import React, { useState } from 'react';
import { Chapter } from '../types';
import { History, BookOpen, Clock, Trash2 } from 'lucide-react';

interface ChapterHistoryPanelProps {
  chapters: Chapter[];
  projectTitle: string;
  onDeleteChapterHistory: (chapId: string) => void;
  onGoToTranslate: () => void;
}

export default function ChapterHistoryPanel({
  chapters,
  projectTitle,
  onDeleteChapterHistory,
  onGoToTranslate,
}: ChapterHistoryPanelProps) {
  const [selectedHistoryChapterId, setSelectedHistoryChapterId] = useState<string | null>(null);
  const [historyViewTab, setHistoryViewTab] = useState<'source' | 'raw' | 'polished'>('polished');

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
            onClick={onGoToTranslate}
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer shadow-sm transition-colors"
          >
            Bắt đầu dịch ngay
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Chapter list */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden p-2 space-y-1.5 max-h-[500px] overflow-y-auto shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 px-2.5 py-1 block tracking-wider uppercase">
              Chương đã biên soạn
            </span>
            {chapters.map((chap) => {
              const isSelected = selectedHistoryChapterId === chap.id;
              return (
                <div
                  key={chap.id}
                  onClick={() => setSelectedHistoryChapterId(chap.id)}
                  className={`p-2.5 rounded-lg transition-all cursor-pointer relative group flex justify-between items-start border ${
                    isSelected
                      ? 'bg-indigo-50 border-indigo-200 shadow-xs'
                      : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex-1 pr-6">
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
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Bạn có chắc muốn xóa lịch sử dịch của chương này khỏi hệ thống?')) {
                        onDeleteChapterHistory(chap.id);
                        if (selectedHistoryChapterId === chap.id) setSelectedHistoryChapterId(null);
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
                const chap = chapters.find((c) => c.id === selectedHistoryChapterId);
                if (!chap)
                  return <p className="text-slate-400 text-sm">Không thấy chương lựa chọn.</p>;
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
                      <button
                        onClick={onGoToTranslate}
                        className="text-xs font-semibold border border-indigo-600 hover:bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                      >
                        Mở chỉnh sửa lại
                      </button>
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
