# Tasks: Tự Động Cuộn & Bôi Đen Đoạn Lỗi Khi Bấm "Mở Trong Bàn Dịch Để Sửa" (135-open-translator-highlight)

**Feature**: `135-open-translator-highlight`  
**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md), [research.md](./research.md), [contracts/open-in-translator.contract.ts](./contracts/open-in-translator.contract.ts)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Thiết lập các kiểu dữ liệu và hợp đồng giao diện dùng chung cho tính năng deep-link.

- [x] T001 Khai báo interface `HighlightIntent` và cập nhật `OpenInTranslatorOptions` trong `src/types/audit.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Nâng cấp bộ tiện ích tìm kiếm và bôi chọn văn bản trước khi tích hợp luồng giao diện.

**⚠️ CRITICAL**: Các User Story bên dưới phụ thuộc vào thuật toán so khớp bền vững trong `textareaHighlight.ts`.

- [x] T002 [P] Nâng cấp `findSnippetLocationInText` trong `src/utils/textareaHighlight.ts` (chuẩn hóa khoảng trắng liên tiếp `\s+`, lược bỏ dấu ngoặc kép bao ngoài đa dạng, và hỗ trợ so khớp đoạn đầu khi snippet dài)
- [x] T003 [P] Bổ sung unit tests cho thuật toán so khớp mở rộng trong `src/utils/__tests__/textareaHighlight.test.ts`

**Checkpoint**: Nền tảng thuật toán sẵn sàng - có thể tiến hành tích hợp luồng điều phối giao diện.

---

## Phase 3: User Story 1 & User Story 2 - Định Vị, Bôi Đen & Triệt Tiêu Race Condition (Priority: P1) 🎯 MVP

**Goal**: Bấm "Mở trong Bàn Dịch để sửa" từ thẻ lỗi `HakoIssueCard` sẽ mở đúng chương, kiên nhẫn đợi dữ liệu chương nạp xong, tự động kích hoạt phân vùng dịch phù hợp (`polished` hoặc `raw`), cuộn mượt đến câu văn lỗi và bôi đen toàn bộ đoạn trích làm bằng chứng.

**Independent Test**: Mở một chương bất kỳ trong Bàn Dịch -> Sang tab Kiểm Định Hako -> Chọn một thẻ lỗi thuộc chương khác có trích đoạn bằng chứng -> Bấm "Mở trong Bàn Dịch để sửa" -> Chương mới được nạp và câu văn lỗi được bôi đen chính xác trong ô soạn thảo mà không bị lỗi thời gian nạp.

### Tests for User Story 1 & 2
- [x] T004 [P] [US1] Unit test kiểm tra `HakoIssueCard` phát tín hiệu `onOpenInTranslator(chapterId, { snippet, issueId })` trong `src/components/hako-checker/__tests__/HakoIssueReviewPanel.test.tsx`
- [x] T005 [P] [US2] Unit test kiểm tra `BilingualEditor` xử lý `highlightIntent` an toàn khi chương đang được nạp trong `src/components/translator-workspace/__tests__/BilingualEditorHighlight.test.tsx`

### Implementation for User Story 1 & 2
- [x] T006 [US1] Xác minh và đảm bảo nút "Mở trong Bàn Dịch để sửa" trên `HakoIssueCard.tsx` truyền đầy đủ `snippet` và `issueId` trong `src/components/hako-checker/HakoIssueCard.tsx`
- [x] T007 [US2] Quản lý state `pendingHighlightIntent: HighlightIntent | null` và cập nhật handler `handleOpenChapterFromHakoChecker` trong `src/App.tsx`
- [x] T008 [US2] Chuyển tiếp `highlightIntent` và callback `onClearHighlightIntent` qua `src/components/layout/TabContent.tsx` và `src/components/TranslatorWorkspace.tsx`
- [x] T009 [US1] Cập nhật `BilingualEditor.tsx` đồng bộ hóa vòng đời nạp chương: chỉ thực thi bôi chọn khi `currentChapterId === intent.chapterId` và văn bản đã sẵn sàng; tự động chuyển phân vùng `activeStage`, đợi textarea mount trong DOM, thực hiện `scrollAndSelectInTextarea` với khoảng đệm an toàn và giải phóng intent trong `src/components/translator-workspace/BilingualEditor.tsx`

**Checkpoint**: MVP hoàn tất độc lập - tính năng mở và bôi đen hoạt động ổn định 100% không còn lỗi race condition.

---

## Phase 4: User Story 3 & User Story 4 - Phản Hồi Ngữ Cảnh & Đồng Bộ Thẻ Lỗi (Priority: P2 & P3)

**Goal**: Phản hồi trực quan thông qua toast và đồng bộ làm nổi bật thẻ lỗi tương ứng trên bảng thẩm định bên phải (`UnifiedAuditPanel`).

**Independent Test**: Bấm mở sửa từ thẻ lỗi AI QA -> Bàn Dịch mở ra, thẻ lỗi đó trong `UnifiedAuditPanel` bên phải cũng được tự động focus/chọn.

### Tests for User Story 4
- [x] T010 [P] [US4] Unit test kiểm tra `UnifiedAuditPanel` phản ứng với `focusedIssueId` hoặc active issue trong `src/components/translator-workspace/__tests__/UnifiedAuditPanel.test.tsx`

### Implementation for User Story 3 & 4
- [x] T011 [US3] Kiểm tra và hoàn thiện hiển thị thông báo toast phản hồi (thành công hoặc giải thích nhẹ khi câu văn đã được chỉnh sửa) trong `src/components/translator-workspace/BilingualEditor.tsx`
- [x] T012 [US4] Kết nối `intent.issueId` với `focusedIssueIndex` hoặc state chọn lỗi trong `UnifiedAuditPanel.tsx` thông qua `BilingualEditor.tsx`

**Checkpoint**: Trải nghiệm người dùng đạt độ liền mạch tối đa giữa hai màn hình kiểm định và bàn dịch.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Đảm bảo tuân thủ nghiêm ngặt 5 nguyên tắc hiến pháp dự án.

- [x] T013 [P] Chạy kiểm tra cú pháp và kiểu tĩnh `npm run lint` (`tsc --noEmit`)
- [x] T014 [P] Chạy toàn bộ bộ kiểm thử tự động `npm test` (`vitest run`)
- [x] T015 Chạy kiểm tra đóng gói sản phẩm `npm run build` (`tsc && vite build`)
- [x] T016 Xác thực thủ công luồng kiểm thử theo kịch bản trong `specs/135-open-translator-highlight/quickstart.md`

---

## Dependencies & Execution Order

```text
Phase 1: Setup (T001)
       │
       ▼
