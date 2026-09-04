# Feature Specification: Toàn Diện 20 Hạng Mục Tối Ưu UI/UX Frontend

**Feature Branch**: `084-ui-ux-optimization`  
**Created**: 2026-09-04  
**Status**: Draft  
**Input**: User description: "Kiểm tra toàn bộ mã nguồn giao diện của dự án này và hoàn thiện 20 hạng mục: 1. Remove horizontal scroll, 2. Find broken links, 3. Add mobile menu, 4. Add favicon, 5. Fix page titles, 6. Add meta descriptions, 7. Fix footer links, 8. Custom 404 page, 9. Dynamic copyright year, 10. Compress images, 11. Fix broken buttons, 12. Success messages, 13. Error messages, 14. Remove placeholder text, 15. Remove unused navigation, 16. Fix mobile overflow, 17. Clickable logo, 18. Clickable phone number, 19. Clickable email, 20. Full mobile optimization."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trải nghiệm di động hoàn hảo không tràn viền và menu điều hướng trực quan (Priority: P1) 🎯 MVP

**As a** biên tập viên hoặc độc giả sử dụng điện thoại thông minh (màn hình hẹp 360px - 430px),  
**I want** trang web không bao giờ bị cuộn ngang ngoài ý muốn, bảng biểu dữ liệu tự động co giãn/cuộn cục bộ, và có menu điều hướng di động (hamburger menu) mượt mà,  
**So that** tôi có thể thao tác dịch thuật, duyệt từ điển, quản lý dự án một cách thuận tiện bằng một tay mà không bị vỡ giao diện hay giật lag.

**Why this priority**: Thiết bị di động chiếm tỷ lệ lớn lượng truy cập. Tràn màn hình ngang hoặc thiếu menu điều hướng trên mobile khiến trải nghiệm người dùng bị suy giảm nghiêm trọng.

**Independent Test**: Mở ứng dụng trên trình duyệt mô phỏng kích thước iPhone/Android (375x667px và 390x844px), xác nhận:
- Thanh cuộn ngang của trang hoàn toàn biến mất (window.scrollX === 0).
- Nút hamburger menu mở ra ngăn kéo điều hướng đầy đủ, chọn mục chuyển tab và tự động đóng menu.
- Bảng từ điển (GlossaryTable) và các khối dữ liệu nằm trọn trong khung màn hình mà không làm tràn bố cục tổng thể.

**Acceptance Scenarios**:
1. **Given** người dùng truy cập app trên thiết bị di động (<768px), **When** vuốt hoặc cuộn toàn trang, **Then** không xuất hiện thanh cuộn ngang ngoài ý muốn ở cấp độ thẻ `html`/`body`.
2. **Given** màn hình di động, **When** nhấn vào biểu tượng Hamburger Menu ở thanh tiêu đề, **Then** menu trượt ra hiển thị danh sách tất cả các phân vùng làm việc; khi nhấn vào một mục, hệ thống chuyển đến phân vùng đó và tự đóng menu ngay lập tức.
3. **Given** bảng từ điển (GlossaryTable) hoặc bảng dài, **When** xem trên màn hình nhỏ, **Then** bảng được bọc trong container có thanh cuộn ngang cục bộ (`overflow-x-auto`) thay vì đẩy rộng toàn bộ viewport.

---

### User Story 2 - Thương hiệu, SEO và nhận diện ứng dụng (Favicon, Title, Meta, Logo) (Priority: P1)

**As a** người dùng duyệt web và lưu bookmark trang,  
**I want** tab trình duyệt hiển thị favicon chuẩn phong cách Mực & Chu Sa, tiêu đề trang (`<title>`) phản ánh chính xác phân vùng/tiểu thuyết đang thao tác, thẻ mô tả SEO (`<meta name="description">`) đầy đủ, và logo header luôn trỏ về trang chủ,  
**So that** tôi dễ dàng nhận biết tab giữa hàng chục tab trình duyệt đang mở và có thể click logo để quay về bàn dịch bất cứ lúc nào.

**Why this priority**: Nhận diện thương hiệu chuyên nghiệp, tiêu chuẩn SEO cơ bản và khả năng định vị nội dung tab là tiêu chuẩn cốt lõi của một sản phẩm Web hoàn chỉnh.

