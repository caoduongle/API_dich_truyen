import React from 'react';
import { AlertTriangle, AlertCircle, CheckCircle, X } from 'lucide-react';
import { GlossaryItem, GlossaryType } from '../../types';
import { useNotifications } from '../NotificationSystem';
import { getChapterFromDB } from '../../services/db';
import { findFuzzyCandidates, FuzzyCandidate } from '../../utils/sinoNormalize';

export interface ReviewQueuePanelProps {
  reviewQueue: Array<GlossaryItem & { reason: string }>;
  setReviewQueue: React.Dispatch<React.SetStateAction<Array<GlossaryItem & { reason: string }>>>;
  handleAcceptReviewItem: (id: string) => void;
  handleDiscardReviewItem: (id: string) => void;
  handleUpdateReviewItem: (id: string, updatedFields: Partial<GlossaryItem>) => void;
}

const ReviewQueueItem = React.memo(function ReviewQueueItem({
  item,
  handleAcceptReviewItem,
  handleDiscardReviewItem,
  handleUpdateReviewItem,
}: {
  item: GlossaryItem & { reason: string };
  handleAcceptReviewItem: (id: string) => void;
  handleDiscardReviewItem: (id: string) => void;
  handleUpdateReviewItem: (id: string, updatedFields: Partial<GlossaryItem>) => void;
}) {
  const [candidates, setCandidates] = React.useState<FuzzyCandidate[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [chapterText, setChapterText] = React.useState<string>('');
  const [isModalOpen, setIsModalOpen] = React.useState<boolean>(false);
  const [hasSearched, setHasSearched] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (item.needsReview && item.sourceChapterId) {
      setIsLoading(true);
      getChapterFromDB(item.sourceChapterId)
        .then((chap) => {
          if (chap && chap.sourceText) {
            setChapterText(chap.sourceText);
            const res = findFuzzyCandidates(chap.sourceText, item.chinese, 3);
            setCandidates(res);
          }
          setHasSearched(true);
        })
        .catch((err) => {
          console.error("Lỗi khi tải chương gốc để tìm kiếm gợi ý:", err);
          setHasSearched(true);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setCandidates([]);
      setHasSearched(false);
    }
  }, [item.needsReview, item.sourceChapterId, item.chinese]);

  const handleApplyCandidate = (candidateText: string) => {
    let newParagraph = '';
    if (chapterText) {
      newParagraph = chapterText.split('\n').find(p =>
        p.includes(candidateText) || p.replace(/\s+/g, '').includes(candidateText.replace(/\s+/g, ''))
      )?.trim() || '';
    }
    handleUpdateReviewItem(item.id, {
      chinese: candidateText,
      needsReview: false,
      sourceParagraph: newParagraph
    });
  };

  return (
    <div className="bg-white border border-amber-205 p-3 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs hover:border-amber-300 transition-colors">
      <div className="flex-1 space-y-2">
        {item.needsReview ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] text-rose-900 bg-rose-100/60 border border-rose-200 px-2.5 py-1 rounded-md font-medium" title="Không xác định được vị trí chính xác trong văn bản gốc — có thể AI nhận diện sai, vui lòng kiểm tra tay.">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span><strong>AI Cảnh báo:</strong> Không xác định được vị trí chính xác trong văn bản gốc — có thể AI nhận diện sai, vui lòng kiểm tra tay.</span>
            </div>

            {/* Fuzzy match suggestions */}
            {isLoading ? (
              <div className="text-[10px] text-slate-400 italic flex items-center gap-1.5 pl-1.5 animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full border border-slate-350 border-t-transparent animate-spin inline-block" />
                Đang tìm kiếm gợi ý từ chương gốc...
              </div>
            ) : hasSearched ? (
              candidates.length > 0 ? (
                <div className="text-[10.5px] bg-slate-50 border border-slate-200 rounded-lg p-2 space-y-1.5 pl-2.5 animate-fadeIn">
                  <div className="font-bold text-slate-600 text-[9.5px] uppercase tracking-wider">Cụm từ tương tự tìm thấy trong chương gốc:</div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {candidates.map((cand, idx) => (
                      <div key={idx} className="inline-flex items-center gap-1.5 bg-white border border-slate-250 rounded px-2 py-0.5 text-slate-800 shadow-3xs">
                        <span className="font-mono font-bold text-indigo-950">[{cand.text}]</span>
                        <span className="text-[9.5px] text-emerald-600 font-bold">({cand.similarity}%)</span>
                        <button
                          type="button"
                          onClick={() => handleApplyCandidate(cand.text)}
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                        >
                          Dùng cụm này
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-[10px] text-slate-500 bg-slate-50 border border-slate-150 rounded-lg p-2 flex items-center justify-between pl-2.5 animate-fadeIn">
                  <span>Không tìm được gợi ý tự động</span>
                  {chapterText && (
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(true)}
                      className="text-indigo-600 hover:text-indigo-800 text-[10px] font-bold underline cursor-pointer"
                    >
                      Xem toàn văn chương gốc
                    </button>
                  )}
                </div>
              )
            ) : null}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[10px] text-amber-900 bg-amber-100/60 px-2.5 py-1 rounded-md font-medium">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span><strong>Lọc trùng:</strong> {item.reason}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div>
            <span className="block text-[9px] uppercase font-bold text-slate-400 mb-0.5">Tiếng Trung *</span>
            <input type="text" value={item.chinese} onChange={(e) => handleUpdateReviewItem(item.id, { chinese: e.target.value })}
                   className="w-full text-xs font-bold font-mono bg-amber-50/10 border border-slate-205 focus:border-amber-450 rounded px-2 py-1 text-slate-800 outline-none" />
          </div>
          <div>
            <span className="block text-[9px] uppercase font-bold text-slate-400 mb-0.5">Phiên âm</span>
            <input type="text" value={item.pinyin} onChange={(e) => handleUpdateReviewItem(item.id, { pinyin: e.target.value })}
                   className="w-full text-xs bg-amber-50/10 border border-slate-205 focus:border-amber-450 rounded px-2 py-1 text-slate-800 outline-none" />
          </div>
          <div>
            <span className="block text-[9px] uppercase font-bold text-slate-400 mb-0.5">Dịch Việt *</span>
            <input type="text" value={item.vietnamese} onChange={(e) => handleUpdateReviewItem(item.id, { vietnamese: e.target.value })}
                   className="w-full text-xs font-bold bg-amber-50/10 border border-slate-205 focus:border-amber-450 rounded px-2 py-1 text-indigo-950 outline-none" />
          </div>
          <div>
            <span className="block text-[9px] uppercase font-bold text-slate-400 mb-0.5">Phân loại</span>
            <select value={item.type} onChange={(e) => handleUpdateReviewItem(item.id, { type: e.target.value as GlossaryType })}
                    className="w-full text-xs bg-amber-50/10 border border-slate-205 focus:border-amber-450 rounded px-1 py-1 text-slate-700 outline-none cursor-pointer">
              <option value="character">Nhân vật</option>
              <option value="location">Địa danh</option>
              <option value="term">Bí kíp/Vật phẩm</option>
              <option value="phrase">Thành ngữ</option>
              <option value="other">Thuật ngữ khác</option>
            </select>
          </div>
        </div>
        <div>
          <span className="block text-[9px] uppercase font-bold text-slate-400 mb-0.5">Chỉ dẫn ngữ cảnh / Vai trò</span>
          <input type="text" placeholder="Ghi chú thêm thông tin..." value={item.note}
                 onChange={(e) => handleUpdateReviewItem(item.id, { note: e.target.value })}
                 className="w-full text-xs bg-amber-50/10 border border-slate-205 focus:border-amber-450 rounded px-2 py-1 text-slate-700 outline-none" />
        </div>
      </div>
      <div className="flex md:flex-col gap-1.5 shrink-0 justify-end md:justify-center">
        <button onClick={() => handleAcceptReviewItem(item.id)}
                className="flex-1 md:w-32 bg-emerald-600 hover:bg-emerald-700 text-white rounded px-2.5 py-1.5 text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-3xs">
          <CheckCircle className="w-3.5 h-3.5" /> Xác nhận từ
        </button>
        <button onClick={() => handleDiscardReviewItem(item.id)}
                className="flex-1 md:w-32 bg-slate-100 text-slate-650 hover:bg-rose-50 hover:text-rose-700 rounded px-2.5 py-1.5 text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer">
          <X className="w-3.5 h-3.5" /> Loại bỏ
        </button>
      </div>

      {/* Full raw text modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-scale-up max-h-[90vh] flex flex-col">
            <div className="border-b border-slate-800 p-4 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400">
                Toàn văn chương gốc tiếng Trung
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 text-slate-350 text-xs leading-relaxed whitespace-pre-wrap select-text selection:bg-indigo-500/30">
              {chapterText}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export const ReviewQueuePanel = React.memo(function ReviewQueuePanel({
  reviewQueue,
  setReviewQueue,
  handleAcceptReviewItem,
  handleDiscardReviewItem,
  handleUpdateReviewItem,
}: ReviewQueuePanelProps) {
  const { showConfirm } = useNotifications();
  if (reviewQueue.length === 0) return null;

  return (
    <div id="review-queue-section" className="bg-amber-50/50 border-2 border-amber-300 rounded-xl p-4 md:p-5 space-y-4 shadow-sm animate-fadeIn">
      <div className="flex items-center justify-between border-b border-amber-200 pb-2.5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600 animate-pulse" />
          <div>
            <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
              Mục Rà Soát Từ Trùng Lặp / Lặp Nghĩa ({reviewQueue.length} từ cần xử lý)
            </h4>
            <p className="text-[11px] text-amber-700">
              Những từ khóa này đã bị chặn khỏi việc nạp rộng rãi do trùng nghĩa hoặc trùng lặp giữa các dòng. Hãy tùy chỉnh rồi ấn Xác nhận!
            </p>
          </div>
        </div>
        <button
          onClick={async () => {
            const confirmed = await showConfirm({
              title: 'Loại bỏ danh sách rà soát',
              message: "Bạn có tin chắc muốn loại bỏ hoàn toàn danh sách rà soát trùng lặp này?",
              confirmText: 'Đồng ý bỏ qua',
              cancelText: 'Hủy',
              type: 'warning'
            });
            if (confirmed) {
              setReviewQueue([]);
            }
          }}
          className="bg-rose-100 hover:bg-rose-250 text-rose-800 text-[10px] font-extrabold px-2.5 py-1 rounded transition-colors cursor-pointer uppercase tracking-wider"
        >
          Bỏ qua tất cả
        </button>
      </div>

      <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
        {reviewQueue.map((item) => (
          <ReviewQueueItem
            key={item.id}
            item={item}
            handleAcceptReviewItem={handleAcceptReviewItem}
            handleDiscardReviewItem={handleDiscardReviewItem}
            handleUpdateReviewItem={handleUpdateReviewItem}
          />
        ))}
      </div>
    </div>
  );
});
