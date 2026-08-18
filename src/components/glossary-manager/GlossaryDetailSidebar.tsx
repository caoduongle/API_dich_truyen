import React, { useState } from 'react';
import { BookOpen, X, Edit2, Save, Hash } from 'lucide-react';
import { GlossaryItem, GlossaryType } from '../../types';
import { useNotifications } from '../NotificationSystem';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface DetailEditPanelProps {
  item: GlossaryItem;
  onSave: (updated: GlossaryItem) => void;
}

const DetailEditPanel = React.memo(function DetailEditPanel({ item, onSave }: DetailEditPanelProps) {
  const { showToast } = useNotifications();
  const [chinese, setChinese]       = useState(item.chinese);
  const [pinyin, setPinyin]         = useState(item.pinyin);
  const [vietnamese, setVietnamese] = useState(item.vietnamese);
  const [type, setType]             = useState<GlossaryType>(item.type);
  const [note, setNote]             = useState(item.note);

  const handleSave = () => {
    if (!chinese.trim() || !vietnamese.trim()) {
      showToast({ message: "Vui lòng nhập đầy đủ tiếng Trung gốc và dịch tiếng Việt.", type: 'warning' });
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
    <div className="bg-ink/50 p-4 rounded-md border border-parchment-2 space-y-3">
      <h4 className="text-[11px] font-bold text-text-main uppercase tracking-wider flex items-center gap-1 font-display">
        <Edit2 className="w-3.5 h-3.5 text-polish" /> Chỉnh sửa nhanh thuật ngữ
      </h4>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[9px] uppercase font-bold text-text-muted">Chữ gốc Trung</label>
          <input type="text" value={chinese} onChange={(e) => setChinese(e.target.value)}
                 className="w-full text-xs font-bold font-serif bg-ink border border-parchment-2 text-text-main rounded-[2px] px-2.5 py-1.5 focus:outline-none focus:border-polish transition-all" />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] uppercase font-bold text-text-muted font-sans">Phiên âm</label>
          <input type="text" value={pinyin} onChange={(e) => setPinyin(e.target.value)}
                 className="w-full text-xs bg-ink border border-parchment-2 text-text-main rounded-[2px] px-2.5 py-1.5 focus:outline-none focus:border-polish transition-all" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[9px] uppercase font-bold text-text-muted">Bản dịch Việt</label>
          <input type="text" value={vietnamese} onChange={(e) => setVietnamese(e.target.value)}
                 className="w-full text-xs font-bold bg-ink border border-parchment-2 text-text-main rounded-[2px] px-2.5 py-1.5 focus:outline-none focus:border-polish transition-all" />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] uppercase font-bold text-text-muted">Phân loại</label>
          <select value={type} onChange={(e) => setType(e.target.value as GlossaryType)}
                  className="w-full text-xs bg-ink border border-parchment-2 text-text-main rounded-[2px] px-2.5 py-1.5 focus:outline-none focus:border-polish cursor-pointer">
            <option value="character" className="bg-parchment text-text-main">Nhân vật</option>
            <option value="location" className="bg-parchment text-text-main">Địa danh</option>
            <option value="term" className="bg-parchment text-text-main">Bí kíp/Vật phẩm</option>
            <option value="phrase" className="bg-parchment text-text-main">Thành ngữ</option>
            <option value="other" className="bg-parchment text-text-main">Thuật ngữ khác</option>
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[9px] uppercase font-bold text-text-muted font-sans">Chỉ dẫn ngữ cảnh AI / Ghi chú xưng hô</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                  className="w-full text-xs bg-ink border border-parchment-2 text-text-main rounded-[2px] px-2.5 py-1.5 focus:outline-none focus:border-polish transition-all resize-none"
                  placeholder="Xưng hô bá đạo, nàng, phu nhân..." />
      </div>

      <Button
        type="button"
        variant="primary"
        size="md"
        onClick={handleSave}
        icon={<Save className="w-3.5 h-3.5" />}
        className="w-full"
      >
        Cập nhật thay đổi từ khóa
      </Button>
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
    <div className="lg:col-span-5 bg-parchment border border-parchment-2 rounded-md p-5 shadow-xs space-y-5 animate-in slide-in-from-right duration-300 lg:sticky lg:top-32 max-h-[calc(100vh-10rem)] overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between border-b border-parchment-2 pb-3">
        <div className="space-y-1 min-w-0 pr-2">
          <Badge tone="polish">
            Bảng chi tiết &amp; Tra cứu ngữ cảnh
          </Badge>
          <h3 className="text-sm font-bold font-serif text-text-main flex items-center gap-1.5 truncate max-w-[250px]" title={`${selectedItem.chinese} → ${selectedItem.vietnamese}`}>
            <BookOpen className="w-4 h-4 text-polish shrink-0" />
            <span className="truncate">{selectedItem.chinese} → {selectedItem.vietnamese}</span>
          </h3>
        </div>
        <button
          onClick={() => setSelectedItem(null)}
          className="p-1 hover:bg-parchment-2 rounded-[2px] text-text-muted hover:text-text-main cursor-pointer transition-colors"
          title="Đóng bảng chi tiết"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Khối hiển thị chi tiết mốc thời gian ghi nhận từ vựng */}
      <div className="text-[11px] text-text-muted bg-ink border border-parchment-2 p-3.5 rounded-[2px] space-y-1.5">
        <div className="flex justify-between">
          <span className="text-text-muted">Nguồn gốc nạp:</span>
          <span className="font-bold text-text-main">
            {selectedItem.origin === 'guideline' ? 'Tệp cẩm nang (.md)' : selectedItem.origin === 'scanned' ? 'AI trích xuất tự động' : 'Nhập tay thủ công'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Thời điểm khởi tạo:</span>
          <span className="font-bold text-polish font-mono">
            {selectedItem.createdAt ? new Date(selectedItem.createdAt).toLocaleString('vi-VN') : 'Trước phiên bản v2.4'}
          </span>
        </div>
      </div>

      {selectedItem.sourceChapter && (
        <div className="bg-ink border border-amber-800/30 rounded-[2px] p-3.5 text-[11px] text-amber-300 space-y-1 animate-in fade-in">
          <div className="flex items-center gap-1.5 font-bold text-amber-400 uppercase tracking-wider text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            Nguồn gốc trích lọc tự động từ AI Filter
          </div>
          <p>• <strong>Chương gốc:</strong> {selectedItem.sourceChapter}</p>
          {selectedItem.sourceParagraph && (
            <p className="text-text-muted italic line-clamp-2" title={selectedItem.sourceParagraph}>
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-parchment-2 pt-4">
          <div className="flex items-center gap-1">
            <Hash className="w-4 h-4 text-polish" />
            <span className="text-xs font-bold text-text-main">
              Vị trí trong các chương truyện ({searchContextMatches.length} lần xuất hiện)
            </span>
          </div>

          <div className="flex items-center gap-1 text-[10px]">
            <span className="text-text-muted">Xem:</span>
            <div className="inline-flex bg-ink rounded-[2px] p-0.5 border border-parchment-2">
              <button onClick={() => setContextFilterType('all')}
                      className={`px-2.5 py-1 rounded-[2px] text-[10px] font-bold cursor-pointer transition-all ${contextFilterType === 'all' ? 'bg-polish text-white shadow-xs' : 'text-text-muted'}`}>
                Mọi tệp
              </button>
              <button onClick={() => setContextFilterType('source')}
                      className={`px-2.5 py-1 rounded-[2px] text-[10px] font-bold cursor-pointer transition-all ${contextFilterType === 'source' ? 'bg-polish text-white shadow-xs' : 'text-text-muted'}`}
                      title="Chỉ tìm trong chữ Trung nguyên tác gốc">
                Bản Gốc
              </button>
              <button onClick={() => setContextFilterType('translation')}
                      className={`px-2.5 py-1 rounded-[2px] text-[10px] font-bold cursor-pointer transition-all ${contextFilterType === 'translation' ? 'bg-polish text-white shadow-xs' : 'text-text-muted'}`}
                      title="Chỉ tìm trong văn bản tiếng Việt bồi dưỡng">
                Văn Dịch
              </button>
            </div>
          </div>
        </div>

        {filteredMatches.length === 0 ? (
          <div className="p-4 bg-ink rounded-[2px] text-center text-text-muted text-xs italic border border-parchment-2">
            Từ khóa '{selectedItem.chinese}' hoặc '{selectedItem.vietnamese}' chưa tìm thấy đoạn văn nào trùng khớp ở tệp sách hiện hữu.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[290px] overflow-y-auto pr-1 custom-scrollbar">
            {filteredMatches.map((match, idx) => {
              const isSource = match.textType === 'source';
              const targetWord = isSource ? selectedItem.chinese : selectedItem.vietnamese;
              return (
                <div key={idx}
                     className="p-3 rounded-[2px] border border-parchment-2 hover:border-text-muted hover:bg-ink transition-all text-xs space-y-1.5 bg-ink/40">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-text-main bg-parchment border border-parchment-2 px-1.5 py-0.5 rounded-[2px] truncate max-w-[190px]" title={match.chapterTitle}>
                      {match.chapterTitle}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0 text-text-muted">
                      <span>Dòng #{match.paragraphIndex}</span>
                      <span className={`px-1.5 py-0.5 rounded-[2px] text-[9px] font-bold border ${
                        match.textType === 'source' ? 'bg-ink text-polish border-parchment-2 font-serif' :
                          match.textType === 'polished' ? 'bg-polish/20 text-polish border-polish/30' : 'bg-draft/20 text-draft border-draft/30'
                      }`}>
                        {match.textType === 'source' ? 'Gốc Trung' : match.textType === 'polished' ? 'Chuốt' : 'Dịch Thô'}
                      </span>
                    </div>
                  </div>
                  <p className="text-text-main leading-relaxed font-sans text-[11px] break-words italic select-text">
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

export default GlossaryDetailSidebar;
