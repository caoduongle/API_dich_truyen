# Tasks: Sửa Lỗi Kiểu Dữ Liệu Vite Esbuild Drop (116-fix-vite-esbuild-drop)

**Feature**: `116-fix-vite-esbuild-drop`  
**Input**: Design documents from `specs/116-fix-vite-esbuild-drop/`  
**Status**: Completed  

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Kiểm tra môi trường và trạng thái không gian làm việc

- [x] T001 Kiểm tra trạng thái git working tree và các package cần thiết trong `package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Rà soát cấu hình Vite và xác thực vị trí dòng sinh lỗi TS2769

- [x] T002 Rà soát vị trí thuộc tính `esbuild.drop` tại dòng 15-17 trong `vite.config.ts`

---

## Phase 3: User Story 1 - Khắc Phục Lỗi Kiểu Dữ Liệu Type Check (Priority: P1) 🎯 MVP

**Goal**: Loại bỏ lỗi `TS2769: No overload matches this call` trên `vite.config.ts` khi chạy `npm run lint`.

**Independent Test**: Chạy `npm run lint` (`tsc --noEmit`), lệnh thoát với mã `0` và không còn thông báo lỗi overload nào.

### Implementation for User Story 1

- [x] T003 [US1] Cập nhật thuộc tính `esbuild.drop` với ép kiểu an toàn `(['console', 'debugger'] as ('console' | 'debugger')[])` trong `vite.config.ts`
- [x] T004 [US1] Thực thi và kiểm chứng lệnh `npm run lint` trên toàn bộ dự án

---

## Phase 4: User Story 2 - Kiểm Chứng Đóng Gói Production & Bộ Kiểm Thử (Priority: P2)

**Goal**: Đảm bảo lệnh `npm run build` và `npm test` hoạt động ổn định và giữ nguyên tính năng loại bỏ log/debugger trong production.

**Independent Test**: Chạy `npm run build` và `npm test`; 100% test suites và build steps đều pass.

### Implementation for User Story 2

- [x] T005 [US2] Thực thi lệnh `npm run build` để kiểm chứng tiến trình đóng gói production trong `dist/`
- [x] T006 [US2] Thực thi bộ kiểm thử `npm test` để đảm bảo không phát sinh bất kỳ hồi quy nào

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Hoàn thiện tài liệu và kiểm chứng theo hướng dẫn toàn trình

- [x] T007 Kiểm chứng các kịch bản trong `specs/116-fix-vite-esbuild-drop/quickstart.md`
- [x] T008 Đánh dấu hoàn tất toàn bộ các task trong `specs/116-fix-vite-esbuild-drop/tasks.md`

---

## Dependencies & Execution Order

- **Phase 1 (Setup)** -> **Phase 2 (Foundational)** -> **Phase 3 (User Story 1)** -> **Phase 4 (User Story 2)** -> **Phase 5 (Polish)**
- US1 giải quyết trực tiếp lỗi biên dịch kiểu dữ liệu `TS2769`.
- US2 đảm bảo quy trình CI/CD và chất lượng sản phẩm không bị ảnh hưởng.
