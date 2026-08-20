# API & Service Contract: Model Verification Tri-State & Probe

**Feature**: `043-model-verification-unknown-not-true`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Giao Diện Service Trong `modelInfoService.ts`

```typescript
/**
 * Đánh giá trạng thái năng lực tạo nội dung của mô hình từ danh sách phương thức
 */
export function evaluateModelGenerationCapability(
  supportedMethods: unknown
): ModelCapabilityState;

export interface IModelInfoService {
  /**
   * Liệt kê các mô hình đã được xác nhận hỗ trợ generateContent
   */
  listModelsForKey(
    apiKey: string,
    forceRefresh?: boolean
  ): Promise<{ keyHash: string; maskedKey: string; cached: boolean; stale?: boolean; models: ModelInfo[] }>;

  /**
   * Xác minh một mô hình cụ thể (kích hoạt probe nếu trạng thái là unknown)
   */
  verifySingleModel(
    modelId: string,
    apiKey?: string,
    customLabel?: string
  ): Promise<ModelDefinition>;

  /**
   * Thử nghiệm thực tế với prompt tối giản để xác minh mô hình khi metadata là unknown
   */
  probeModelGeneration(
    modelId: string,
    apiKey: string
  ): Promise<boolean>;
}
```

---

## 2. Hợp Đồng API Endpoint: `POST /api/verify-model`

### Thành Công (200 OK)
```json
{
  "success": true,
  "verified": true,
  "model": {
    "id": "gemini-custom-experiment",
    "label": "Gemini Custom Experiment",
    "verified": true,
    "capabilities": {
      "generateContent": true,
      "structuredOutput": true
    }
  },
  "checkedAt": "2026-08-20T11:20:00.000Z"
}
```

### Thất Bại (400 Bad Request)
```json
{
  "success": false,
  "verified": false,
  "error": "Mô hình \"text-embedding-004\" không hỗ trợ phương thức tạo nội dung (generateContent). Không tương thích với quy trình dịch thuật.",
  "errorCode": "UNSUPPORTED_METHODS",
  "checkedAt": "2026-08-20T11:20:00.000Z"
}
```
