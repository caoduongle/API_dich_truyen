import React, { useState, useEffect, useRef } from 'react';
import { 
  Key, Plus, Trash2, Eye, EyeOff, ClipboardPaste, 
  CheckCircle2, AlertTriangle, RefreshCw, Zap, ShieldCheck 
} from 'lucide-react';
import { Button } from '../ui/Button';
import { verifyModelDirect } from '../../services/directGeminiClient';
import { cn } from '../../lib/cn';

export interface LocalKeyDraftItem {
  draftId: string;
  value: string;
  isRevealed: boolean;
  testState: 'idle' | 'testing' | 'valid' | 'invalid';
  testMessage?: string;
}

export type ModelSupportLevel =
  | 'presumed_supported'
  | 'verified_supported'
  | 'pending_inspection'
  | 'unsupported';

export interface ModelSupportAssessment {
  modelId: string;
  displayName: string;
  supportLevel: ModelSupportLevel;
  totalKeys: number;
  availableKeys: number;
  badgeTone: 'polish' | 'neutral' | 'warning' | 'danger';
  badgeLabel: string;
  warningMessage?: string;
}

interface KeyInputRowProps {
  index: number;
  value: string;
  isRevealed: boolean;
  isTesting: boolean;
  testResult?: { success: boolean; message: string };
  onUpdate: (index: number, value: string) => void;
  onDelete: (index: number) => void;
  onToggleReveal: (index: number) => void;
  onTest: (index: number, value: string) => void;
}

const KeyInputRow = React.memo(function KeyInputRow({
  index,
  value,
  isRevealed,
  isTesting,
  testResult,
  onUpdate,
  onDelete,
  onToggleReveal,
  onTest,
}: KeyInputRowProps) {
  const [localVal, setLocalVal] = useState(value);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setLocalVal(newVal);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      onUpdate(index, newVal);
    }, 300);
  };

  const handleBlur = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (localVal !== value) {
      onUpdate(index, localVal);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1 border border-parchment-2 rounded-[2px] px-2.5 py-1.5 bg-ink focus-within:ring-2 focus-within:ring-polish/60 focus-within:border-polish">
          <span className="text-[10px] font-bold text-text-muted shrink-0 w-5 text-center">
            {index + 1}
          </span>
          <input
            type={isRevealed ? 'text' : 'password'}
            value={localVal}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Nhập Gemini API Key..."
            className="flex-1 text-xs bg-transparent outline-none text-text-main font-mono min-w-0"
          />
        </div>

        {/* Nút kiểm tra kết nối nhanh */}
        <button
          type="button"
          onClick={() => onTest(index, localVal)}
          disabled={isTesting || !localVal.trim()}
          className={cn(
            "p-1.5 rounded-[2px] border border-parchment-2 transition-colors cursor-pointer shrink-0 flex items-center gap-1 text-[11px] font-semibold",
            isTesting && "opacity-70 cursor-wait bg-parchment-2/50 text-text-muted",
            !isTesting && testResult?.success && "bg-emerald-950/30 border-emerald-800/60 text-emerald-400 hover:bg-emerald-900/40",
            !isTesting && testResult && !testResult.success && "bg-amber-950/30 border-amber-800/60 text-amber-400 hover:bg-amber-900/40",
            !isTesting && !testResult && "text-text-muted hover:text-polish hover:bg-parchment-2 bg-ink/40"
          )}
          title="Kiểm tra kết nối với Google Gemini"
        >
          {isTesting ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-polish" />
          ) : testResult?.success ? (
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          ) : testResult && !testResult.success ? (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Zap className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Ẩn / Hiện key */}
        <button
          type="button"
          onClick={() => onToggleReveal(index)}
          className="text-text-muted hover:text-text-main p-1.5 rounded-[2px] hover:bg-parchment-2 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-polish/60"
          title={isRevealed ? 'Ẩn key' : 'Hiện key'}
        >
          {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>

        {/* Xóa key */}
        <button
          type="button"
          onClick={() => onDelete(index)}
          className="text-text-muted hover:text-polish p-1.5 rounded-[2px] hover:bg-polish/10 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-polish/60"
          title="Xóa key này"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Thông báo kết quả kiểm tra key */}
      {testResult && (
        <div className={cn(
          "text-[10px] px-2 py-0.5 rounded-[2px] flex items-center gap-1.5 animate-fadeIn",
          testResult.success ? "text-emerald-400 bg-emerald-950/20" : "text-amber-300 bg-amber-950/20"
        )}>
          {testResult.success ? (
            <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-3 h-3 shrink-0 text-amber-400" />
          )}
          <span>{testResult.message}</span>
        </div>
      )}
    </div>
  );
});

