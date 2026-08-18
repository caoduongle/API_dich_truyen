import React from 'react';
import { AlertTriangle, AlertCircle, CheckCircle, X } from 'lucide-react';
import { GlossaryItem, GlossaryType } from '../../types';
import { useNotifications } from '../NotificationSystem';
import { getChapterFromDB } from '../../services/db';
import { findFuzzyCandidates, FuzzyCandidate } from '@shared/sinoNormalize';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

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
  fuzzyCacheRef,
}: {
  item: GlossaryItem & { reason: string };
  handleAcceptReviewItem: (id: string) => void;
  handleDiscardReviewItem: (id: string) => void;
  handleUpdateReviewItem: (id: string, updatedFields: Partial<GlossaryItem>) => void;
  fuzzyCacheRef: React.RefObject<Map<string, FuzzyCandidate[]>>;
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
            const cacheKey = `${item.sourceChapterId}_${item.chinese}`;
            if (fuzzyCacheRef?.current && fuzzyCacheRef.current.has(cacheKey)) {
              setCandidates(fuzzyCacheRef.current.get(cacheKey) || []);
              setIsLoading(false);
              setHasSearched(true);
              return;
            }

            const runFuzzyMatch = () => {
              const res = findFuzzyCandidates(chap.sourceText, item.chinese, 3);
              if (fuzzyCacheRef?.current) {
                fuzzyCacheRef.current.set(cacheKey, res);
              }
              setCandidates(res);
              setIsLoading(false);
              setHasSearched(true);
            };

            if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
              (window as any).requestIdleCallback(() => {
                runFuzzyMatch();
              });
            } else {
              setTimeout(() => {
                runFuzzyMatch();
              }, 0);
            }
          } else {
            setHasSearched(true);
            setIsLoading(false);
          }
        })
        .catch((err) => {
          console.error("Lỗi khi tải chương gốc để tìm kiếm gợi ý:", err);
          setHasSearched(true);
          setIsLoading(false);
        });
    } else {
      setCandidates([]);
      setHasSearched(false);
    }
  }, [item.needsReview, item.sourceChapterId, item.chinese, fuzzyCacheRef]);

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
    <div className="bg-ink border border-amber-800/40 p-3 rounded-md flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs hover:border-amber-700/80 transition-colors">
      <div className="flex-1 space-y-2">
        {item.needsReview ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] text-polish bg-polish/10 border border-polish/40 px-2.5 py-1 rounded-[2px] font-medium" title="Không xác định được vị trí chính xác trong văn bản gốc — có thể AI nhận diện sai, vui lòng kiểm tra tay.">
              <AlertTriangle className="w-3.5 h-3.5 text-polish shrink-0" />
              <span><strong>AI Cảnh báo:</strong> Không xác định được vị trí chính xác trong văn bản gốc — có thể AI nhận diện sai, vui lòng kiểm tra tay.</span>
            </div>

            {/* Fuzzy match suggestions */}
            {isLoading ? (
              <div className="text-[10px] text-text-muted italic flex items-center gap-1.5 pl-1.5 animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full border border-text-muted border-t-transparent animate-spin inline-block" />
                Đang tìm kiếm gợi ý từ chương gốc...
              </div>
            ) : hasSearched ? (
              candidates.length > 0 ? (
                <div className="text-[10.5px] bg-parchment border border-parchment-2 rounded-[2px] p-2 space-y-1.5 pl-2.5 animate-in fade-in">
                  <div className="font-bold text-text-muted text-[9.5px] uppercase tracking-wider">Cụm từ tương tự tìm thấy trong chương gốc:</div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {candidates.map((cand, idx) => (
                      <div key={idx} className="inline-flex items-center gap-1.5 bg-ink border border-parchment-2 rounded-[2px] px-2 py-0.5 text-text-main shadow-xs">
                        <span className="font-serif font-bold text-polish">[{cand.text}]</span>
                        <span className="text-[9.5px] text-emerald-400 font-bold">({cand.similarity}%)</span>
                        <button
                          type="button"
                          onClick={() => handleApplyCandidate(cand.text)}
                          className="bg-polish/20 hover:bg-polish/30 text-polish text-[9px] font-bold px-1.5 py-0.5 rounded-[2px] cursor-pointer transition-colors border border-polish/40"
                        >
                          Dùng cụm này
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-[10px] text-text-muted bg-parchment border border-parchment-2 rounded-[2px] p-2 flex items-center justify-between pl-2.5 animate-in fade-in">
                  <span>Không tìm được gợi ý tự động</span>
                  {chapterText && (
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(true)}
                      className="text-polish hover:underline text-[10px] font-bold cursor-pointer"
                    >
                      Xem toàn văn chương gốc
                    </button>
                  )}
                </div>
              )
            ) : null}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[10px] text-amber-300 bg-amber-950/20 border border-amber-800/40 px-2.5 py-1 rounded-[2px] font-medium">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span><strong>Lọc trùng:</strong> {item.reason}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div>
            <span className="block text-[9px] uppercase font-bold text-text-muted mb-0.5">Tiếng Trung *</span>
            <input type="text" value={item.chinese} onChange={(e) => handleUpdateReviewItem(item.id, { chinese: e.target.value })}
                   className="w-full text-xs font-bold font-serif bg-parchment border border-parchment-2 focus:border-amber-500 rounded-[2px] px-2 py-1 text-text-main outline-none" />
          </div>
          <div>
            <span className="block text-[9px] uppercase font-bold text-text-muted mb-0.5">Phiên âm</span>
            <input type="text" value={item.pinyin} onChange={(e) => handleUpdateReviewItem(item.id, { pinyin: e.target.value })}
                   className="w-full text-xs bg-parchment border border-parchment-2 focus:border-amber-500 rounded-[2px] px-2 py-1 text-text-main outline-none" />
          </div>
          <div>
            <span className="block text-[9px] uppercase font-bold text-text-muted mb-0.5">Dịch Việt *</span>
            <input type="text" value={item.vietnamese} onChange={(e) => handleUpdateReviewItem(item.id, { vietnamese: e.target.value })}
                   className="w-full text-xs font-bold bg-parchment border border-parchment-2 focus:border-amber-500 rounded-[2px] px-2 py-1 text-text-main outline-none" />
          </div>
          <div>
            <span className="block text-[9px] uppercase font-bold text-text-muted mb-0.5">Phân loại</span>
            <select value={item.type} onChange={(e) => handleUpdateReviewItem(item.id, { type: e.target.value as GlossaryType })}
                    className="w-full text-xs bg-parchment border border-parchment-2 focus:border-amber-500 rounded-[2px] px-1 py-1 text-text-main outline-none cursor-pointer">
              <option value="character" className="bg-parchment text-text-main">Nhân vật</option>
              <option value="location" className="bg-parchment text-text-main">Địa danh</option>
              <option value="term" className="bg-parchment text-text-main">Bí kíp/Vật phẩm</option>
              <option value="phrase" className="bg-parchment text-text-main">Thành ngữ</option>
              <option value="other" className="bg-parchment text-text-main">Thuật ngữ khác</option>
            </select>
          </div>
        </div>
        <div>
          <span className="block text-[9px] uppercase font-bold text-text-muted mb-0.5">Chỉ dẫn ngữ cảnh / Vai trò</span>
          <input type="text" placeholder="Ghi chú thêm thông tin..." value={item.note}
                 onChange={(e) => handleUpdateReviewItem(item.id, { note: e.target.value })}
                 className="w-full text-xs bg-parchment border border-parchment-2 focus:border-amber-500 rounded-[2px] px-2 py-1 text-text-main outline-none" />
        </div>
      </div>
      <div className="flex md:flex-col gap-1.5 shrink-0 justify-end md:justify-center">
        <Button
          variant="primary"
          size="sm"
          onClick={() => handleAcceptReviewItem(item.id)}
          icon={<CheckCircle className="w-3.5 h-3.5" />}
          className="flex-1 md:w-32"
        >
          Xác nhận từ
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleDiscardReviewItem(item.id)}
          icon={<X className="w-3.5 h-3.5" />}
          className="flex-1 md:w-32 hover:bg-polish/15 hover:text-polish"
        >
          Loại bỏ
        </Button>
      </div>

      {/* Full raw text modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        size="2xl"
        title="Toàn văn chương gốc tiếng Trung"
        bodyClassName="p-6 text-text-main text-xs font-serif leading-relaxed whitespace-pre-wrap select-text"
      >
        {chapterText}
      </Modal>
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
  const fuzzyCacheRef = React.useRef<Map<string, FuzzyCandidate[]>>(new Map());
  const { showConfirm } = useNotifications();
  if (reviewQueue.length === 0) return null;

  return (
    <div id="review-queue-section" className="bg-parchment border border-amber-800/40 rounded-md p-4 md:p-5 space-y-4 shadow-xs animate-in fade-in">
      <div className="flex items-center justify-between border-b border-parchment-2 pb-2.5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500 animate-pulse" />
          <div>
            <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
              Mục Rà Soát Từ Trùng Lặp / Lặp Nghĩa ({reviewQueue.length} từ cần xử lý)
            </h4>
            <p className="text-[11px] text-text-muted">
              Những từ khóa này đã bị chặn khỏi việc nạp rộng rãi do trùng nghĩa hoặc trùng lặp giữa các dòng. Hãy tùy chỉnh rồi ấn Xác nhận!
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
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
          className="text-text-muted hover:text-polish uppercase tracking-wider text-[10px]"
        >
          Bỏ qua tất cả
        </Button>
      </div>

      <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
        {reviewQueue.map((item) => (
          <ReviewQueueItem
            key={item.id}
            item={item}
            handleAcceptReviewItem={handleAcceptReviewItem}
            handleDiscardReviewItem={handleDiscardReviewItem}
            handleUpdateReviewItem={handleUpdateReviewItem}
            fuzzyCacheRef={fuzzyCacheRef}
          />
        ))}
      </div>
    </div>
  );
});

export default ReviewQueuePanel;
