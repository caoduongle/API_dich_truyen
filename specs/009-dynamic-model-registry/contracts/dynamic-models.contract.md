# Interface Contract: Dynamic Models & Registry APIs

**Feature**: `009-dynamic-model-registry`  
**Created**: 2026-08-19  

---

## 1. Backend Route Validation Contract (`validateModelMiddleware`)

- **Input**: `req.body.model?: string`
- **Behavior**:
  - Nếu `model` là `undefined`, `null`, hoặc `""`: Cho qua (sử dụng `DEFAULT_MODEL_ID` mặc định).
  - Nếu `model` có giá trị chuỗi:
    - Kiểm tra `isValidModelId(model)`.
    - Nếu không hợp lệ: Trả HTTP 400 kèm JSON `{ error: 'Mô hình AI "${model}" không hợp lệ. Vui lòng kiểm tra lại định dạng.' }`.
    - Nếu hợp lệ: Gọi `next()`.

---

## 2. Frontend Context & Hook Contracts (`AIConfigContext`)

```typescript
export interface AIConfigContextType {
  // Existing props
  apiKeys: string[];
  selectedModel: string;
  showApiSettings: boolean;
  setShowApiSettings: (b: boolean) => void;
  handleSaveModel: (model: string) => void;
  // ... other existing handlers

  // New Dynamic Model Registry props
  availableModels: RegisteredModelDef[];
  discoveredModels: RegisteredModelDef[];
  customModels: RegisteredModelDef[];
  registerDiscoveredModels: (models: ModelInfoItem[]) => void;
  addCustomModel: (modelId: string, label?: string) => boolean;
  removeCustomModel: (modelId: string) => void;
  clearDiscoveredModels: () => void;
}
```
