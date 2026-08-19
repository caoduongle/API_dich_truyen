# Tasks: Lựa Chọn & Đăng Ký Model AI Động (Dynamic Model Selection & Discovery Registry)

**Feature**: `009-dynamic-model-registry`  
**Spec**: [specs/009-dynamic-model-registry/spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/009-dynamic-model-registry/spec.md)  
**Plan**: [specs/009-dynamic-model-registry/plan.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/009-dynamic-model-registry/plan.md)  

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Xác thực môi trường kiểm thử và baseline hiện tại

- [x] T001 [P] Verify baseline test suites and type check readiness via `npm test` and `npm run lint`

---

## Phase 2: Foundational (Backend Validation & Frontend Model Registry)

**Purpose**: Nâng cấp backend route validation sang Regex an toàn và xây dựng module lưu trữ Model Registry động

- [x] T002 [P] Update `server/routes/api.ts` `validateModelMiddleware` to validate model IDs via safe Regex `/^[a-zA-Z0-9_\-\.\/]{1,128}$/` and reject path traversal (`..`) and control characters
- [x] T003 [P] Add backend validation test cases in `server/routes/__tests__/apiValidation.test.ts` verifying acceptance of dynamic models and rejection of malicious inputs
- [x] T004 [P] Update `src/utils/modelRegistry.ts` with local persistence functions (`getRegisteredModels`, `saveDiscoveredModels`, `addCustomModel`, `removeCustomModel`, `isValidModelIdFormat`, `getModelDisplayName`)
- [x] T005 [P] Add comprehensive unit tests in `src/utils/__tests__/modelRegistry.test.ts` for dynamic registration, deduplication, and custom model management

---

## Phase 3: User Story 1 - Khám Phá & Chọn Nhanh Model Thực Tế Từ API Key (Priority: P1) 🎯 MVP

**Goal**: Khi người dùng bấm "Kiểm tra Model" ở tab Quota, tự động nạp các model khả dụng vào registry và cho phép bấm nút "Dùng model này" để đổi ngay `selectedModel`.  
**Independent Test**: Bấm "Kiểm tra Model" ở một key bất kỳ, tìm một model mới trong danh sách và bấm "Dùng model này", xác nhận `selectedModel` đổi ngay lập tức, xuất hiện badge "Đang dùng", và tab Cấu hình hiển thị đúng model đó.

### Implementation for User Story 1
- [x] T006 [US1] Update `src/hooks/useAIConfig.ts` and `src/context/AIConfigContext.tsx` to manage `discoveredModels`, `customModels`, and `availableModels`, and export registration/mutation handlers
- [x] T007 [US1] Update `src/components/QuotaPanel.tsx` to automatically call `registerDiscoveredModels` upon key inspection and add "Dùng model này" quick action button on each inspected model

**Checkpoint**: User Story 1 hoàn thành độc lập. Model khám phá từ API key có thể chọn dùng ngay lập tức cho dịch thuật.

---

## Phase 4: User Story 2 & 3 - Nhập Tùy Chỉnh Model & Phân Nhóm Dropdown UI (Priority: P1/P2) 🎯 MVP

**Goal**: Cho phép người dùng nhập model tùy chỉnh (`tunedModels/...` hoặc preview) và hiển thị dropdown chọn model phân nhóm `<optgroup>` rõ ràng.  
**Independent Test**: Mở tab Cấu hình AI, nhập một model tùy chỉnh mới, bấm thêm và xác nhận model xuất hiện trong nhóm "Mô hình tự nhập (Custom)" và được chọn làm model hiện tại.

### Implementation for User Story 2 & 3
- [x] T008 [US2/US3] Update `src/components/ApiSettings.tsx` to render `<select>` grouped by `<optgroup>` (Presets, Discovered, Custom) and add custom model input form with add/remove actions

**Checkpoint**: User Story 2 & 3 hoàn thành. Dropdown phân nhóm đẹp mắt, hỗ trợ thêm/xóa model tùy chỉnh.

---

## Phase 5: Integration Testing & Verification

**Purpose**: Đảm bảo luồng khám phá, chọn nhanh và nhập model tùy chỉnh được kiểm thử toàn diện

- [x] T009 Update `src/components/__tests__/ApiSettingsModelFlow.test.ts` to test dynamic discovery, quick apply, and custom model creation flows

---

## Phase 6: Polish & Cross-Cutting Verification

**Purpose**: Chạy toàn bộ các cổng kiểm soát chất lượng (Constitution Quality Gates)

- [x] T010 [P] Run `npm run lint` (`tsc --noEmit`) to verify zero TypeScript compilation errors
- [x] T011 Run `npm test` (`vitest run`) to verify 100% pass across all unit and integration test suites
- [x] T012 Run `npm run build` to verify clean frontend (Vite) and backend (esbuild) production bundle generation
