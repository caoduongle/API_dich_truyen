# Tasks: Quota & Usage Tracking Dashboard

**Feature**: `004-quota-usage-dashboard`
**Spec**: [specs/004-quota-usage-dashboard/spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/004-quota-usage-dashboard/spec.md)
**Plan**: [specs/004-quota-usage-dashboard/plan.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/004-quota-usage-dashboard/plan.md)

---

## Phase 1: Setup (Shared Interfaces & Types)

**Purpose**: Định nghĩa cấu trúc dữ liệu và interfaces cho toàn bộ hệ thống theo dõi hạn ngạch

- [x] T001 Setup Quota TypeScript types & interfaces in `server/services/quotaService.ts`
- [x] T002 [P] Setup client-side Quota interfaces in `src/utils/apiClient.ts`

---

## Phase 2: Foundational (Core In-Memory Quota Service & Tests)

**Purpose**: Xây dựng service theo dõi hạn ngạch in-memory và bộ kiểm thử Vitest cơ sở

- [x] T003 Implement `hashApiKey`, `maskApiKey`, and timezone normalization (`America/Los_Angeles`) in `server/services/quotaService.ts`
- [x] T004 Implement `recordUsage`, rolling minute bucket, and `getQuotaSnapshot` in `server/services/quotaService.ts`
- [x] T005 [P] Create comprehensive Vitest unit test suite in `server/services/__tests__/quotaService.test.ts`

---

## Phase 3: User Story 1 - Giám sát mức sử dụng và hạn ngạch API Key theo thời gian thực (Priority: P1) 🎯 MVP

**Goal**: Ghi nhận toàn bộ lượt gọi AI theo key/model, hỗ trợ snapshot an toàn qua API không lộ raw key.
**Independent Test**: Gửi request qua `geminiService`, gọi `/api/quota-status` xác nhận `requestsTotal`, `requestsToday` (múi giờ PST), `requestsThisMinute`, `errorsTotal` tăng chính xác và raw key được băm/masking.

### Implementation for User Story 1
- [x] T006 [US1] Integrate `quotaService.recordUsage` into all execution branches (`success`, `overloaded`, `quota_exceeded`, `safety`, `error`) in `server/services/geminiService.ts`
- [x] T007 [P] [US1] Create controller handler `getQuotaStatusHandler` in `server/controllers/quotaController.ts`
- [x] T008 [US1] Register `POST /api/quota-status` wrapped with `resolveApiKeysMiddleware` in `server/routes/api.ts`
- [x] T009 [P] [US1] Implement `fetchQuotaStatus()` in `src/utils/apiClient.ts`

**Checkpoint**: User Story 1 hoàn thành độc lập, ghi nhận và cung cấp snapshot quota an toàn.

---

## Phase 4: User Story 2 - Theo dõi trạng thái ngắt mạch bảo vệ và đếm ngược thời gian phục hồi (Priority: P1) 🎯 MVP

**Goal**: Đọc trạng thái circuit breaker và cooldown theo từng key để cung cấp đồng hồ đếm ngược phục hồi.
**Independent Test**: Kích hoạt blacklist/cooldown cho 1 key, gọi `/api/quota-status` xác nhận trường `runtime` trả về đúng cờ `isBlacklisted` và số mili-giây còn lại.

### Implementation for User Story 2
- [x] T010 [US2] Export `getKeyRuntimeStatus(key: string)` in `server/services/geminiService.ts` to expose circuit breaker and rate limit cooldown state
- [x] T011 [US2] Map `runtime` status into full quota snapshot in `server/controllers/quotaController.ts`
- [x] T012 [P] [US2] Add unit tests in `server/services/__tests__/geminiService.test.ts` for `getKeyRuntimeStatus`

**Checkpoint**: User Story 2 hoàn thành, runtime state được phản ánh chuẩn xác vào snapshot.

---

## Phase 5: User Story 3 - Kiểm tra danh sách mô hình AI khả dụng cho từng khóa API (Priority: P2)

**Goal**: Truy vấn upstream `models.list` để hiển thị các model hỗ trợ `generateContent` kèm cache 10 phút và timeout 15s.
**Independent Test**: Gửi yêu cầu `POST /api/models-for-key` với index hợp lệ, kiểm tra trả về danh sách model; gọi lại lần 2 xác nhận dữ liệu trả về từ cache; giả lập timeout xác nhận ngắt sau 15s.

