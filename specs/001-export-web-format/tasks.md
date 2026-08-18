# Tasks: Web Chapter Export Formatting

**Branch**: `001-export-web-format` | **Date**: 2026-08-18 | **Spec**: [specs/001-export-web-format/spec.md](spec.md) | **Plan**: [specs/001-export-web-format/plan.md](plan.md)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project preparation and test environment setup

- [X] T001 [P] Create test file scaffold for export formatter in `src/utils/__tests__/exportFormatter.test.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data contracts and utility interfaces needed for export formatting

**⚠️ CRITICAL**: Must complete before implementing user story formatting logic

- [X] T002 Define data structures (`FormattedChapterInput`, `WebExportResult`, `ExportMode`) in `src/utils/exportFormatter.ts`

**Checkpoint**: Foundation ready - User story formatting implementation can begin

---

## Phase 3: User Story 1 - Chuẩn hóa định dạng xuất tệp cho Web truyện (Priority: P1) 🎯 MVP

**Goal**: Đảm bảo tệp xuất ra theo định dạng Web luôn có tiền tố `*** [Tên chương]` ở một dòng riêng biệt, theo sau là phần thân nội dung và các chương phân cách nhau bằng `\n\n`.

**Independent Test**: Chạy unit test kiểm tra hàm `formatChapterForWeb` và `buildExportFileContent` với dữ liệu mẫu 2 chương, xác nhận tệp xuất ra có đúng cấu trúc `*** Tên chương 1\nNội dung 1\n\n*** Tên chương 2\nNội dung 2`.

### Tests for User Story 1
- [X] T003 [P] [US1] Implement unit tests for `formatChapterForWeb` in `src/utils/__tests__/exportFormatter.test.ts`
- [X] T004 [P] [US1] Implement unit tests for multi-chapter `buildExportFileContent` in `src/utils/__tests__/exportFormatter.test.ts`

### Implementation for User Story 1
- [X] T005 [US1] Implement `formatChapterForWeb` and `buildExportFileContent` in `src/utils/exportFormatter.ts`
- [X] T006 [US1] Integrate `exportFormatter` into `handleExportTxt` in `src/hooks/useExportFiles.ts`

**Checkpoint**: User Story 1 hoàn thành — định dạng xuất Web cơ bản hoạt động chính xác và độc lập.

---

## Phase 4: User Story 2 - Xử lý tính toàn vẹn và các trường hợp biên của nội dung chương (Priority: P2)

**Goal**: Đảm bảo không thất thoát câu chữ trong nội dung, không nuốt dòng đầu vào tiêu đề và không lặp lại tiêu đề trong phần thân nội dung khi xuất tệp.

**Independent Test**: Chạy unit test với các chương có tiêu đề tiếng Trung (`第1章`), tiêu đề có sẵn `***`, hoặc thân bài có chứa từ "Chương".

### Tests for User Story 2
- [X] T007 [P] [US2] Implement unit tests for edge cases (dấu sao thừa, tiêu đề tiếng Trung, lặp tiêu đề) in `src/utils/__tests__/exportFormatter.test.ts`

### Implementation for User Story 2
- [X] T008 [US2] Enhance regex & title normalization in `src/utils/exportFormatter.ts` to handle all edge cases cleanly

**Checkpoint**: Cả 2 User Stories hoạt động hoàn chỉnh và vượt qua toàn bộ test edge cases.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Đảm bảo chất lượng mã nguồn toàn diện và kiểm định hệ thống

- [X] T009 [P] Run TypeScript typecheck `npx tsc --noEmit` to verify type safety
- [X] T010 [P] Run Vitest unit tests `npx vitest run` across the entire project
- [X] T011 Run production build `npm run build` to verify bundle packaging
- [X] T012 Run quickstart validation per `specs/001-export-web-format/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: Không có phụ thuộc, bắt đầu ngay.
- **Foundational (Phase 2)**: Phụ thuộc Phase 1, chặn Phase 3 & 4.
- **User Story 1 (Phase 3)**: Phụ thuộc Phase 2 (MVP).
- **User Story 2 (Phase 4)**: Phụ thuộc Phase 3.
- **Polish (Phase 5)**: Phụ thuộc Phase 3 & 4 hoàn thành.

### Parallel Opportunities
- T001, T003, T004, T007 có thể viết test song song.
- T009 và T010 có thể chạy kiểm định song song.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Hoàn thành Phase 1 & Phase 2 (Setup & Data Types)
2. Hoàn thành Phase 3 (T003 -> T006)
3. Chạy kiểm thử độc lập cho User Story 1 để xác nhận tính năng xuất Web hoạt động chuẩn dạng `*** Tên chương\nNội dung`.
4. Mở rộng xử lý các trường hợp biên trong Phase 4 và hoàn thiện ở Phase 5.
