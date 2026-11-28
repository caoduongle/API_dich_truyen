import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { DEFAULT_MODEL_ID } from '../config/models';
import type { ModelInfoItem } from '../types/quota';
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
import { migrateCustomLimits } from '../utils/customLimitsStorage';
import { OPENAI_COMPATIBLE_PRESETS } from '../config/aiProviders';
import type { AIProviderMode, OpenAICompatibleConfig, OpenAICompatiblePresetId } from '../types/aiProvider';
import {
  getIncludePinnedGlossaryPreference,
  getStoredAIProviderConfig,
  loadOpenAIApiKeys,
  saveOpenAIApiKeys,
  saveStoredAIProviderConfig,
  setIncludePinnedGlossaryPreference,
} from '../utils/aiProviderStorage';


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
                const keys = parsed.filter((k): k is string => typeof k === 'string' && k.trim().length > 0);
                if (keys.length > 0) {
                    migrateCustomLimits(keys);
                    return keys;
                }
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
                    migrateCustomLimits(cleanKeys);
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

    // 3. Kiểm tra persisted keys trong app_ui_prefs (khi user bật rememberKeys)
    try {
        const prefsRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('app_ui_prefs') : null;
        if (prefsRaw) {
            const prefs = JSON.parse(prefsRaw);
            if (prefs && prefs.rememberKeys === false) {
                // Nếu rememberKeys = false mà có savedKeys / savedOpenAIKeys còn sót lại -> scrub ngay lập tức
                const hasStaleGemini = Array.isArray(prefs.savedKeys) && prefs.savedKeys.length > 0;
                const hasStaleOpenAI = Array.isArray(prefs.savedOpenAIKeys) && prefs.savedOpenAIKeys.length > 0;
                if (hasStaleGemini || hasStaleOpenAI) {
                    prefs.savedKeys = [];
                    prefs.savedOpenAIKeys = [];
                    try {
                        localStorage.setItem('app_ui_prefs', JSON.stringify(prefs));
                    } catch (_) {}
                }
            } else if (prefs && prefs.rememberKeys === true && Array.isArray(prefs.savedKeys)) {
                const clean = prefs.savedKeys.filter((k: any): k is string => typeof k === 'string' && k.trim().length > 0);
                if (clean.length > 0) {
                    try {
                        if (typeof sessionStorage !== 'undefined') {
                            sessionStorage.setItem('gemini_api_keys', JSON.stringify(clean));
                        }
                    } catch (_) {}
                    migrateCustomLimits(clean);
                    return clean;
                }
            }
        }
    } catch (_) {}

    return [];
}

