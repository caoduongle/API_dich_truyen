import React, { useState } from 'react';
import { BookOpen, X, Edit2, Save, Hash } from 'lucide-react';
import { GlossaryItem, GlossaryType } from '../../types';

interface DetailEditPanelProps {
  item: GlossaryItem;
  onSave: (updated: GlossaryItem) => void;
}

const DetailEditPanel = React.memo(function DetailEditPanel({ item, onSave }: DetailEditPanelProps) {
  const [chinese, setChinese]       = useState(item.chinese);
  const [pinyin, setPinyin]         = useState(item.pinyin);
  const [vietnamese, setVietnamese] = useState(item.vietnamese);
  const [type, setType]             = useState<GlossaryType>(item.type);
  const [note, setNote]             = useState(item.note);

  const handleSave = () => {
    if (!chinese.trim() || !vietnamese.trim()) {
      alert("Vui lòng nhập đầy đủ tiếng Trung gốc và dịch tiếng Việt.");
      return;
    }
    onSave({
      ...item,
      chinese:     chinese.trim(),
      pinyin:      pinyin.trim() || vietnamese.trim(),
      vietnamese:  vietnamese.trim(),
      type,
      note:        note.trim(),
    });
  };

  return (
    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-3">
      <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
        <Edit2 className="w-3.5 h-3.5 text-indigo-650" /> Chỉnh sửa nhanh thuật ngữ
      </h4>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[9px] uppercase font-bold text-slate-400">Chữ gốc Trung</label>
          <input type="text" value={chinese} onChange={(e) => setChinese(e.target.value)}
                 className="w-full text-xs font-bold font-mono bg-white border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-600" />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] uppercase font-bold text-slate-400 font-sans">Phiên âm</label>
          <input type="text" value={pinyin} onChange={(e) => setPinyin(e.target.value)}
                 className="w-full text-xs bg-white border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-600" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[9px] uppercase font-bold text-slate-400">Bản dịch Việt</label>
          <input type="text" value={vietnamese} onChange={(e) => setVietnamese(e.target.value)}
                 className="w-full text-xs font-bold bg-white border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-600" />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] uppercase font-bold text-slate-400">Phân loại</label>
          <select value={type} onChange={(e) => setType(e.target.value as GlossaryType)}
                  className="w-full text-xs bg-white border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:border-indigo-600 cursor-pointer text-slate-800">
            <option value="character">Nhân vật</option>
            <option value="location">Địa danh</option>
            <option value="term">Bí kíp/Vật phẩm</option>
            <option value="phrase">Thành ngữ</option>
            <option value="other">Thuật ngữ khác</option>
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[9px] uppercase font-bold text-slate-400 font-sans">Chỉ dẫn ngữ cảnh AI / Ghi chú xưng hô</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                  className="w-full text-xs bg-white border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-600 resize-none"
                  placeholder="Xưng hô bá đạo, nàng, phu nhân..." />
      </div>

      <button type="button" onClick={handleSave}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 rounded text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5">
        <Save className="w-3.5 h-3.5" />
        Cập nhật thay đổi từ khóa
      </button>
    </div>
  );
});

export interface GlossaryDetailSidebarProps {
  selectedItem: GlossaryItem | null;
  setSelectedItem: (item: GlossaryItem | null) => void;
  handleDetailSave: (updated: GlossaryItem) => void;
  searchContextMatches: any[];
  contextFilterType: 'all' | 'source' | 'translation';
  setContextFilterType: (t: 'all' | 'source' | 'translation') => void;
  filteredMatches: any[];
  highlightWordInText: (text: string, word: string) => React.ReactNode;
}

