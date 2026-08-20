# Tasks: Verify Project ID (Xác Nhận projectId Thay Vì Tin Tuyệt Đối)

**Branch**: `048-verify-project-id` | **Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/048-verify-project-id/spec.md) | **Plan**: [plan.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/048-verify-project-id/plan.md)

---

## Phase 1: Setup & Data Contracts

**Purpose**: Định nghĩa các kiểu dữ liệu `ProjectBindingSource`, `ProjectVerificationStatus`, `ProjectMetadata` trong `shared/models.ts`.

- [x] T001 Cập nhật `shared/models.ts` bổ sung `ProjectBindingSource`, `ProjectVerificationStatus`, `ProjectMetadata`, và trường `projectMetadata` trong `QuotaGroup`, `QuotaGroupConfigInput`

---

## Phase 2: Foundational Architecture (Project Verification Services)

**Purpose**: Cập nhật logic gán metadata nguồn gốc và cài đặt phương thức xác thực dự án trong `quotaService.ts`.

- [x] T002 Cập nhật `server/services/quotaService.ts` để tự động gán và truy vết `projectMetadata` trong `registerQuotaGroup`, `ensureKeyGroup`
- [x] T003 Cài đặt phương thức `verifyGroupProject` và `areKeysInSameVerifiedBucket` trong `server/services/quotaService.ts` để thực thi ngữ nghĩa an toàn của Scheduler

**Checkpoint**: QuotaGroup metadata và logic xác thực dự án đã sẵn sàng — các User Stories có thể bắt đầu tích hợp kiểm thử.

---

## Phase 3: User Story 1 & 2 - Project Verification Tests (Priority: P1) 🎯 MVP

**Goal**: Đảm bảo 4 kịch bản kiểm thử cốt lõi phản ánh chính xác nguồn gốc và trạng thái xác minh của dự án, bảo đảm Scheduler không tự ý suy diễn Provider Quota Bucket.

**Independent Test**: Chạy 4 test scenarios trong `projectVerification.test.ts` $\to$ 100% pass.

### Tests for User Story 1 & 2

- [x] T004 [P] [US1] Tạo file test `server/services/__tests__/projectVerification.test.ts` và viết 4 ca kiểm thử: `same declared project`, `different declared project`, `provider verified project`, `unknown project`
- [x] T005 [US2] Đồng bộ hóa các unit tests hiện hữu (`quotaService.test.ts`, `quotaAuthority.test.ts`, `QuotaGroupsPanel.test.ts`) để tương thích với `projectMetadata`

**Checkpoint**: User Story 1 & 2 hoàn thành — Ngữ nghĩa nguồn gốc dự án và an toàn Scheduler được chứng minh qua test.

---

## Phase 4: User Story 3 - API & Consumer Harmonization (Priority: P1) 🎯 MVP

**Goal**: Đảm bảo API `/api/quota/groups` và các consumers nhận diện đúng `projectMetadata` mà không gây breaking changes.

- [x] T006 [US3] Rà soát `server/controllers/quotaController.ts` để đảm bảo API `/api/quota/groups` trả về đầy đủ `projectMetadata`

**Checkpoint**: User Story 3 hoàn thành — Toàn hệ thống đồng bộ chuẩn tắc.

---

## Phase 5: Polish & Quality Gates (Constitution Non-Negotiable)

**Purpose**: Cập nhật tài liệu kỹ thuật, rà soát type safety và chạy toàn diện các Quality Gates theo Hiến pháp.

- [x] T007 [P] Cập nhật tài liệu kiến trúc trong `docs/quota-and-scheduling.md` (mục Project ID Verification & Quota Bucket Semantics)
- [x] T008 Kiểm tra Type Safety không có lỗi với `npm run lint` (`tsc --noEmit`)
- [x] T009 Chạy toàn bộ test suite và đảm bảo pass 100% với `npm test` (`vitest run`)
- [x] T010 Kiểm tra đóng gói build production thành công với `npm run build`
- [x] T011 Thực hiện kiểm định xác thực 4 ca kiểm thử theo `specs/048-verify-project-id/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Không có phụ thuộc — bắt đầu ngay.
- **Phase 2 (Foundational)**: Phụ thuộc vào Phase 1 — CHẶN toàn bộ User Stories.
- **Phase 3 (User Story 1 & 2 - P1 MVP)**: Phụ thuộc vào Phase 2.
- **Phase 4 (User Story 3 - P1 MVP)**: Phụ thuộc vào Phase 3.
- **Phase 5 (Polish & Quality Gates)**: Phụ thuộc vào toàn bộ các Phase trước.

```mermaid
graph TD
    P1[Phase 1: Setup] --> P2[Phase 2: Foundational Project Verification Services]
    P2 --> US1[Phase 3: User Story 1 & 2 - Project Verification Tests]
    US1 --> US3[Phase 4: User Story 3 - API Harmonization]
    US3 --> P5[Phase 5: Polish & Quality Gates]
```

---

## Parallel Execution Opportunities

- **Trong Phase 3**: Viết test suite `T004` có thể chuẩn bị song song với việc đồng bộ `T005`.
- **Trong Phase 5**: Cập nhật tài liệu `T007` có thể thực hiện song song với việc kiểm tra lints.

---

## Implementation Strategy

### MVP Scope (User Story 1, 2, 3)
1. Hoàn thành Phase 1 (Setup) và Phase 2 (Foundational).
2. Triển khai Phase 3 (US1 & US2) và Phase 4 (US3).
3. **STOP & VALIDATE**: Chạy toàn bộ 4 bài test kịch bản trong `projectVerification.test.ts` để chứng minh MVP hoạt động chuẩn xác 100%.

### Quality Delivery
4. Hoàn tất Phase 5 (Quality Gates: lint, test, build).
