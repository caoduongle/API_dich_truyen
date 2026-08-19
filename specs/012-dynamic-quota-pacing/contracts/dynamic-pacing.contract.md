# Interface Contract: Dynamic Pacing & Rate Limiting

**Feature**: `012-dynamic-quota-pacing`  
**Created**: 2026-08-19  

---

## 1. HTTP Translation API Request Contract

- **Headers**:
  - `x-custom-rpm?: string` (ví dụ: `"60"`)
- **Backend Handling (`server/routes/api.ts` & `server/services/geminiService.ts`)**:
  - Đọc `req.headers['x-custom-rpm']` hoặc `req.body.customRpm`.
  - Parse thành số nguyên dương: `const customRpm = parseInt(headerVal, 10) || 0;`.
  - Truyền `customRpm` vào `geminiService.generateWithRotation`.
  - Tính `keyMinInterval = customRpm > 0 ? Math.max(400, Math.ceil(60000 / (customRpm * 0.9))) : 4500`.

---

## 2. Model Registry Helper Functions (`src/utils/modelRegistry.ts`)

```typescript
export function getDynamicPacingInterval(customRpm?: number, modelId?: string): number;
export function isTpmNearLimit(currentTpm: number, maxTpm?: number): boolean;
export function formatPacingSummary(customRpm?: number, modelId?: string): PacingConfig;
```
