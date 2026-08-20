# Data Model & Outbound HTTP Request Specifications

**Feature**: `044-model-discovery-header-auth`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Cấu Trúc Request Header Chuẩn Tắc

```typescript
export interface GoogleApiHeaders {
  'Content-Type': 'application/json';
  'User-Agent': 'aistudio-build';
  'x-goog-api-key': string;
}

export function buildGoogleApiHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'User-Agent': 'aistudio-build',
    'x-goog-api-key': apiKey.trim(),
  };
}
```

---

## 2. Danh Sách Endpoint URL Chuẩn Hóa

```typescript
export const GOOGLE_GENAI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export const GOOGLE_ENDPOINTS = {
  listModels: `${GOOGLE_GENAI_BASE_URL}/models`,
  singleModel: (modelId: string) => `${GOOGLE_GENAI_BASE_URL}/${encodeURIComponent(modelId.startsWith('models/') ? modelId : `models/${modelId}`)}`,
  probeGenerate: (modelId: string) => `${GOOGLE_GENAI_BASE_URL}/${encodeURIComponent(modelId.startsWith('models/') ? modelId : `models/${modelId}`)}:generateContent`,
};
```