export interface KeyListSectionProps {
  apiKeys: string[];
  validKeyCount: number;
  onAddApiKey: () => void;
  onUpdateKeyIndex: (index: number, value: string) => void;
  onDeleteKeyIndex: (index: number) => void;
  onImportClipboardKeys: () => void;
  onBatchUpdateKeys?: (keys: string[]) => void;
  rememberKeys?: boolean;
  onToggleRememberKeys?: (remember: boolean) => void;
}

export function KeyListSection({
  apiKeys,
  validKeyCount,
  onAddApiKey,
  onUpdateKeyIndex,
  onDeleteKeyIndex,
  onImportClipboardKeys,
  onBatchUpdateKeys: _onBatchUpdateKeys,
  rememberKeys = false,
  onToggleRememberKeys,
}: KeyListSectionProps) {
  const [revealedKeys, setRevealedKeys] = useState<Set<number>>(new Set());
  const [testingIndex, setTestingIndex] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<number, { success: boolean; message: string }>>({});

  const toggleReveal = (index: number) => {
    setRevealedKeys(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleTestKey = async (index: number, rawValue: string) => {
    const cleanKey = rawValue.trim();
    if (!cleanKey) {
      setTestResults(prev => ({
        ...prev,
        [index]: { success: false, message: 'Vui lòng nhập API Key trước khi kiểm tra.' },
      }));
      return;
    }

    setTestingIndex(index);
    try {
      const res = await verifyModelDirect(cleanKey, 'gemini-2.5-flash');
      if (res.success && res.verified) {
        setTestResults(prev => ({
          ...prev,
          [index]: { success: true, message: 'Khóa hợp lệ và kết nối tốt với Google Gemini!' },
        }));
      } else {
        setTestResults(prev => ({
          ...prev,
          [index]: { success: false, message: res.error || 'Khóa không hợp lệ hoặc đã hết hạn mức.' },
        }));
      }
    } catch (err: any) {
      setTestResults(prev => ({
        ...prev,
        [index]: { success: false, message: err?.message || 'Lỗi kiểm tra kết nối tới Google API.' },
      }));
    } finally {
      setTestingIndex(null);
    }
  };

  return (
    <div className="space-y-2.5 border-t border-parchment-2 pt-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-1.5">
          <Key className="w-3.5 h-3.5 text-polish" />
          Gemini API Keys ({validKeyCount} / {apiKeys.length})
        </label>
        {validKeyCount > 0 && (
          <span className="text-[11px] text-polish font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Đã sẵn sàng dịch
          </span>
        )}
      </div>

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
          {apiKeys.map((key, idx) => (
            <KeyInputRow
              key={idx}
              index={idx}
              value={key}
              isRevealed={revealedKeys.has(idx)}
              isTesting={testingIndex === idx}
              testResult={testResults[idx]}
              onUpdate={onUpdateKeyIndex}
              onDelete={onDeleteKeyIndex}
              onToggleReveal={toggleReveal}
              onTest={handleTestKey}
            />
          ))}
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

      {/* Tùy chọn ghi nhớ khóa bền vững */}
      {onToggleRememberKeys && (
        <div className="pt-1 border-t border-parchment-2/40 space-y-1">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberKeys}
                onChange={e => onToggleRememberKeys(e.target.checked)}
                className="rounded-[2px] text-polish focus:ring-polish/60 cursor-pointer"
              />
              <span className="text-[11px] text-text-main font-semibold">
                Ghi nhớ API Key trên trình duyệt này
              </span>
            </label>
            <span className="text-[10px] text-text-muted">
              {rememberKeys ? 'Không bị xóa khi đóng tab' : 'Chỉ lưu trong tab này'}
            </span>
          </div>
          {rememberKeys && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 pl-5 leading-normal">
              ⚠️ Không nên bật trên máy tính công cộng hoặc thiết bị dùng chung.
            </p>
          )}
        </div>
      )}

      <p className="text-[11px] text-text-muted leading-relaxed">
        Hệ thống tự động gom nhóm khóa theo Project / Quota Group và quản lý hạn ngạch RPM/TPM độc lập. Có thể cấu hình nhiều khóa thuộc các Project / Quota Group khác nhau để tăng khả năng dự phòng và điều phối hạn mức.
      </p>
      <p className="text-[11px] text-text-muted leading-relaxed border-t border-parchment-2/50 pt-2">
        💡 <strong className="text-text-main">Gợi ý quản lý chi phí:</strong> Bạn nên chủ động thiết lập <span className="font-semibold text-text-main">Quota Limits &amp; Billing Alerts</span> trên chính Google Cloud Console của mình để kiểm soát hạn mức chi tiêu an toàn cho từng API Key cá nhân.
      </p>
    </div>
  );
}
