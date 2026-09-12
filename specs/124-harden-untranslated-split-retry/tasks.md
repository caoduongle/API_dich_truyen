# Tasks: Gia cố cơ chế phân đoạn cứu nguy và chống sót chữ Hán cho mô hình Flash-Lite

**Feature**: `124-harden-untranslated-split-retry`  
**Date**: 2026-09-12  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

### Phase 1: Setup (Shared Infrastructure)

**Purpose**: Mở rộng các interface dữ liệu và cờ chẩn đoán cho cơ chế cứu nguy phân cấp đa tầng.

- [X] T001 Update SplitRetryEventInfo with tier property and extend DirectRawTranslationParams with isRetry in src/services/directTranslationEngine.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Nâng cấp prompt engine để tự động bổ sung chỉ thị chống chữ Hán khi retry và tránh lặp kép văn bản đã quét từ điển.

**⚠️ CRITICAL**: Phải hoàn thành giai đoạn này trước khi triển khai các User Story.

- [X] T002 Add prompt reinforcement directive logic for retries and deduplicate vocabulary injection in src/services/ai/prompts.ts

**Checkpoint**: Nền tảng prompt tăng cường đã sẵn sàng.

---

## Phase 3: User Story 1 - Tách biệt phân đoạn độ dài văn bản với độ sâu thử lại và gia cố chỉ thị chống sót chữ Hán (Priority: P1) 🎯 MVP

**Goal**: Đảm bảo các chương dài (> 2000 token) khi chia nhỏ ban đầu không bị tiêu hao cấp độ thử lại, mỗi phân đoạn con luôn bắt đầu với `retryDepth = 0` và có đủ 2 cấp thử lại độc lập kèm prompt gia cố.

**Independent Test**: Chạy unit test giả lập chương dài > 2000 token bị chia đôi, và phân đoạn con gặp `UNTRANSLATED_CHINESE_LEFTOVER`, xác minh hệ thống kích hoạt đầy đủ 2 cấp thử lại với chỉ thị chống chữ Hán và ghép nối thành công.

### Tests for User Story 1 🧪
- [X] T003 [P] [US1] Add unit test for long-text pre-split with independent retryDepth in src/services/__tests__/directTranslationEngine.test.ts

### Implementation for User Story 1
- [X] T004 [US1] Refactor rawWithContentSplitDirect to decouple token pre-split from error retryDepth in src/services/directTranslationEngine.ts

**Checkpoint**: User Story 1 hoàn thành độc lập và có thể kiểm thử đạt MVP.

---

## Phase 4: User Story 2 - Cứu nguy phân cấp đa tầng (Multi-tier Fallback) cho các phân đoạn con ngoan cố (Priority: P1)

**Goal**: Khi một phân đoạn con đạt giới hạn độ sâu phân đoạn (cấp 2) mà vẫn còn sót chữ Hán, hệ thống tự động kích hoạt Tier 2 (dịch phân rã từng dòng) và Tier 3 (phiên âm Hán-Việt cho câu khó) thay vì đánh sập và bỏ qua toàn bộ chương.

**Independent Test**: Chạy unit test giả lập phân đoạn con liên tục vi phạm kiểm định ở cấp 2, xác minh hệ thống kích hoạt Tier 2 (line-by-line fallback) và Tier 3 cứu nguy thành công, không ném lỗi làm hỏng toàn bộ chương.

### Tests for User Story 2 🧪
- [X] T005 [P] [US2] Add unit test for multi-tier fallback (line-by-line & Sino-Vietnamese rescue) in src/services/__tests__/directTranslationEngine.test.ts

### Implementation for User Story 2
- [X] T006 [US2] Implement Tier 2 line-by-line fallback and Tier 3 Sino-Vietnamese rescue in src/services/directTranslationEngine.ts

**Checkpoint**: Cả User Story 1 và User Story 2 đều hoạt động độc lập và hoàn tất bảo vệ phân đoạn con.

---

## Phase 5: User Story 3 - Tối ưu hóa dữ liệu đầu vào và minh bạch nhật ký tiến trình (Priority: P2)

**Goal**: Cập nhật thông điệp nhật ký tiến trình hiển thị chính xác từng tầng cứu nguy (`split`, `line-by-line`, `sino-fallback`) trong bảng nhật ký thời gian thực.

**Independent Test**: Chạy unit test trên `chapterTranslationService.ts` xác minh các thông điệp chẩn đoán theo từng tầng hiển thị chuẩn xác trên nhật ký.

### Tests for User Story 3 🧪
- [X] T007 [P] [US3] Add unit test for multi-tier diagnostic logging in src/services/__tests__/chapterTranslationService.test.ts

### Implementation for User Story 3
- [X] T008 [US3] Update diagnostic log messages with tier metadata in src/services/chapterTranslationService.ts

**Checkpoint**: Toàn bộ các User Story đã hoàn tất và tích hợp hoàn chỉnh.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Kiểm tra toàn diện hệ thống theo quy định nghiêm ngặt của Hiến pháp dự án.

- [X] T009 Run quickstart.md validation scenarios across directTranslationEngine and chapterTranslationService in src/services/__tests__/
- [X] T010 Verify type check clean with npm run lint
- [X] T011 Verify complete test suite pass with npm test
- [X] T012 Verify production build integrity with npm run build

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Bắt đầu ngay lập tức.
- **Foundational (Phase 2)**: Phụ thuộc Phase 1.
- **User Story 1 (Phase 3)**: Phụ thuộc Phase 2.
- **User Story 2 (Phase 4)**: Phụ thuộc Phase 3.
- **User Story 3 (Phase 5)**: Phụ thuộc Phase 4.
- **Polish (Phase 6)**: Phụ thuộc toàn bộ Phase 1 - 5 hoàn tất.

### Parallel Opportunities

- `T003` và `T005`: Viết song song các unit test cho US1 và US2.
- `T007`: Viết test chẩn đoán log song song với logic engine.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Hoàn thành Phase 1 & 2 (`T001`, `T002`).
2. Hoàn thành Phase 3: Tách biệt `retryDepth = 0` khi pre-split văn bản dài (> 2000 token) (`T003`, `T004`).
3. **STOP và VALIDATE**: Ngay lập tức giải quyết được tình huống trong log thực tế của người dùng (`第一卷 — 恐怖广播`).

### Incremental Delivery

1. Thêm Phase 4 (US2): Cứu nguy phân cấp đa tầng (dịch từng dòng & phiên âm Hán-Việt câu khó).
2. Thêm Phase 5 (US3): Nhật ký chi tiết theo từng tier.
3. Hoàn tất Phase 6: Chạy nghiệm thu `lint`, `test`, `build`.
