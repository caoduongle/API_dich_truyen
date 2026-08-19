# Implementation Plan: Lựa Chọn & Đăng Ký Model AI Động (Dynamic Model Selection & Discovery Registry)

**Feature**: `009-dynamic-model-registry`  
**Spec**: [specs/009-dynamic-model-registry/spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/009-dynamic-model-registry/spec.md)  
**Research**: [specs/009-dynamic-model-registry/research.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/009-dynamic-model-registry/research.md)  
**Data Model**: [specs/009-dynamic-model-registry/data-model.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/009-dynamic-model-registry/data-model.md)  
**Contract**: [specs/009-dynamic-model-registry/contracts/dynamic-models.contract.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/009-dynamic-model-registry/contracts/dynamic-models.contract.md)  

---

## 1. Executive Summary

Kế hoạch chuyển đổi hệ thống quản lý Model AI từ danh sách hardcode tĩnh sang cơ chế đăng ký và phát hiện động toàn diện:
1. **Backend Validation Động**: Nâng cấp `validateModelMiddleware` (`server/routes/api.ts`) dùng Regex `/^[a-zA-Z0-9_\-\.\/]{1,128}$/` với cơ chế chống path traversal (`..`) và ký tự điều khiển.
2. **Model Registry Phía Client (`src/utils/modelRegistry.ts`)**: Bổ sung hàm lưu/đọc `gemini_discovered_models` và `gemini_custom_models`, hợp nhất danh sách model `getRegisteredModels()`, và khử trùng lặp thông minh.
3. **State Integration trong Context & Hook (`useAIConfig.ts`, `AIConfigContext.tsx`)**: Quản lý `availableModels`, cung cấp các hàm `registerDiscoveredModels`, `addCustomModel`, `removeCustomModel`.
4. **UI/UX Nâng Cao**:
   - `ApiSettings.tsx`: Dropdown chia nhóm `<optgroup>` (`Mô hình khuyên dùng`, `Mô hình tìm thấy từ API Key`, `Mô hình tự nhập`) và form nhập model tùy chỉnh.
   - `QuotaPanel.tsx`: Tự động nạp model khi kiểm tra key và bổ sung nút "Dùng model này" trên từng model khả dụng.

---

## 2. User Review Required

> [!IMPORTANT]
> - `validateModelMiddleware` trên backend sẽ chấp nhận mọi model hợp lệ theo Regex thay vì danh sách 5 model tĩnh trước đây.
> - Presets mặc định (`gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.0-flash`, `gemini-3.1-flash-lite`, `gemma-4-31b-it`) vẫn được giữ nguyên làm nhóm Khuyên Dùng.

---

## 3. Proposed Changes

### Component 1: Backend Route Validation

#### [MODIFY] [server/routes/api.ts](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/server/routes/api.ts)
- Thay thế whitelist check trong `validateModelMiddleware` bằng `isValidModelId(model)`.
- Trả về HTTP 400 nếu model chứa payload độc hại hoặc sai định dạng.

#### [MODIFY] [server/routes/__tests__/apiValidation.test.ts](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/server/routes/__tests__/apiValidation.test.ts)
- Bổ sung test suites kiểm tra regex model validation (chấp nhận model mới, từ chối path traversal và ký tự điều khiển).

---

### Component 2: Frontend Model Registry Utilities

#### [MODIFY] [src/utils/modelRegistry.ts](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/utils/modelRegistry.ts)
- Thêm các kiểu dữ liệu `RegisteredModelDef`, `ModelSource`.
- Thêm hàm `getRegisteredModels()`, `saveDiscoveredModels(models)`, `addCustomModel(id, label)`, `removeCustomModel(id)`, `isValidModelIdFormat(id)`.
- Cập nhật hàm `getModelDisplayName` để tìm tên hiển thị trong cả Presets, Discovered, và Custom models.

#### [MODIFY] [src/utils/__tests__/modelRegistry.test.ts](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/utils/__tests__/modelRegistry.test.ts)
- Thêm unit tests cho các thao tác lưu, đọc, khử trùng lặp và phân loại model registry.

---

### Component 3: State Management (`useAIConfig` & `AIConfigContext`)

#### [MODIFY] [src/hooks/useAIConfig.ts](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/hooks/useAIConfig.ts)
- Bổ sung state `discoveredModels` và `customModels` (khởi tạo từ localStorage qua `modelRegistry.ts`).
- Cung cấp `availableModels` (danh sách gộp `[...PRESETS, ...discoveredModels, ...customModels]`).
- Cung cấp `registerDiscoveredModels`, `addCustomModel`, `removeCustomModel`.
- Cho phép `selectedModel` nhận bất kỳ model nào có trong `availableModels` hoặc model tùy chỉnh mới thêm.

#### [MODIFY] [src/context/AIConfigContext.tsx](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/context/AIConfigContext.tsx)
- Cập nhật export kiểu `AIConfigContextType`.

---

### Component 4: UI Enhancements (`ApiSettings` & `QuotaPanel`)

#### [MODIFY] [src/components/ApiSettings.tsx](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/components/ApiSettings.tsx)
- Render `<select>` phân nhóm bằng `<optgroup label="...">`.
- Thêm form nhập model tùy chỉnh (+ Nhập model khác) với nút "Thêm & Dùng".
- Cho phép xóa model tùy chỉnh khỏi danh sách.

#### [MODIFY] [src/components/QuotaPanel.tsx](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/components/QuotaPanel.tsx)
- Tự động gọi `registerDiscoveredModels(res.models)` khi `fetchModelsForKey` thành công.
- Trên từng item model trong danh sách khả dụng, thêm nút "Dùng model này" (khi chưa chọn) hoặc Badge "Đang dùng" (khi đang chọn).

#### [MODIFY] [src/components/__tests__/ApiSettingsModelFlow.test.ts](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/components/__tests__/ApiSettingsModelFlow.test.ts)
- Thêm tests cho luồng khám phá model, chọn model động và nhập model tùy chỉnh.

---

## 4. Verification Plan

### Automated Tests
1. `npm run lint` (`tsc --noEmit`) - Kiểm tra type safety.
2. `npm test` (`vitest run`) - Chạy toàn bộ 34+ test suites.
3. `npm run build` - Kiểm tra build Vite và esbuild.

### Manual Verification
- Thực hiện theo kịch bản [quickstart.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/009-dynamic-model-registry/quickstart.md).
