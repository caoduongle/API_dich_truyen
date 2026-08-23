import React from 'react';
import { Sparkles, AlertTriangle, Loader2, CheckCircle2, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/cn';
import { RegisteredModelDef, isValidModelIdFormat } from '../../utils/modelRegistry';

export interface CustomModelSectionProps {
  showAddCustom: boolean;
  onCloseAddCustom: () => void;
  customModelIdInput: string;
  setCustomModelIdInput: (val: string) => void;
  customModelLabelInput: string;
  setCustomModelLabelInput: (val: string) => void;
  isVerifying: boolean;
  verifyError: string | null;
  onSubmitCustomModel: (e: React.FormEvent) => void;
  customModels: RegisteredModelDef[];
  reverifyingModelId: string | null;
  onReverifyCustomModel: (modelId: string, label?: string) => void;
  onRemoveCustomModel: (modelId: string) => void;
}

export function CustomModelSection({
  showAddCustom,
  onCloseAddCustom,
  customModelIdInput,
  setCustomModelIdInput,
  customModelLabelInput,
  setCustomModelLabelInput,
  isVerifying,
  verifyError,
  onSubmitCustomModel,
  customModels,
  reverifyingModelId,
  onReverifyCustomModel,
  onRemoveCustomModel,
}: CustomModelSectionProps) {
  return (
    <>
      {showAddCustom && (
        <form onSubmit={onSubmitCustomModel} className="bg-ink/80 border border-parchment-2 rounded-[2px] p-3 space-y-2.5 animate-fadeIn">
          <div className="text-[11px] font-bold text-text-main flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-polish" />
            Thêm &amp; Xác minh Model Tùy chỉnh (Fine-Tuned / Preview)
          </div>

          {verifyError && (
            <div className="bg-red-950/40 border border-red-800/80 rounded-[2px] p-2 text-xs text-red-300 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              <span>{verifyError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] uppercase font-bold text-text-muted mb-0.5">Mã Model ID *</label>
              <input
                type="text"
                placeholder="Ví dụ: tunedModels/my-model hoặc gemini-exp-1206"
                value={customModelIdInput}
                onChange={e => setCustomModelIdInput(e.target.value)}
                className="w-full text-xs bg-parchment border border-parchment-2 rounded-[2px] px-2.5 py-1.5 text-text-main font-mono focus:outline-none focus:border-polish"
                disabled={isVerifying}
                required
              />
            </div>
            <div>
              <label className="block text-[9px] uppercase font-bold text-text-muted mb-0.5">Tên hiển thị (Tùy chọn)</label>
              <input
                type="text"
                placeholder="Ví dụ: Bản dịch Chuyên Sâu Tiên Hiệp"
                value={customModelLabelInput}
                onChange={e => setCustomModelLabelInput(e.target.value)}
                className="w-full text-xs bg-parchment border border-parchment-2 rounded-[2px] px-2.5 py-1.5 text-text-main focus:outline-none focus:border-polish"
                disabled={isVerifying}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCloseAddCustom}
              disabled={isVerifying}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isVerifying || !customModelIdInput.trim() || !isValidModelIdFormat(customModelIdInput.trim())}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Đang xác minh...
                </>
              ) : (
                'Xác minh & Thêm'
              )}
            </Button>
          </div>
        </form>
      )}

      {customModels.length > 0 && (
        <div className="space-y-1 pt-1">
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
            Quản lý model tự nhập ({customModels.length}):
          </div>
          <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
            {customModels.map(c => {
              const isReverifying = reverifyingModelId === c.id;
              return (
                <div key={c.id} className="flex items-center justify-between bg-parchment-2/20 border border-parchment-2 px-2 py-1.5 rounded-[2px] text-xs">
                  <div className="flex items-center gap-1.5 truncate max-w-[240px]">
                    <span className="font-mono text-[11px] text-text-main truncate">{c.label || c.id}</span>
                    {c.verified ? (
                      <span className="text-[10px] text-polish flex items-center gap-0.5 shrink-0" title="Đã xác minh">
                        <CheckCircle2 className="w-3 h-3 text-polish" />
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-400 flex items-center gap-0.5 shrink-0" title="Chưa xác minh hoặc không hợp lệ">
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!c.verified && (
                      <button
                        type="button"
                        onClick={() => onReverifyCustomModel(c.id, c.label)}
                        disabled={isReverifying}
                        className="text-[10px] text-text-muted hover:text-polish p-1 transition-colors cursor-pointer flex items-center gap-0.5"
                        title="Xác minh lại model này"
                      >
                        <RefreshCw className={cn("w-3 h-3", isReverifying && "animate-spin text-polish")} />
                        {isReverifying ? 'Đang kiểm tra...' : 'Xác minh'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemoveCustomModel(c.id)}
                      className="text-text-muted hover:text-polish p-1 transition-colors cursor-pointer"
                      title="Xóa model này"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
