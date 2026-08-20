import React, { useState } from 'react';
import { 
  Key, Plus, Trash2, Eye, EyeOff, ClipboardPaste, Cpu, Sliders, BarChart3,
  AlertTriangle, CheckCircle2, Clock, Sparkles, X, Zap, Loader2, ShieldCheck, RefreshCw
} from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { QuotaPanel } from './QuotaPanel';
import { cn } from '../lib/cn';
import { useModelObservability } from '../hooks/useModelObservability';
import { useModelDiscovery } from '../hooks/useModelDiscovery';
import { useAIConfigContext } from '../context/AIConfigContext';
import { verifyModel } from '../utils/apiClient';
import { 
  computeModelStatsSummary, 
  ModelStatsSummary,
  getRegisteredModels,
  getPresetModels,
  RegisteredModelDef,
  isValidModelIdFormat,
  formatTokenCount,
  formatPacingSummary,
  getModelDefinition,
} from '../utils/modelRegistry';


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

function ModelSummaryCard({ 
  summary, 
  onInspectClick 
}: { 
  summary: ModelStatsSummary; 
  onInspectClick: () => void;
}) {
  const modelDef = getModelDefinition(summary.modelId);
  const isDeprecated = modelDef?.status === 'deprecated';
  const isShutdown = modelDef?.status === 'shutdown';
  const isVerified = modelDef?.verified === true;

  let customRpm: number | undefined;
  try {
    const saved = localStorage.getItem('gemini_quota_custom_limits');
    if (saved) {
      const parsed = JSON.parse(saved);
      const firstLimit = Object.values(parsed)[0] as any;
      if (firstLimit?.maxRpm && typeof firstLimit.maxRpm === 'number') {
        customRpm = firstLimit.maxRpm;
      }
    }
  } catch {}

  const pacing = formatPacingSummary(customRpm, summary.modelId);

  return (
    <div className="bg-parchment-2/15 border border-parchment-2 rounded-[2px] p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-text-main uppercase tracking-wider">
            Trạng thái Mô hình:
          </span>
          <span className="text-xs font-semibold text-polish font-serif">
            {summary.displayName.split('(')[0].trim()}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {isVerified && (
            <Badge tone="polish">
              <ShieldCheck className="w-3 h-3 text-polish" />
              Đã xác minh
            </Badge>
          )}
          {isDeprecated && (
            <Badge tone="warning">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              Sắp ngừng hỗ trợ (Deprecated)
            </Badge>
          )}
          {isShutdown && (
            <Badge tone="danger">
              <X className="w-3 h-3 text-red-400" />
              Đã ngừng hoạt động (Shutdown)
            </Badge>
          )}
          {summary.hasChecked ? (
            summary.isUnavailable ? (
              <Badge tone="warning" className="animate-pulse">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                0 / {summary.totalKeys} key hỗ trợ
              </Badge>
            ) : (
              <Badge tone="polish">
                <CheckCircle2 className="w-3 h-3 text-polish" />
                {summary.availableKeyCount} / {summary.totalKeys} key hỗ trợ
              </Badge>
            )
          ) : (
            <Badge tone="neutral">
              <Clock className="w-3 h-3 text-text-muted" />
              Chưa kiểm tra key
            </Badge>
          )}
        </div>
      </div>

      {isDeprecated && (
        <div className="bg-amber-950/30 border border-amber-800/60 rounded-[2px] p-2.5 text-xs text-amber-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Mô hình này sắp ngừng hỗ trợ. Khuyến nghị chuyển sang: <strong>{modelDef?.replacementId || 'model mới hơn'}</strong></span>
          </div>
        </div>
      )}

      {isShutdown && (
        <div className="bg-red-950/30 border border-red-800/60 rounded-[2px] p-2.5 text-xs text-red-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <X className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span>Mô hình này đã bị Google khai tử. Vui lòng chọn mô hình khác để tiếp tục dịch.</span>
          </div>
        </div>
      )}


      {summary.isUnavailable && (
        <div className="bg-amber-950/30 border border-amber-800/60 rounded-[2px] p-2.5 text-xs text-amber-300 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Model đang chọn hiện không có API key nào hỗ trợ.</span>
          </div>
          <button
            type="button"
            onClick={onInspectClick}
            className="text-[11px] font-bold text-amber-200 hover:text-white underline cursor-pointer shrink-0"
          >
            Chuyển sang Quota để kiểm tra lại
          </button>
        </div>
      )}

      {/* Dynamic Pacing Info Line */}
      <div className="bg-parchment-2/20 border border-parchment-2/70 rounded-[2px] px-2.5 py-1 flex items-center justify-between text-[11px] text-text-muted flex-wrap gap-1">
        <span className="flex items-center gap-1 font-medium">
          <Zap className="w-3 h-3 text-polish" />
          <span>Tốc độ điều phối: <strong className="text-text-main">~{pacing.estimatedRpm} req/phút</strong> (~{pacing.intervalSec}/lần gọi)</span>
        </span>
        <span className="text-[10px] italic">
          {pacing.isCustom ? 'Tự động tối ưu theo hạn mức bạn nhập' : 'Mặc định theo tier model'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <div className="bg-ink border border-parchment-2 rounded-[2px] p-1.5">
          <div className="text-[9px] text-text-muted uppercase font-bold tracking-wider">RPM (60s)</div>
          <div className="text-xs font-mono font-bold text-text-main mt-0.5">
            {summary.requestsThisMinute}
          </div>
        </div>

        <div className="bg-ink border border-parchment-2 rounded-[2px] p-1.5">
          <div className="text-[9px] text-text-muted uppercase font-bold tracking-wider">TPM (60s)</div>
          <div className="text-xs font-mono font-bold text-text-main mt-0.5">
            {formatTokenCount(summary.tokensThisMinute)}
          </div>
        </div>

        <div className="bg-ink border border-parchment-2 rounded-[2px] p-1.5">
          <div className="text-[9px] text-text-muted uppercase font-bold tracking-wider">Hôm nay (PST)</div>
          <div className="text-xs font-mono font-bold text-text-main mt-0.5">
            {summary.requestsToday} <span className="text-[9px] text-text-muted">({formatTokenCount(summary.tokensToday)})</span>
          </div>
        </div>

        <div className="bg-ink border border-parchment-2 rounded-[2px] p-1.5">
          <div className="text-[9px] text-text-muted uppercase font-bold tracking-wider">Tổng Token</div>
          <div className={`text-xs font-mono font-bold mt-0.5 ${summary.errorsTotal > 0 ? 'text-polish' : 'text-text-main'}`}>
            {formatTokenCount(summary.totalTokens)}
          </div>
        </div>
      </div>
    </div>
  );
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
  const [activeTab, setActiveTab] = useState<'config' | 'quota'>('config');
  const [revealedKeys, setRevealedKeys] = useState<Set<number>>(new Set());

  // Lấy danh sách dynamic models từ AIConfigContext
  const {
    availableModels,
    discoveredModels,
    customModels,
    addCustomModel,
    removeCustomModel,
    registerDiscoveredModels,
  } = useAIConfigContext();

  // State cho form nhập model tùy chỉnh
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customModelIdInput, setCustomModelIdInput] = useState('');
  const [customModelLabelInput, setCustomModelLabelInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Observability state duy trì xuyên suốt cả 2 tab
  const observability = useModelObservability(apiKeys, registerDiscoveredModels);

  // Model Discovery Hook với SWR cache và background refresh
  const discovery = useModelDiscovery({ apiKeys });

  const toggleReveal = (index: number) => {
    setRevealedKeys(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleCreateCustomModel = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = customModelIdInput.trim();
    if (!cleanId) return;

    setVerifyError(null);
    setIsVerifying(true);

    try {
      const verifyRes = await verifyModel(cleanId, customModelLabelInput.trim() || undefined, apiKeys);
      if (!verifyRes.success || !verifyRes.verified) {
        setVerifyError(verifyRes.error || 'Xác minh mô hình thất bại. Vui lòng kiểm tra lại ID model hoặc API Key.');
        setIsVerifying(false);
        return;
      }

      const res = addCustomModel(cleanId, customModelLabelInput.trim() || undefined, verifyRes.model);
      if (res.success) {
        setCustomModelIdInput('');
        setCustomModelLabelInput('');
        setVerifyError(null);
        setShowAddCustom(false);
      } else {
        setVerifyError(res.error || 'Không thể thêm model vào danh sách.');
      }
    } catch (err: any) {
      setVerifyError(err.message || 'Lỗi kết nối khi xác minh mô hình.');
    } finally {
      setIsVerifying(false);
    }
  };

  const validKeyCount = apiKeys.filter(k => typeof k === 'string' && k.trim().length > 0).length;

  const modelSummary = computeModelStatsSummary(
    selectedModel,
    observability.snapshotKeys,
    observability.inspectResults,
    validKeyCount
  );

  const presets = availableModels.filter(m => m.source === 'preset' && m.status !== 'shutdown');
  const discovered = availableModels.filter(m => m.source === 'discovered' && m.status !== 'shutdown');
  const custom = availableModels.filter(m => m.source === 'custom' && m.status !== 'shutdown');

  return (
    <Modal
      open={true}
      onClose={onClose}
      size="lg"
      icon={<Cpu className="w-4 h-4 text-polish" />}
      title="Cấu hình AI & Bản Thảo"
      description={
        validKeyCount > 0 ? (
          <span className="text-text-muted font-medium flex items-center gap-1">
            <Key className="w-3 h-3 text-polish" /> Đã cấu hình {validKeyCount} key
          </span>
        ) : (
          'Chưa có API key nào được cấu hình'
        )
      }
      footer={
        <Button variant="primary" size="md" onClick={onClose}>
          Lưu & Đóng
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Tab Switcher */}
        <div className="flex items-center border-b border-parchment-2 pb-2.5 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-[2px] cursor-pointer transition-colors border',
              activeTab === 'config'
                ? 'bg-parchment-2 text-text-main border-polish/40 shadow-xs'
                : 'bg-transparent text-text-muted border-transparent hover:text-text-main hover:bg-parchment-2/40'
            )}
          >
            <Sliders className="w-3.5 h-3.5 text-polish" />
            Cấu hình AI
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('quota')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-[2px] cursor-pointer transition-colors border',
              activeTab === 'quota'
                ? 'bg-parchment-2 text-text-main border-polish/40 shadow-xs'
                : 'bg-transparent text-text-muted border-transparent hover:text-text-main hover:bg-parchment-2/40'
            )}
          >
            <BarChart3 className="w-3.5 h-3.5 text-polish" />
            Quota &amp; Hạn mức
          </button>
        </div>

        {activeTab === 'quota' ? (
          <QuotaPanel 
            apiKeys={apiKeys} 
            selectedModel={selectedModel} 
            onSelectModel={onSaveModel}
            onSwitchToConfigTab={() => setActiveTab('config')} 
            observability={observability}
          />
        ) : (
          <div className="space-y-5">
            {/* Model selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-polish" />
                  Mô hình AI
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await discovery.refresh(true);
                    }}
                    disabled={discovery.isRefreshing || validKeyCount === 0}
                    className={cn(
                      "text-[11px] font-bold text-polish hover:text-[#A03522] flex items-center gap-1 cursor-pointer transition-opacity",
                      (discovery.isRefreshing || validKeyCount === 0) && "opacity-70 cursor-not-allowed"
                    )}
                    title="Làm mới danh sách mô hình từ Google API"
                  >
                    <RefreshCw className={cn("w-3 h-3", discovery.isRefreshing && "animate-spin text-polish")} />
                    {discovery.isRefreshing ? 'Đang làm mới...' : 'Làm mới mô hình'}
                  </button>
                  <span className="text-text-muted/40">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddCustom(!showAddCustom);
                      setVerifyError(null);
                    }}
                    className="text-[11px] font-bold text-polish hover:text-[#A03522] flex items-center gap-1 cursor-pointer"
                  >
                    {showAddCustom ? (
                      <>
                        <X className="w-3 h-3" /> Đóng nhập tay
                      </>
                    ) : (
                      <>
                        <Plus className="w-3 h-3" /> Nhập model tùy chỉnh...
                      </>
                    )}
                  </button>
                </div>
              </div>

              {discovery.error && (
                <div className="bg-amber-950/20 border border-amber-800/60 rounded-[2px] p-2 text-xs text-amber-300 flex items-center gap-1.5 animate-fadeIn">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{discovery.error} (Đang tiếp tục sử dụng danh mục mô hình đã lưu)</span>
                </div>
              )}

              {/* Form nhập model tùy chỉnh */}
              {showAddCustom && (
                <form onSubmit={handleCreateCustomModel} className="bg-ink/80 border border-parchment-2 rounded-[2px] p-3 space-y-2.5 animate-fadeIn">
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
                      onClick={() => {
                        setShowAddCustom(false);
                        setVerifyError(null);
                      }}
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

              {/* Grouped Select Dropdown */}
              <select
                value={selectedModel}
                onChange={e => onSaveModel(e.target.value)}
                className="w-full text-sm border border-parchment-2 bg-ink rounded-[2px] px-3 py-2 text-text-main font-semibold focus:outline-none focus:border-polish cursor-pointer"
              >
                <optgroup label="Mô hình khuyên dùng (Presets)" className="bg-ink text-text-main font-bold">
                  {presets.map(m => (
                    <option key={m.id} value={m.id} className="bg-parchment text-text-main font-normal">
                      {m.label}
                    </option>
                  ))}
                </optgroup>

                {discovered.length > 0 && (
                  <optgroup label="Mô hình tìm thấy từ API Key (Discovered)" className="bg-ink text-text-main font-bold">
                    {discovered.map(m => (
                      <option key={m.id} value={m.id} className="bg-parchment text-text-main font-normal">
                        {m.label}
                      </option>
                    ))}
                  </optgroup>
                )}

                {custom.length > 0 && (
                  <optgroup label="Mô hình tự nhập (Custom)" className="bg-ink text-text-main font-bold">
                    {custom.map(m => (
                      <option key={m.id} value={m.id} className="bg-parchment text-text-main font-normal">
                        {m.label}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              {/* Custom Models List with Delete option */}
              {custom.length > 0 && (
                <div className="space-y-1 pt-1">
                  <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                    Quản lý model tự nhập ({custom.length}):
                  </div>
                  <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                    {custom.map(c => (
                      <div key={c.id} className="flex items-center justify-between bg-parchment-2/20 border border-parchment-2 px-2 py-1 rounded-[2px] text-xs">
                        <div className="flex items-center gap-1.5 truncate max-w-[260px]">
                          <span className="font-mono text-[11px] text-text-main truncate">{c.label || c.id}</span>
                          {c.verified && (
                            <span className="text-[10px] text-polish flex items-center gap-0.5 shrink-0" title="Đã xác minh">
                              <CheckCircle2 className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCustomModel(c.id)}
                          className="text-text-muted hover:text-polish p-1 transition-colors cursor-pointer"
                          title="Xóa model này"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Model Summary Card */}
              <ModelSummaryCard 
                summary={modelSummary} 
                onInspectClick={() => setActiveTab('quota')} 
              />

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
                Hỗ trợ nhiều keys để hệ thống tự xoay vòng, tránh giới hạn tốc độ khi dịch hàng loạt. Mỗi dòng / dấu phẩy là một key.
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
