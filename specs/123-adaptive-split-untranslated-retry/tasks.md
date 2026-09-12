# Tasks: Tự động kích hoạt Adaptive Content Split Retry khi gặp lỗi UNTRANSLATED_CHINESE_LEFTOVER

**Feature**: `123-adaptive-split-untranslated-retry`  
**Date**: 2026-09-12  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Chuẩn bị các interface dữ liệu và callback chẩn đoán cần thiết cho cơ chế phân đoạn thích ứng.

- [X] T001 Define SplitRetryEventInfo interface and extend DirectRawTranslationParams and DirectPolishTranslationParams in src/services/directTranslationEngine.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Xây dựng hàm phân loại lỗi hợp nhất `isAdaptiveSplitRetryableError` làm điều kiện tiên quyết kích hoạt phân đoạn cứu nguy cho mọi giai đoạn.

**⚠️ CRITICAL**: Phải hoàn thành giai đoạn này trước khi triển khai các User Story.

- [X] T002 Implement and export isAdaptiveSplitRetryableError helper in src/services/directTranslationEngine.ts

**Checkpoint**: Nền tảng phân loại lỗi đã sẵn sàng - có thể triển khai User Story 1 và User Story 2.

---

## Phase 3: User Story 1 - Tự động cứu nguy phân đoạn khi dịch thô (GĐ1) bị sót chữ Hán (Priority: P1) 🎯 MVP

**Goal**: Khi kết quả dịch thô GĐ1 vi phạm kiểm định chữ Hán (`UNTRANSLATED_CHINESE_LEFTOVER`), hệ thống tự động chia nhỏ văn bản nguồn thành các phân đoạn thích ứng và dịch lại từng phần độc lập với xoay vòng API key, ghép nối kết quả hoàn chỉnh bảo toàn tiêu đề chương.

**Independent Test**: Chạy unit test giả lập `callGeminiDirect` trả về chữ Hán > 10% trong lần gọi đầu tiên của `translateRawDirect`, xác minh hệ thống tự động phân đoạn, gọi dịch lại thành công và trả về bản dịch thô hoàn thiện không lỗi.

### Tests for User Story 1 🧪
- [X] T003 [P] [US1] Add unit test for translateRawDirect adaptive split retry on UNTRANSLATED_CHINESE_LEFTOVER in src/services/__tests__/directTranslationEngine.test.ts

### Implementation for User Story 1
- [X] T004 [US1] Extract callRawDirectCore and implement recursive rawWithContentSplitDirect with depth limit and staggered keys in src/services/directTranslationEngine.ts
- [X] T005 [US1] Connect onSplitRetry callback to addLog for GĐ1 in src/services/chapterTranslationService.ts

**Checkpoint**: User Story 1 hoàn thành độc lập và có thể kiểm thử đạt MVP.

---

## Phase 4: User Story 2 - Tự động kích hoạt chia nhỏ thích ứng khi chuốt văn (GĐ2) bị sót chữ Hán (Priority: P1)

**Goal**: Khi kết quả chuốt văn phong GĐ2 vi phạm tỉ lệ chữ Hán, hệ thống nhận diện đây là lỗi cứu nguy và kích hoạt chia nhỏ đồng bộ cả văn bản gốc và bản nháp để chuốt lại từng cặp phân đoạn.

**Independent Test**: Chạy unit test giả lập `callPolishDirectCore` ném lỗi `UNTRANSLATED_CHINESE_LEFTOVER`, xác minh `polishWithContentSplitDirect` được kích hoạt thay vì re-throw ra ngoài, chuốt lại các phân đoạn con và hợp nhất bản dịch thành công.

### Tests for User Story 2 🧪
- [X] T006 [P] [US2] Add unit test for polishTranslationDirect adaptive split retry on UNTRANSLATED_CHINESE_LEFTOVER in src/services/__tests__/directTranslationEngine.test.ts

### Implementation for User Story 2
- [X] T007 [US2] Update polishWithContentSplitDirect to use isAdaptiveSplitRetryableError and emit onSplitRetry in src/services/directTranslationEngine.ts
- [X] T008 [US2] Connect onSplitRetry callback to addLog for GĐ2 in src/services/chapterTranslationService.ts

**Checkpoint**: Cả User Story 1 và User Story 2 đều hoạt động độc lập và hoàn thành mục tiêu cứu nguy ở cả hai giai đoạn cốt lõi.

---

## Phase 5: User Story 3 - Bảo vệ tiến trình dịch hàng loạt và xử lý suy biến giới hạn phân đoạn (Priority: P2)

