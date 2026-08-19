# Tasks: Tối Ưu Hóa Hiệu Năng Màn Hình Quota & Hạn Mức (Quota Panel Performance Optimization)

**Feature**: `010-quota-panel-optimization`  
**Spec**: [specs/010-quota-panel-optimization/spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/010-quota-panel-optimization/spec.md)  
**Plan**: [specs/010-quota-panel-optimization/plan.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/010-quota-panel-optimization/plan.md)  

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Xác thực baseline test suites và type check

- [x] T001 [P] Verify baseline test suites and type check readiness via `npm test` and `npm run lint`

---

## Phase 2: Foundational (State & Observability Hook Optimization)

**Purpose**: Tối ưu hóa hook `useModelObservability` và `useAIConfig` để loại bỏ timer toàn cục, thêm 30s cache TTL và chống cascading context re-render

- [x] T002 [P] Update `src/hooks/useModelObservability.ts` to remove global 1s interval ticking and add 30-second TTL cache for `loadQuotaStatus`
- [x] T003 [P] Update `src/hooks/useAIConfig.ts` in `handleRegisterDiscoveredModels` to preserve previous state reference when discovered model IDs have not changed
- [x] T004 [P] Update `src/hooks/__tests__/useModelObservability.test.ts` to verify 30s caching behavior and isolated state updates

---

## Phase 3: User Story 1 & 2 - QuotaPanel Decomposition & Countdown Isolation (Priority: P1) 🎯 MVP

**Goal**: Bóc tách các component con trong `QuotaPanel.tsx` (`CountdownBadge`, `KeyCardItem`, `CustomLimits`), bọc `React.memo` và cô lập timer 1s trong `CountdownBadge`.  
**Independent Test**: Quan sát các thẻ key và badge đếm lùi nhảy giây mà không làm re-render toàn bộ `QuotaPanel` hay `ApiSettings`.

### Implementation for User Story 1 & 2
- [x] T005 [US1] Create isolated `CountdownBadge` component wrapped in `React.memo` inside or alongside `src/components/QuotaPanel.tsx` to handle 1s countdown timer locally
- [x] T006 [US1/US2] Extract `KeyCardItem` and `CustomLimitsRow` into memoized subcomponents in `src/components/QuotaPanel.tsx` with memoized callbacks

**Checkpoint**: User Story 1 & 2 hoàn thành độc lập. Không còn hiện tượng re-render toàn cục mỗi giây hay cascading context update.

---

## Phase 4: Integration Testing & Verification

**Purpose**: Xác thực hoạt động mượt mà và kiểm tra tích hợp toàn bộ các tính năng Quota và Model Selection

- [x] T007 Update `src/components/__tests__/ApiSettingsModelFlow.test.ts` to verify smooth selection and quota interaction flows

---

## Phase 5: Polish & Cross-Cutting Verification

**Purpose**: Chạy toàn bộ các cổng kiểm soát chất lượng (Constitution Quality Gates)

- [x] T008 [P] Run `npm run lint` (`tsc --noEmit`) to verify zero TypeScript compilation errors
- [x] T009 Run `npm test` (`vitest run`) to verify 100% pass across all unit and integration test suites
- [x] T010 Run `npm run build` to verify clean frontend (Vite) and backend (esbuild) production bundle generation
