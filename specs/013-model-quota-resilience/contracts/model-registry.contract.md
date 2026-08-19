# Interface Contract: Model Registry & Lifecycle Validation

**Contract ID**: `model-registry-contract-v1`  
**Feature**: `013-model-quota-resilience`  

---

## 1. Shared Types Contract (`@shared/models`)

```typescript
export type ModelSource = 'preset' | 'discovered' | 'custom';
export type ModelStatus = 'active' | 'deprecated' | 'shutdown';

export interface ModelCapabilities {
  generateContent: boolean;
  structuredOutput?: boolean;
  vision?: boolean;
  thinking?: boolean;
}

export interface ModelDefinition {
  id: string;
  label: string;
  source: ModelSource;
  status: ModelStatus;
  capabilities: ModelCapabilities;
  replacementId?: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
}
```

---

## 2. API Endpoints

### `POST /api/models-for-key`
Tra cứu danh sách model Google API hỗ trợ cho API key.

#### Request Body:
```json
{
  "apiKeys": ["AIzaSy..."],
  "sessionToken": "optional-session-token"
}
```

#### Response (200 OK):
```json
{
  "keyHash": "3f4a8...",
  "maskedKey": "AIzaSy...abcd",
  "cached": true,
  "models": [
    {
      "id": "gemini-2.5-flash",
      "label": "Gemini 2.5 Flash",
      "source": "discovered",
      "status": "active",
      "capabilities": {
        "generateContent": true,
        "vision": true,
        "thinking": true
      },
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 8192
    }
  ]
}
```

---

## 3. Server Validation Contract

Khi nhận request dịch thuật (`/api/translate-raw`, `/api/polish-translation`, `/api/qa-critique`):
1. Đọc trường `model` từ body.
2. Nếu `model` không được truyền: Sử dụng `DEFAULT_MODEL_ID` (`gemini-3.1-flash-lite`).
3. Nếu `model` được truyền:
   - Kiểm tra Regex `/^[a-zA-Z0-9_\-\.\/]{1,128}$/`. Nếu sai: Trả `400 Bad Request`.
   - Kiểm tra model có trong danh mục hợp lệ (Presets hoặc verified cache) và có `capabilities.generateContent === true`.
   - Nếu model bị `shutdown`: Trả `400 Bad Request` kèm gợi ý `replacementId`.
