# Tasks: Điều Phối Nhịp Độ Gọi API Động Dựa Trên Quota Cá Nhân (Dynamic Quota-Driven Pacing & Rate Limiting)

**Feature**: `012-dynamic-quota-pacing`  
**Spec**: [specs/012-dynamic-quota-pacing/spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/012-dynamic-quota-pacing/spec.md)  
**Plan**: [specs/012-dynamic-quota-pacing/plan.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/012-dynamic-quota-pacing/plan.md)  

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Xác thực baseline test suites và type check

- [x] T001 [P] Verify baseline test suites and type check readiness via `npm test` and `npm run lint`

---

## Phase 2: Foundational (Pacing Helpers & Backend Dynamic Key Interval)

**Purpose**: Xây dựng thuật toán tính pacing interval và tích hợp header `x-custom-rpm` trên backend

- [x] T002 [P] Update `src/utils/modelRegistry.ts` with `getDynamicPacingInterval`, `isTpmNearLimit`, and `formatPacingSummary` helpers
- [x] T003 [P] Update `src/utils/__tests__/modelRegistry.test.ts` to test dynamic pacing interval calculation across various RPM levels (5, 15, 60, 300) and TPM threshold checks
- [x] T004 [P] Update `server/routes/api.ts` and `server/services/geminiService.ts` to accept `x-custom-rpm` from client and dynamically adjust `keyMinInterval` in `nextAllowedTimeByKey`
- [x] T005 [P] Update `src/utils/apiClient.ts` to attach `x-custom-rpm` header in translation API client requests (`translateRaw`, `polishTranslation`, `qaCritique`, `translateSegmentStream`)

---

## Phase 3: Queue Pacing & TPM Protection (User Story 1 & 2) 🎯 MVP

**Goal**: Hàng đợi dịch tự động áp dụng nhịp độ động và tự động giãn nhịp bảo vệ khi `tokensThisMinute` chạm ngưỡng 85% TPM.  
**Independent Test**: Khởi chạy hàng đợi dịch tự động nhiều chương, xác nhận thời gian trễ giữa các chunk tuân theo RPM cấu hình, và khi giả lập TPM >= 85% thì hàng đợi hiển thị thông báo giãn nhịp.

### Implementation for User Story 1 & 2
- [x] T006 [US1/US2] Update `src/hooks/useAutoTranslationQueue.ts` and `src/hooks/useTranslationProcess.ts` to apply dynamic pacing interval and integrate TPM throttling guard with status notifications

---

## Phase 4: UI Observability (User Story 3)

**Goal**: Hiển thị trực quan tốc độ điều phối trên `ApiSettings.tsx` và `QuotaPanel.tsx` và tự động cập nhật ngay khi chỉnh sửa RPM/TPM.  
**Independent Test**: Mở modal Cấu hình AI & tab Quota, kiểm tra dòng hiển thị nhịp độ ("Tốc độ điều phối: ~X req/phút • ~Y s/lần gọi") cập nhật tức thì khi gõ số RPM mới.

### Implementation for User Story 3
- [x] T007 [US3] Update `src/components/ApiSettings.tsx` and `src/components/QuotaPanel.tsx` to render dynamic pacing summary badges and live speed indicators

---

## Phase 5: Integration Testing & Verification

**Purpose**: Xác thực toàn bộ luồng điều phối nhịp độ động và bảo vệ TPM

- [x] T008 Update `src/components/__tests__/ApiSettingsModelFlow.test.ts` with dynamic pacing and TPM protection scenarios

---

## Phase 6: Polish & Cross-Cutting Verification

**Purpose**: Chạy toàn bộ các cổng kiểm soát chất lượng (Constitution Quality Gates)

- [x] T009 [P] Run `npm run lint` (`tsc --noEmit`) to verify zero TypeScript compilation errors
- [x] T010 Run `npm test` (`vitest run`) to verify 100% pass across all unit and integration test suites
- [x] T011 Run `npm run build` to verify clean frontend (Vite) and backend (esbuild) production bundle generation
