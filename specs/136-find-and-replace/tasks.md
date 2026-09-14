# Tasks: Tìm và Thay Thế Văn Bản Trong Bàn Dịch (136-find-and-replace)

**Feature**: `136-find-and-replace`  
**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md), [research.md](./research.md), [contracts/find-and-replace.contract.ts](./contracts/find-and-replace.contract.ts)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Thiết lập các kiểu dữ liệu và cấu trúc hợp đồng dùng chung cho tính năng tìm kiếm và thay thế.

- [x] T001 Khai báo interface `MatchLocation`, `ReplaceAllResult`, và `FindReplaceModalProps` trong `src/types/textSearch.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Xây dựng bộ tiện ích thuật toán tìm kiếm và thay thế văn bản an toàn, hiệu năng cao trước khi tích hợp vào giao diện.

**⚠️ CRITICAL**: Các User Story bên dưới phụ thuộc hoàn toàn vào tính chính xác của thuật toán trong `textSearch.ts`.

- [x] T002 [P] Xây dựng bộ hàm thuần túy `findMatchesInText`, `replaceSingleMatch`, `replaceAllMatches`, `getNextMatchIndex`, `getPrevMatchIndex` (thoát ký tự Regex an toàn, hỗ trợ cờ `g`/`gi`, thay thế một lượt tránh lặp vô hạn) trong `src/utils/textSearch.ts`
- [x] T003 [P] Viết bộ unit tests cho các thuật toán tìm kiếm và thay thế chuỗi trong `src/utils/__tests__/textSearch.test.ts`

**Checkpoint**: Nền tảng thuật toán sẵn sàng - có thể tiến hành xây dựng giao diện và tích hợp luồng tương tác.

---

## Phase 3: User Story 1 - Tìm Kiếm & Điều Hướng Kết Quả (Priority: P1) 🎯 MVP

**Goal**: Người dùng mở hộp thoại, nhập từ khóa tìm kiếm, hệ thống hiển thị số lượng kết quả (ví dụ "1/5") và hỗ trợ bấm "Trước" / "Sau" để cuộn đến và bôi đen từng vị trí theo cơ chế vòng tròn (wrap-around).

**Independent Test**: Mở một chương trong Bàn Dịch, nhập từ khóa xuất hiện nhiều lần, bấm "Sau" để cuộn qua từng vị trí và tự động quay vòng lại vị trí đầu tiên.

### Tests for User Story 1
- [x] T004 [P] [US1] Viết unit tests cho component `FindReplaceModal` (kiểm tra render các trường nhập, bộ đếm kết quả thời gian thực, kích hoạt sự kiện Trước/Sau) trong `src/components/translator-workspace/__tests__/FindReplaceModal.test.tsx`

### Implementation for User Story 1
- [x] T005 [US1] Xây dựng component `FindReplaceModal.tsx` với giao diện chuẩn "Mực & Chu Sa" (`bg-ink`, viền `border-parchment-2`, ô tìm kiếm, ô thay thế, nút `^ Trước`, `v Sau`, `Đóng`, bộ đếm kết quả) trong `src/components/translator-workspace/FindReplaceModal.tsx`
- [x] T006 [US1] Tích hợp cơ chế điều khiển textarea DOM: cuộn mượt có khoảng đệm an toàn 2 dòng trên, kích hoạt `setSelectionRange(start, end)` và `focus()` khi người dùng chuyển vị trí kết quả trong `src/components/translator-workspace/FindReplaceModal.tsx`

**Checkpoint**: User Story 1 hoàn tất độc lập - tính năng tìm kiếm và duyệt kết quả hoạt động mượt mà.

---

## Phase 4: User Story 2 - Thay Thế Đơn Lẻ & Thay Thế Tất Cả Hàng Loạt (Priority: P1) 🎯 MVP

**Goal**: Cho phép người dùng bấm "Thay thế" để đổi từ ngữ tại vị trí hiện tại và nhảy tới kết quả tiếp theo, hoặc bấm "Thay tất cả" để đổi đồng loạt toàn bộ các vị trí trong chương chỉ với 1 cú nhấp chuột kèm thông báo phản hồi.

**Independent Test**: Nhập từ tìm kiếm và từ thay thế, bấm "Thay tất cả", xác minh văn bản được cập nhật đồng loạt và thông báo toast hiển thị "Đã thay thế X vị trí".

### Implementation for User Story 2
- [x] T007 [US2] Triển khai logic nút "Thay thế" (cắt ghép chuỗi an toàn tại vị trí đang chọn, gọi `onTextChange`, tính lại danh sách kết quả và bôi đen vị trí tiếp theo) trong `src/components/translator-workspace/FindReplaceModal.tsx`
- [x] T008 [US2] Triển khai logic nút "Thay tất cả" (gọi `replaceAllMatches`, cập nhật `onTextChange`, hiển thị thông báo toast thành công qua `useNotifications`) trong `src/components/translator-workspace/FindReplaceModal.tsx`

**Checkpoint**: MVP cốt lõi hoàn thành - người dùng có thể thay thế từng từ hoặc thay thế hàng loạt toàn bộ chương.

---

## Phase 5: User Story 3 - Phân Biệt Chữ Hoa/Thường & Phím Tắt Thao Tác Nhanh (Priority: P2)

**Goal**: Checkbox "Phân biệt chữ hoa/thường" cập nhật kết quả tìm kiếm tức thì; tích hợp phím tắt `Ctrl+H` / `Ctrl+F` mở nhanh hộp thoại, `Esc` đóng nhanh; tự động điền sẵn văn bản đang bôi đen vào ô tìm kiếm; thêm nút bấm trên thanh công cụ soạn thảo.

**Independent Test**: Bôi đen một từ trong ô soạn thảo, nhấn `Ctrl+H` thấy hộp thoại mở ra với từ đó điền sẵn; tích chọn checkbox phân biệt hoa/thường thấy kết quả lọc chính xác theo chữ hoa.

### Implementation for User Story 3
- [x] T009 [US3] Tích hợp checkbox "Phân biệt chữ hoa/thường" (`matchCase`) cập nhật danh sách kết quả theo thời gian thực trong `src/components/translator-workspace/FindReplaceModal.tsx`
- [x] T010 [US3] Tích hợp phím tắt `Ctrl+H` và nút biểu tượng "Tìm & Thay thế" trên thanh công cụ của cả 2 phân vùng Dịch thô (`raw`) và Biên tập (`polished`) trong `src/components/translator-workspace/BilingualEditor.tsx`
- [x] T011 [US3] Tự động trích xuất chuỗi văn bản đang được bôi chọn trong textarea (`selectionStart` đến `selectionEnd`) truyền vào làm `initialSearchTerm` khi mở hộp thoại trong `src/components/translator-workspace/BilingualEditor.tsx`

**Checkpoint**: Trải nghiệm người dùng hoàn thiện tối đa, thao tác bàn phím liền mạch và an toàn.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Đảm bảo tuân thủ nghiêm ngặt 5 nguyên tắc hiến pháp dự án.

- [x] T012 [P] Chạy kiểm tra cú pháp và kiểu tĩnh `npm run lint` (`tsc --noEmit`)
- [x] T013 [P] Chạy toàn bộ bộ kiểm thử tự động `npm test` (`vitest run`)
- [x] T014 Chạy kiểm tra đóng gói sản phẩm `npm run build` (`tsc && vite build`)
- [x] T015 Xác thực thủ công luồng kiểm thử theo kịch bản trong `specs/136-find-and-replace/quickstart.md`

---

## Dependencies & Execution Order

```text
Phase 1: Setup (T001)
       │
       ▼
