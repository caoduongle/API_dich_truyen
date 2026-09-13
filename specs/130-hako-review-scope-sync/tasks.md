# Tasks: Đồng Bộ Phạm Vi Hiển Thị & Cơ Chế Quyết Định Lỗi Kiểm Định Hako (Hako Review Scope & Decision Sync)

**Feature**: `130-hako-review-scope-sync`  
**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md), [research.md](./research.md), [contracts/review-scope-sync.contract.ts](./contracts/review-scope-sync.contract.ts)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Khởi tạo và xác minh môi trường kiểm thử trước khi tiến hành các thay đổi mã nguồn.

- [ ] T001 [P] Khởi tạo và xác minh môi trường kiểm thử trong `src/services/__tests__/hakoQualityEngine.test.ts` và `src/components/hako-checker/__tests__/HakoIssueReviewPanel.test.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Nâng cấp các định nghĩa hợp đồng và giao diện dữ liệu làm tiền đề cho tất cả user stories.

**⚠️ CRITICAL**: Phải hoàn thành định nghĩa prop `selectedChapterIds` trước khi triển khai các luồng giao diện người dùng.

- [ ] T002 [P] Khai báo prop `selectedChapterIds?: (string | number)[]` trong hợp đồng `HakoIssueReviewPanelProps` tại `src/components/hako-checker/HakoIssueReviewPanel.tsx`

**Checkpoint**: Nền tảng hợp đồng sẵn sàng - có thể triển khai song song các user story.

---

## Phase 3: User Story 1 - Tự động đồng bộ phạm vi lỗi theo danh sách chương đang chọn (Priority: P1) 🎯 MVP

**Goal**: Bảng danh sách lỗi bên dưới tự động lọc và chỉ hiển thị các lỗi thuộc về các chương đang được người dùng tích chọn ở trên, loại bỏ hiện tượng lỗi chương cũ chình ình hiện ra khi đã đổi sang các chương khác.

**Independent Test**: Tích chọn Chương 1 và 2 -> Hiển thị lỗi cả 2 chương; bỏ chọn Chương 2 -> Bảng lỗi bên dưới lập tức chỉ còn hiển thị lỗi của Chương 1.

### Tests for User Story 1
- [ ] T003 [P] [US1] Unit test xác thực `HakoIssueReviewPanel` lọc đúng lỗi theo `selectedChapterIds` ở chế độ `'selected'` và hiển thị toàn bộ ở chế độ `'all'` trong `src/components/hako-checker/__tests__/HakoIssueReviewPanel.test.tsx`

### Implementation for User Story 1
- [ ] T004 [US1] Triển khai bộ lọc phạm vi chương `filterChapterId` với chế độ `'selected'` (mặc định) và `'all'` trong `src/components/hako-checker/HakoIssueReviewPanel.tsx`
- [ ] T005 [US1] Cập nhật dropdown bộ lọc chương hiển thị tùy chọn *"Các chương đang chọn"*, *"Toàn bộ phiên làm việc"*, và danh sách từng chương có lỗi trong `src/components/hako-checker/HakoIssueReviewPanel.tsx`
- [ ] T006 [US1] Truyền prop `selectedChapterIds={session?.selectedChapterIds || []}` vào `HakoIssueReviewPanel` trong `src/components/hako-checker/HakoCheckerWorkspace.tsx`

**Checkpoint**: User Story 1 hoạt động độc lập - loại bỏ triệt để lỗi phạm vi hiển thị.

---

## Phase 4: User Story 2 - Minh bạch hóa vòng đời và phản hồi thị giác 3 nút quyết định (Priority: P1)

**Goal**: Hiển thị rõ rệt trạng thái của 3 nút "Bác bỏ", "Cần xem lại", "Xác nhận lỗi", cho phép người kiểm định chủ động toggle và ghi đè quyết định bất cứ lúc nào.

**Independent Test**: Ấn từng nút quyết định trên thẻ lỗi -> Giao diện phản hồi tức thì với màu sắc active rõ rệt và cập nhật huy hiệu tiêu đề; ấn lại nút active sẽ toggle trở về trạng thái `pending`.

### Tests for User Story 2
- [ ] T007 [P] [US2] Unit test kiểm tra cơ chế toggle quyết định và chú thích tooltip 3 nút trong `src/components/hako-checker/__tests__/HakoIssueReviewPanel.test.tsx`

### Implementation for User Story 2
- [ ] T008 [P] [US2] Thêm cơ chế toggle và phản hồi thị giác active styling cho 3 nút quyết định trong `src/components/hako-checker/HakoIssueCard.tsx`
- [ ] T009 [US2] Bổ sung tooltip chi tiết và cho phép ghi đè quyết định khi lỗi ở trạng thái `resolved` trong `src/components/hako-checker/HakoIssueCard.tsx`

**Checkpoint**: User Stories 1 và 2 đều hoạt động độc lập và trực quan.

---

## Phase 5: User Story 3 - Ngăn chặn tự ý chuyển lỗi sang "Đã giải quyết" khi chưa sửa bản dịch (Priority: P1)

**Goal**: Đảm bảo lỗi đã "Xác nhận lỗi" (`confirmed`) tuyệt đối không bị tự ý chuyển thành "Đã giải quyết" (`resolved`) trừ khi văn bản bản dịch thực sự đã xóa/sửa đoạn trích vi phạm gốc.

**Independent Test**: Quét lại một chương có lỗi đã `confirmed`, nếu văn bản chương chưa sửa thì lỗi vẫn giữ nguyên là `confirmed`.

### Tests for User Story 3
- [ ] T010 [P] [US3] Unit test kiểm tra `reconcileIssuesWithDecisions` không tự ý gán `resolved` khi văn bản tiếng Việt vẫn còn chứa snippet vi phạm trong `src/services/__tests__/hakoQualityEngine.test.ts`

### Implementation for User Story 3
- [ ] T011 [US3] Viết hàm `isSnippetStillPresentInContent` kiểm tra đoạn trích vi phạm trong nội dung chương tại `src/services/hakoQualityEngine.ts`
- [ ] T012 [US3] Nâng cấp hàm `reconcileIssuesWithDecisions` nhận `chaptersContentMap` và bảo toàn trạng thái `confirmed` trong `src/services/hakoQualityEngine.ts`
- [ ] T013 [US3] Truyền `chaptersContentMap` từ JIT chapters vào `reconcileIssuesWithDecisions` trong `src/components/hako-checker/HakoCheckerWorkspace.tsx`

**Checkpoint**: Logic hòa giải lỗi đạt độ tin cậy tuyệt đối, không còn hiện tượng chuyển trạng thái ngoài ý muốn.

---

## Phase 6: User Story 4 - Trải nghiệm lọc trạng thái linh hoạt và hàng đợi xử lý lỗi (Priority: P2)

**Goal**: Cung cấp EmptyState thông minh và nút đặt lại bộ lọc chuẩn xác theo phạm vi chương đang thao tác.

**Independent Test**: Bỏ chọn tất cả chương hoặc chọn chương không có lỗi -> Hiển thị EmptyState thân thiện kèm nút chuyển nhanh xem toàn bộ lỗi của phiên.

### Implementation for User Story 4
- [ ] T014 [P] [US4] Cải tiến EmptyState trong `src/components/hako-checker/HakoIssueReviewPanel.tsx` khi các chương đang chọn không có lỗi hoặc chưa quét
- [ ] T015 [US4] Xử lý nút "Đặt lại bộ lọc" khôi phục chính xác về chế độ `'selected'` và reset tiêu chí lọc trong `src/components/hako-checker/HakoIssueReviewPanel.tsx`

**Checkpoint**: Toàn bộ trải nghiệm lọc lỗi và EmptyState hoàn thiện.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Kiểm tra tổng thể và xác thực chất lượng nghiêm ngặt theo quy định `AGENTS.md`.

- [ ] T016 [P] Chạy toàn bộ bộ kiểm thử tự động `npm test` đảm bảo 100% test pass
- [ ] T017 [P] Chạy kiểm tra kiểu tĩnh và cú pháp `npm run lint` (`tsc --noEmit`)
- [ ] T018 Chạy kiểm tra đóng gói sản phẩm `npm run build` (`tsc && vite build`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Không phụ thuộc - có thể bắt đầu ngay.
- **Foundational (Phase 2)**: Phụ thuộc Phase 1 - CHẶN các user story cần thay đổi giao diện.
- **User Stories (Phase 3+)**: Phụ thuộc Phase 2:
  - User Story 1 (P1) và User Story 3 (P1) có thể tiến hành độc lập hoặc song song.
  - User Story 2 (P1) tiếp nối hoàn thiện giao diện thẻ lỗi sau khi US1 ổn định.
  - User Story 4 (P2) hoàn thiện trải nghiệm EmptyState và reset bộ lọc sau US1.
- **Polish (Phase 7)**: Phụ thuộc toàn bộ các story trước đó.

```text
Phase 1: Setup (T001)
       │
       ▼
