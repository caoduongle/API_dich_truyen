import { useState, useCallback, useEffect } from 'react';
import { useNotifications } from '../components/NotificationSystem';
import { AVAILABLE_MODELS, DEFAULT_MODEL_ID } from '../constants/models';

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

    const [selectedModel, setSelectedModel] = useState<string>(() => {
        const stored = localStorage.getItem('gemini_selected_model');
        // Nếu giá trị đã lưu không nằm trong danh sách model hợp lệ
        // (ví dụ: giá trị cũ 'gemini-3.5-flash' đã bị loại bỏ), tự động
        // fallback về DEFAULT_MODEL_ID để tránh lệch dropdown.
        if (stored && AVAILABLE_MODELS.some(m => m.id === stored)) {
            return stored;
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

    // Sync apiKeys to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('gemini_api_keys', JSON.stringify(apiKeys));
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
                .filter(k => k.length > 5 && k.startsWith('AIza'));
            if (keys.length > 0) {
                setApiKeys(prev => {
                    const updated = [...prev, ...keys];
                    return Array.from(new Set(updated));
                });
                showToast({ message: `Đã nhận diện thành công và nhập sỉ ${keys.length} API Keys!`, type: 'success' });
            } else {
                showToast({ message: "Không tìm thấy dòng khóa hợp lệ (phải bắt đầu bằng AIza) trong clipboard.", type: 'warning' });
            }
        } catch (_) {
            showToast({ message: "Lỗi truy xuất bộ nhớ Clipboard của trình duyệt. Bạn có thể tự dán thủ công.", type: 'error' });
        }
    }, []);

    return {
        apiKeys,
        selectedModel,
        showApiSettings,
        setShowApiSettings,
        handleSaveModel,
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
