# Tasks: Định Vị & Làm Nổi Bật Đoạn Lỗi Khi Mở Bàn Dịch (Jump to Issue & Highlight in Translator)

**Feature**: `131-jump-to-issue-highlight`  
**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md), [research.md](./research.md), [contracts/jump-to-issue.contract.ts](./contracts/jump-to-issue.contract.ts)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Xác minh môi trường kiểm thử cho tiện ích xử lý văn bản và giao diện trước khi triển khai.

- [x] T001 [P] Khởi tạo và xác minh môi trường kiểm thử cho tiện ích bôi chọn trong `src/utils/__tests__/textareaHighlight.test.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Mở rộng các hợp đồng giao diện dữ liệu cho callback điều hướng giữa Kiểm Định Hako và Bàn Dịch.

**⚠️ CRITICAL**: Phải hoàn thành định nghĩa kiểu tham số `options?: { snippet?: string; issueId?: string }` trước khi nối dây các component.

- [x] T002 [P] Khai báo kiểu dữ liệu `OpenInTranslatorOptions` và cập nhật prop `onOpenInTranslator` tại `src/components/hako-checker/HakoIssueCard.tsx`
- [x] T003 [P] Cập nhật interface `HakoIssueReviewPanelProps` và `HakoCheckerWorkspaceProps` để tiếp nhận `options` cho `onOpenInTranslator` trong `src/components/hako-checker/HakoIssueReviewPanel.tsx` và `src/components/hako-checker/HakoCheckerWorkspace.tsx`

**Checkpoint**: Nền tảng hợp đồng sẵn sàng - có thể triển khai song song luồng UI và thuật toán tìm kiếm.

---

## Phase 3: User Story 1 - Mở trực tiếp và bôi chọn đoạn văn bản lỗi từ Thẻ lỗi Kiểm Định Hako (Priority: P1) 🎯 MVP

**Goal**: Bấm "Mở trong Bàn Dịch để sửa" trên thẻ lỗi sẽ nạp chương, tự động chuyển sang stage phù hợp (`polished` hoặc `raw`), cuộn đến vị trí lỗi và bôi chọn câu văn trong textarea.

**Independent Test**: Nhấp nút "Mở trong Bàn Dịch để sửa" trên thẻ lỗi -> Ứng dụng lập tức chuyển sang Bàn Dịch, cuộn đến đoạn lỗi và câu văn được bôi chọn nổi bật.

### Tests for User Story 1
- [x] T004 [P] [US1] Unit test kiểm tra `HakoIssueCard` truyền `vietnameseSnippet` và `issueId` khi bấm "Mở trong Bàn Dịch để sửa" trong `src/components/hako-checker/__tests__/HakoIssueReviewPanel.test.tsx`

### Implementation for User Story 1
- [x] T005 [US1] Cập nhật nút "Mở trong Bàn Dịch để sửa" trên `HakoIssueCard.tsx` gọi `onOpenInTranslator(issue.chapterId, { snippet: issue.vietnameseSnippet, issueId: issue.id })` trong `src/components/hako-checker/HakoIssueCard.tsx`
- [x] T006 [US1] Quản lý state `pendingHighlightSnippet` và cập nhật handler `handleOpenChapterFromHakoChecker` trong `src/App.tsx`
- [x] T007 [US1] Chuyển tiếp prop `pendingHighlightSnippet` và `onClearHighlightSnippet` từ `src/components/layout/TabContent.tsx` vào `src/components/TranslatorWorkspace.tsx`
- [x] T008 [US1] Tiếp nhận `initialHighlightSnippet`, tự động phát hiện phân vùng dịch phù hợp (`activeStage`), thực hiện cuộn và bôi chọn trong `src/components/translator-workspace/BilingualEditor.tsx`

**Checkpoint**: User Story 1 hoàn thành độc lập - người dùng được đưa thẳng tới đoạn lỗi cần sửa.

---

## Phase 4: User Story 2 - Tìm kiếm thông minh khi trích đoạn lỗi có sai khác nhẹ (Priority: P2)

**Goal**: Nâng cấp thuật toán tìm kiếm hỗ trợ lược bỏ dấu ngoặc kép, dấu ba chấm và chuẩn hóa khoảng trắng để tỷ lệ định vị đạt > 95%.

**Independent Test**: Định vị thành công trích đoạn lỗi có chứa dấu ngoặc kép `"..."` hoặc dấu ba chấm `...` khi văn bản trong editor không có dấu này.

### Tests for User Story 2
- [x] T009 [P] [US2] Unit test kiểm tra `scrollAndSelectInTextarea` với dấu ngoặc kép thừa, dấu ba chấm và khoảng trắng lệch trong `src/utils/__tests__/textareaHighlight.test.ts`

### Implementation for User Story 2
- [x] T010 [US2] Cập nhật `scrollAndSelectInTextarea` tích hợp thuật toán chuẩn hóa dấu ngoặc bao ngoài, dấu ba chấm và khoảng trắng liên tiếp trong `src/utils/textareaHighlight.ts`

**Checkpoint**: Khả năng định vị lỗi bền vững trước mọi định dạng trích dẫn từ AI.

---

## Phase 5: User Story 3 - Phản hồi thị giác trực quan và thông báo trạng thái (Priority: P2)

**Goal**: Cung cấp toast phản hồi khi tìm thấy đoạn lỗi hoặc thông báo nhẹ khi câu văn đã được sửa trước đó; đảm bảo dọn dẹp state dùng 1 lần (one-time consumption).

**Independent Test**: Thấy toast xác nhận khi định vị thành công; thấy toast thông báo khi đoạn văn đã bị xóa; không bị cuộn lại ngoài ý muốn khi gõ phím.

### Implementation for User Story 3
- [x] T011 [P] [US3] Thêm phản hồi toast thông báo khi định vị thành công hoặc khi không tìm thấy đoạn văn vi phạm trong `src/components/translator-workspace/BilingualEditor.tsx`
- [x] T012 [US3] Đảm bảo dọn dẹp `initialHighlightSnippet` (one-time consumption) sau khi thực hiện định vị trong `src/components/translator-workspace/BilingualEditor.tsx`

**Checkpoint**: Hoàn thiện toàn bộ trải nghiệm người dùng và tính ổn định.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Đảm bảo tất cả tiêu chuẩn chất lượng nghiêm ngặt của `AGENTS.md` đều vượt qua 100%.

- [x] T013 [P] Chạy toàn bộ bộ kiểm thử tự động `npm test`
- [x] T014 [P] Chạy kiểm tra kiểu tĩnh và cú pháp `npm run lint` (`tsc --noEmit`)
- [x] T015 Chạy kiểm tra đóng gói sản phẩm `npm run build` (`tsc && vite build`)

---

## Dependencies & Execution Order

```text
Phase 1: Setup (T001)
       │
       ▼
