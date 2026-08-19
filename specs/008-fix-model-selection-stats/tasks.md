# Tasks: Sửa Chọn Model & Hiển Thị Thống Kê Request Theo Model

**Feature**: `008-fix-model-selection-stats`  
**Spec**: [specs/008-fix-model-selection-stats/spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/008-fix-model-selection-stats/spec.md)  
**Plan**: [specs/008-fix-model-selection-stats/plan.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/008-fix-model-selection-stats/plan.md)  

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Xác thực môi trường kiểm thử và baseline hiện tại

- [x] T001 [P] Verify baseline test suites and type check readiness via `npm test` and `npm run lint`

---

## Phase 2: Foundational (Model Registry & Observability Logic)

**Purpose**: Xây dựng module tính toán thống kê thuần túy và hook quản lý trạng thái quan sát độc lập với cấu hình

- [x] T002 [P] Implement pure model registry helper functions in `src/utils/modelRegistry.ts` (compute stats summary, per-key model details, model ID normalization)
- [x] T003 [P] Add comprehensive unit tests in `src/utils/__tests__/modelRegistry.test.ts` verifying request totals, RPM, RPD, errors, and availability logic
- [x] T004 [P] Implement `src/hooks/useModelObservability.ts` hook managing quota snapshots and key model inspection cache across tab switches
- [x] T005 [P] Add unit tests in `src/hooks/__tests__/useModelObservability.test.ts` verifying state separation (checking keys does not alter selectedModel, independent key loading)

---

## Phase 3: User Story 1 & 2 - UI & State Integration (Priority: P1) 🎯 MVP

**Goal**: Hiển thị thống kê request cho Model đang chọn ở Tab "Cấu hình AI" và Tab "Quota & Hạn mức", bảo đảm kiểm tra key không làm đổi `selectedModel` và dữ liệu quan sát được duy trì xuyên suốt.  
**Independent Test**: Chọn model, chuyển tab, kiểm tra model trên từng key, xác nhận dropdown model vẫn hoạt động và hiển thị đúng thống kê request của model.

### Implementation for User Story 1 & 2
- [x] T006 [US1/US2] Update `src/components/ApiSettings.tsx` to integrate `useModelObservability`, add compact Model Summary Card beneath model dropdown, and pass shared observability state to `QuotaPanel`
- [x] T007 [US1/US2] Update `src/components/QuotaPanel.tsx` to render Top Overview Banner for current model, show per-key model usage stats & inspected models list, and support independent per-key inspection

**Checkpoint**: User Story 1 & 2 hoàn thành độc lập. Cả 2 tab hiển thị thống kê request theo model chính xác, chọn model hoạt động ổn định 100%.

---

## Phase 4: User Story 3 - Cảnh Báo Trực Quan Model Không Khả Dụng (Priority: P2)

**Goal**: Hiển thị hộp cảnh báo màu hổ phách khi model đang chọn không có key nào hỗ trợ (`availableKeyCount === 0`), không tự ý đổi model ngầm.  
**Independent Test**: Khi tất cả các key được kiểm tra và không có key nào hỗ trợ model đang chọn, xác nhận hiển thị cảnh báo rõ ràng kèm nút kiểm tra lại.

### Implementation for User Story 3
- [x] T008 [US3] Add visual warning alert in `src/components/ApiSettings.tsx` and `src/components/QuotaPanel.tsx` when selected model has 0 available keys among checked keys

**Checkpoint**: User Story 3 hoàn thành. Xử lý trường hợp biên model không khả dụng một cách an toàn, minh bạch.

---

## Phase 5: Polish & Cross-Cutting Verification

**Purpose**: Chạy toàn bộ các cổng kiểm soát chất lượng (Constitution Quality Gates)

- [x] T009 [P] Run `npm run lint` (`tsc --noEmit`) to verify zero TypeScript compilation errors
- [x] T010 Run `npm test` (`vitest run`) to verify 100% pass across all unit and integration test suites
- [x] T011 Run `npm run build` to verify clean frontend (Vite) and backend (esbuild) production bundle generation