**Independent Test**:
- Kiểm tra mã nguồn `<head>` thấy thẻ favicon SVG/ICO và thẻ `<meta name="description">`.
- Chuyển đổi giữa các tab (Dịch thuật, Từ điển, Lịch sử, Dự án, Hako), xác nhận `document.title` thay đổi tương ứng theo thời gian thực.
- Nhấn vào logo thương hiệu ở header, xác nhận ứng dụng quay về phân vùng dịch chính.

**Acceptance Scenarios**:
1. **Given** trang web được tải, **When** kiểm tra phần tử `<head>`, **Then** tồn tại thẻ `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` cùng thẻ mô tả SEO `<meta name="description" content="...">`.
2. **Given** người dùng đang ở tab "Từ điển Nhân vật" của truyện "Đấu Phá", **When** nhìn tiêu đề tab trình duyệt, **Then** tiêu đề hiển thị rõ ràng: "Đấu Phá - Thuật ngữ & Danh xưng | AI Dịch Truyện Trung - Việt".
3. **Given** người dùng đang ở bất kỳ tab nào, **When** bấm vào cụm Logo và ấn triện ở góc trái Header, **Then** hệ thống điều hướng trở về phân vùng Dịch thuật chính (`translate`).

---

### User Story 3 - Phản hồi tương tác người dùng: Thông báo Thành công & Bắt lỗi Form chi tiết (Priority: P2)

**As a** dịch giả nhập liệu form và điều chỉnh cấu hình API/Dự án,  
**I want** luôn nhận được thông báo phản hồi (toast/alert) rõ ràng khi thao tác thành công hoặc khi xảy ra lỗi/bỏ sót trường bắt buộc,  
**So that** tôi an tâm dữ liệu đã được lưu trữ an toàn hoặc biết chính xác trường nào cần điều chỉnh thay vì giao diện im lặng.

**Why this priority**: Thiếu phản hồi trạng thái gây hoang mang, người dùng không biết thao tác có được ghi nhận hay không hoặc tại sao nút bấm không chạy.

**Independent Test**:
- Thao tác thêm/xóa API key hoặc chỉnh sửa thông tin dự án, xác nhận toast thông báo màu xanh/thành công xuất hiện.
- Để trống trường bắt buộc trong form tạo dự án hoặc thêm thuật ngữ và nhấn gửi, xác nhận trường vi phạm được đánh dấu viền đỏ/chu sa và có thông báo lỗi cụ thể.

**Acceptance Scenarios**:
1. **Given** người dùng lưu cài đặt API hoặc cập nhật thông tin dự án, **When** hoàn tất thành công, **Then** hệ thống phát thông báo Toast thành công với nội dung cụ thể (ví dụ "Đã lưu cấu hình AI thành công!").
2. **Given** form nhập liệu có trường bắt buộc, **When** người dùng bỏ trống hoặc nhập sai định dạng, **Then** trường đó được đánh dấu trạng thái lỗi trực quan (`aria-invalid="true"`, viền đỏ) kèm thông điệp cảnh báo rõ ràng.
3. **Given** mọi thẻ `<button>` trên giao diện, **When** người dùng tương tác, **Then** nút có thuộc tính `type="button"` rõ ràng (tránh tự submit form ngầm), kích thước vùng bấm tối thiểu đạt chuẩn tiếp cận (44x44px trên mobile).

---

### User Story 4 - Hoàn thiện liên kết, Trang lỗi 404 thân thiện và Tối ưu hóa đa phương tiện (Priority: P2)

**As a** người dùng duyệt trang và tra cứu chính sách/liên hệ,  
**I want** footer có đầy đủ liên kết điều khoản/bảo mật/liên hệ (kèm link `mailto:` và `tel:` gọi được), năm bản quyền tự động cập nhật, trang 404 tùy chỉnh thân thiện phong cách cổ phong, và ảnh đại diện được tối ưu `loading="lazy"`,  
**So that** tôi có trải nghiệm liền mạch, chuyên nghiệp và thuận tiện khi cần liên hệ trợ giúp.

**Why this priority**: Loại bỏ toàn bộ liên kết chết/rỗng (`href="#"`), tạo trang 404 nhất quán và định dạng liên hệ mở rộng tính hoàn thiện của sản phẩm theo chuẩn web hiện đại.

