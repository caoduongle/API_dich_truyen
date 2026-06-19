import React from 'react';
import { AlertTriangle, AlertCircle, CheckCircle, X } from 'lucide-react';
import { GlossaryItem, GlossaryType } from '../../types';
import { useNotifications } from '../NotificationSystem';

export interface ReviewQueuePanelProps {
  reviewQueue: Array<GlossaryItem & { reason: string }>;
  setReviewQueue: React.Dispatch<React.SetStateAction<Array<GlossaryItem & { reason: string }>>>;
  handleAcceptReviewItem: (id: string) => void;
  handleDiscardReviewItem: (id: string) => void;
  handleUpdateReviewItem: (id: string, updatedFields: Partial<GlossaryItem>) => void;
}

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
          <div key={item.id}
               className="bg-white border border-amber-205 p-3 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs hover:border-amber-300 transition-colors">
            <div className="flex-1 space-y-2">
              {item.needsReview ? (
                <div className="flex items-center gap-1.5 text-[10px] text-rose-900 bg-rose-100/60 border border-rose-200 px-2.5 py-1 rounded-md font-medium" title="Không xác định được vị trí chính xác trong văn bản gốc — có thể AI nhận diện sai, vui lòng kiểm tra tay.">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span><strong>AI Cảnh báo:</strong> Không xác định được vị trí chính xác trong văn bản gốc — có thể AI nhận diện sai, vui lòng kiểm tra tay.</span>
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
          </div>
        ))}
      </div>
    </div>
  );
});
