# Feature Specification: Khắc Phục Lỗi Bị Che Chữ & Cho Phép Cuộn Xem Đầy Đủ Thẻ Lỗi Thẩm Định Chất Lượng (133-fix-audit-overflow)

**Feature Branch**: `133-fix-audit-overflow`

**Created**: 2026-09-13

**Status**: Draft

**Input**: User description: "phần thẩm định chất lượng ở tab dịch thuật gặp lỗi bị che chữ; ví dụ khi tìm thấy lỗi mà lỗi quá dài thì chữ bị che mất; không kéo lên được"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Xem Đầy Đủ & Cuộn Nội Dung Trích Đoạn Dài Trong Thẻ Lỗi (Priority: P1)

Là một dịch giả/biên tập viên đang làm việc trong tab Dịch Thuật (Translator Workspace), khi bảng Thẩm Định Chất Lượng hiển thị một lỗi có trích đoạn văn bản (`targetText`) dài (nhiều dòng hoặc đoạn văn hoàn chỉnh), tôi muốn toàn bộ đoạn văn bản đó có thể đọc được đầy đủ thông qua thanh cuộn hoặc nút mở rộng/thu gọn mà không bị cắt cụt (clipping) hay che khuất chữ vĩnh viễn, để tôi có thể nắm bắt đầy đủ ngữ cảnh và đưa ra quyết định chỉnh sửa chính xác.

**Why this priority**: Đây là lỗi UI/UX cốt lõi người dùng phản ánh trực tiếp ("chữ bị che mất; không kéo lên được"). Nếu trích đoạn bị cắt cụt và không cuộn được, người dùng không thể biết câu văn đầy đủ chứa lỗi là gì, làm suy giảm nghiêm trọng giá trị của công cụ thẩm định chất lượng.

**Independent Test**:
- Kích hoạt kiểm định chất lượng hoặc tạo một lỗi giả lập có trích đoạn văn bản tiếng Việt dài 5-10 dòng (hoặc trên 150 ký tự).
- Xác minh rằng người dùng có thể dùng chuột/cảm ứng kéo cuộn mượt mà xem từ đầu đến cuối trích đoạn, hoặc bấm nút xem thêm/thu gọn để mở rộng toàn bộ nội dung mà không mất bất kỳ ký tự nào.

**Acceptance Scenarios**:

1. **Given** một thẻ lỗi có trích đoạn văn bản dài hơn 2 dòng hiển thị trong bảng thẩm định chất lượng, **When** người dùng quan sát thẻ lỗi, **Then** phần trích đoạn không bị ép cứng cắt đứt dòng với thuộc tính che khuất không cuộn được; người dùng có thể cuộn lên/xuống bên trong khung trích đoạn để đọc trọn vẹn văn bản.
2. **Given** một thẻ lỗi có trích đoạn rất dài, **When** người dùng bấm vào nút mở rộng ("Xem thêm") hoặc bấm chọn thẻ lỗi, **Then** khung trích đoạn mở rộng kích thước hiển thị đầy đủ ngữ cảnh đoạn văn bản và chuyển nhãn thành "Thu gọn".
3. **Given** người dùng muốn chọn và sao chép một phần văn bản trong trích đoạn lỗi, **When** người dùng bôi đen văn bản bằng con trỏ chuột, **Then** văn bản được chọn bình thường (`select-text`) mà không bị ngăn cản hay vô tình kích hoạt sự kiện bấm đóng/mở ngoài ý muốn.

---

### User Story 2 - Hiển Thị Toàn Vẹn Tin Nhắn Giải Thích Lỗi & Gợi Ý Viết Lại Từ AI (Priority: P2)

Là một người dùng đang kiểm tra các góp ý từ AI hoặc bộ quy chuẩn dịch thuật, khi nhận được thông báo lỗi có phần giải thích chi tiết (`message`) hoặc đoạn văn bản viết lại đề xuất (`suggestion` / `preview`) dài, tôi muốn văn bản tự động xuống dòng mượt mà, không tràn lề ngang và có vùng cuộn dọc nếu vượt quá chiều cao tối đa, để tôi đọc hiểu trọn vẹn lý do bị bắt lỗi cũng như gợi ý thay thế từ AI.

**Why this priority**: Sau trích đoạn bằng chứng, nội dung giải thích lỗi và văn bản đề xuất viết lại của AI là thông tin quan trọng thứ hai. Nếu tin nhắn dài bị tràn viền hoặc bị khuất, người dùng không nắm được hướng dẫn sửa đổi của hệ thống.

