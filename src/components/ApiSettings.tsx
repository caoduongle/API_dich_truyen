import React, { useState } from 'react';
import { X, Plus, Trash2, Key, Cpu, ClipboardPaste, Eye, EyeOff, CheckCircle } from 'lucide-react';

const AVAILABLE_MODELS = [
  { id: 'gemini-2.5-flash',       label: 'Gemini 2.5 Flash (Khuyên dùng)' },
  { id: 'gemini-2.5-pro',         label: 'Gemini 2.5 Pro (Mạnh nhất)' },
  { id: 'gemini-2.0-flash',       label: 'Gemini 2.0 Flash' },
  { id: 'gemini-3.1-flash-lite',  label: 'Gemini 3.1 Flash Lite (Nhanh / Rẻ)' },
  { id: 'gemma-4-31b-it',         label: 'Gemma 4 31B IT (Local)' },
];

interface ApiSettingsProps {
  apiKeys: string[];
  selectedModel: string;
  onClose: () => void;
  onSaveModel: (model: string) => void;
  onAddApiKey: () => void;
  onUpdateKeyIndex: (index: number, val: string) => void;
  onDeleteKeyIndex: (index: number) => void;
  onImportClipboardKeys: () => void;
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
}: ApiSettingsProps) {
  const [revealedKeys, setRevealedKeys] = useState<Set<number>>(new Set());

  const toggleReveal = (index: number) => {
    setRevealedKeys(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const validKeyCount = apiKeys.filter(k => k.trim().length > 5).length;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div className="relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
              <Cpu className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Cấu hình AI</h2>
              <p className="text-[11px] text-slate-400">
                {validKeyCount > 0 ? (
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> {validKeyCount} key đang hoạt động
                  </span>
                ) : (
                  'Chưa có API key nào được cấu hình'
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* Model selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-indigo-500" />
              Mô hình AI
            </label>
            <select
              value={selectedModel}
              onChange={e => onSaveModel(e.target.value)}
              className="w-full text-sm border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
            >
              {AVAILABLE_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400">
              Áp dụng ngay lập tức cho tất cả tính năng dịch thuật.
            </p>
          </div>

          {/* API Keys */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-indigo-500" />
              Gemini API Keys ({validKeyCount} / {apiKeys.length})
            </label>

            {apiKeys.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center space-y-1">
                <Key className="w-6 h-6 text-amber-400 mx-auto" />
                <p className="text-xs font-semibold text-amber-700">Chưa có key nào</p>
                <p className="text-[11px] text-amber-600">Thêm ít nhất một Gemini API Key để bắt đầu dịch.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {apiKeys.map((key, idx) => {
                  const isRevealed = revealedKeys.has(idx);
                  const isValid = key.trim().length > 5;
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <div className={`flex-1 flex items-center gap-1 border rounded-lg px-2.5 py-1.5 bg-white transition-colors ${
                        isValid ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'
                      }`}>
                        <span className="text-[10px] font-bold text-slate-400 shrink-0 w-5 text-center">
                          {idx + 1}
                        </span>
                        <input
                          type={isRevealed ? 'text' : 'password'}
                          value={key}
                          onChange={e => onUpdateKeyIndex(idx, e.target.value)}
                          placeholder="AIza..."
                          className="flex-1 text-xs bg-transparent outline-none text-slate-800 font-mono min-w-0"
                        />
                        {isValid && (
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        )}
                      </div>
                      <button
                        onClick={() => toggleReveal(idx)}
                        className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                        title={isRevealed ? 'Ẩn key' : 'Hiện key'}
                      >
                        {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => onDeleteKeyIndex(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
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
                className="flex-1 flex items-center justify-center gap-1.5 border border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 text-slate-500 hover:text-indigo-700 text-xs font-semibold py-2 rounded-lg transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm key mới
              </button>
              <button
                onClick={onImportClipboardKeys}
                className="flex-1 flex items-center justify-center gap-1.5 border border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 text-slate-500 hover:text-indigo-700 text-xs font-semibold py-2 rounded-lg transition-all cursor-pointer"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                Dán từ clipboard
              </button>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Hỗ trợ nhiều keys để hệ thống tự xoay vòng, tránh giới hạn tốc độ khi dịch hàng loạt. Mỗi dòng / dấu phẩy là một key.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 shrink-0 flex justify-end">
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
