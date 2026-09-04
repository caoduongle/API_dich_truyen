# Feature Specification: Sửa Footer (Thông Tin Liên Hệ Thật & Tách Modal Điều Khoản Sử Dụng)

**Feature Branch**: `090-footer-contact-terms`  
**Created**: 2026-09-05  
**Status**: Ready for Implementation  
**Input**: Sửa footer của ứng dụng trong `src/App.tsx`: cập nhật thông tin liên hệ thật (email caoduongle22@gmail.com, SĐT +84 357 077 042) và tách modal "Điều khoản sử dụng" độc lập khỏi modal "Chính sách bảo mật".

---

## 1. User Scenarios & Testing *(mandatory)*

### User Story 1 - Tách Biệt & Mở Độc Lập Modal "Điều Khoản Sử Dụng" (Priority: P1)

Là một người dùng hoặc cộng tác viên của nền tảng, tôi muốn khi nhấp vào nút "Điều khoản sử dụng" ở footer, hệ thống sẽ mở ra một modal riêng biệt hiển thị các điều khoản dịch vụ thực tế (tính chất công cụ AI, trách nhiệm bản quyền của người dùng, giới hạn trách nhiệm "as-is" của phần mềm mã nguồn mở), thay vì bị mở nhầm modal Chính sách bảo mật.

**Why this priority**: Hiện tại cả hai nút "Chính sách bảo mật" và "Điều khoản sử dụng" đều gọi chung `setShowPrivacyModal(true)`, gây hiểu nhầm cho người dùng, làm mất tính chuyên nghiệp của sản phẩm và thiếu tính minh bạch về pháp lý đối với việc sử dụng API key của bên thứ ba.

**Independent Test**: Nhấp vào nút "Điều khoản sử dụng" ở footer; kiểm chứng modal Điều Khoản Sử Dụng hiển thị với tiêu đề "Điều Khoản Sử Dụng", con dấu triện "約", 4 điều khoản chi tiết và nút đóng "Đã hiểu và đồng ý". Nhấp vào nút "Chính sách bảo mật"; kiểm chứng modal Chính Sách Bảo Mật hiển thị tiêu đề "Chính Sách Bảo Mật" với con dấu triện "隱".

**Acceptance Scenarios**:
1. **Given** người dùng đang ở bất kỳ màn hình nào và cuộn xuống footer, **When** người dùng nhấp nút "Điều khoản sử dụng", **Then** `showTermsModal` chuyển thành `true` và modal Điều Khoản Sử Dụng hiển thị rõ ràng với nội dung 4 điều khoản dịch vụ.
2. **Given** modal Điều Khoản Sử Dụng đang mở, **When** người dùng nhấn nút "Đã hiểu và đồng ý", biểu tượng "X", hoặc nhấp vào vùng backdrop đen mờ, **Then** modal đóng lại an toàn (`showTermsModal` thành `false`).
3. **Given** người dùng nhấp nút "Chính sách bảo mật", **When** modal mở ra, **Then** tiêu đề hiển thị chính xác là "Chính Sách Bảo Mật" (đã lược bỏ "& Điều Khoản").

---

### User Story 2 - Cập Nhật Thông Tin Liên Hệ Thật Tại Footer (Priority: P2)

Là một người dùng cần hỗ trợ kỹ thuật hoặc liên hệ nhà phát triển, tôi muốn footer cung cấp địa chỉ email và số điện thoại liên lạc thực tế có thể nhấp trực tiếp (`mailto:` và `tel:`), giúp việc gửi phản hồi hoặc yêu cầu trợ giúp diễn ra tức thì.

**Why this priority**: Thông tin liên hệ dạng placeholder (`hotro@dichtruyen.ai`, `+84 988 000 111`) khiến người dùng không thể liên lạc thực tế khi gặp sự cố dịch thuật hoặc lỗi hệ thống.

**Independent Test**: Kiểm tra liên kết email tại footer có `href="mailto:caoduongle22@gmail.com"` và nhãn `caoduongle22@gmail.com`; kiểm tra liên kết điện thoại có `href="tel:+84357077042"` và nhãn `+84 357 077 042`.

**Acceptance Scenarios**:
1. **Given** liên kết email ở footer, **When** người dùng quan sát hoặc nhấp chuột, **Then** giao diện hiển thị `caoduongle22@gmail.com` và kích hoạt ứng dụng email với địa chỉ `caoduongle22@gmail.com`.
2. **Given** liên kết số điện thoại ở footer, **When** người dùng quan sát hoặc nhấp chuột, **Then** giao diện hiển thị `+84 357 077 042` và liên kết kích hoạt quay số `tel:+84357077042`.

---

### Edge Cases

- **Tương tác modal kép**: Người dùng mở modal Điều Khoản Sử Dụng rồi bấm ESC hoặc click backdrop -> modal đóng độc lập mà không ảnh hưởng tới trạng thái của các modal khác (`showPrivacyModal`, `showApiSettings`, `showAuthModal`).
- **Phím Escape & Click Outside**: Đóng modal chính xác, chống click propagation từ nội dung hộp thoại ra ngoài backdrop.

---

## 2. Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `src/App.tsx` PHẢI khai báo state riêng `const [showTermsModal, setShowTermsModal] = useState(false)`.
- **FR-002**: Nút "Điều khoản sử dụng" tại footer PHẢI kích hoạt `setShowTermsModal(true)` khi click, tách biệt hoàn toàn với `setShowPrivacyModal`.
- **FR-003**: Footer PHẢI hiển thị email thật `caoduongle22@gmail.com` với liên kết `mailto:caoduongle22@gmail.com`.
- **FR-004**: Footer PHẢI hiển thị số điện thoại thật dạng quốc tế `+84 357 077 042` với liên kết `tel:+84357077042`.
- **FR-005**: Tiêu đề của modal Chính sách bảo mật PHẢI được cập nhật thành "Chính Sách Bảo Mật".
- **FR-006**: Ứng dụng PHẢI hiển thị modal mới riêng biệt cho "Điều Khoản Sử Dụng" với con dấu triện "約", 4 điều khoản chi tiết (Tính chất công cụ, Trách nhiệm người dùng, Giới hạn trách nhiệm, Thay đổi điều khoản) và nút đóng "Đã hiểu và đồng ý".
- **FR-007**: Toàn bộ dự án PHẢI biên dịch sạch với `npx tsc --noEmit` và build thành công với `npm run build`.

---

## 3. Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% các nút và liên kết tại footer điều hướng/mở đúng mục tiêu dự định mà không bị trùng lặp modal.
- **SC-002**: Không có lỗi TypeScript (`tsc --noEmit` exit code 0).
- **SC-003**: Bản build production `npm run build` hoàn thành với exit code 0, sinh đầy đủ `dist/client` và `dist/server`.
- **SC-004**: Bộ kiểm thử tự động `npm test` tiếp tục đạt 100% pass (803/803 tests).

---

## 4. Assumptions & Constraints

- Chỉ chỉnh sửa tệp `src/App.tsx`, không tác động đến các component hay schema IndexedDB khác.
- Tận dụng các component và icon đã có sẵn trong dự án: `Seal`, `Button`, `X`, `Mail`, `Phone`.
