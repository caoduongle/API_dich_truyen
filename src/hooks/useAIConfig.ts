import { useState, useCallback } from 'react';

export function useAIConfig() {
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
        return localStorage.getItem('gemini_selected_model') || 'gemini-3.5-flash';
    });

    const [showApiSettings, setShowApiSettings] = useState(false);

    const handleSaveModel = useCallback((model: string) => {
        setSelectedModel(model);
        localStorage.setItem('gemini_selected_model', model);
    }, []);

    const handleAddApiKey = useCallback(() => {
        setApiKeys(prev => {
            const updated = [...prev, ''];
            localStorage.setItem('gemini_api_keys', JSON.stringify(updated));
            return updated;
        });
    }, []);

    const handleUpdateKeyIndex = useCallback((index: number, val: string) => {
        setApiKeys(prev => {
            const updated = [...prev];
            updated[index] = val;
            localStorage.setItem('gemini_api_keys', JSON.stringify(updated));
            return updated;
        });
    }, []);

    const handleDeleteKeyIndex = useCallback((index: number) => {
        setApiKeys(prev => {
            const updated = prev.filter((_, idx) => idx !== index);
            localStorage.setItem('gemini_api_keys', JSON.stringify(updated));
            return updated;
        });
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
                    const uniqueKeys = Array.from(new Set(updated));
                    localStorage.setItem('gemini_api_keys', JSON.stringify(uniqueKeys));
                    return uniqueKeys;
                });
                alert(`Đã nhận diện thành công và nhập sỉ ${keys.length} API Keys!`);
            } else {
                alert("Không tìm thấy dòng khóa hợp lệ trong clipboard.");
            }
        } catch (_) {
            alert("Lỗi truy xuất bộ nhớ Clipboard của trình duyệt. Bạn có thể tự dán thủ công.");
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
        handleImportClipboardKeys
    };
}
