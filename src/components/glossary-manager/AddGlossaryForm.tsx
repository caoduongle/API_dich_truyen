import React, { useState } from 'react';
import { GlossaryType } from '../../types';

interface AddGlossaryFormProps {
  onSave: (item: { chinese: string; pinyin: string; vietnamese: string; type: GlossaryType; note: string }) => void;
  onCancel: () => void;
}

export const AddGlossaryForm = React.memo(function AddGlossaryForm({ onSave, onCancel }: AddGlossaryFormProps) {
  const [chinese,    setChinese]    = useState('');
  const [pinyin,     setPinyin]     = useState('');
  const [vietnamese, setVietnamese] = useState('');
  const [type,       setType]       = useState<GlossaryType>('character');
  const [note,       setNote]       = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chinese.trim() || !vietnamese.trim()) {
      alert("Vui lòng nhập từ gốc tiếng Trung và bản dịch tiếng Việt.");
      return;
    }
    onSave({ chinese, pinyin, vietnamese, type, note });
  };

  return (
    <form id="form-add-glossary" onSubmit={handleSubmit} className="bg-slate-100/60 p-4 border border-slate-200 rounded-xl space-y-3">
      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Thêm từ khóa mới bằng tay</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Gốc tiếng Trung *</label>
          <input id="input-chinese-new" type="text" placeholder="Ví dụ: 萧炎" value={chinese}
                 onChange={(e) => setChinese(e.target.value)}
                 className="w-full text-xs bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-600" required />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Phiên âm Hán Việt</label>
          <input id="input-pinyin-new" type="text" placeholder="Ví dụ: Tiêu Viêm" value={pinyin}
                 onChange={(e) => setPinyin(e.target.value)}
                 className="w-full text-xs bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-600" />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Bản dịch tiếng Việt *</label>
          <input id="input-vietnamese-new" type="text" placeholder="Ví dụ: Tiêu Viêm" value={vietnamese}
                 onChange={(e) => setVietnamese(e.target.value)}
                 className="w-full text-xs bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-600" required />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Phân loại</label>
          <select id="select-type-new" value={type} onChange={(e) => setType(e.target.value as GlossaryType)}
                  className="w-full text-xs bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-600">
            <option value="character">Nhân vật</option>
            <option value="location">Địa danh</option>
            <option value="term">Bí kíp / Vật phẩm</option>
            <option value="phrase">Thành ngữ / Cụm từ</option>
            <option value="other">Thuật ngữ khác</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Ghi chú ngữ cảnh (Hướng dẫn AI xưng hô, đại từ đúng đắn)</label>
        <input id="input-note-new" type="text"
               placeholder="Ví dụ: Nam chính, sư phụ, nhân vật nữ kêu bằng nàng, có xưng hô bá đạo..."
               value={note} onChange={(e) => setNote(e.target.value)}
               className="w-full text-xs bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-600" />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button id="btn-cancel-add" type="button" onClick={onCancel}
                className="px-2.5 py-1 text-xs font-bold text-slate-650 hover:bg-slate-200 rounded transition-colors cursor-pointer">
          Hủy
        </button>
        <button id="btn-save-add" type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1 text-xs font-bold rounded transition-colors cursor-pointer animate-fadeIn">
          Lưu từ điển
        </button>
      </div>
    </form>
  );
});