Phase 2: Foundational (T002, T003)
       │
       ▼
Phase 3: US1 Search & Navigate (T004 -> T005 -> T006)
       │
       ▼
Phase 4: US2 Replace & Replace All (T007 -> T008)
       │
       ▼
Phase 5: US3 Case-Sensitive & Hotkeys (T009 -> T010 -> T011)
       │
       ▼
Phase 6: Polish & Verification (T012, T013, T014, T015)
```

---

## Parallel Execution Opportunities

- **Trong Phase 2**: T002 (`textSearch.ts`) và T003 (`textSearch.test.ts`) có thể tiến hành song song theo mô hình TDD.
- **Trong Phase 3**: T004 (`FindReplaceModal.test.tsx`) có thể viết trước song song với việc định hình khung T005 (`FindReplaceModal.tsx`).
- **Trong Phase 6**: T012 (`npm run lint`) và T013 (`npm test`) có thể chạy song song.

---

## Implementation Strategy

### MVP First (Phát hành cốt lõi trước)
1. Hoàn thành Phase 1 & Phase 2 (Thuật toán tìm kiếm & thay thế chuỗi an toàn).
2. Hoàn thành Phase 3 & Phase 4 (Giao diện hộp thoại + Thay thế từng từ & Thay thế tất cả).
3. Kiểm thử độc lập: Mở hộp thoại -> Nhập từ tìm kiếm và từ thay thế -> Bấm "Thay tất cả" -> Toàn bộ các từ trong chương được thay đổi chuẩn xác.

### Incremental Delivery (Giao hàng tăng tiến)
1. **Giai đoạn 1**: Tìm kiếm & Điều hướng vòng tròn (User Story 1).
2. **Giai đoạn 2**: Thay thế đơn lẻ và Thay thế hàng loạt (User Story 2).
3. **Giai đoạn 3**: Phân biệt chữ hoa/thường, phím tắt `Ctrl+H` và điền sẵn vùng chọn (User Story 3).
4. **Giai đoạn 4**: Kiểm thử toàn diện và nghiệm thu theo hiến pháp.
