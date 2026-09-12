# Contract: Key Configuration & Model Discovery Interaction

**Feature**: `118-fix-api-key-config-lag`  
**Date**: 2026-09-12  

---

## 1. Key Input Component Contract (`KeyListSection`)

### Interface Signature

```typescript
export interface KeyListSectionProps {
  apiKeys: string[];
  validKeyCount: number;
  onAddApiKey: () => void;
  onUpdateKeyIndex: (index: number, value: string) => void;
  onDeleteKeyIndex: (index: number) => void;
  onImportClipboardKeys: () => void;
  onBatchUpdateKeys?: (keys: string[]) => void;
  onTestKey?: (index: number, key: string) => Promise<{ success: boolean; message?: string }>;
}
```

### Behavioral Contract

1. **Local Buffering**:
   - The component MUST initialize internal state from `apiKeys`.
   - Modifying an input field updates local state synchronously and renders immediately with zero lag.
   - The component debounces propagation to `onUpdateKeyIndex` or `onBatchUpdateKeys` by 300ms.
   - On blur or paste, changes are flushed immediately.
2. **Clipboard Paste**:
   - Multi-key strings pasted into any field (split by newlines, commas, or semicolons) are parsed, trimmed, and merged into the key list without dropping characters.
3. **Key Testing (Ping)**:
   - When the user clicks the "Kiểm tra" button on a key slot, the component enters `testing` state for that specific key.
   - It performs a lightweight ping with `verifyModelDirect(key, 'gemini-2.5-flash')`.
   - On success: displays a green badge `Đã xác minh`.
   - On failure: displays a red/amber tooltip with the error reason (e.g. `API key không hợp lệ` or `Quota exceeded`).

---

## 2. Model Discovery Guard Contract (`useModelDiscovery`)

### Invariants

1. **No Incomplete Key Probing**:
   - `useModelDiscovery` MUST filter `apiKeys` before attempting to discover models:
     `validKeys = apiKeys.filter(k => typeof k === 'string' && k.trim().length >= 25)`
   - If `validKeys.length === 0`, `refresh` returns immediately without dispatching any network fetch requests.
2. **Stable Key Dependency**:
   - The effect hook MUST NOT re-run on array reference changes if the sanitized key string content has not changed.
3. **Graceful Error Handling**:
   - If `listModelsDirect` fails due to bad keys or network errors, it records the error quietly in cache metadata without clearing existing models or throwing unhandled rejections.

---

## 3. Model Summary Assessment Contract (`computeModelStatsSummary`)

### Invariants

1. **Preset Model Default Availability**:
   - When `totalKeys > 0` and the selected model is an active Preset (`source === 'preset' && status !== 'shutdown'`), `availableKeyCount` MUST equal `totalKeys` if `hasChecked === false`.
   - The card displays `Sẵn sàng sử dụng` (Ready to use) or `Đã xác minh` instead of `Chưa kiểm tra key`.
2. **No False Negative Warning**:
   - The warning banner `Model đang chọn hiện không có API key nào hỗ trợ.` MUST ONLY be shown when:
     `hasChecked === true && availableKeyCount === 0 && modelDef?.source !== 'preset'`
   - It MUST NOT be shown for standard preset models when keys are configured.
