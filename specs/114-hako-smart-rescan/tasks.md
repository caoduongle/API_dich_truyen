# Tasks: Rà Soát Lại Có Ghi Nhớ Quyết Định Kiểm Định (114-hako-smart-rescan)

**Input**: Design artifacts from `specs/114-hako-smart-rescan/` (`spec.md`, `plan.md`, `data-model.md`, `research.md`, `contracts/`)

---

## Phase 1: Setup & Foundational (Prerequisites)

**Purpose**: Thiết lập các kiểu dữ liệu mở rộng và hạ tầng nhận diện lỗi (fingerprinting) làm nền tảng cho toàn bộ các User Story.

- [X] T001 Mở rộng kiểu dữ liệu `QualityIssueDecision` với `'resolved'`, bổ sung `isNew` và `resolvedAt` vào `QualityIssue`, định nghĩa `ReauditDiffSummary` trong `src/types/hakoChecker.ts`
- [X] T002 [P] Xây dựng hàm băm định danh lỗi duy nhất `generateIssueFingerprint` trong `src/services/hakoQualityEngine.ts`
- [X] T003 [P] Viết unit tests kiểm thử hàm `generateIssueFingerprint` với các biến thể khoảng trắng và trích xuất token CJK trong `src/services/__tests__/hakoQualityEngine.test.ts`

---

## Phase 2: User Story 1 - Ghi nhớ các lỗi đã Bác bỏ khi rà soát lại (Priority: P1) 🎯 MVP

**Goal**: Khi người dùng nhấn nút "Bác bỏ" (`dismissed`), tiến trình "Rà soát lại" không cảnh báo lại lỗi đó như một lỗi mới, bảo toàn 100% quyết định bác bỏ của moderator.

**Independent Test**: Quét một chương có lỗi -> bấm "Bác bỏ" -> bấm "Rà soát lại" -> Lỗi vẫn giữ trạng thái "Đã bỏ qua", không bị đưa về "Chờ duyệt" và không nhân bản thêm thẻ lỗi.

### Tests for User Story 1 🧪
- [X] T004 [P] [US1] Viết unit test xác nhận các lỗi `dismissed` được giữ nguyên quyết định sau khi chạy `reconcileIssuesWithDecisions` trong `src/services/__tests__/hakoQualityEngine.test.ts`

### Implementation for User Story 1 💻
- [X] T005 [US1] Xây dựng khung hàm `reconcileIssuesWithDecisions` và xử lý kế thừa trạng thái `dismissed` cho lỗi cũ trong `src/services/hakoQualityEngine.ts`
- [X] T006 [US1] Tích hợp `reconcileIssuesWithDecisions` vào hàm `handleStartAnalysis` trong `src/components/hako-checker/HakoCheckerWorkspace.tsx` để đối chiếu với `session.issues` thay vì gán mảng rỗng

**Checkpoint**: User Story 1 hoàn tất và có thể kiểm thử độc lập (MVP cốt lõi: Bác bỏ không còn bị mất khi rà soát lại).

---

## Phase 3: User Story 2 - Tự động phát hiện lỗi đã sửa và chuyển sang Đã giải quyết (Priority: P1)

**Goal**: Khi người dùng đã sửa bản dịch trong Bàn Dịch (vi phạm không còn tồn tại trong chương), rà soát lại tự động chuyển lỗi từ `confirmed` sang `resolved` (Đã giải quyết); nếu chưa sửa, giữ nguyên `confirmed`.

**Independent Test**: Bấm "Xác nhận lỗi" -> Mở Bàn Dịch sửa xóa vi phạm -> Bấm "Rà soát lại" -> Lỗi chuyển thành "Đã giải quyết" với huy hiệu xanh lá.

### Tests for User Story 2 🧪
- [X] T007 [P] [US2] Viết unit test kiểm tra chuyển dịch trạng thái từ `confirmed` sang `resolved` khi không còn phát hiện vi phạm trong `src/services/__tests__/hakoQualityEngine.test.ts`

### Implementation for User Story 2 💻
- [X] T008 [US2] Bổ sung logic nhận diện lỗi đã sửa (không còn vi phạm trong lần quét mới) để chuyển sang `resolved` và giữ nguyên `confirmed` nếu vi phạm vẫn còn trong `src/services/hakoQualityEngine.ts`
- [X] T009 [US2] Cập nhật component `HakoIssueCard.tsx` hiển thị giao diện thẻ lỗi khi `decision === 'resolved'` (viền ngọc, huy hiệu "✓ Đã khắc phục sau khi sửa bản dịch")
- [X] T010 [US2] Cập nhật bộ lọc quyết định và thanh chỉ số thống kê trong `HakoIssueReviewPanel.tsx` để hỗ trợ hiển thị danh sách và số lượng lỗi `resolved`

**Checkpoint**: User Story 2 hoàn tất, người dùng kiểm chứng được vòng lặp Dịch - Duyệt - Sửa - Xác nhận thành công.

---

## Phase 4: User Story 3 - Bảo toàn trạng thái Cần xem lại và ghi chú thảo luận (Priority: P2)

**Goal**: Bảo toàn quyết định `review_needed` cùng toàn bộ ghi chú `moderatorNote` khi rà soát lại nếu chưa sửa; chuyển sang `resolved` nếu đã sửa.