**Independent Test**:
- Kiểm tra footer: năm bản quyền bằng với `new Date().getFullYear()`, liên kết email mở ứng dụng mail (`mailto:`), liên kết điện thoại mở ứng dụng gọi (`tel:`).
- Truy cập một đường dẫn hoặc trạng thái không tồn tại, xác nhận trang 404 tùy chỉnh phong cách "Mực & Chu Sa" hiển thị cùng nút quay về bàn dịch.
- Toàn bộ thẻ `<img>` trong mã nguồn có đầy đủ `loading="lazy"` và `decoding="async"`.

**Acceptance Scenarios**:
1. **Given** phần chân trang (Footer), **When** hiển thị dòng bản quyền, **Then** năm hiển thị được trích xuất động bằng code (`new Date().getFullYear()`).
2. **Given** thông tin email và số điện thoại hỗ trợ, **When** người dùng nhấp vào, **Then** trình duyệt tự động kích hoạt ứng dụng gửi email (`mailto:`) hoặc ứng dụng quay số (`tel:`).
3. **Given** người dùng gặp trang lỗi không tìm thấy nội dung (404), **When** màn hình hiển thị, **Then** giao diện có ấn triện cổ phong, thông điệp hướng dẫn rõ ràng và nút bấm "Quay về Bàn Dịch".
4. **Given** các thẻ hiển thị ảnh đại diện Google hoặc ảnh bìa, **When** kiểm tra thuộc tính HTML, **Then** thẻ chứa `loading="lazy"`, `decoding="async"` và kích thước width/height xác định.

---

## Edge Cases

- **Màn hình cực hẹp (<320px) hoặc gập (Galaxy Fold)**: Nội dung trong Header và Toolbar không được co rúm chồng chéo; các nút phụ ẩn vào Hamburger Menu.
- **Bảng danh sách thuật ngữ có hàng nghìn dòng**: Giữ nguyên cơ chế ảo hóa danh sách (`useVirtualList`), bọc khung cuộn ngang cục bộ để không làm đơ trình duyệt.
- **Không có kết nối mạng khi tải ảnh Google Avatar**: Thẻ ảnh phải có hàm dự phòng `onError` hiển thị avatar chữ cái viết tắt hoặc icon trung tính thay vì icon ảnh hỏng của trình duyệt.
- **Trình duyệt Safari trên iOS tự phóng to khi bấm ô nhập liệu**: Toàn bộ `input` và `textarea` trên mobile phải có font size tối thiểu 16px (`text-base sm:text-xs`) để ngăn Safari auto-zoom.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống MUST triệt tiêu thanh cuộn ngang toàn trang bằng cách áp dụng `overflow-x: hidden` / `overflow-x: clip` và `max-w-full` tại các cấp tử `html`, `body`, container gốc.
- **FR-002**: Hệ thống MUST loại bỏ toàn bộ liên kết chết hoặc rỗng (`href="#"`), đảm bảo mọi thẻ `<a>` có đích đến hợp lệ hoặc chuyển sang `<button>` nếu là nút hành động.
- **FR-003**: Giao diện MUST cung cấp Hamburger Menu trên thiết bị di động (<768px), cho phép mở danh sách phân vùng làm việc mượt mà và tự động đóng khi chọn phân vùng.
- **FR-004**: Tệp `index.html` MUST khai báo đầy đủ cấu hình favicon (`favicon.svg`, `favicon.ico`) phong cách "Mực & Chu Sa" với ấn triện đỏ Chu Sa.
- **FR-005**: Hệ thống MUST tự động cập nhật thẻ `<title>` của trình duyệt theo phân vùng làm việc và tên tiểu thuyết đang mở.
- **FR-006**: Tệp `index.html` và các phân vùng MUST có thẻ `<meta name="description">` chuẩn SEO mô tả công cụ dịch tiểu thuyết AI.
- **FR-007**: Footer MUST cung cấp các liên kết chính sách bảo mật, điều khoản sử dụng, kho lưu trữ mã nguồn với thuộc tính bảo mật `rel="noopener noreferrer"`.
- **FR-008**: Hệ thống MUST cung cấp trang/chế độ lỗi 404 (NotFound) phong cách cổ phong với nút điều hướng quay về bàn dịch.
- **FR-009**: Dòng bản quyền dưới Footer MUST lấy năm hiện tại tự động thông qua `new Date().getFullYear()`.
- **FR-010**: Toàn bộ thẻ `<img>` MUST có thuộc tính `loading="lazy"`, `decoding="async"`, kích thước rõ ràng và cơ chế xử lý lỗi ảnh tải hỏng.
- **FR-011**: Toàn bộ thẻ `<button>` MUST được chỉ định `type="button"` (trừ nút submit form) và gắn hàm xử lý sự kiện đầy đủ, không gây treo giao diện.
- **FR-012**: Các thao tác thành công (lưu cấu hình AI, thêm key, lưu dự án, xuất file) MUST hiển thị Toast thông báo thành công màu xanh/chu sa rõ ràng.
- **FR-013**: Khi người dùng bỏ sót thông tin form hoặc API gặp sự cố, hệ thống MUST hiển thị thông báo lỗi chi tiết, trực quan tại chỗ.
- **FR-014**: Giao diện MUST không chứa bất kỳ đoạn văn bản mẫu vô nghĩa (Lorem Ipsum) hoặc nhãn giữ chỗ tạm thời chưa xử lý.
- **FR-015**: Loại bỏ các menu điều hướng thừa thãi, trùng lặp tính năng gây rối mắt trên thanh công cụ.
- **FR-016**: Toàn bộ các phần tử lớn (bảng dữ liệu, văn bản Hán tự dài, khối thông số) MUST không tràn viền màn hình điện thoại.
- **FR-017**: Logo thương hiệu ở Header MUST là thành phần có thể bấm được (`onClick` / `<a>`) để quay về trang chủ.
- **FR-018**: Mọi số điện thoại hiển thị trên giao diện MUST được định dạng thành thẻ liên kết gọi trực tiếp (`href="tel:..."`).
- **FR-019**: Mọi địa chỉ email hiển thị trên giao diện MUST được định dạng thành thẻ liên kết mở ứng dụng mail (`href="mailto:..."`).
- **FR-020**: Toàn bộ các nút bấm và phần tử tương tác trên thiết bị di động MUST đáp ứng kích thước vùng chạm tối thiểu 44x44px và kích thước chữ không kích hoạt auto-zoom.