Phase 2: Foundational (T002)
       │
       ├─────────────────────────────────────┐
       ▼                                     ▼
Phase 3: US1 Sync Scope (T003-T006)   Phase 5: US3 Guard State (T010-T013)
       │                                     │
       ├──────────────────┬──────────────────┘
       ▼                  ▼
Phase 4: US2 Buttons   Phase 6: US4 EmptyState
(T007-T009)            (T014-T015)
       │                  │
       └──────────────────┴──────────────────┐
                                             ▼
                                      Phase 7: Polish (T016-T018)
```

### User Story Dependencies

- **US1 (P1)**: Bắt đầu ngay sau Phase 2 - Không phụ thuộc các story khác.
- **US2 (P1)**: Hoạt động trên thẻ lỗi độc lập `HakoIssueCard.tsx`.
- **US3 (P1)**: Hoạt động trên tầng service `hakoQualityEngine.ts`, tích hợp tại `HakoCheckerWorkspace.tsx`.
- **US4 (P2)**: Tinh chỉnh EmptyState và nút reset trong `HakoIssueReviewPanel.tsx`.

### Parallel Opportunities

- `T003` (US1 test) và `T010` (US3 test) có thể viết song song.
- `T008` (US2 card styling) và `T011` (US3 text search helper) thực hiện song song vì trên 2 file hoàn toàn khác nhau.
- `T016` (`npm test`) và `T017` (`npm run lint`) có thể chạy độc lập.

---

## Parallel Example: User Story 1 & User Story 3

```bash
# Nhóm 1: Triển khai kiểm thử & service logic cho US3 (Bảo toàn confirmed)
Task: T010 [P] [US3] Unit test trong src/services/__tests__/hakoQualityEngine.test.ts
Task: T011 [US3] Hàm isSnippetStillPresentInContent trong src/services/hakoQualityEngine.ts

