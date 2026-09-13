# Tasks: Khắc Phục Lỗi Bị Che Chữ & Cho Phép Cuộn Xem Đầy Đủ Thẻ Lỗi Thẩm Định Chất Lượng (133-fix-audit-overflow)

**Input**: Design artifacts from `specs/133-fix-audit-overflow/` (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`)

## Phase 1: Setup

**Purpose**: Xác minh môi trường và hành vi kiểm thử cơ sở

- [x] T001 Verify existing test suite and baseline behavior in src/components/translator-workspace/__tests__/UnifiedAuditPanel.test.tsx

---

## Phase 2: Foundational

**Purpose**: Chuẩn bị trạng thái cục bộ và hằng số quản lý mở rộng trích đoạn

- [x] T002 Prepare snippet expand state management and helper constants in src/components/translator-workspace/UnifiedAuditPanel.tsx

---

## Phase 3: User Story 1 - Xem Đầy Đủ & Cuộn Nội Dung Trích Đoạn Dài Trong Thẻ Lỗi (Priority: P1) 🎯 MVP

**Goal**: Loại bỏ `line-clamp-2`, hỗ trợ cuộn dọc mượt mà trong ô trích đoạn (`overflow-y-auto max-h-28`), cung cấp nút mở rộng/thu gọn ("Xem thêm" / "Thu gọn"), và bảo vệ bôi đen sao chép văn bản (`select-text`) không bị kích hoạt chọn thẻ.

**Independent Test**:
- Kích hoạt thẻ lỗi có `targetText` dài hơn 120 ký tự hoặc nhiều dòng.
- Xác minh khung trích đoạn có thanh cuộn và nút "Xem thêm / Thu gọn", không bị cắt cứng ở dòng 2.
- Nhấp chọn hoặc bôi đen chữ trong trích đoạn không gây nhảy thẻ hoặc nhảy vị trí trình soạn thảo.

### Tests for User Story 1

- [x] T003 [P] [US1] Add unit tests for snippet scrollability, expand/collapse toggles, and click propagation in src/components/translator-workspace/__tests__/UnifiedAuditPanel.test.tsx

### Implementation for User Story 1

- [x] T004 [US1] Remove line-clamp-2, add scrollable snippet container and expand/collapse toggle with Chevron icons in src/components/translator-workspace/UnifiedAuditPanel.tsx
- [x] T005 [US1] Implement event propagation guard on snippet container and toggle button in src/components/translator-workspace/UnifiedAuditPanel.tsx

**Checkpoint**: User Story 1 hoàn thành và kiểm thử độc lập thành công.

---

## Phase 4: User Story 2 - Hiển Thị Toàn Vẹn Tin Nhắn Giải Thích Lỗi & Gợi Ý Viết Lại Từ AI (Priority: P2)

**Goal**: Tự động xuống dòng mượt mà (`break-words whitespace-pre-wrap`), không tràn viền cho phần giải thích lỗi (`issue.message`) và vùng xem trước viết lại từ AI (`pendingPreviews`).

**Independent Test**:
- Kiểm tra hiển thị thẻ lỗi có `message` dài và khung xem trước viết lại dài nhiều câu.
- Xác minh văn bản không bị tràn ngang mép thẻ và có thể cuộn dọc khi vượt quá chiều cao tối đa.

### Tests for User Story 2

- [x] T006 [P] [US2] Add unit tests for long message and AI rewrite preview wrapping/scrolling in src/components/translator-workspace/__tests__/UnifiedAuditPanel.test.tsx

### Implementation for User Story 2

- [x] T007 [US2] Apply break-words whitespace-pre-wrap to issue.message and max-h-36 overflow-y-auto to pendingPreviews in src/components/translator-workspace/UnifiedAuditPanel.tsx

**Checkpoint**: User Story 1 và 2 đều hoạt động độc lập và hoàn hảo.

---

## Phase 5: User Story 3 - Tối Ưu Chiều Cao Khung Danh Sách Thẻ Lỗi & Điều Hướng Thân Thiện (Priority: P3)

**Goal**: Mở rộng chiều cao tối đa của danh sách thẻ lỗi lên `max-h-[28rem]` với thanh cuộn tinh gọn và giữ nguyên sự mượt mà của điều hướng phím tắt (Alt+J, Alt+K).

**Independent Test**:
- Tạo danh sách gồm 10 thẻ lỗi, cuộn bằng chuột và bằng phím tắt.
- Xác minh thẻ lỗi đang focus luôn cuộn mượt mà vào tầm nhìn hiển thị.

### Tests for User Story 3

- [x] T008 [P] [US3] Add unit tests for expanded list container max-h-[28rem] in src/components/translator-workspace/__tests__/UnifiedAuditPanel.test.tsx

### Implementation for User Story 3

- [x] T009 [US3] Update issue list container height to max-h-[28rem] and preserve keyboard navigation alignment in src/components/translator-workspace/UnifiedAuditPanel.tsx

**Checkpoint**: Tất cả các User Stories hoàn tất và hoạt động trơn tru.

---

## Phase 6: Polish & Verification

**Purpose**: Xác minh toàn diện chất lượng theo Hiến pháp dự án

- [x] T010 Run TypeScript lint verification (npm run lint) across the workspace
- [x] T011 Run complete vitest test suite (npm test) across all test files
- [x] T012 Run Vite production build (npm run build) to ensure bundle integrity

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Không phụ thuộc - thực hiện ngay.
- **Foundational (Phase 2)**: Phụ thuộc Setup - chuẩn bị state & hằng số.
- **User Story 1 (Phase 3 - MVP)**: Phụ thuộc Foundational - giải quyết lỗi cốt lõi che chữ trích đoạn.
- **User Story 2 (Phase 4)**: Có thể triển khai song song hoặc nối tiếp sau US1.
- **User Story 3 (Phase 5)**: Có thể triển khai sau US1/US2.
- **Polish (Phase 6)**: Phụ thuộc toàn bộ các User Stories.

---

## Parallel Opportunities

- Các task kiểm thử `T003`, `T006`, `T008` có thể được chuẩn bị song song với cấu trúc test case chuyên biệt.
- Sau khi hoàn thành Phase 2, các cải tiến style cho `issue.message` và list container có thể kết hợp tinh gọn mà không gây xung đột logic.

---

## Implementation Strategy

### MVP First (User Story 1)

1. Hoàn thành Phase 1 (Setup) & Phase 2 (Foundational).
2. Triển khai Phase 3 (User Story 1): Xóa bỏ hoàn toàn `line-clamp-2`, hỗ trợ cuộn trong trích đoạn và nút mở rộng/thu gọn.
3. Chạy `npm test -- UnifiedAuditPanel.test.tsx` để xác nhận MVP đạt yêu cầu của người dùng.
4. Triển khai tiếp User Story 2 & User Story 3 để hoàn thiện trải nghiệm.
5. Chạy toàn bộ 3 quality gates bắt buộc (`npm run lint`, `npm test`, `npm run build`).