### Key Entities

- **Responsive Viewport State**: Trạng thái kích thước màn hình và trạng thái đóng/mở của Mobile Drawer Menu.
- **Active Context Metadata**: Dữ liệu ngữ cảnh gồm tiêu đề tab đang chọn, tiêu đề tác phẩm hiện tại dùng để cập nhật động tiêu đề `<title>` và thẻ `<meta>`.
- **Feedback Notification**: Thông báo Toast phản hồi tương tác (thành công, lỗi, cảnh báo) kèm thời lượng tự biến mất.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% trang không xuất hiện thanh cuộn ngang ngoài ý muốn trên toàn bộ kích thước màn hình từ 320px đến 4K (`document.documentElement.scrollWidth <= window.innerWidth`).
- **SC-002**: 100% người dùng trên thiết bị di động (<768px) có thể truy cập toàn bộ 6 phân vùng làm việc thông qua Hamburger Menu trong vòng không quá 2 thao tác chạm.
- **SC-003**: 100% các nút bấm và phần tử tương tác trên mobile đạt diện tích chạm tối thiểu 44x44px (hoặc có vùng đệm tương đương).
- **SC-004**: 0 liên kết chết (`href="#"`) hoặc nút bấm thiếu sự kiện trên toàn bộ ứng dụng.
- **SC-005**: 100% thao tác lưu dữ liệu (API Key, Dự án, Thuật ngữ) kích hoạt phản hồi trực quan (Toast thông báo) trong vòng dưới 100ms.
- **SC-006**: Đạt điểm tiếp cận & SEO >= 95 trên công cụ kiểm định chuẩn Lighthouse.

---

## Assumptions

- Ứng dụng là một Single Page Application (SPA) với quản lý trạng thái phân vùng làm việc (tabs), toàn bộ dữ liệu lưu trữ trực tiếp tại IndexedDB của trình duyệt người dùng.
- Việc bổ sung Mobile Menu và tinh chỉnh Responsive tuân thủ nghiêm ngặt Design System "Mực & Chu Sa" tại `.agents/rules/design-system.md` (bảng màu ink/parchment/polish, font Fraunces/Be Vietnam Pro, bo góc 2px-3px, không dùng thư viện ngoài).