export function useAIConfig() {
    const { showToast } = useNotifications();
    const [apiKeys, setApiKeys] = useState<string[]>(() => migrateAndLoadApiKeys());
    const [rememberKeys, setRememberKeys] = useState<boolean>(() => {
        try {
            const prefsRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('app_ui_prefs') : null;
            if (prefsRaw) {
                const prefs = JSON.parse(prefsRaw);
                return prefs?.rememberKeys === true;
            }
        } catch (_) {}
        return false;
    });

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

    const [enableAutoTargetedRepair, setEnableAutoTargetedRepair] = useState<boolean>(() => {
        try {
            return localStorage.getItem('enable_auto_targeted_repair') === 'true';
        } catch {
            return false;
        }
    });

    const [enableSegmentTranslation, setEnableSegmentTranslation] = useState<boolean>(() => {
        const stored = localStorage.getItem('enable_segment_translation');
        return stored === 'true';
    });

    const [providerMode, setProviderModeState] = useState<AIProviderMode>(
        () => getStoredAIProviderConfig().providerMode
    );
    const [openAIConfig, setOpenAIConfigState] = useState<OpenAICompatibleConfig>(() => {
        const stored = getStoredAIProviderConfig();
        return {
            presetId: stored.presetId,
            baseUrl: stored.baseUrl,
            model: stored.model,
        };
    });
    const [openAIApiKeys, setOpenAIApiKeys] = useState<string[]>(() => loadOpenAIApiKeys());
    const [includePinnedGlossary, setIncludePinnedGlossaryState] = useState<boolean>(() =>
        getIncludePinnedGlossaryPreference()
    );

    // Sync apiKeys + openAIApiKeys atomically to sessionStorage and optionally app_ui_prefs
    useEffect(() => {
        try {
            const cleanKeys = apiKeys.filter(k => typeof k === 'string' && k.trim().length > 0);
            const cleanOpenAIKeys = openAIApiKeys.filter(k => typeof k === 'string' && k.trim().length > 0);
            if (typeof sessionStorage !== 'undefined') {
                if (cleanKeys.length > 0) {
                    sessionStorage.setItem('gemini_api_keys', JSON.stringify(cleanKeys));
                } else {
                    sessionStorage.removeItem('gemini_api_keys');
                }
            }
            if (typeof localStorage !== 'undefined') {
                const currentPrefs = JSON.parse(localStorage.getItem('app_ui_prefs') || '{}');
                const updatedPrefs = {
                    ...currentPrefs,
                    rememberKeys,
                    savedKeys: rememberKeys ? cleanKeys : [],
                    savedOpenAIKeys: rememberKeys ? cleanOpenAIKeys : [],
                };
                localStorage.setItem('app_ui_prefs', JSON.stringify(updatedPrefs));
            }
            saveOpenAIApiKeys(cleanOpenAIKeys, rememberKeys);
        } catch (_) {}
    }, [apiKeys, openAIApiKeys, rememberKeys]);

    useEffect(() => {
        saveStoredAIProviderConfig({
            providerMode,
            ...openAIConfig,
        });
    }, [providerMode, openAIConfig]);

    useEffect(() => {
        setIncludePinnedGlossaryPreference(includePinnedGlossary);
    }, [includePinnedGlossary]);

    useEffect(() => {
        localStorage.setItem('warning_paragraph_mismatch', String(warningParagraphMismatch));
    }, [warningParagraphMismatch]);

    useEffect(() => {
        localStorage.setItem('enable_ai_qa_critique', String(enableAiQaCritique));
    }, [enableAiQaCritique]);

    useEffect(() => {
        try {
            localStorage.setItem('enable_auto_targeted_repair', String(enableAutoTargetedRepair));
        } catch {}
    }, [enableAutoTargetedRepair]);

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
            if (prev[index] === val) return prev;
            const updated = [...prev];
            updated[index] = val;
            return updated;
        });
    }, []);

    const handleBatchUpdateKeys = useCallback((newKeys: string[]) => {
        setApiKeys(prev => {
            if (prev.length === newKeys.length && prev.every((k, i) => k === newKeys[i])) {
                return prev;
            }
            return newKeys;
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

    const setProviderMode = useCallback((mode: AIProviderMode) => {
        setProviderModeState(mode);
    }, []);

    const updateOpenAIConfig = useCallback((patch: Partial<OpenAICompatibleConfig>) => {
        setOpenAIConfigState(prev => ({
            ...prev,
            ...patch,
        }));
    }, []);

    const selectOpenAIPreset = useCallback((presetId: OpenAICompatiblePresetId) => {
        const preset = OPENAI_COMPATIBLE_PRESETS[presetId];
        setOpenAIConfigState(prev => ({
            presetId,
            baseUrl: preset.id === 'custom' ? prev.baseUrl : preset.baseUrl,
            model: preset.id === 'custom' ? prev.model : preset.defaultModel,
        }));
    }, []);

    const addOpenAIKey = useCallback(() => {
        setOpenAIApiKeys(prev => [...prev, '']);
    }, []);

    const updateOpenAIKey = useCallback((index: number, value: string) => {
        setOpenAIApiKeys(prev => {
            if (prev[index] === value) return prev;
            const next = [...prev];
            next[index] = value;
            return next;
        });
    }, []);

    const deleteOpenAIKey = useCallback((index: number) => {
        setOpenAIApiKeys(prev => prev.filter((_, idx) => idx !== index));
    }, []);

    const setIncludePinnedGlossary = useCallback((enabled: boolean) => {
        setIncludePinnedGlossaryState(Boolean(enabled));
    }, []);

    return {
        apiKeys,
        rememberKeys,
        setRememberKeys,
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
        handleBatchUpdateKeys,
        handleDeleteKeyIndex,
        handleImportClipboardKeys,
        warningParagraphMismatch,
        setWarningParagraphMismatch,
        enableAiQaCritique,
        setEnableAiQaCritique,
        enableAutoTargetedRepair,
        setEnableAutoTargetedRepair,
        enableSegmentTranslation,
        setEnableSegmentTranslation,
        providerMode,
        setProviderMode,
        openAIConfig,
        updateOpenAIConfig,
        selectOpenAIPreset,
        openAIApiKeys,
        addOpenAIKey,
        updateOpenAIKey,
        deleteOpenAIKey,
        includePinnedGlossary,
        setIncludePinnedGlossary,
    };
}