**Independent Test**:
- Kích hoạt lỗi có tin nhắn giải thích dài 300 từ và một gợi ý AI viết lại một đoạn văn phức tạp.
- Xác minh toàn bộ các ký tự hiển thị đầy đủ, ngắt dòng tự nhiên (`break-words`), và vùng xem trước viết lại có thể cuộn dọc mượt mà nếu dài hơn khung chứa.

**Acceptance Scenarios**:

1. **Given** một góp ý AI có nội dung giải thích (`message`) dài nhiều câu, **When** hiển thị trên thẻ lỗi, **Then** văn bản tự động ngắt dòng thông minh, không tràn ra ngoài viền thẻ, không bị che mất phần chân chữ.
2. **Given** một đề xuất viết lại từ AI (`pendingPreviews`) có độ dài nhiều câu hoặc một đoạn văn, **When** người dùng nhấn "Nhờ AI viết lại câu này", **Then** khung hiển thị bản viết lại có chiều cao co giãn linh hoạt hoặc cuộn dọc mượt mà với thanh cuộn chuyên dụng, cho phép người dùng đối chiếu toàn bộ trước khi bấm "Áp dụng" hoặc "Hủy".

---

### User Story 3 - Tối Ưu Chiều Cao Khung Danh Sách Thẻ Lỗi & Điều Hướng Thân Thiện (Priority: P3)

Là một người dùng đang rà soát chương truyện có nhiều lỗi được phát hiện, tôi muốn danh sách thẻ lỗi có chiều cao tối đa rộng rãi, tỷ lệ hợp lý với màn hình làm việc, thanh cuộn rõ ràng và không bị kẹt khi cuộn bằng con lăn chuột, để trải nghiệm duyệt qua danh sách các lỗi diễn ra liên tục, không gây ức chế thị giác.

**Why this priority**: Hỗ trợ nâng cao trải nghiệm người dùng tổng thể, đảm bảo khi nhiều thẻ lỗi mở rộng cùng lúc, khung danh sách vẫn cuộn nhịp nhàng và không làm biến dạng giao diện biên tập dịch thuật.

**Independent Test**:
- Tạo một danh sách gồm 10 lỗi với các kích thước nội dung khác nhau.
- Thử nghiệm cuộn danh sách từ trên xuống dưới bằng chuột và bằng phím tắt (Alt+J, Alt+K).
- Xác minh thẻ lỗi đang được chọn (focus) luôn tự động cuộn vào tầm nhìn (`scrollIntoView`) rõ ràng mà không bị che khuất.

**Acceptance Scenarios**:

1. **Given** danh sách có nhiều thẻ lỗi trong bảng thẩm định, **When** người dùng sử dụng chuột hoặc phím tắt để duyệt lỗi, **Then** khung danh sách cuộn mượt mà với thanh cuộn tinh gọn, độ tương phản trực quan tốt.
2. **Given** người dùng duyệt tới một thẻ lỗi dài ở gần đáy danh sách, **When** thẻ được chọn, **Then** toàn bộ phần nội dung quan trọng của thẻ lỗi hiển thị trọn vẹn trong khung nhìn của người dùng.

---

### Edge Cases