Phase 2: Foundational (T002, T003)
       │
       ├─────────────────────────────────────┐
       ▼                                     ▼
Phase 3: US1 Deep-Link & Selection    Phase 4: US2 Smart Normalization
(T004 -> T005 -> T006 -> T007 -> T008)   (T009 -> T010)
       │                                     │
       ├──────────────────┬──────────────────┘
       ▼
Phase 5: US3 Feedback & Cleanup (T011, T012)
       │
       ▼
Phase 6: Polish & Verification (T013, T014, T015)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Hoàn thành Phase 1 & Phase 2.
2. Hoàn thành Phase 3: Kết nối luồng từ `HakoIssueCard` qua `App.tsx` vào `BilingualEditor`.
3. Kiểm tra độc lập: Bấm nút mở -> Bàn Dịch mở ra và bôi chọn câu văn. Đạt ngay giá trị MVP cốt lõi.

### Incremental Delivery
1. US1: Kết nối chuyển tab, cuộn và bôi chọn (MVP).
2. US2: Bổ sung xử lý thông minh cho dấu ngoặc kép và dấu ba chấm.
3. US3: Bổ sung toast phản hồi và dọn dẹp state dùng 1 lần.
4. Polish: Đảm bảo toàn bộ kiểm thử pass 100%.
