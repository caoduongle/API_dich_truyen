import { useState } from 'react';
import {
  Server,
  Key,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  PlugZap,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Cpu,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/cn';
import {
  OPENAI_COMPATIBLE_PRESETS,
  validateProviderBaseUrl,
} from '../../config/aiProviders';
import { maskSecretKey } from '../../utils/aiProviderStorage';
import {
  listOpenAIModels,
  testOpenAIConnection,
  type OpenAIConnectionTestResult,
} from '../../services/openai/openaiClient';
import type { OpenAICompatibleConfig, OpenAICompatiblePresetId } from '../../types/aiProvider';
import type { ModelInfoItem } from '../../types/quota';

const PRESET_ORDER: OpenAICompatiblePresetId[] = [
  'deepseek',
  'qwen',
  'groq',
  'nvidia-nim',
  'ollama',
  'lm-studio',
  'custom',
];

export interface OpenAIProviderSectionProps {
  openAIConfig: OpenAICompatibleConfig;
  onUpdateConfig: (patch: Partial<OpenAICompatibleConfig>) => void;
  onSelectPreset: (presetId: OpenAICompatiblePresetId) => void;
  openAIApiKeys: string[];
  onAddOpenAIKey: () => void;
  onUpdateOpenAIKey: (index: number, value: string) => void;
  onDeleteOpenAIKey: (index: number) => void;
  rememberKeys?: boolean;
  onToggleRememberKeys?: (remember: boolean) => void;
}

export function OpenAIProviderSection({
  openAIConfig,
  onUpdateConfig,
  onSelectPreset,
  openAIApiKeys,
  onAddOpenAIKey,
  onUpdateOpenAIKey,
  onDeleteOpenAIKey,
  rememberKeys = false,
  onToggleRememberKeys,
}: OpenAIProviderSectionProps) {
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set());
  const [discoveredModels, setDiscoveredModels] = useState<ModelInfoItem[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<OpenAIConnectionTestResult | null>(null);

  const activePreset = OPENAI_COMPATIBLE_PRESETS[openAIConfig.presetId] || OPENAI_COMPATIBLE_PRESETS.custom;
  const urlValidation = validateProviderBaseUrl(openAIConfig.baseUrl);
  const isLocal = Boolean(urlValidation.valid && urlValidation.isLocal);
  const cleanKeys = openAIApiKeys.map((k) => k.trim()).filter(Boolean);
  const firstKey = cleanKeys[0];

  const suggestedModelIds = Array.from(
    new Set([
      ...discoveredModels.map((m) => m.name),
      ...activePreset.suggestedModels,
      ...(openAIConfig.model.trim() ? [openAIConfig.model.trim()] : []),
    ])
  ).filter(Boolean);

  const toggleReveal = (index: number) => {
    setRevealedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleLoadModels = async () => {
    setModelsError(null);
    setIsLoadingModels(true);
    try {
      const models = await listOpenAIModels(openAIConfig.baseUrl, firstKey);
      setDiscoveredModels(models);
      if (models.length === 0) {
        setModelsError('Máy chủ không trả về model nào từ /v1/models. Bạn vẫn có thể nhập tay mã model.');
      } else if (!openAIConfig.model.trim()) {
        onUpdateConfig({ model: models[0].name });
      }
    } catch (err: unknown) {
      setModelsError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testOpenAIConnection(openAIConfig.baseUrl, openAIConfig.model, firstKey);
      setTestResult(res);
    } catch (err: unknown) {
      setTestResult({
        ok: false,
        latencyMs: 0,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Preset Quick Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-polish" />
            Chọn nhanh nhà cung cấp (/v1/chat/completions)
          </label>
          <Badge tone={isLocal ? 'polish' : 'neutral'}>
            {isLocal ? 'Local Keyless' : 'Remote HTTPS'}
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {PRESET_ORDER.map((presetId) => {
            const preset = OPENAI_COMPATIBLE_PRESETS[presetId];
            const isSelected = openAIConfig.presetId === presetId;
            return (
              <button
                key={presetId}
                type="button"
                onClick={() => {
                  onSelectPreset(presetId);
                  setDiscoveredModels([]);
                  setTestResult(null);
                  setModelsError(null);
                }}
                className={cn(
                  'px-2.5 py-2 text-left rounded-[2px] border text-xs font-semibold transition-colors cursor-pointer',
                  isSelected
                    ? 'bg-polish/15 border-polish text-text-main shadow-xs'
                    : 'bg-ink/60 border-parchment-2 text-text-muted hover:text-text-main hover:bg-parchment-2/60'
                )}
              >
                <div className="truncate">{preset.label}</div>
                <div className="text-[10px] font-normal text-text-muted truncate">
                  {preset.isLocal ? 'Không cần Key' : preset.baseUrl ? 'Bearer Key' : 'URL tùy nhập'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Base URL */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-text-main uppercase tracking-wider block">
          Địa chỉ gốc (Base URL)
        </label>
        <input
          type="text"
          value={openAIConfig.baseUrl}
          onChange={(e) => {
            onUpdateConfig({ baseUrl: e.target.value });
            setDiscoveredModels([]);
            setModelsError(null);
            setTestResult(null);
          }}
          placeholder="https://api.deepseek.com/v1 hoặc http://localhost:11434/v1"
          className="w-full text-xs border border-parchment-2 bg-ink rounded-[2px] px-3 py-2 text-text-main font-mono focus:outline-none focus:border-polish"
        />
        {!urlValidation.valid && urlValidation.error && (
          <div className="bg-amber-950/30 border border-amber-800/60 rounded-[2px] px-2.5 py-1.5 text-[11px] text-amber-300 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{urlValidation.error}</span>
          </div>
        )}
        {isLocal && (
          <div className="bg-parchment-2/40 border border-parchment-2 rounded-[2px] px-2.5 py-2 text-[11px] text-text-muted space-y-1">
            <div className="font-semibold text-text-main flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-polish shrink-0" />
              Chế độ máy chủ cục bộ: có thể bỏ trống API Key để chạy không giới hạn.
            </div>
            <p className="text-[10px] leading-relaxed">
              Nếu trình duyệt báo lỗi mạng / CORS: với Ollama đặt biến môi trường{' '}
              <code className="font-mono text-text-main">OLLAMA_ORIGINS=*</code>; với LM Studio bật{' '}
              <code className="font-mono text-text-main">Enable CORS</code> trong Server Settings.
            </p>
          </div>
        )}
      </div>

      {/* Model ID + /v1/models Fetch */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-polish" />
            Mã mô hình (Model ID)
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadModels}
            disabled={isLoadingModels || !urlValidation.valid || (!isLocal && cleanKeys.length === 0)}
            icon={<RefreshCw className={cn('w-3 h-3', isLoadingModels && 'animate-spin text-polish')} />}
          >
            {isLoadingModels ? 'Đang tải...' : 'Tải danh sách Model'}
          </Button>
        </div>

        <input
          type="text"
          value={openAIConfig.model}
          onChange={(e) => onUpdateConfig({ model: e.target.value })}
          placeholder={activePreset.defaultModel || 'Nhập mã model (vd: deepseek-chat, qwen2.5:14b)'}
          className="w-full text-xs border border-parchment-2 bg-ink rounded-[2px] px-3 py-2 text-text-main font-mono focus:outline-none focus:border-polish"
        />

        {suggestedModelIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {suggestedModelIds.slice(0, 12).map((modelId) => {
              const active = openAIConfig.model.trim() === modelId;
              return (
                <button
                  key={modelId}
                  type="button"
                  onClick={() => onUpdateConfig({ model: modelId })}
                  className={cn(
                    'text-[10px] font-mono px-2 py-1 rounded-[2px] border cursor-pointer transition-colors',
                    active
                      ? 'bg-polish text-white border-[#8F2D1E]'
                      : 'bg-ink/60 border-parchment-2 text-text-muted hover:text-text-main hover:bg-parchment-2/60'
                  )}
                >
                  {modelId}
                </button>
              );
            })}
          </div>
        )}

        {modelsError && (
          <div className="bg-amber-950/30 border border-amber-800/60 rounded-[2px] px-2.5 py-1.5 text-[11px] text-amber-300 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{modelsError}</span>
            </div>
            <button
              type="button"
              onClick={handleLoadModels}
              className="text-[10px] font-bold underline cursor-pointer shrink-0"
            >
              Thử lại
            </button>
          </div>
        )}
      </div>

      {/* API Keys for OpenAI-Compatible */}
      <div className="space-y-2 border-t border-parchment-2 pt-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-polish" />
            API Keys OpenAI-compatible ({cleanKeys.length})
          </label>
          {isLocal && cleanKeys.length === 0 && (
            <Badge tone="neutral">Không bắt buộc với Local</Badge>
          )}
        </div>

        {openAIApiKeys.length === 0 ? (
          <div className="bg-ink/40 border border-parchment-2 rounded-[2px] p-3 text-[11px] text-text-muted flex items-center justify-between gap-2">
            <span>
              {isLocal
                ? 'Đang dùng chế độ không cần khóa cho máy chủ cục bộ.'
                : 'Chưa có API Key cho máy chủ từ xa. Có thể nhập nhiều khóa để tự xoay vòng khi chạm 429.'}
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            {openAIApiKeys.map((keyVal, idx) => {
              const revealed = revealedIndices.has(idx);
              const maskedHint = maskSecretKey(keyVal);
              return (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-1.5 border border-parchment-2 rounded-[2px] px-2.5 py-1.5 bg-ink focus-within:ring-2 focus-within:ring-polish/60 focus-within:border-polish">
                    <span className="text-[10px] font-bold text-text-muted w-4 text-center">
                      {idx + 1}
                    </span>
                    <input
                      type={revealed ? 'text' : 'password'}
                      value={keyVal}
                      onChange={(e) => onUpdateOpenAIKey(idx, e.target.value)}
                      placeholder={isLocal ? 'Tùy chọn (có thể để trống)' : 'Nhập API Key (sk-..., nvapi-..., gsk_...)'}
                      className="flex-1 text-xs bg-transparent outline-none text-text-main font-mono min-w-0"
                    />
                    {!revealed && maskedHint && (
                      <span className="text-[10px] font-mono text-text-muted shrink-0">
                        {maskedHint}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleReveal(idx)}
                    className="text-text-muted hover:text-text-main p-1.5 rounded-[2px] hover:bg-parchment-2 cursor-pointer shrink-0"
                    title={revealed ? 'Ẩn key' : 'Hiện key'}
                  >
                    {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteOpenAIKey(idx)}
                    className="text-text-muted hover:text-polish p-1.5 rounded-[2px] hover:bg-polish/10 cursor-pointer shrink-0"
                    title="Xóa key này"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={onAddOpenAIKey}
            className="bg-ink/40 border-dashed hover:border-polish hover:bg-polish/10"
          >
            Thêm OpenAI Key
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleTestConnection}
            disabled={isTesting || !urlValidation.valid || (!isLocal && cleanKeys.length === 0)}
            icon={<PlugZap className={cn('w-3.5 h-3.5 text-polish', isTesting && 'animate-pulse')} />}
          >
            {isTesting ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
          </Button>
        </div>

        {onToggleRememberKeys && (
          <div className="pt-1 border-t border-parchment-2/40 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberKeys}
                onChange={(e) => onToggleRememberKeys(e.target.checked)}
                className="rounded-[2px] text-polish focus:ring-polish/60 cursor-pointer"
              />
              <span className="text-[11px] text-text-main font-semibold">
                Ghi nhớ khóa API trên trình duyệt này
              </span>
            </label>
            <span className="text-[10px] text-text-muted">
              {rememberKeys ? 'Lưu tùy chọn cục bộ' : 'Chỉ lưu trong phiên hiện tại'}
            </span>
          </div>
        )}
      </div>

      {/* Connection Test Result */}
      {testResult && (
        <div
          className={cn(
            'rounded-[2px] border px-3 py-2 text-xs flex items-start gap-2',
            testResult.ok
              ? 'bg-emerald-950/25 border-emerald-800/60 text-emerald-300'
              : 'bg-amber-950/30 border-amber-800/60 text-amber-300'
          )}
        >
          {testResult.ok ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <div className="font-semibold">{testResult.message}</div>
            {testResult.isCorsSuspected && (
              <div className="text-[11px] text-text-muted">
                Kiểm tra máy chủ cục bộ đang chạy và đã cho phép truy cập từ nguồn trình duyệt hiện tại.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
