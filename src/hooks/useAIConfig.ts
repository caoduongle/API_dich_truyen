import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNotifications } from '../components/NotificationSystem';
import { DEFAULT_MODEL_ID } from '../constants/models';
import { syncSessionKeysToServer, registerSessionSyncCallback, ModelInfoItem } from '../utils/apiClient';
import { 
  getDiscoveredModels, 
  getCustomModels, 
  getRegisteredModels, 
  saveDiscoveredModels, 
  addCustomModel, 
  removeCustomModel, 
  clearDiscoveredModels, 
  RegisteredModelDef,
  normalizeModelId
} from '../utils/modelRegistry';

export function useAIConfig() {
    const { showToast } = useNotifications();
    const [apiKeys, setApiKeys] = useState<string[]>(() => {
        const stored = localStorage.getItem('gemini_api_keys');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) return parsed;
            } catch (_) {}
        }
        return [];
    });

    const [discoveredModels, setDiscoveredModels] = useState<RegisteredModelDef[]>(() => getDiscoveredModels());
    const [customModels, setCustomModels] = useState<RegisteredModelDef[]>(() => getCustomModels());

    const availableModels = useMemo<RegisteredModelDef[]>(() => {
        return getRegisteredModels();
    }, [discoveredModels, customModels]);

    const [selectedModel, setSelectedModel] = useState<string>(() => {
        const stored = localStorage.getItem('gemini_selected_model');
        if (stored) {
            const all = getRegisteredModels();
            const normStored = normalizeModelId(stored);
            if (all.some(m => normalizeModelId(m.id) === normStored)) {
                return stored;
            }
        }
        return DEFAULT_MODEL_ID;
    });

    const [showApiSettings, setShowApiSettings] = useState(false);

    const [warningParagraphMismatch, setWarningParagraphMismatch] = useState<boolean>(() => {
        const stored = localStorage.getItem('warning_paragraph_mismatch');
        return stored !== 'false';
    });

    const [enableAiQaCritique, setEnableAiQaCritique] = useState<boolean>(() => {
        const stored = localStorage.getItem('enable_ai_qa_critique');
        return stored === 'true';
    });

    const [enableSegmentTranslation, setEnableSegmentTranslation] = useState<boolean>(() => {
        const stored = localStorage.getItem('enable_segment_translation');
        return stored === 'true';
    });

    const apiKeysRef = useRef(apiKeys);
    apiKeysRef.current = apiKeys;

    // Đăng ký callback phục hồi session cho apiClient
    useEffect(() => {
        registerSessionSyncCallback(async () => {
            const currentKeys = apiKeysRef.current;
            return await syncSessionKeysToServer(currentKeys);
        });
    }, []);

    // Sync apiKeys to localStorage & Server Session whenever they change
    useEffect(() => {
        localStorage.setItem('gemini_api_keys', JSON.stringify(apiKeys));
        syncSessionKeysToServer(apiKeys);
    }, [apiKeys]);

    useEffect(() => {
        localStorage.setItem('warning_paragraph_mismatch', String(warningParagraphMismatch));
    }, [warningParagraphMismatch]);

    useEffect(() => {
        localStorage.setItem('enable_ai_qa_critique', String(enableAiQaCritique));
    }, [enableAiQaCritique]);

    useEffect(() => {
        localStorage.setItem('enable_segment_translation', String(enableSegmentTranslation));
    }, [enableSegmentTranslation]);

    const handleSaveModel = useCallback((model: string) => {
        setSelectedModel(model);
        localStorage.setItem('gemini_selected_model', model);
    }, []);

    const handleRegisterDiscoveredModels = useCallback((models: ModelInfoItem[]) => {
        const updated = saveDiscoveredModels(models);
        setDiscoveredModels(prev => {
            if (
                prev.length === updated.length &&
                prev.every((item, idx) => item.id === updated[idx]?.id)
            ) {
                return prev; // Giữ nguyên state reference cũ -> React bails out, không re-render Context
            }
            return updated;
        });
    }, []);

    const handleAddCustomModel = useCallback((modelId: string, label?: string) => {
        const res = addCustomModel(modelId, label);
        if (res.success && res.model) {
            setCustomModels(getCustomModels());
            handleSaveModel(res.model.id);
            showToast({ message: `Đã thêm và kích hoạt model tùy chỉnh: ${res.model.id}`, type: 'success' });
            return { success: true };
        } else {
            showToast({ message: res.error || 'Không thể thêm model tùy chỉnh.', type: 'warning' });
            return { success: false, error: res.error };
        }
    }, [handleSaveModel, showToast]);

    const handleRemoveCustomModel = useCallback((modelId: string) => {
        const updated = removeCustomModel(modelId);
        setCustomModels(updated);
        if (normalizeModelId(selectedModel) === normalizeModelId(modelId)) {
            handleSaveModel(DEFAULT_MODEL_ID);
        }
        showToast({ message: `Đã xóa model tùy chỉnh: ${modelId}`, type: 'info' });
    }, [selectedModel, handleSaveModel, showToast]);

    const handleClearDiscoveredModels = useCallback(() => {
        clearDiscoveredModels();
        setDiscoveredModels([]);
        showToast({ message: 'Đã xóa bộ nhớ đệm model khám phá từ API Key.', type: 'info' });
    }, [showToast]);

    const handleAddApiKey = useCallback(() => {
        setApiKeys(prev => [...prev, '']);
    }, []);

    const handleUpdateKeyIndex = useCallback((index: number, val: string) => {
        setApiKeys(prev => {
            const updated = [...prev];
            updated[index] = val;
            return updated;
        });
    }, []);

    const handleDeleteKeyIndex = useCallback((index: number) => {
        setApiKeys(prev => prev.filter((_, idx) => idx !== index));
    }, []);

    const handleImportClipboardKeys = useCallback(async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (!text) return;
            const keys = text
                .split(/[\n,;]+/)
                .map(k => k.trim())
                .filter(k => k.length > 5);
            if (keys.length > 0) {
                setApiKeys(prev => {
                    const updated = [...prev, ...keys];
                    return Array.from(new Set(updated));
                });
                showToast({ message: `Đã nhận diện thành công và nhập sỉ ${keys.length} API Keys!`, type: 'success' });
            } else {
                showToast({ message: "Không tìm thấy dòng khóa hợp lệ trong clipboard.", type: 'warning' });
            }
        } catch (_) {
            showToast({ message: "Lỗi truy xuất bộ nhớ Clipboard của trình duyệt. Bạn có thể tự dán thủ công.", type: 'error' });
        }
    }, [showToast]);

    return {
        apiKeys,
        selectedModel,
        availableModels,
        discoveredModels,
        customModels,
        showApiSettings,
        setShowApiSettings,
        handleSaveModel,
        registerDiscoveredModels: handleRegisterDiscoveredModels,
        addCustomModel: handleAddCustomModel,
        removeCustomModel: handleRemoveCustomModel,
        clearDiscoveredModels: handleClearDiscoveredModels,
        handleAddApiKey,
        handleUpdateKeyIndex,
        handleDeleteKeyIndex,
        handleImportClipboardKeys,
        warningParagraphMismatch,
        setWarningParagraphMismatch,
        enableAiQaCritique,
        setEnableAiQaCritique,
        enableSegmentTranslation,
        setEnableSegmentTranslation
    };
}
