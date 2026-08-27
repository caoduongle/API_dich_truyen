# Tasks: Fix CSP Gemini Model Discovery & Pacing Interval Delay

**Feature**: Fix CSP Gemini Model Discovery & Pacing Interval Delay  
**Branch**: `083-fix-csp-pacing-delay` | **Date**: 2026-08-28 | **Spec**: [`specs/083-fix-csp-pacing-delay/spec.md`](./spec.md) | **Plan**: [`specs/083-fix-csp-pacing-delay/plan.md`](./plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Xác minh môi trường và các tập tin mục tiêu trước khi sửa đổi

- [X] T001 Review and verify target files in `server.ts`, `server/__tests__/securityHeaders.test.ts`, `src/components/quota-panel/GroupQuotaCard.tsx`, and `src/services/directGeminiClient.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Chạy baseline test kiểm tra an toàn hệ thống trước khi bắt đầu

- [X] T002 [P] Verify existing security header test suite baseline via `npx vitest run server/__tests__/securityHeaders.test.ts`

**Checkpoint**: Baseline test sẵn sàng - bắt đầu thực hiện các User Story

---

## Phase 3: User Story 1 - Cho phép kết nối trực tiếp đến Gemini API qua CSP trong môi trường Production (Priority: P1) 🎯 MVP

**Goal**: Bổ sung `https://generativelanguage.googleapis.com` và `https://*.googleapis.com` vào chỉ thị `connect-src` trong cấu hình Helmet CSP ở `server.ts`, loại bỏ hoàn toàn lỗi `Failed to fetch` do CSP chặn khi kiểm tra model từ trình duyệt.

**Independent Test**: Chạy `npx vitest run server/__tests__/securityHeaders.test.ts` để xác nhận `connect-src` trong production CSP chứa đầy đủ domain Gemini API.

### Implementation for User Story 1

- [X] T003 [P] [US1] Update `connectSrc` directive in Helmet CSP configuration in `server.ts` to include `https://generativelanguage.googleapis.com` and `https://*.googleapis.com`
- [X] T004 [P] [US1] Update `createTestApp` and test assertions in `server/__tests__/securityHeaders.test.ts` to assert inclusion of `https://generativelanguage.googleapis.com` in `connect-src`

**Checkpoint**: User Story 1 hoàn thành — CSP cho phép gửi request trực tiếp đến Gemini API trong production.

---

## Phase 4: User Story 2 - Chuẩn hóa hiển thị thời gian điều phối không bị số âm (Priority: P1)

**Goal**: Khắc phục lỗi hiển thị số âm (`-4445ms/call`) trên giao diện Quota Panel bằng cách chặn cận dưới $\ge 0$ với `Math.max(0, ...)` và hiển thị nhãn `"Sẵn sàng"` khi thời gian trễ $\le 0$.

**Independent Test**: Kiểm tra logic hiển thị trong `GroupQuotaCard.tsx` và chạy test kiểm định formatting.

### Implementation for User Story 2

- [X] T005 [P] [US2] Update pacing delay and interval rendering logic in `src/components/quota-panel/GroupQuotaCard.tsx` to clamp values with `Math.max(0, ...)` and render `"Sẵn sàng"` when delay is `<= 0`
- [X] T006 [P] [US2] Add unit tests in `src/components/__tests__/ApiSettingsModelFlow.test.ts` verifying non-negative pacing display and `"Sẵn sàng"` label fallback

**Checkpoint**: User Story 2 hoàn thành — Giao diện không bao giờ hiển thị số âm cho nhịp độ điều phối.

---

## Phase 5: User Story 3 - Cải thiện thông báo lỗi và phân loại lỗi kết nối Gemini API / CSP (Priority: P2)

**Goal**: Nâng cấp khả năng bắt lỗi trong `directGeminiClient.ts`, `useModelDiscovery.ts` và các thành phần UI liên quan, chuyển đổi lỗi `TypeError: Failed to fetch` hoặc `SecurityError` thành thông báo hướng dẫn người dùng kiểm tra kết nối mạng hoặc chính sách CSP.

**Independent Test**: Gọi hàm khám phá/kiểm tra model với lỗi mạng giả lập, kiểm tra thông điệp lỗi trả về thân thiện và rõ nghĩa.

### Implementation for User Story 3

- [X] T007 [P] [US3] Update `listModelsDirect`, `callGeminiDirect`, and `verifyModelDirect` in `src/services/directGeminiClient.ts` to catch `Failed to fetch` / `SecurityError` and return friendly message `"Không thể kết nối đến Gemini API (Vui lòng kiểm tra kết nối mạng hoặc chính sách CSP)"`
- [X] T008 [P] [US3] Update error handling in `src/hooks/useModelDiscovery.ts` to handle CSP / network failure gracefully during model discovery and background revalidation
- [X] T009 [P] [US3] Update UI error alert presentation in `src/components/api-settings/KeyListSection.tsx` and `src/components/quota-panel/KeyCardItem.tsx` to display inspection error states clearly

**Checkpoint**: User Story 3 hoàn thành — Thông báo lỗi kết nối Gemini API / CSP rõ ràng, thân thiện với người dùng.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Đảm bảo toàn bộ tiêu chuẩn chất lượng (Quality Gates) của Constitution được thỏa mãn

- [X] T010 [P] Run full TypeScript type check via `npx tsc --noEmit`
- [X] T011 Run full test suite via `npx vitest run`
- [X] T012 Run production build via `npm run build`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Không phụ thuộc — bắt đầu ngay.
- **Foundational (Phase 2)**: Phụ thuộc Phase 1 — chạy baseline test.
- **User Story 1 (Phase 3)**: Phụ thuộc Phase 2 — Có thể chạy song song với US2/US3 nếu chia task.
- **User Story 2 (Phase 4)**: Phụ thuộc Phase 2 — Độc lập với US1.
- **User Story 3 (Phase 5)**: Phụ thuộc Phase 2 & US1.
- **Polish (Phase 6)**: Phụ thuộc vào việc hoàn tất toàn bộ các User Story.

### Parallel Opportunities

- `T003` và `T004` (US1) có thể thực hiện đồng thời hoặc theo cặp code + test.
- `T005` và `T006` (US2) có thể thực hiện song song với `T003`/`T004`.
- `T007`, `T008`, `T009` (US3) thực hiện trên các file client độc lập.
- `T010` (Type check) có thể chạy song song với kiểm tra unit test.

---

## Implementation Strategy

### MVP First (User Story 1 & 2)

1. Hoàn tất Phase 1 & Phase 2.
2. Hoàn tất Phase 3 (US1 - Fix CSP allowlist cho Gemini API).
3. Hoàn tất Phase 4 (US2 - Chuẩn hóa nhịp độ điều phối không âm).
4. Hoàn tất Phase 5 (US3 - Cải thiện thông báo lỗi CSP/Network).
5. Thực thi Phase 6 (Quality Gates: `tsc`, `vitest`, `build`).