- **Trích đoạn chứa các chuỗi ký tự liền nhau rất dài không có khoảng trắng** (ví dụ: một chuỗi tiếng Trung liên tục không có dấu ngắt, hoặc một liên kết/mã dài): Giao diện phải tự động bẻ dòng bằng quy tắc bẻ từ (`break-words` / `break-all`) để tránh phá vỡ bố cục ngang của thẻ lỗi.
- **Trích đoạn hoặc tin nhắn chứa ký tự xuống dòng nhiều lần (`\n`)**: Khung hiển thị phải giữ nguyên định dạng ngắt dòng (`whitespace-pre-wrap`) để dễ đọc, không gộp thô bạo làm dính chữ.
- **Thao tác bôi đen chọn chữ bên trong trích đoạn để sao chép**: Sự kiện bôi đen không được nhầm lẫn với hành vi click thẻ lỗi gây nhảy con trỏ trong ô soạn thảo ngoài ý muốn.
- **Màn hình hiển thị trên các kích thước hiển thị nhỏ (laptop màn hình 13-14 inch hoặc chia đôi cửa sổ)**: Chiều cao tối đa của danh sách thẻ lỗi phải thích ứng theo tỷ lệ khung nhìn (responsive viewport), không chiếm trọn toàn bộ màn hình khiến thanh cuộn của trình soạn thảo chính bị đẩy mất.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Khung trích đoạn văn bản (`targetText`) của thẻ lỗi trong bảng Thẩm Định Chất Lượng TUYỆT ĐỐI KHÔNG được sử dụng cơ chế cắt dòng cứng kèm ẩn tràn (`line-clamp-2` với `overflow: hidden`) mà không cung cấp khả năng cuộn hoặc mở rộng nội dung cho người dùng.
- **FR-002**: Khung trích đoạn văn bản có nội dung dài hơn 2 dòng PHẢI hỗ trợ cuộn dọc độc lập (`overflow-y-auto`) với chiều cao tối đa phù hợp, đồng thời hỗ trợ ngắt dòng an toàn (`break-words` / `whitespace-pre-wrap`) để người dùng có thể kéo cuộn xem trọn vẹn từng từ.
- **FR-003**: Mỗi thẻ lỗi có trích đoạn dài PHẢI hỗ trợ cơ chế chuyển đổi mở rộng/thu gọn (ví dụ: nút bấm "Xem thêm / Thu gọn" hoặc tự động mở rộng khi thẻ được kích hoạt/focus), cho phép người dùng tùy ý đọc toàn văn bản trích đoạn mà không cần thao tác cuộn trong ô nhỏ.
- **FR-004**: Phần tin nhắn giải thích lỗi (`message`) và khung hiển thị gợi ý viết lại từ AI (`pendingPreviews`) PHẢI được trang bị khả năng tự bẻ từ (`break-words`) và vùng cuộn dọc có giới hạn chiều cao tối đa, ngăn ngừa hiện tượng chữ bị che khuất hoặc tràn lề giao diện.
- **FR-005**: Văn bản bên trong trích đoạn và khung gợi ý viết lại PHẢI cho phép người dùng chọn và bôi đen tự do (`select-text`) phục vụ sao chép hoặc kiểm tra chi tiết ký tự.
- **FR-006**: Khung chứa danh sách các thẻ lỗi trong bảng Thẩm Định Chất Lượng PHẢI duy trì chiều cao hiển thị hợp lý (tối ưu từ 24rem đến 32rem hoặc thích ứng theo chiều cao màn hình) kèm thanh cuộn mượt mà, đảm bảo việc cuộn danh sách và cuộn nội dung từng thẻ không bị xung đột.
- **FR-007**: Tính năng cuộn và mở rộng thẻ lỗi PHẢI tương thích hoàn toàn với hệ thống phím tắt điều hướng hiện có (Alt+J: lỗi tiếp theo, Alt+K: lỗi trước đó, Alt+Enter: áp dụng sửa nhanh/viết lại) và tự động căn chỉnh thẻ đang chọn vào tầm nhìn người dùng.

### Key Entities *(include if feature involves data)*

- **UnifiedAuditIssue**: Thực thể dữ liệu mô tả một vấn đề chất lượng thống nhất (tích hợp từ Hako Rule hoặc AI QA Critique), bao gồm các trường: `id`, `title`, `message`, `severity`, `source`, `targetText`, `status`, `autoFixable`, `suggestion`.
- **CardExpandState**: Trạng thái giao diện tại chỗ (local UI state) quản lý việc mở rộng toàn phần hay hiển thị dạng cuộn gọn của từng thẻ lỗi đang hiển thị trên bảng thẩm định.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% các trích đoạn lỗi dài (kể cả trên 1.000 ký tự hoặc nhiều câu liên tục) hiển thị đầy đủ nội dung, không có bất kỳ ký tự nào bị che khuất vĩnh viễn hoặc không thể kéo cuộn xem được.
- **SC-002**: Người dùng có thể kéo cuộn (scroll/drag) nội dung trích đoạn mượt mà 100% số lần thử nghiệm trên cả chuột và thao tác cảm ứng/bàn di chuột.
- **SC-003**: Tỷ lệ hoàn thành tác vụ đọc hiểu lỗi và quyết định sửa đổi của người dùng đạt 100% mà không gặp cản trở về mặt hiển thị văn bản.
- **SC-004**: Toàn bộ hệ thống kiểm thử tự động (unit test, integration test, type check và production build) đạt 100% pass status, không có lỗi hồi quy phát sinh trên các tính năng hiện có.

## Assumptions

- Sự cố "bị che chữ, không kéo lên được" phát sinh do thuộc tính CSS `line-clamp-2` kết hợp `overflow: hidden` trên phần tử hiển thị `issue.targetText` trong component `UnifiedAuditPanel.tsx`.
- Việc khắc phục sự cố này là một cải tiến thuần túy về mặt giao diện người dùng (Presentation / View Layer), không làm thay đổi cấu trúc dữ liệu `UnifiedAuditIssue`, không ảnh hưởng đến cơ chế phát hiện lỗi của AI hay IndexedDB storage.
- Hệ sinh thái Tailwind v4 và các primitive UI hiện có (`Button`, `Badge`, `EmptyState`, `cn`) cung cấp đầy đủ các tiện ích cần thiết để xử lý thanh cuộn và khả năng hiển thị mà không cần cài đặt thêm thư viện ngoài.
