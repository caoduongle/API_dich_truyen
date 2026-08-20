# Data Model & Verification Specifications

**Feature**: `043-model-verification-unknown-not-true`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Cấu Trúc Dữ Liệu TypeScript

### 1.1 Kiểu Năng Lực 3 Trạng Thái (`ModelCapabilityState`)
```typescript
export type ModelCapabilityState = 'supported' | 'unsupported' | 'unknown';
```

### 1.2 Đánh Giá Chi Tiết Năng Lực (`ModelCapabilityEvaluation`)
```typescript
export interface ModelCapabilityEvaluation {
  state: ModelCapabilityState;
  hasGenerateContent: boolean;
  rawMethods: string[];
}
```

### 1.3 Cập Nhật Cấu Trúc `ModelInfo`
```typescript
export interface ModelInfo {
  name: string;
  displayName: string;
  description?: string;
  supportedGenerationMethods?: string[];
  capabilityState?: ModelCapabilityState;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
}
```

---

## 2. Ma Trận Quyết Định Xác Minh

| Dữ Liệu `supportedGenerationMethods` | Trạng Thái Năng Lực | Hành Động Của Service | Trạng Thái Cuối Cùng |
|---|---|---|---|
| Chứa `"generateContent"` | `supported` | Chấp thuận trực tiếp | `verified = true` |
| Mảng không chứa `"generateContent"` (VD: `["embedContent"]`) | `unsupported` | Từ chối trực tiếp (ném lỗi) | `verified = false` |
| `undefined` / `null` / `[]` / Dị tật | `unknown` | Kích hoạt Explicit Probe thăm dò | Theo kết quả probe |
| Probe thành công | `supported` | Đăng ký vào cache | `verified = true` |
| Probe thất bại (400/404/Error) | `unsupported` | Từ chối xác minh (ném lỗi) | `verified = false` |