**Independent Test**: Đánh dấu "Cần xem lại" và nhập ghi chú -> bấm "Rà soát lại" -> Trạng thái và ghi chú được giữ nguyên vẹn 100%.

### Tests for User Story 3 🧪
- [X] T011 [P] [US3] Viết unit test xác nhận quyết định `review_needed` và nội dung `moderatorNote` không bị ghi đè sau khi rà soát trong `src/services/__tests__/hakoQualityEngine.test.ts`

### Implementation for User Story 3 💻
- [X] T012 [US3] Hoàn thiện nhánh xử lý cho `review_needed` trong `reconcileIssuesWithDecisions` tại `src/services/hakoQualityEngine.ts`

**Checkpoint**: User Story 3 hoàn tất, không bao giờ xảy ra tình trạng mất ghi chú hay mất đánh dấu hội ý.

---

## Phase 5: User Story 4 - Nhận diện lỗi mới phát sinh và tóm tắt kết quả sau rà soát (Priority: P3)

**Goal**: Nhận diện các vi phạm mới phát sinh với cờ `isNew: true`, tính toán bảng biến động `ReauditDiffSummary` và hiển thị thanh thông báo tổng kết rõ ràng sau khi rà soát.

**Independent Test**: Thêm ký tự Hán mới vào bản dịch -> bấm "Rà soát lại" -> Lỗi mới có nhãn "Mới", banner thông báo hiển thị đúng số lỗi đã sửa, lỗi chưa sửa và lỗi mới.

### Tests for User Story 4 🧪
- [X] T013 [P] [US4] Viết unit test kiểm tra việc đánh dấu `isNew: true` cho lỗi mới và tính toán chính xác các trường trong `ReauditDiffSummary` trong `src/services/__tests__/hakoQualityEngine.test.ts`

### Implementation for User Story 4 💻
- [X] T014 [US4] Triển khai tính toán `ReauditDiffSummary` trả về từ `reconcileIssuesWithDecisions` trong `src/services/hakoQualityEngine.ts`
- [X] T015 [US4] Cập nhật `HakoIssueCard.tsx` hiển thị huy hiệu "Mới" cho các lỗi có `isNew === true`
- [X] T016 [US4] Bổ sung banner thông báo tổng kết biến động kiểm định (số lỗi đã khắc phục, số lỗi còn lại, số lỗi mới) vào `src/components/hako-checker/HakoIssueReviewPanel.tsx`

**Checkpoint**: Toàn bộ 4 User Stories đã được tích hợp hoàn chỉnh và hoạt động ăn khớp.

---

## Phase 6: Polish & Verification

**Purpose**: Rà soát chất lượng toàn diện, kiểm thử giao diện và đảm bảo không có bất kỳ hồi quy (regression) nào.

- [X] T017 [P] Cập nhật và bổ sung test cases kiểm tra lọc và hiển thị `resolved` trong `src/components/hako-checker/__tests__/HakoIssueReviewPanel.test.tsx`
- [X] T018 Chạy quy trình kiểm tra chất lượng bắt buộc: `npm run lint`, `npm test`, `npm run build`
- [X] T019 Thực hiện kiểm thử thủ công 4 kịch bản theo tài liệu `specs/114-hako-smart-rescan/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Phase 1 (Setup & Foundational)**: Không có phụ thuộc, thực hiện đầu tiên (T001 -> T003).
- **Phase 2 (User Story 1 - MVP)**: Phụ thuộc vào Phase 1.
- **Phase 3 (User Story 2)**: Phụ thuộc vào Phase 2.
- **Phase 4 (User Story 3)**: Phụ thuộc vào Phase 3.
- **Phase 5 (User Story 4)**: Phụ thuộc vào Phase 4.
- **Phase 6 (Polish & Verification)**: Phụ thuộc vào hoàn tất toàn bộ User Stories.

### Parallel Opportunities
- T002 và T003 có thể chạy song song sau T001.
- T004 (test US1) có thể viết song song với thiết kế chi tiết.
- T007 (test US2) có thể viết trước khi sửa UI T009, T010.
- T011 (test US3) và T013 (test US4) có thể chạy độc lập.
- T017 có thể chạy song song với việc hoàn thiện giao diện.

---

## Implementation Strategy

### MVP Scope (Chỉ User Story 1)
Chỉ cần hoàn thành Phase 1 và Phase 2 (T001 -> T006) là người dùng đã giải quyết được nỗi đau lớn nhất: Bấm "Bác bỏ" không còn bị mất khi ấn "Rà soát lại".

### Incremental Delivery
1. **Giao đợt 1 (MVP)**: T001-T006 (Ghi nhớ Bác bỏ).
2. **Giao đợt 2**: T007-T010 (Tự động chuyển Đã giải quyết khi sửa text).
3. **Giao đợt 3**: T011-T012 (Bảo toàn Cần xem lại & Ghi chú).
4. **Giao đợt 4**: T013-T016 (Nhận diện Lỗi mới & Banner tổng kết biến động).
5. **Nghiệm thu**: T017-T019 (Kiểm thử tự động + lint + build + manual quickstart).

