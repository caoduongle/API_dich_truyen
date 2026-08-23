import React, { useState } from 'react';
import { Key, Plus, Trash2, Eye, EyeOff, ClipboardPaste } from 'lucide-react';
import { Button } from '../ui/Button';

export interface KeyListSectionProps {
  apiKeys: string[];
  validKeyCount: number;
  onAddApiKey: () => void;
  onUpdateKeyIndex: (index: number, value: string) => void;
  onDeleteKeyIndex: (index: number) => void;
  onImportClipboardKeys: () => void;
}

export function KeyListSection({
  apiKeys,
  validKeyCount,
  onAddApiKey,
  onUpdateKeyIndex,
  onDeleteKeyIndex,
  onImportClipboardKeys,
}: KeyListSectionProps) {
  const [revealedKeys, setRevealedKeys] = useState<Set<number>>(new Set());

  const toggleReveal = (index: number) => {
    setRevealedKeys(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div className="space-y-2 border-t border-parchment-2 pt-3">
      <label className="text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-1.5">
        <Key className="w-3.5 h-3.5 text-polish" />
        Gemini API Keys ({validKeyCount} / {apiKeys.length})
      </label>

      {apiKeys.length === 0 ? (
        <div className="bg-amber-950/20 border border-amber-800/40 rounded-[2px] p-4 text-center space-y-1">
          <Key className="w-5 h-5 text-amber-400 mx-auto animate-pulse" />
          <p className="text-xs font-semibold text-amber-300">API Key cá nhân là bắt buộc</p>
          <p className="text-[11px] text-text-muted">
            Ứng dụng dịch trực tiếp từ trình duyệt đến Google Gemini (100% riêng tư, máy chủ không xử lý hay lưu trữ văn bản). Vui lòng thêm ít nhất một API Key để bắt đầu dịch.
          </p>
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
                  type="button"
                  onClick={() => toggleReveal(idx)}
                  className="text-text-muted hover:text-text-main p-1.5 rounded-[2px] hover:bg-parchment-2 transition-colors cursor-pointer shrink-0"
                  title={isRevealed ? 'Ẩn key' : 'Hiện key'}
                >
                  {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
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
        <Button
          variant="outline"
          size="sm"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={onAddApiKey}
          className="flex-1 py-2 bg-ink/40 border-dashed hover:border-polish hover:bg-polish/10"
        >
          Thêm key mới
        </Button>
        <Button
          variant="outline"
          size="sm"
          icon={<ClipboardPaste className="w-3.5 h-3.5" />}
          onClick={onImportClipboardKeys}
          className="flex-1 py-2 bg-ink/40 border-dashed hover:border-polish hover:bg-polish/10"
        >
          Dán từ clipboard
        </Button>
      </div>

      <p className="text-[11px] text-text-muted leading-relaxed">
        Hệ thống tự động gom nhóm khóa theo Project / Quota Group và quản lý hạn ngạch RPM/TPM độc lập. Thêm nhiều khóa thuộc các dự án khác nhau để mở rộng dung lượng dịch.
      </p>
    </div>
  );
}
