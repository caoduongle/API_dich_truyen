# Tasks: Sửa Lỗi CI/CD (Windows Path Handling & Build-Before-Test Ordering)

**Feature Branch**: `089-fix-ci-failures`  
**Input**: [`specs/089-fix-ci-failures/spec.md`](./spec.md), [`specs/089-fix-ci-failures/plan.md`](./plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Thiết lập ngữ cảnh và rà soát các tệp cấu hình kiểm thử của dự án

- [ ] T001 Verify project prerequisites and inspect existing CI workflow and test suites in .github/workflows/ci.yml

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Thẩm định hành vi khử trùng đường dẫn tệp tin trên môi trường runtime

- [ ] T002 Inspect and validate current path sanitization behavior across environments in server/utils/fileValidation.ts

---

## Phase 3: User Story 1 - Khử Trùng Đường Dẫn Tệp Tin Nhất Quán Trên Đa Nền Tảng (Priority: P1) 🎯 MVP

**Goal**: Đảm bảo hàm `sanitizeFilename` tách và khử trùng đúng tên tệp đối với cả định dạng đường dẫn Windows (`\`) và Unix/POSIX (`/`) trên cả runner Linux và Windows dev.

**Independent Test**: Chạy `npx vitest run server/utils/__tests__/fileValidation.test.ts`, xác nhận 7/7 bài kiểm thử đều pass.

### Implementation for User Story 1

- [ ] T003 [P] [US1] Add test case for Windows directory traversal path handling in server/utils/__tests__/fileValidation.test.ts
- [ ] T004 [US1] Implement path normalization replacing backslashes with forward slashes in server/utils/fileValidation.ts
- [ ] T005 [US1] Execute unit test suite for file validation in server/utils/__tests__/fileValidation.test.ts

**Checkpoint**: Hàm `sanitizeFilename` an toàn tuyệt đối với directory traversal trên tất cả hệ điều hành.

---

## Phase 4: User Story 2 - Đảm Bảo Thứ Tự Build Trước Test Trong Quy Trình CI (Priority: P2)

**Goal**: Cập nhật workflow `.github/workflows/ci.yml` để bước `Build` chạy trước `Run tests`, cung cấp đầy đủ `dist/client` cho các bài kiểm thử verification.

**Independent Test**: Kiểm tra tệp workflow và chạy `npm run build` rồi chạy `server/__tests__/quickstartVerification.test.ts`, xác nhận 5/5 scenario pass.

### Implementation for User Story 2

- [ ] T006 [US2] Reorder workflow steps placing Build before Run tests in .github/workflows/ci.yml
- [ ] T007 [US2] Execute quickstart verification test suite against dist/client in server/__tests__/quickstartVerification.test.ts

**Checkpoint**: CI workflow đảm bảo tính sẵn sàng của tài nguyên tĩnh trước khi chạy test suites.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Đảm bảo chất lượng toàn diện theo Hiến pháp dự án và đồng bộ mã nguồn lên Git remote

- [ ] T008 [P] Run TypeScript type checking with npm run lint
- [ ] T009 Execute full production build with npm run build
- [ ] T010 Run complete automated test suite with npx vitest run ensuring 803/803 tests pass
- [ ] T011 Commit modified files and push to remote repository on branch main

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Bắt đầu ngay, không có phụ thuộc.
- **Foundational (Phase 2)**: Phụ thuộc Phase 1.
- **User Story 1 (Phase 3)**: Phụ thuộc Phase 2 (MVP).
- **User Story 2 (Phase 4)**: Có thể thực hiện song song hoặc nối tiếp sau US1.
- **Polish (Phase 5)**: Phụ thuộc vào việc hoàn thành User Story 1 và User Story 2.

### Parallel Opportunities

- T003 và T008 có thể chạy song song độc lập.
- US1 (sửa đổi mã nguồn server) và US2 (sửa đổi cấu hình CI workflow) tác động lên các tệp tin hoàn toàn độc lập (`server/utils/fileValidation.ts` vs `.github/workflows/ci.yml`).

---

## Implementation Strategy

### MVP First (User Story 1)
1. Hoàn tất T001 - T005.
2. Xác minh độc lập `fileValidation.test.ts` (7/7 pass).
3. Triển khai User Story 2 (T006 - T007).
4. Xác minh toàn diện toàn bộ 803 bài test và build production (T008 - T011).