### Implementation for User Story 3
- [x] T013 [P] [US3] Create `server/services/modelInfoService.ts` with Google API `models.list` query, 10-minute cache TTL, and 15s `AbortController` timeout
- [x] T014 [P] [US3] Create controller handler `getModelsForKeyHandler` in `server/controllers/quotaController.ts`
- [x] T015 [US3] Register `POST /api/models-for-key` wrapped with `resolveApiKeysMiddleware` in `server/routes/api.ts`
- [x] T016 [P] [US3] Implement `fetchModelsForKey()` helper in `src/utils/apiClient.ts`

**Checkpoint**: User Story 3 hoàn thành, tra cứu model an toàn và tối ưu cache.

---

## Phase 6: User Story 4 - Giao diện Quota Panel đồng bộ phong cách Mực & Chu Sa và cấu hình hạn mức cá nhân (Priority: P2)

**Goal**: Xây dựng UI `QuotaPanel`, tích hợp tab switcher vào `ApiSettings` và hỗ trợ tùy biến hạn mức người dùng.
**Independent Test**: Mở modal Cấu hình AI, chuyển tab Quota, kiểm tra giao diện tuân thủ màu sắc Mực & Chu Sa, đồng hồ đếm ngược tự giảm mỗi giây, và thanh tiến độ hạn mức cá nhân hoạt động mượt mà.

### Implementation for User Story 4
- [x] T017 [US4] Create `src/components/QuotaPanel.tsx` with masked keys, status badges, real-time cooldown countdown timer, usage metrics (RPM, RPD, total, errors), model breakdown, and custom user limits
- [x] T018 [US4] Update `src/components/ApiSettings.tsx` to add tab switcher ("Cấu hình" vs "Quota & Hạn mức") and embed `QuotaPanel`
- [x] T019 [P] [US4] Integrate model capability inspect trigger in `src/components/QuotaPanel.tsx` calling `fetchModelsForKey`

**Checkpoint**: User Story 4 hoàn thành, giao diện trực quan và trải nghiệm người dùng hoàn chỉnh.

---

## Phase 7: Polish & Cross-Cutting Verification

**Purpose**: Chạy toàn bộ các cổng kiểm soát chất lượng (Constitution Quality Gates)

- [x] T020 Run `npm run lint` (`npx tsc --noEmit`) to verify zero TypeScript compilation errors
- [x] T021 Run `npm test` (`npx vitest run`) to verify 100% pass across all unit and integration tests
- [x] T022 Run `npm run build` to verify clean frontend (Vite) and backend (esbuild) bundle generation
- [x] T023 Execute end-to-end manual verification per `specs/004-quota-usage-dashboard/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 - Blocks User Stories.
- **User Story 1 (Phase 3 - P1)**: Depends on Phase 2 - Can execute independently.
- **User Story 2 (Phase 4 - P1)**: Depends on Phase 2 & US1.
- **User Story 3 (Phase 5 - P2)**: Depends on Phase 1 & 2 - Can execute in parallel with US1/US2.
- **User Story 4 (Phase 6 - P2)**: Depends on US1, US2, and US3.
- **Polish (Phase 7)**: Depends on all User Stories complete.

---

## Parallel Execution Examples

### Foundational & Setup Parallel Stream
```bash
# Parallel interface definitions:
Task T001: "Setup Quota TypeScript types in server/services/quotaService.ts"
Task T002: "Setup client-side Quota interfaces in src/utils/apiClient.ts"
```

### User Story 1 & User Story 3 Parallel Streams
```bash
# Parallel backend service development:
Task T007: "Create getQuotaStatusHandler in server/controllers/quotaController.ts"
Task T013: "Create modelInfoService.ts with models.list query and cache"
Task T016: "Implement fetchModelsForKey in src/utils/apiClient.ts"
```

---

## Implementation Strategy

### MVP Scope (User Story 1 + User Story 2)
1. Complete Phase 1 (Setup) & Phase 2 (Foundational In-Memory Service & Vitest Suite).
2. Complete Phase 3 (US1 - Usage Recording & Snapshot Endpoint).
3. Complete Phase 4 (US2 - Runtime Circuit Breaker Status & Countdown).
4. Complete Phase 5 (US3 - Model Info Discovery).
5. Complete Phase 6 (US4 - QuotaPanel UI & Tab Switcher in ApiSettings).
6. Complete Phase 7 (Quality Gates Verification - `tsc`, `vitest`, `build`).