export const GlossaryDetailSidebar = React.memo(function GlossaryDetailSidebar({
  selectedItem,
  setSelectedItem,
  handleDetailSave,
  searchContextMatches,
  contextFilterType,
  setContextFilterType,
  filteredMatches,
  highlightWordInText,
}: GlossaryDetailSidebarProps) {
  if (!selectedItem) return null;

  return (
    <div className="lg:col-span-5 bg-white border border-slate-250 rounded-xl p-5 shadow-sm space-y-5 animate-in slide-in-from-right duration-300 lg:sticky lg:top-32 max-h-[calc(100vh-10rem)] overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="space-y-0.5">
          <span className="text-[10px] bg-indigo-100 text-indigo-850 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
            Bảng chi tiết &amp; Tra cứu ngữ cảnh
          </span>
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5 truncate max-w-[250px]" title={`${selectedItem.chinese} → ${selectedItem.vietnamese}`}>
            <BookOpen className="w-4 h-4 text-indigo-600" />
            {selectedItem.chinese} → {selectedItem.vietnamese}
          </h3>
        </div>
        <button
          onClick={() => setSelectedItem(null)}
          className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 cursor-pointer" title="Đóng bảng chi tiết">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Khối hiển thị chi tiết mốc thời gian ghi nhận từ vựng */}
      <div className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-1">
        <div className="flex justify-between">
          <span className="text-slate-400">Nguồn gốc nạp:</span>
          <span className="font-bold text-slate-700">
            {selectedItem.origin === 'guideline' ? 'Tệp cẩm nang (.md)' : selectedItem.origin === 'scanned' ? 'AI trích xuất tự động' : 'Nhập tay thủ công'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Thời điểm khởi tạo:</span>
          <span className="font-bold text-indigo-900">
            {selectedItem.createdAt ? new Date(selectedItem.createdAt).toLocaleString('vi-VN') : 'Trước phiên bản v2.4'}
          </span>
        </div>
      </div>

      {selectedItem.sourceChapter && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-900 space-y-1 animate-fadeIn">
          <div className="flex items-center gap-1.5 font-extrabold text-amber-950 uppercase tracking-wider text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            Nguồn gốc trích lọc tự động từ AI Filter
          </div>
          <p>• <strong>Chương gốc:</strong> {selectedItem.sourceChapter}</p>
          {selectedItem.sourceParagraph && (
            <p className="text-slate-500 italic line-clamp-2" title={selectedItem.sourceParagraph}>
              • <strong>Ngữ cảnh:</strong> "{selectedItem.sourceParagraph}"
            </p>
          )}
        </div>
      )}

      {/* Quick Live Editor Portion inside Sidebar */}
      <DetailEditPanel
        key={selectedItem.id}
        item={selectedItem}
        onSave={handleDetailSave}
      />

      {/* Context Checker / Occurrence Locator */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-slate-150 pt-4">
          <div className="flex items-center gap-1">
            <Hash className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-700">
              Vị trí trong các chương truyện ({searchContextMatches.length} lần xuất hiện)
            </span>
          </div>

          <div className="flex items-center gap-1 text-[10px]">
            <span className="text-slate-400">Xem:</span>
            <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
              <button onClick={() => setContextFilterType('all')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${contextFilterType === 'all' ? 'bg-white text-indigo-950 shadow-3xs' : 'text-slate-400'}`}>
                Mọi tệp
              </button>
              <button onClick={() => setContextFilterType('source')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${contextFilterType === 'source' ? 'bg-white text-indigo-950 shadow-3xs' : 'text-slate-400'}`}
                      title="Chỉ tìm trong chữ Trung nguyên tác gốc">
                Bản Gốc
              </button>
              <button onClick={() => setContextFilterType('translation')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${contextFilterType === 'translation' ? 'bg-white text-indigo-950 shadow-3xs' : 'text-slate-400'}`}
                      title="Chỉ tìm trong văn bản tiếng Việt bồi dưỡng">
                Văn Dịch
              </button>
            </div>
          </div>
        </div>

        {filteredMatches.length === 0 ? (
          <div className="p-4 bg-slate-50 rounded-xl text-center text-slate-400 text-xs italic border border-slate-150">
            Từ khóa '{selectedItem.chinese}' hoặc '{selectedItem.vietnamese}' chưa tìm thấy đoạn văn nào trùng khớp ở tệp sách hiện hữu.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[290px] overflow-y-auto pr-1">
            {filteredMatches.map((match, idx) => {
              const isSource = match.textType === 'source';
              const targetWord = isSource ? selectedItem.chinese : selectedItem.vietnamese;
              return (
                <div key={idx}
                     className="p-2.5 rounded-lg border border-slate-150 hover:border-indigo-300 transition-colors text-xs space-y-1 bg-white">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-extrabold text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded truncate max-w-[190px]" title={match.chapterTitle}>
                      {match.chapterTitle}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
                      <span>Dòng #{match.paragraphIndex}</span>
                      <span className={`px-1 rounded-sm text-[9px] font-bold ${
                        match.textType === 'source' ? 'bg-rose-50 text-rose-700 font-mono' :
                          match.textType === 'polished' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                      }`}>
                        {match.textType === 'source' ? 'Gốc Trung' : match.textType === 'polished' ? 'Chuốt' : 'Dịch Thô'}
                      </span>
                    </div>
                  </div>
                  <p className="text-slate-600 leading-relaxed font-sans text-[11px] break-words italic select-text">
                    "...{highlightWordInText(match.paragraphText, targetWord)}..."
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
