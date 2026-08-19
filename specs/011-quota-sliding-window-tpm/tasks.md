# Tasks: Đo Lường Hạn Ngạch Thời Gian Thực: RPM, TPM & RPD (Sliding Window Token & Request Quota Observability)

**Feature**: `011-quota-sliding-window-tpm`  
**Spec**: [specs/011-quota-sliding-window-tpm/spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/011-quota-sliding-window-tpm/spec.md)  
**Plan**: [specs/011-quota-sliding-window-tpm/plan.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/011-quota-sliding-window-tpm/plan.md)  

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Xác thực baseline test suites và type check

- [x] T001 [P] Verify baseline test suites and type check readiness via `npm test` and `npm run lint`

---

## Phase 2: Foundational (Backend Sliding Window & Token Tracking)

**Purpose**: Nâng cấp `quotaService.ts` sang Sliding Window Log 60s và tích hợp `usageMetadata` trong `geminiService.ts`

- [x] T002 [P] Update `server/services/quotaService.ts` with 60-second sliding window log (`recentCalls`), token fields (`tokensTotal`, `tokensTodayCount`, `tokensTodayDateKey`), tokenStats in `recordAttempt`, and snapshot aggregation
- [x] T003 [P] Update `server/services/geminiService.ts` in `generateWithRotation` to extract `usageMetadata` from response and pass `tokenStats` to `recordAttempt`
- [x] T004 [P] Update `server/services/__tests__/quotaService.test.ts` to test sliding window calculation, token tracking, PST rollover, and memory pruning

---

## Phase 3: Client Data Models & Registry Utilities

**Purpose**: Đồng bộ interface token metrics trên frontend và mở rộng hàm tổng hợp model stats

- [x] T005 [P] Update `src/utils/apiClient.ts` to add token fields (`tokensTotal`, `tokensToday`, `tokensThisMinute`) in `ModelUsageStats` and `KeyQuotaFullSnapshot`
- [x] T006 [P] Update `src/utils/modelRegistry.ts` to aggregate token metrics in `computeModelStatsSummary` and `getKeyModelStats`, and add `formatTokenCount` helper
- [x] T007 [P] Update `src/utils/__tests__/modelRegistry.test.ts` to test token metrics aggregation and formatting helper

---

## Phase 4: UI Gauges & Custom Limits (User Story 1, 2, 3) 🎯 MVP

**Goal**: Hiển thị các chỉ số TPM trong Banner tổng quan và trên từng thẻ API Key kèm thanh tiến độ trực quan (RPM %, TPM %, RPD %) và cấu hình `maxTpm`.  
**Independent Test**: Mở tab Quota & Hạn mức, xác nhận thấy cột TPM, tiến độ TPM % và ô nhập Giới hạn TPM trong bảng Ngưỡng cá nhân.

### Implementation for User Stories
- [x] T008 [US1/US2/US3] Update `src/components/QuotaPanel.tsx` to support `maxTpm` in `CustomLimit`, add TPM input in `CustomLimitsPanel`, and render TPM metrics & progress gauges on overview banner and `KeyCardItem`

---

## Phase 5: Integration Testing & Verification

**Purpose**: Xác thực luồng đo lường Quota và chọn model với các metrics token mới

- [x] T009 Update `src/components/__tests__/ApiSettingsModelFlow.test.ts` with token stats verification

---

## Phase 6: Polish & Cross-Cutting Verification

**Purpose**: Chạy toàn bộ các cổng kiểm soát chất lượng (Constitution Quality Gates)

- [x] T010 [P] Run `npm run lint` (`tsc --noEmit`) to verify zero TypeScript compilation errors
- [x] T011 Run `npm test` (`vitest run`) to verify 100% pass across all unit and integration test suites
- [x] T012 Run `npm run build` to verify clean frontend (Vite) and backend (esbuild) production bundle generation
