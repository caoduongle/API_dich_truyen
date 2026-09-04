# Tasks: Toàn Diện 20 Hạng Mục Tối Ưu UI/UX Frontend

**Feature**: Toàn Diện 20 Hạng Mục Tối Ưu UI/UX Frontend  
**Branch**: `084-ui-ux-optimization` | **Date**: 2026-09-05 | **Spec**: [`specs/084-ui-ux-optimization/spec.md`](./spec.md) | **Plan**: [`specs/084-ui-ux-optimization/plan.md`](./plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Rà soát các tập tin mục tiêu và chuẩn bị môi trường trước khi thực hiện sửa đổi UI

- [X] T001 Rà soát và xác định các tập tin mục tiêu cần tối ưu hóa giao diện trong `src/App.tsx`, `src/index.css`, `index.html`, `src/components/ui/Button.tsx`, `src/components/glossary-manager/GlossaryTable.tsx`, và `src/components/ApiSettings.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Chạy baseline test kiểm tra an toàn hệ thống trước khi bắt đầu

- [X] T002 [P] Xác minh trạng thái sạch của baseline type checking và test suite thông qua `npm run lint` và `npm test`

**Checkpoint**: Baseline test sẵn sàng - bắt đầu thực hiện các User Story theo thứ tự ưu tiên

---

## Phase 3: User Story 1 - Trải nghiệm di động hoàn hảo không tràn viền và menu điều hướng trực quan (Priority: P1) 🎯 MVP

**Goal**: Triệt tiêu toàn bộ nguyên nhân gây thanh cuộn ngang ngoài ý muốn, tích hợp Mobile Hamburger Menu trượt mượt mà cho màn hình <768px, bọc cuộn ngang an toàn cho bảng từ điển, và tối ưu cảm ứng chống auto-zoom Safari iOS (Bao phủ Hạng mục 1, 3, 16, 20).

**Independent Test**: Mở ứng dụng trên trình duyệt ở kích thước iPhone (375x667px và 390x844px), xác nhận:
- Không xuất hiện thanh cuộn ngang ngoài ý muốn ở cấp độ trang (`window.scrollX === 0`).
- Bấm nút Hamburger Menu mở ra ngăn kéo điều hướng đầy đủ, chọn mục chuyển tab và tự động đóng menu.
- Bảng từ điển `GlossaryTable` cuộn mượt cục bộ, không đẩy rộng màn hình điện thoại.
- Ô nhập liệu có font-size 16px trên mobile, không kích hoạt tự động zoom màn hình trên Safari iOS.

### Implementation for User Story 1

- [X] T003 [P] [US1] Áp dụng `overflow-x: hidden; max-width: 100vw;` cho `html, body, #root` trong `src/index.css` và `overflow-x-clip max-w-full` cho `#ai-story-translator-app` trong `src/App.tsx` (Hạng mục 1)
- [X] T004 [P] [US1] Tích hợp nút Hamburger Menu (`MoreHorizontal` / `X`) trên Header và ngăn kéo điều hướng di động (Mobile Drawer) tự đóng khi chuyển tab trong `src/App.tsx` (Hạng mục 3)
- [X] T005 [P] [US1] Bọc bảng 12 cột trong container cuộn ngang cục bộ `overflow-x-auto min-w-[640px]` trong `src/components/glossary-manager/GlossaryTable.tsx` để chống tràn viền mobile (Hạng mục 16)
- [X] T006 [P] [US1] Nâng chuẩn kích thước vùng bấm cảm ứng tối thiểu đạt 38px/44px trong `src/components/ui/Button.tsx` và thêm media query chống tự động zoom Safari iOS cho input trong `src/index.css` (Hạng mục 20)

**Checkpoint**: User Story 1 hoàn thành — Trải nghiệm di động trơn tru, không cuộn ngang, có menu điều hướng trực quan (MVP).

---

## Phase 4: User Story 2 - Thương hiệu, SEO và nhận diện ứng dụng (Favicon, Title, Meta, Logo) (Priority: P1)

**Goal**: Xây dựng nhận diện thương hiệu chuyên nghiệp với Favicon ấn triện Chu Sa `譯`, tiêu đề trang động phản ánh tab/bộ truyện theo thời gian thực, thẻ `<meta name="description">` chuẩn SEO, và Logo Header bấm được để quay về Bàn Dịch (Bao phủ Hạng mục 4, 5, 6, 17).

**Independent Test**:
- Kiểm tra favicon hiển thị ấn triện đỏ Chu Sa sắc nét trên tab trình duyệt.
- Chuyển tab hoặc mở truyện, xác nhận `document.title` thay đổi chính xác.
- Kiểm tra mã nguồn `<head>` có thẻ mô tả SEO `<meta name="description">`.
- Bấm vào logo ở góc trái header, xác nhận ứng dụng chuyển về phân vùng Dịch Thuật.

### Implementation for User Story 2

- [X] T007 [P] [US2] Tạo tệp favicon vector `public/favicon.svg` phong cách ấn triện Chu Sa chữ `譯` và khai báo các thẻ `<link rel="icon">` trong `index.html` (Hạng mục 4)
- [X] T008 [P] [US2] Tích hợp hook `useEffect` cập nhật `document.title` động theo thời gian thực dựa trên `activeTab` và `activeProject?.title` trong `src/App.tsx` (Hạng mục 5)
- [X] T009 [P] [US2] Bổ sung thẻ `<meta name="description">` và siêu dữ liệu OpenGraph vào thẻ `<head>` trong `index.html` (Hạng mục 6)
- [X] T010 [P] [US2] Chuyển cụm Logo và ấn triện `譯` ở góc trái Header thành nút bấm quay về Bàn Dịch chính trong `src/App.tsx` (Hạng mục 17)

**Checkpoint**: User Story 2 hoàn thành — Nhận diện thương hiệu, tiêu chuẩn SEO và điều hướng Logo hoàn chỉnh.

---

## Phase 5: User Story 3 - Phản hồi tương tác người dùng: Thông báo Thành công & Bắt lỗi Form chi tiết (Priority: P2)

**Goal**: Đảm bảo toàn bộ nút bấm không gây submit form ngầm ngoài ý muốn, bổ sung Toast thông báo thành công khi lưu cấu hình AI, và cung cấp phản hồi lỗi trực quan tại chỗ cho các form nhập liệu (Bao phủ Hạng mục 11, 12, 13, 14).

**Independent Test**:
- Kiểm tra các nút trong form không gây kích hoạt submit ngầm; nút Lưu & Đóng trong Cấu hình AI kích hoạt Toast thông báo thành công.
- Bỏ trống trường bắt buộc khi tạo dự án hoặc thêm thuật ngữ, xác nhận ô nhập liệu xuất hiện viền đỏ Chu Sa và dòng cảnh báo lỗi rõ ràng.

### Implementation for User Story 3

- [X] T011 [P] [US3] Thiết lập mặc định `type = props.type || 'button'` trong `src/components/ui/Button.tsx` và gán `type="button"` cho các nút tab bar trong `src/App.tsx` (Hạng mục 11)
- [X] T012 [P] [US3] Tích hợp Toast thông báo thành công khi người dùng bấm Lưu & Đóng cấu hình AI trong `src/components/ApiSettings.tsx` (Hạng mục 12)
- [X] T013 [P] [US3] Bổ sung trạng thái lỗi trực quan tại chỗ (`border-polish bg-polish/5` và thông điệp lỗi) cho trường bắt buộc trong `src/components/glossary-manager/AddGlossaryForm.tsx` và `src/components/project-list/ProjectFormModal.tsx` (Hạng mục 13)
- [X] T014 [P] [US3] Dọn dẹp các nhãn giữ chỗ và văn bản mẫu tạm thời (thay thế mặc định cứng "Khuyết Danh") trong `src/components/project-list/ProjectFormModal.tsx` (Hạng mục 14)

**Checkpoint**: User Story 3 hoàn thành — Phản hồi tương tác người dùng và kiểm soát lỗi form trực quan, rõ ràng.

---

## Phase 6: User Story 4 - Hoàn thiện liên kết, Trang lỗi 404 thân thiện và Tối ưu hóa đa phương tiện (Priority: P2)

**Goal**: Rà soát và hoàn thiện toàn bộ liên kết dưới footer (chính sách, điều khoản, GitHub), năm bản quyền tự động, xây dựng trang lỗi 404 cổ phong, tối ưu thuộc tính tải ảnh `<img>`, và định dạng liên kết `mailto:`, `tel:` (Bao phủ Hạng mục 2, 7, 8, 9, 10, 15, 18, 19).

**Independent Test**:
- Kiểm tra footer: năm bản quyền khớp với `new Date().getFullYear()`, không có liên kết chết `href="#"`, link GitHub mở tab mới an toàn.
- Nhấn vào email hoặc số điện thoại, xác nhận kích hoạt ứng dụng mail (`mailto:`) và gọi điện (`tel:`).
- Truy cập trạng thái 404, xác nhận trang thông báo cổ phong với nút quay về bàn dịch hiển thị.
- Kiểm tra thuộc tính thẻ ảnh có `loading="lazy"`, `decoding="async"` và fallback khi lỗi.

### Implementation for User Story 4

- [X] T015 [P] [US4] Rà soát và đảm bảo mọi liên kết ngoài có thuộc tính an toàn `rel="noopener noreferrer"`, không sử dụng liên kết rỗng `href="#"` trong `src/App.tsx` (Hạng mục 2)
- [X] T016 [P] [US4] Cập nhật các liên kết dưới Footer với link chính sách bảo mật, điều khoản sử dụng và kho mã nguồn GitHub trong `src/App.tsx` (Hạng mục 7)
- [X] T017 [P] [US4] Xây dựng component trang lỗi tùy chỉnh `src/components/common/NotFoundPage.tsx` phong cách Mực & Chu Sa kèm nút điều hướng quay về Bàn Dịch (Hạng mục 8)
- [X] T018 [P] [US4] Cập nhật năm bản quyền dưới Footer tự động thông qua `new Date().getFullYear()` trong `src/App.tsx` (Hạng mục 9)
- [X] T019 [P] [US4] Bổ sung `loading="lazy"`, `decoding="async"`, kích thước và xử lý `onError` fallback cho thẻ `<img>` trong `src/components/google-sync/GoogleUserButton.tsx`, `GoogleSyncModal.tsx`, và `ShareProjectModal.tsx` (Hạng mục 10)
- [X] T020 [P] [US4] Tinh giản dropdown "Thêm" bị trùng lặp trên thanh tab bar desktop trong `src/App.tsx` (Hạng mục 15)
- [X] T021 [P] [US4] Định dạng số điện thoại hỗ trợ thành liên kết gọi được (`href="tel:+84988000111"`) tại footer trong `src/App.tsx` (Hạng mục 18)
- [X] T022 [P] [US4] Chuyển đổi toàn bộ địa chỉ email thành liên kết mở ứng dụng mail (`href="mailto:..."`) trong `src/components/google-sync/ShareProjectModal.tsx` và tại footer trong `src/App.tsx` (Hạng mục 19)

**Checkpoint**: User Story 4 hoàn thành — Toàn bộ liên kết, trang 404 và phương tiện hình ảnh được hoàn thiện chuẩn mực.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Đảm bảo toàn bộ tiêu chuẩn chất lượng (Quality Gates) của Hiến pháp dự án được thỏa mãn

- [X] T023 [P] Chạy kiểm tra Type Safety toàn dự án qua `npm run lint` (`tsc --noEmit`)
- [X] T024 Chạy kiểm tra hồi quy toàn bộ test suites qua `npm test` (`vitest run`)
- [X] T025 Kiểm tra build production bundle thành công qua `npm run build`
- [X] T026 Thực hiện kiểm tra trực quan trên các kích thước di động theo kịch bản `specs/084-ui-ux-optimization/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Không phụ thuộc — bắt đầu ngay.
- **Foundational (Phase 2)**: Phụ thuộc Phase 1 — xác nhận baseline sạch.
- **User Story 1 (Phase 3)**: Phụ thuộc Phase 2 — Trọng tâm MVP di động.
- **User Story 2 (Phase 4)**: Phụ thuộc Phase 2 — Có thể chạy song song với US1 trên các file khác nhau.
- **User Story 3 (Phase 5)**: Phụ thuộc Phase 2.
- **User Story 4 (Phase 6)**: Phụ thuộc Phase 2.
- **Polish (Phase 7)**: Phụ thuộc vào việc hoàn tất toàn bộ các User Story.

### Parallel Opportunities

- Trong Phase 3 (US1): `T003` (`index.css`), `T004` (`App.tsx`), `T005` (`GlossaryTable.tsx`), `T006` (`Button.tsx`) đều can thiệp vào các tệp khác nhau, có thể thực hiện song song.
- Trong Phase 4 (US2): `T007` (`favicon.svg`), `T008` (`App.tsx`), `T009` (`index.html`) có thể chạy song song.
- Trong Phase 5 (US3): `T011` (`Button.tsx`), `T012` (`ApiSettings.tsx`), `T013` (`AddGlossaryForm.tsx`), `T014` (`ProjectFormModal.tsx`) có thể chạy song song.
- Trong Phase 6 (US4): `T017` (`NotFoundPage.tsx`), `T019` (`GoogleUserButton.tsx`), `T022` (`ShareProjectModal.tsx`) có thể chạy song song.
- Trong Phase 7 (Polish): `T023` (`npm run lint`) có thể chạy đồng thời với `T024` (`npm test`).

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Hoàn thành Phase 1: Setup
2. Hoàn thành Phase 2: Foundational
3. Hoàn thành Phase 3: User Story 1 (Triệt tiêu cuộn ngang, Mobile menu, Bảng cuộn cục bộ, Chống zoom Safari)
4. **Kiểm tra độc lập**: Xác nhận giao diện mobile hoàn hảo, không tràn viền.

### Incremental Delivery

1. Setup + Foundational -> Môi trường sẵn sàng
2. Thêm User Story 1 -> Kiểm tra độc lập -> Hoàn thành MVP di động
3. Thêm User Story 2 -> Kiểm tra Favicon, Title động, SEO meta, Clickable Logo
4. Thêm User Story 3 -> Kiểm tra Nút bấm, Toast thông báo, Inline error form
5. Thêm User Story 4 -> Kiểm tra Footer links, Dynamic copyright, Trang 404, Lazy images, Tel/Mailto links
6. Chạy Polish (Phase 7) -> `npm run lint`, `npm test`, `npm run build` sạch 100%
