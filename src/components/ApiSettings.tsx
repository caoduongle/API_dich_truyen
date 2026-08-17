import React, { useState } from 'react';
import { 
  Key, Plus, Trash2, X, Eye, EyeOff, ClipboardPaste, Cpu
} from 'lucide-react';
import { AVAILABLE_MODELS } from '../constants/models';

interface ApiSettingsProps {
  apiKeys: string[];
  selectedModel: string;
  onClose: () => void;
  onSaveModel: (model: string) => void;
  onAddApiKey: () => void;
  onUpdateKeyIndex: (index: number, value: string) => void;
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
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const validKeyCount = apiKeys.filter(k => k.trim().length > 0).length;

  return (
    /* Backdrop */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-settings-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-xs"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div className="relative w-full max-w-lg mx-4 bg-parchment border border-parchment-2 rounded-md shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-parchment-2 shrink-0 bg-ink/30">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-polish rounded-[2px] flex items-center justify-center shadow-xs">
              <Cpu className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <h2 id="api-settings-title" className="text-sm font-display font-bold text-text-main">Cấu hình AI &amp; Bản Thảo</h2>
              <p className="text-[11px] text-text-muted">
                {validKeyCount > 0 ? (
                  <span className="text-text-muted font-medium flex items-center gap-1">
                    <Key className="w-3 h-3 text-polish" /> Đã cấu hình {validKeyCount} key
                  </span>
                ) : (
                  'Chưa có API key nào được cấu hình'
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng bảng cấu hình AI"
            className="text-text-muted hover:text-text-main hover:bg-parchment-2 p-1.5 rounded-[2px] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* Model selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-polish" />
              Mô hình AI
            </label>
            <select
              value={selectedModel}
              onChange={e => onSaveModel(e.target.value)}
              className="w-full text-sm border border-parchment-2 bg-ink rounded-[2px] px-3 py-2 text-text-main font-semibold focus:outline-none focus:border-polish cursor-pointer"
            >
              {AVAILABLE_MODELS.map(m => (
                <option key={m.id} value={m.id} className="bg-parchment text-text-main">{m.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-text-muted">
              Áp dụng ngay lập tức cho tất cả tính năng dịch thuật.
            </p>
          </div>

          {/* Cài đặt chất lượng & Kiểm duyệt */}
          <div className="space-y-3 pt-3 border-t border-parchment-2">
            <label className="text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-polish" />
              Chất lượng &amp; Kiểm duyệt dịch thuật
            </label>

            {/* Mismatch Warning */}
            <div className="flex items-center justify-between py-1">
              <div className="flex flex-col pr-2">
                <span className="text-xs font-bold text-text-main">Cảnh báo lệch đoạn (Phương án 1)</span>
                <span className="text-[10px] text-text-muted leading-relaxed">Hiện thông báo nếu số đoạn bản dịch khác bản gốc.</span>
              </div>
              <button
                type="button"
                onClick={() => setWarningParagraphMismatch(!warningParagraphMismatch)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${warningParagraphMismatch ? 'bg-polish' : 'bg-parchment-2'}`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${warningParagraphMismatch ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* AI Critique QA */}
            <div className="flex items-center justify-between py-1 border-t border-parchment-2 pt-2">
              <div className="flex flex-col pr-2">
                <span className="text-xs font-bold text-text-main">AI tự động kiểm duyệt QA (Phương án 2)</span>
                <span className="text-[10px] text-text-muted leading-relaxed">Dùng AI rà soát lỗi bỏ sót/thêm thắt/lặp lại sau khi dịch.</span>
              </div>
              <button
                type="button"
                onClick={() => setEnableAiQaCritique(!enableAiQaCritique)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${enableAiQaCritique ? 'bg-polish' : 'bg-parchment-2'}`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${enableAiQaCritique ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Segment Translation */}
            <div className="flex items-center justify-between py-1 border-t border-parchment-2 pt-2">
              <div className="flex flex-col pr-2">
                <span className="text-xs font-bold text-text-main">Dịch phân đoạn nhỏ (Phương án 3)</span>
                <span className="text-[10px] text-text-muted leading-relaxed">Dịch riêng lẻ từng câu/đoạn để bảo đảm cấu trúc 1-1.</span>
              </div>
              <button
                type="button"
                onClick={() => setEnableSegmentTranslation(!enableSegmentTranslation)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${enableSegmentTranslation ? 'bg-polish' : 'bg-parchment-2'}`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${enableSegmentTranslation ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          {/* API Keys */}
          <div className="space-y-2 border-t border-parchment-2 pt-3">
            <label className="text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-polish" />
              Gemini API Keys ({validKeyCount} / {apiKeys.length})
            </label>

            {apiKeys.length === 0 ? (
              <div className="bg-amber-950/20 border border-amber-800/40 rounded-[2px] p-4 text-center space-y-1">
                <Key className="w-5 h-5 text-amber-400 mx-auto animate-pulse" />
                <p className="text-xs font-semibold text-amber-300">Chưa có key nào</p>
                <p className="text-[11px] text-text-muted">Thêm ít nhất một Gemini API Key để bắt đầu dịch.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {apiKeys.map((key, idx) => {
                  const isRevealed = revealedKeys.has(idx);
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="flex-1 flex items-center gap-1 border border-parchment-2 rounded-[2px] px-2.5 py-1.5 bg-ink">
                        <span className="text-[10px] font-bold text-text-muted shrink-0 w-5 text-center">
                          {idx + 1}
                        </span>
                        <input
                          type={isRevealed ? 'text' : 'password'}
                          value={key}
                          onChange={e => onUpdateKeyIndex(idx, e.target.value)}
                          placeholder="Nhập Gemini API Key..."
                          className="flex-1 text-xs bg-transparent outline-none text-text-main font-mono min-w-0"
                        />
                      </div>
                      <button
                        onClick={() => toggleReveal(idx)}
                        className="text-text-muted hover:text-text-main p-1.5 rounded-[2px] hover:bg-parchment-2 transition-colors cursor-pointer shrink-0"
                        title={isRevealed ? 'Ẩn key' : 'Hiện key'}
                      >
                        {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => onDeleteKeyIndex(idx)}
                        className="text-text-muted hover:text-polish p-1.5 rounded-[2px] hover:bg-polish/10 transition-colors cursor-pointer shrink-0"
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
                className="flex-1 flex items-center justify-center gap-1.5 border border-dashed border-parchment-2 hover:border-polish hover:bg-polish/10 text-text-muted hover:text-text-main text-xs font-semibold py-2 rounded-[2px] transition-all cursor-pointer bg-ink/40"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm key mới
              </button>
              <button
                onClick={onImportClipboardKeys}
                className="flex-1 flex items-center justify-center gap-1.5 border border-dashed border-parchment-2 hover:border-polish hover:bg-polish/10 text-text-muted hover:text-text-main text-xs font-semibold py-2 rounded-[2px] transition-all cursor-pointer bg-ink/40"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                Dán từ clipboard
              </button>
            </div>

            <p className="text-[11px] text-text-muted leading-relaxed">
              Hỗ trợ nhiều keys để hệ thống tự xoay vòng, tránh giới hạn tốc độ khi dịch hàng loạt. Mỗi dòng / dấu phẩy là một key.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-parchment-2 shrink-0 flex justify-end bg-ink/30">
          <button
            onClick={onClose}
            className="bg-polish hover:bg-[#A03522] active:bg-[#8F2D1E] text-white text-xs font-bold px-5 py-2 rounded-[2px] transition-colors cursor-pointer shadow-xs"
          >
            Lưu &amp; Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
