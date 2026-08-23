import React, { useState } from 'react';
import { 
  Key, Plus, Cpu, Sliders, BarChart3,
  AlertTriangle, X, RefreshCw
} from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { QuotaPanel } from './QuotaPanel';
import { cn } from '../lib/cn';
import { useModelObservability } from '../hooks/useModelObservability';
import { useModelDiscovery } from '../hooks/useModelDiscovery';
import { useAIConfigContext } from '../context/AIConfigContext';
import { verifyModel } from '../utils/apiClient';
import { 
  computeModelStatsSummary, 
  updateCustomModelVerification,
} from '../utils/modelRegistry';

import { ModelSummaryCard } from './api-settings/ModelSummaryCard';
import { KeyListSection } from './api-settings/KeyListSection';
import { CustomModelSection } from './api-settings/CustomModelSection';
import { TranslationQualitySection } from './api-settings/TranslationQualitySection';

export interface ApiSettingsProps {
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
  const [activeTab, setActiveTab] = useState<'config' | 'quota'>('config');

  // Lấy danh sách dynamic models từ AIConfigContext
  const {
    availableModels,
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
  const [reverifyingModelId, setReverifyingModelId] = useState<string | null>(null);

  // Observability state duy trì xuyên suốt cả 2 tab
  const observability = useModelObservability(apiKeys, registerDiscoveredModels);

  // Model Discovery Hook với SWR cache và background refresh
  const discovery = useModelDiscovery({ apiKeys });

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

  const handleReverifyCustomModel = async (modelId: string, label?: string) => {
    setReverifyingModelId(modelId);
    try {
      const verifyRes = await verifyModel(modelId, label, apiKeys);
      if (verifyRes.success && verifyRes.verified && verifyRes.model) {
        updateCustomModelVerification(modelId, verifyRes.model);
      } else {
        updateCustomModelVerification(modelId, {
          verified: false,
          verificationState: 'invalid',
          verificationError: verifyRes.error || 'Xác minh thất bại',
        });
      }
    } catch {
      updateCustomModelVerification(modelId, {
        verified: false,
        verificationState: 'invalid',
        verificationError: 'Lỗi kết nối khi xác minh',
      });
    } finally {
      setReverifyingModelId(null);
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

              {/* Form nhập model tùy chỉnh & danh sách custom model */}
              <CustomModelSection
                showAddCustom={showAddCustom}
                onCloseAddCustom={() => {
                  setShowAddCustom(false);
                  setVerifyError(null);
                }}
                customModelIdInput={customModelIdInput}
                setCustomModelIdInput={setCustomModelIdInput}
                customModelLabelInput={customModelLabelInput}
                setCustomModelLabelInput={setCustomModelLabelInput}
                isVerifying={isVerifying}
                verifyError={verifyError}
                onSubmitCustomModel={handleCreateCustomModel}
                customModels={custom}
                reverifyingModelId={reverifyingModelId}
                onReverifyCustomModel={handleReverifyCustomModel}
                onRemoveCustomModel={removeCustomModel}
              />

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
            <TranslationQualitySection
              warningParagraphMismatch={warningParagraphMismatch}
              setWarningParagraphMismatch={setWarningParagraphMismatch}
              enableAiQaCritique={enableAiQaCritique}
              setEnableAiQaCritique={setEnableAiQaCritique}
              enableSegmentTranslation={enableSegmentTranslation}
              setEnableSegmentTranslation={setEnableSegmentTranslation}
            />

            {/* API Keys */}
            <KeyListSection
              apiKeys={apiKeys}
              validKeyCount={validKeyCount}
              onAddApiKey={onAddApiKey}
              onUpdateKeyIndex={onUpdateKeyIndex}
              onDeleteKeyIndex={onDeleteKeyIndex}
              onImportClipboardKeys={onImportClipboardKeys}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
