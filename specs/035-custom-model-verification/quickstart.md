# Quickstart: Custom Model Verification & State Governance

**Feature**: `specs/035-custom-model-verification/spec.md`  
**Created**: 2026-08-20  

---

## 1. Prerequisites

- Node.js $\ge 18$
- Running development server (`npm run dev`) or test environment.

---

## 2. Automated Test Execution

Run the complete test suite covering model registry, verification flows, and UI lifecycle:

```bash
# 1. Run Unit Tests for Model Registry
npx vitest run src/utils/__tests__/modelRegistry.test.ts

# 2. Run Backend Verification Service Tests
npx vitest run server/services/__tests__/modelInfoService.test.ts

# 3. Run Controller & API Endpoint Tests
npx vitest run server/controllers/__tests__/quotaController.test.ts

# 4. Run Frontend Flow & Component Tests
npx vitest run src/components/__tests__/ApiSettingsModelFlow.test.ts

# 5. Run Full Repository Test Suite
npm test
```

---

## 3. Manual Verification Scenarios

### Scenario 1: Add a Valid Custom Model
1. Open **Cài đặt API** (`ApiSettings`).
2. Expand the **Thêm mô hình tùy chỉnh** (Add Custom Model) section.
3. Input `tunedModels/my-novel-v1` with a friendly label.
4. Click **Thêm mô hình**.
5. Observe the button state transition: `Đang kiểm tra mô hình...` $\to$ Success toast & model registered as `Verified`.
6. Confirm the model appears in the Custom Models list with a verified checkmark badge.

### Scenario 2: Reject an Invalid Custom Model
1. Input `gemini-nonexistent-model-xyz`.
2. Click **Thêm mô hình**.
3. Observe button state transition: `Đang kiểm tra mô hình...` $\to$ Error alert: `"Mô hình không tồn tại hoặc API Key không có quyền truy cập."`
4. Confirm model is NOT added to the active model selection.

### Scenario 3: Reject Model Missing `generateContent`
1. Input `text-embedding-004`.
2. Click **Thêm mô hình**.
3. Observe Error alert: `"Mô hình không hỗ trợ phương thức tạo nội dung (generateContent). Không thể dùng để dịch thuật."`

### Scenario 4: Re-render Zero-Call Optimization
1. In browser Developer Tools $\to$ Network tab.
2. Open modal Cài đặt API, switch tabs, type in input boxes.
3. Confirm that NO `POST /api/verify-model` network calls are made during re-renders.
