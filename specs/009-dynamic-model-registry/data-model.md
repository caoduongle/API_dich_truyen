# Data Model: Dynamic Model Registry & Discovery Structures

**Feature**: `009-dynamic-model-registry`  
**Created**: 2026-08-19  

---

## 1. Model Registry Data Entities

```typescript
export type ModelSource = 'preset' | 'discovered' | 'custom';

export interface RegisteredModelDef {
  /** ID định danh của model (ví dụ: 'gemini-2.5-flash', 'gemini-exp-1206', 'tunedModels/my-model') */
  id: string;
  /** Tên hiển thị người dùng (tiếng Việt hoặc tên Google API) */
  label: string;
  /** Nguồn gốc của model trong registry */
  source: ModelSource;
  /** Mô tả ngắn nếu có */
  description?: string;
  /** Giới hạn token đầu vào nếu có */
  inputTokenLimit?: number;
  /** Giới hạn token đầu ra nếu có */
  outputTokenLimit?: number;
  /** Thời điểm phát hiện / thêm vào (ISO string) */
  addedAt?: string;
}
```

---

## 2. LocalStorage Persistence Schema

| Storage Key | Type | Description |
|:---|:---|:---|
| `gemini_discovered_models` | `RegisteredModelDef[]` (JSON) | Danh sách các model tự động phát hiện được từ Google `models.list` API sau khi lọc `supportsGenerateContent: true` và khử trùng với Presets |
| `gemini_custom_models` | `RegisteredModelDef[]` (JSON) | Danh sách các model do người dùng tự nhập tay |
| `gemini_selected_model` | `string` | ID của model hiện tại đang được chọn để dịch |

---

## 3. Backend Model Validation Rules

```typescript
export const MODEL_ID_REGEX = /^[a-zA-Z0-9_\-\.\/]{1,128}$/;

export function isValidModelId(model: string): boolean {
  if (typeof model !== 'string') return false;
  const trimmed = model.trim();
  if (!trimmed || trimmed.length > 128) return false;
  if (trimmed.includes('..')) return false; // Prevent path traversal
  if (/[\x00-\x1F\x7F]/.test(trimmed)) return false; // Reject control characters
  return MODEL_ID_REGEX.test(trimmed);
}
```
