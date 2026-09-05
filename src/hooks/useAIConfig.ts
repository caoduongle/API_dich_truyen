import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNotifications } from '../components/NotificationSystem';
import { DEFAULT_MODEL_ID } from '../constants/models';
import { ModelInfoItem } from '../utils/apiClient';
import { 
  getDiscoveredModels, 
  getCustomModels, 
  getRegisteredModels, 
  saveDiscoveredModels, 
  addCustomModel, 
  removeCustomModel, 
  clearDiscoveredModels, 
  RegisteredModelDef,
  normalizeModelId,
  migrateModelSelection
} from '../utils/modelRegistry';


/**
 * Tải danh sách API key an toàn:
 * 1. Kiểm tra `sessionStorage` (chế độ phiên làm việc tab hiện tại).
 * 2. Nếu chưa có trong `sessionStorage`, kiểm tra `localStorage` (phiên bản cũ).
 * 3. Nếu tìm thấy khóa trong `localStorage`, di chuyển an toàn sang `sessionStorage`
 *    và XÓA BỎ ngay lập tức khỏi `localStorage` để không lưu trữ plaintext vĩnh viễn.
 * 4. Xử lý an toàn khi gặp dữ liệu lỗi/corrupted JSON mà không gây crash ứng dụng.
 */
export function migrateAndLoadApiKeys(): string[] {
    // 1. Kiểm tra sessionStorage
    try {
        const sessionStored = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('gemini_api_keys') : null;
        if (sessionStored) {
            const parsed = JSON.parse(sessionStored);
            if (Array.isArray(parsed)) {
                return parsed.filter((k): k is string => typeof k === 'string' && k.trim().length > 0);
            }
        }
    } catch (_) {
        try {
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.removeItem('gemini_api_keys');
            }
        } catch (_) {}
    }

    // 2. Kiểm tra legacy localStorage
    try {
        const legacyStored = typeof localStorage !== 'undefined' ? localStorage.getItem('gemini_api_keys') : null;
        if (legacyStored) {
            // Xóa ngay lập tức khỏi localStorage để loại bỏ plaintext lưu vĩnh viễn
            localStorage.removeItem('gemini_api_keys');

            const parsed = JSON.parse(legacyStored);
            if (Array.isArray(parsed)) {
                const cleanKeys = parsed.filter((k): k is string => typeof k === 'string' && k.trim().length > 0);
                if (cleanKeys.length > 0) {
                    try {
                        if (typeof sessionStorage !== 'undefined') {
                            sessionStorage.setItem('gemini_api_keys', JSON.stringify(cleanKeys));
                        }
                    } catch (_) {}
                    return cleanKeys;
                }
            }
        }
    } catch (_) {
        // Dữ liệu malformed trong localStorage -> xóa an toàn
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('gemini_api_keys');
            }
        } catch (_) {}
    }

    return [];
}

export function useAIConfig() {
    const { showToast } = useNotifications();
    const [apiKeys, setApiKeys] = useState<string[]>(() => migrateAndLoadApiKeys());

    const [discoveredModels, setDiscoveredModels] = useState<RegisteredModelDef[]>(() => getDiscoveredModels());
    const [customModels, setCustomModels] = useState<RegisteredModelDef[]>(() => getCustomModels());

    const availableModels = useMemo<RegisteredModelDef[]>(() => {
        return getRegisteredModels();
    }, [discoveredModels, customModels]);

    const [selectedModel, setSelectedModel] = useState<string>(() => {
        const stored = localStorage.getItem('gemini_selected_model');
        if (stored) {
            const migration = migrateModelSelection(stored);
            if (migration.wasMigrated) {
                localStorage.setItem('gemini_selected_model', migration.effectiveModelId);
            }
            return migration.effectiveModelId;
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

    // Sync apiKeys to sessionStorage whenever they change (NEVER write to localStorage)
    useEffect(() => {
        try {
            if (typeof sessionStorage !== 'undefined') {
                if (apiKeys.length > 0) {
                    sessionStorage.setItem('gemini_api_keys', JSON.stringify(apiKeys));
                } else {
                    sessionStorage.removeItem('gemini_api_keys');
                }
            }
        } catch (_) {}
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

    const handleAddCustomModel = useCallback((modelId: string, label?: string, verifiedDef?: Partial<RegisteredModelDef>) => {
        const res = addCustomModel(modelId, label, verifiedDef);
        if (res.success && res.model) {
            setCustomModels(getCustomModels());
            if (res.model.verified) {
                handleSaveModel(res.model.id);
                showToast({ message: `Đã xác minh và kích hoạt model tùy chỉnh: ${res.model.id}`, type: 'success' });
            } else {
                showToast({ message: `Đã lưu model tùy chỉnh (chưa xác minh): ${res.model.id}`, type: 'info' });
            }
            return { success: true, model: res.model };
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
