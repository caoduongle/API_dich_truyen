# Tasks: Preserve Paragraph Layout in Translation

**Branch**: `002-preserve-paragraph-formatting` | **Date**: 2026-08-18 | **Spec**: [specs/002-preserve-paragraph-formatting/spec.md](spec.md) | **Plan**: [specs/002-preserve-paragraph-formatting/plan.md](plan.md)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Thiết lập môi trường kiểm thử cho các hàm xử lý phân đoạn và tách dòng tiêu đề

- [X] T001 [P] Create test scaffold for paragraph layout and title separation in `src/utils/__tests__/textCleaner.test.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cập nhật các hằng số quy chuẩn dịch thuật và hàm cốt lõi xử lý văn bản

**⚠️ CRITICAL**: Phải hoàn thành trước khi triển khai chi tiết vào các controller dịch

- [X] T002 Update `LITERARY_TRANSLATION_FRAMING` in `server/utils/text.ts` to include strict 1:1 paragraph preservation directives
- [X] T003 Implement `separateChapterTitleAndBody` utility in `server/utils/text.ts` and `src/utils/textCleaner.ts`

**Checkpoint**: Foundation ready - Có thể bắt đầu cập nhật Prompt và Controller dịch

---

## Phase 3: User Story 1 - Bảo tồn 100% cấu trúc phân đoạn khi dịch (Priority: P1) 🎯 MVP

**Goal**: Đảm bảo AI dịch thô (Giai đoạn 1) và Chuốt văn (Giai đoạn 2) giữ nguyên 100% ngắt đoạn của văn bản gốc, không nén các đoạn văn thành một khối chữ duy nhất.

**Independent Test**: Dịch văn bản tiếng Trung gồm 5 đoạn riêng biệt, xác nhận kết quả trả về có đúng 5 đoạn văn tương ứng phân tách bằng `\n\n`.

### Tests for User Story 1
- [X] T004 [P] [US1] Implement unit tests for multi-paragraph formatting and line preservation in `src/utils/__tests__/textCleaner.test.ts`

### Implementation for User Story 1
- [X] T005 [US1] Update `callRawTranslationDirect` and `translateRawWithContentSplit` in `server/controllers/translation/rawController.ts` to enforce paragraph structure and join chunks with `\n\n`
- [X] T006 [US1] Update `callPolishDirect` and `translatePolishWithContentSplit` in `server/controllers/translation/polishController.ts` to enforce paragraph structure and join chunks with `\n\n`

**Checkpoint**: User Story 1 hoàn thành — bản dịch thô và bản chuốt giữ trọn vẹn từng đoạn văn.

---

## Phase 4: User Story 2 & 3 - Tách biệt độc lập tiêu đề chương & Hậu xử lý tự động (Priority: P1 & P2)

**Goal**: Đảm bảo tiêu đề chương luôn đứng riêng trên dòng đầu tiên, không bị nối câu mở đầu vào sau dấu chấm, đồng thời tự động sửa các lỗi dính tiêu đề trước khi lưu vào IndexedDB.

**Independent Test**: Kiểm tra chuỗi `Chương 1: Đài Phát Thanh Kinh Hoàng. Đôi môi đỏ thắm...` được tự động tách thành `Chương 1: Đài Phát Thanh Kinh Hoàng\n\nĐôi môi đỏ thắm...`.

### Tests for User Story 2 & 3
- [X] T007 [P] [US2] Implement unit tests for `separateChapterTitleAndBody` covering all chapter title patterns in `src/utils/__tests__/textCleaner.test.ts`

### Implementation for User Story 2 & 3
- [X] T008 [US2] Integrate `separateChapterTitleAndBody` into `server/controllers/translation/rawController.ts` and `server/controllers/translation/polishController.ts`
- [X] T009 [US3] Integrate `separateChapterTitleAndBody` into `src/services/chapterTranslationService.ts` before saving chapters to IndexedDB

**Checkpoint**: Tiêu đề chương luôn được phân tách độc lập hoàn toàn khỏi thân bài.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Đảm bảo chất lượng toàn diện, type safety và kiểm định production build

- [X] T010 [P] Run TypeScript typecheck `npx tsc --noEmit` to verify type safety
- [X] T011 [P] Run Vitest unit tests `npm run test` across all test files
- [X] T012 Run production build `npm run build` to verify bundle packaging
- [X] T013 Run quickstart validation per `specs/002-preserve-paragraph-formatting/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: Bắt đầu ngay.
- **Foundational (Phase 2)**: Phụ thuộc Phase 1.
- **User Story 1 (Phase 3)**: Phụ thuộc Phase 2 (MVP).
- **User Story 2 & 3 (Phase 4)**: Phụ thuộc Phase 3.
- **Polish (Phase 5)**: Phụ thuộc Phase 3 & 4 hoàn thành.

### Parallel Opportunities
- T001, T004, T007 có thể viết test song song.
- T010 và T011 có thể chạy kiểm định song song.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Hoàn thành Setup & Foundational (T001 -> T003)
2. Hoàn thành Phase 3 (T004 -> T006)
3. Xác minh bản dịch không còn bị nén thành một khối chữ.
4. Mở rộng xử lý tách tiêu đề tự động ở Phase 4 và hoàn thiện kiểm định ở Phase 5.
