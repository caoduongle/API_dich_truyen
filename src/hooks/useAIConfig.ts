import { useState } from 'react';

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

    const handleSaveModel = (model: string) => {
        setSelectedModel(model);
        localStorage.setItem('gemini_selected_model', model);
    };

    const handleAddApiKey = () => {
        const updated = [...apiKeys, ''];
        setApiKeys(updated);
        localStorage.setItem('gemini_api_keys', JSON.stringify(updated));
    };

    const handleUpdateKeyIndex = (index: number, val: string) => {
        const updated = [...apiKeys];
        updated[index] = val;
        setApiKeys(updated);
        localStorage.setItem('gemini_api_keys', JSON.stringify(updated));
    };

    const handleDeleteKeyIndex = (index: number) => {
        const updated = apiKeys.filter((_, idx) => idx !== index);
        setApiKeys(updated);
        localStorage.setItem('gemini_api_keys', JSON.stringify(updated));
    };

    const handleImportClipboardKeys = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (!text) return;
            const keys = text
                .split(/[\n,;]+/)
                .map(k => k.trim())
                .filter(k => k.length > 5);
            if (keys.length > 0) {
                const updated = [...apiKeys, ...keys];
                const uniqueKeys = Array.from(new Set(updated));
                setApiKeys(uniqueKeys);
                localStorage.setItem('gemini_api_keys', JSON.stringify(uniqueKeys));
                alert(`Đã nhận diện thành công và nhập sỉ ${keys.length} API Keys!`);
            } else {
                alert("Không tìm thấy dòng khóa hợp lệ trong clipboard.");
            }
        } catch (_) {
            alert("Lỗi truy xuất bộ nhớ Clipboard của trình duyệt. Bạn có thể tự dán thủ công.");
        }
    };

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
