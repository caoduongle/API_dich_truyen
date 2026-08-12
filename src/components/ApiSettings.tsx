import React, { useState } from 'react';
import { X, Plus, Trash2, Key, Cpu, ClipboardPaste, Eye, EyeOff } from 'lucide-react';
import { AVAILABLE_MODELS } from '../constants/models';


interface ApiSettingsProps {
  apiKeys: string[];
  selectedModel: string;
  onClose: () => void;
  onSaveModel: (model: string) => void;
  onAddApiKey: () => void;
  onUpdateKeyIndex: (index: number, val: string) => void;
  onDeleteKeyIndex: (index: number) => void;
  onImportClipboardKeys: () => void;
  warningParagraphMismatch: boolean;
  setWarningParagraphMismatch: (b: boolean) => void;
  enableAiQaCritique: boolean;
  setEnableAiQaCritique: (b: boolean) => void;
  enableSegmentTranslation: boolean;
  setEnableSegmentTranslation: (b: boolean) => void;
}

export default function ApiSettings({
  apiKeys,
  selectedModel,
  onClose,
  onSaveModel,
  onAddApiKey,
  onUpdateKeyIndex,
  onDeleteKeyIndex,
  onImportClipboardKeys,
  warningParagraphMismatch,
  setWarningParagraphMismatch,
  enableAiQaCritique,
  setEnableAiQaCritique,
  enableSegmentTranslation,
  setEnableSegmentTranslation,
}: ApiSettingsProps) {
  const [revealedKeys, setRevealedKeys] = useState<Set<number>>(new Set());

  const toggleReveal = (index: number) => {
    setRevealedKeys(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const validKeyCount = apiKeys.filter(k => k.trim().length > 0).length;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div className="relative w-full max-w-lg mx-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-indigo-950/25 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-850 shrink-0 bg-slate-950/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-650 rounded-lg flex items-center justify-center shadow-sm">
              <Cpu className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-200">Cấu hình AI</h2>
              <p className="text-[11px] text-slate-450">
                {validKeyCount > 0 ? (
                  <span className="text-slate-400 font-semibold flex items-center gap-1">
                    <Key className="w-3 h-3 text-indigo-400" /> Đã cấu hình {validKeyCount} key
                  </span>
                ) : (
                  'Chưa có API key nào được cấu hình'
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* Model selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-indigo-405" />
              Mô hình AI
            </label>
            <select
              value={selectedModel}
              onChange={e => onSaveModel(e.target.value)}
              className="w-full text-sm border border-slate-750/80 bg-slate-950 rounded-lg px-3 py-2 text-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-650 cursor-pointer"
            >
              {AVAILABLE_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-slate-450">
              Áp dụng ngay lập tức cho tất cả tính năng dịch thuật.
            </p>
          </div>

          {/* Cài đặt chất lượng & Kiểm duyệt */}
          <div className="space-y-3 pt-3 border-t border-slate-800/60">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-indigo-405" />
              Chất lượng & Kiểm duyệt dịch thuật
            </label>

            {/* Mismatch Warning */}
            <div className="flex items-center justify-between py-1">
              <div className="flex flex-col pr-2">
                <span className="text-xs font-bold text-slate-200">Cảnh báo lệch đoạn (Phương án 1)</span>
                <span className="text-[10px] text-slate-400 leading-relaxed">Hiện thông báo nếu số đoạn bản dịch khác bản gốc.</span>
              </div>
              <button
                type="button"
                onClick={() => setWarningParagraphMismatch(!warningParagraphMismatch)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${warningParagraphMismatch ? 'bg-indigo-600' : 'bg-slate-800'}`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${warningParagraphMismatch ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* AI Critique QA */}
            <div className="flex items-center justify-between py-1 border-t border-slate-800/40 pt-2">
              <div className="flex flex-col pr-2">
                <span className="text-xs font-bold text-slate-200">AI tự động kiểm duyệt QA (Phương án 2)</span>
                <span className="text-[10px] text-slate-400 leading-relaxed">Dùng AI rà soát lỗi bỏ sót/thêm thắt/lặp lại sau khi dịch.</span>
              </div>
              <button
                type="button"
                onClick={() => setEnableAiQaCritique(!enableAiQaCritique)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${enableAiQaCritique ? 'bg-indigo-600' : 'bg-slate-800'}`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${enableAiQaCritique ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Segment Translation */}
            <div className="flex items-center justify-between py-1 border-t border-slate-800/40 pt-2">
              <div className="flex flex-col pr-2">
                <span className="text-xs font-bold text-slate-200">Dịch phân đoạn nhỏ (Phương án 3)</span>
                <span className="text-[10px] text-slate-400 leading-relaxed">Dịch riêng lẻ từng câu/đoạn để bảo đảm cấu trúc 1-1.</span>
              </div>
              <button
                type="button"
                onClick={() => setEnableSegmentTranslation(!enableSegmentTranslation)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${enableSegmentTranslation ? 'bg-indigo-600' : 'bg-slate-800'}`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${enableSegmentTranslation ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          {/* API Keys */}
          <div className="space-y-2 border-t border-slate-800/60 pt-3">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-indigo-405" />
              Gemini API Keys ({validKeyCount} / {apiKeys.length})
            </label>

            {apiKeys.length === 0 ? (
              <div className="bg-amber-950/15 border border-amber-800/40 rounded-xl p-4 text-center space-y-1">
                <Key className="w-6 h-6 text-amber-450 mx-auto animate-pulse" />
                <p className="text-xs font-semibold text-amber-350">Chưa có key nào</p>
                <p className="text-[11px] text-amber-400/80">Thêm ít nhất một Gemini API Key để bắt đầu dịch.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {apiKeys.map((key, idx) => {
                  const isRevealed = revealedKeys.has(idx);
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="flex-1 flex items-center gap-1 border border-slate-800 rounded-lg px-2.5 py-1.5 bg-slate-950">
                        <span className="text-[10px] font-bold text-slate-400 shrink-0 w-5 text-center">
                          {idx + 1}
                        </span>
                        <input
                          type={isRevealed ? 'text' : 'password'}
                          value={key}
                          onChange={e => onUpdateKeyIndex(idx, e.target.value)}
                          placeholder="Nhập Gemini API Key..."
                          className="flex-1 text-xs bg-transparent outline-none text-slate-100 font-mono min-w-0"
                        />
                      </div>
                      <button
                        onClick={() => toggleReveal(idx)}
                        className="text-slate-450 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                        title={isRevealed ? 'Ẩn key' : 'Hiện key'}
                      >
                        {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => onDeleteKeyIndex(idx)}
                        className="text-slate-455 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-955/40 transition-colors cursor-pointer shrink-0"
                        title="Xóa key này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={onAddApiKey}
                className="flex-1 flex items-center justify-center gap-1.5 border border-dashed border-slate-800 hover:border-indigo-500 hover:bg-indigo-950/20 text-slate-400 hover:text-indigo-300 text-xs font-semibold py-2 rounded-lg transition-all cursor-pointer bg-slate-950/40"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm key mới
              </button>
              <button
                onClick={onImportClipboardKeys}
                className="flex-1 flex items-center justify-center gap-1.5 border border-dashed border-slate-800 hover:border-indigo-500 hover:bg-indigo-950/20 text-slate-400 hover:text-indigo-300 text-xs font-semibold py-2 rounded-lg transition-all cursor-pointer bg-slate-950/40"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                Dán từ clipboard
              </button>
            </div>

            <p className="text-[11px] text-slate-450 leading-relaxed">
              Hỗ trợ nhiều keys để hệ thống tự xoay vòng, tránh giới hạn tốc độ khi dịch hàng loạt. Mỗi dòng / dấu phẩy là một key.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-850 shrink-0 flex justify-end bg-slate-950/20">
          <button
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold px-5 py-2 rounded-lg transition-colors cursor-pointer shadow-sm"
          >
            Lưu & Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