**Goal**: Đảm bảo hàng đợi dịch tự động nhiều chương không bỏ qua chương khi gặp lỗi sót chữ Hán, tự động thực hiện cứu nguy phân đoạn đầy đủ, và chỉ ghi nhận chẩn đoán rõ ràng khi chạm trần độ sâu tối đa (depth = 2).

**Independent Test**: Chạy integration test trên `chapterTranslationService.ts` với kịch bản dịch chương phát sinh lỗi chữ Hán ở GĐ1/GĐ2, xác minh chương được cứu nguy thành công, ghi nhận log đầy đủ và kết thúc ở trạng thái `completed`.

### Tests for User Story 3 🧪
- [X] T009 [P] [US3] Add unit test for chapter translation recovery with UNTRANSLATED_CHINESE_LEFTOVER in src/services/__tests__/chapterTranslationService.test.ts

### Implementation for User Story 3
- [X] T010 [US3] Verify and harden error diagnostics and chapter completion status in src/services/chapterTranslationService.ts

**Checkpoint**: Toàn bộ các User Story đã hoàn tất và được tích hợp trơn tru vào dịch chương đơn cũng như dịch hàng loạt.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Kiểm tra toàn diện hệ thống theo quy định nghiêm ngặt của Hiến pháp dự án.

- [X] T011 Run quickstart.md validation scenarios across directTranslationEngine and chapterTranslationService in src/services/__tests__/
- [X] T012 Verify type check clean with npm run lint
- [X] T013 Verify complete test suite pass with npm test
- [X] T014 Verify production build integrity with npm run build

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Không có phụ thuộc - bắt đầu ngay.
- **Foundational (Phase 2)**: Phụ thuộc Phase 1 - Khóa toàn bộ các User Story cho đến khi xong.
- **User Story 1 (Phase 3)**: Phụ thuộc Phase 2 - Có thể chạy độc lập.
- **User Story 2 (Phase 4)**: Phụ thuộc Phase 2 - Có thể triển khai song song hoặc nối tiếp sau US1.
- **User Story 3 (Phase 5)**: Phụ thuộc Phase 3 và Phase 4 (tích hợp toàn diện vào chapter translation).
- **Polish (Phase 6)**: Phụ thuộc toàn bộ Phase 1 - 5 hoàn tất.

### Within Each User Story

- Viết test kiểm thử trước (TDD) và xác nhận fail nếu chưa cài đặt code.
- Hoàn thiện cài đặt logic chia nhỏ trong `directTranslationEngine.ts`.
- Gắn kết callback nhật ký chẩn đoán trong `chapterTranslationService.ts`.
- Xác nhận test pass trước khi chuyển sang story tiếp theo.

### Parallel Opportunities

- **T003** và **T006**: Có thể viết các test case cho GĐ1 và GĐ2 song song.
- **T004** và **T007**: Sau khi nền tảng T002 hoàn tất, logic phân đoạn GĐ1 và GĐ2 nằm ở các hàm tách biệt trong `directTranslationEngine.ts`.

---

## Parallel Example: User Stories 1 & 2 Tests

```bash
# Viết và chạy song song các test case cho US1 và US2:
Task: "Add unit test for translateRawDirect adaptive split retry on UNTRANSLATED_CHINESE_LEFTOVER in src/services/__tests__/directTranslationEngine.test.ts"
Task: "Add unit test for polishTranslationDirect adaptive split retry on UNTRANSLATED_CHINESE_LEFTOVER in src/services/__tests__/directTranslationEngine.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Hoàn thành Phase 1: Setup (`SplitRetryEventInfo`).
2. Hoàn thành Phase 2: Foundational (`isAdaptiveSplitRetryableError`).
3. Hoàn thành Phase 3: User Story 1 (Cứu nguy phân đoạn GĐ1).
4. **STOP và VALIDATE**: Kiểm tra độc lập GĐ1 với unit test. Bản dịch thô được cứu nguy ngay lập tức, ngăn ngừa 80%+ trường hợp bỏ qua chương.

### Incremental Delivery

1. Phase 1 + Phase 2: Nền tảng phân loại lỗi sẵn sàng.
2. Phase 3 (US1): Dịch thô GĐ1 được trang bị chia nhỏ cứu nguy (MVP).
3. Phase 4 (US2): Chuốt văn GĐ2 được bổ sung chia nhỏ cứu nguy khi lẫn chữ Hán.
4. Phase 5 (US3): Khâu dịch chương hoàn tất bảo vệ tiến trình dịch hàng loạt và nhật ký chẩn đoán.
5. Phase 6: Chạy kiểm tra nghiệm thu toàn bộ theo Hiến pháp dự án (`lint`, `test`, `build`).