# Nhóm 2: Triển khai bộ lọc phạm vi cho US1 (Đồng bộ selected)
Task: T003 [P] [US1] Unit test trong src/components/hako-checker/__tests__/HakoIssueReviewPanel.test.tsx
Task: T004 [US1] Lọc filterChapterId trong src/components/hako-checker/HakoIssueReviewPanel.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Hoàn thành Phase 1 (Setup) & Phase 2 (Foundational).
2. Hoàn thành Phase 3 (User Story 1).
3. **Kiểm tra độc lập**: Chọn đổi chương ở bộ chọn -> Xác nhận danh sách lỗi bên dưới lập tức đồng bộ theo đúng chương được chọn.
4. Đạt MVP giải quyết ngay phàn nàn trực tiếp của người dùng.

### Incremental Delivery
1. Setup + Foundational -> Khung truyền prop sẵn sàng.
2. US1 -> Đồng bộ phạm vi lỗi theo chương đang chọn (MVP).
3. US2 -> Nâng cấp tương tác 3 nút (toggle, active state, tooltip).
4. US3 -> Bảo vệ trạng thái `confirmed` khi quét lại, chặn tự ý đổi `resolved`.
5. US4 -> Tối ưu EmptyState và thao tác đặt lại bộ lọc.
6. Polish -> Vượt qua 100% `lint`, `test`, `build`.

---

## Notes

- Ký hiệu `[P]` chỉ định các tác vụ có thể thực thi song song (khác tệp tin, không phụ thuộc kết quả dở dang).
- Ký hiệu `[USx]` gắn kết chặt chẽ từng tác vụ với User Story tương ứng để dễ dàng theo dõi.
- Tuân thủ nghiêm ngặt 3 quy chuẩn của dự án: không sửa IndexedDB schema, không thêm dependency mới, và giữ nguyên ngôn ngữ tiếng Việt của giao diện.