Phase 2: Foundational (T002, T003)
       │
       ▼
Phase 3: US1 & US2 MVP (T004, T005 -> T006 -> T007 -> T008 -> T009)
       │
       ▼
Phase 4: US3 & US4 Enhancements (T010 -> T011, T012)
       │
       ▼
Phase 5: Polish & Verification (T013, T014, T015, T016)
```

---

## Parallel Execution Opportunities

- **Trong Phase 2**: T002 (`textareaHighlight.ts`) và T003 (`textareaHighlight.test.ts`) có thể tiến hành song song theo mô hình TDD.
- **Trong Phase 3**: T004 và T005 (Unit tests) có thể viết trước song song với việc cập nhật T006 (`HakoIssueCard.tsx`).
- **Trong Phase 5**: T013 (`npm run lint`) và T014 (`npm test`) có thể chạy song song.

---

## Implementation Strategy

### MVP First (Phát hành cốt lõi trước)
1. Hoàn thành Phase 1 & Phase 2.
2. Hoàn thành Phase 3: Nối dây từ `HakoIssueCard` qua `App.tsx` vào `BilingualEditor`.
3. Kiểm thử độc lập: Bấm nút trên thẻ lỗi -> Bàn Dịch mở ra và câu văn được bôi đen chính xác.

### Incremental Delivery (Giao hàng tăng tiến)
1. **Giai đoạn 1**: Loại bỏ race condition và bôi đen câu văn (User Story 1 + 2).
2. **Giai đoạn 2**: Chuẩn hóa trích dẫn phức tạp và phản hồi thông báo (User Story 3).
3. **Giai đoạn 3**: Đồng bộ thẻ lỗi trên UnifiedAuditPanel (User Story 4).
4. **Giai đoạn 4**: Kiểm thử toàn diện và bảo đảm chất lượng hiến pháp.
