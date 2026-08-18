# Feature Specification: Web Chapter Export Formatting

**Feature Branch**: `001-export-web-format`

**Created**: 2026-08-18

**Status**: Draft

**Input**: User description: "hãy kiểm tra lại phần xuất tệp cho web truyện; khi tôi xuất thì phần nội dung bị đẩy lên chương truyện; tôi muốn khi xuất thì nó sẽ có dạng : *** Tên chương 1 \n Nội dung chương 1... \n\n *** Tên chương 2 \n Nội dung chương 2..."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Chuẩn hóa định dạng xuất tệp cho Web truyện (Priority: P1)

Là một người dịch truyện và quản trị viên web truyện, tôi muốn khi xuất các chương truyện dưới chế độ "Web", mỗi chương bắt đầu chính xác bằng dòng tiêu đề tiền tố `*** [Tên chương]` và theo sau ngay bên dưới là toàn bộ phần thân nội dung của chương đó (không bị cắt bớt hoặc nuốt mất dòng đầu vào tiêu đề, và không bị lặp tiêu đề trong phần nội dung).

**Why this priority**: Đây là luồng nghiệp vụ cốt lõi của tính năng xuất bản truyện cho web, đảm bảo các nền tảng đăng truyện tự động nhận diện đúng cấu trúc chương và nội dung chương mà không cần chỉnh sửa thủ công.

**Independent Test**: Chọn chế độ xuất Web cho từ 1 đến nhiều chương, kiểm tra tệp văn bản xuất ra đảm bảo mỗi chương có cấu trúc:
```text
*** Tên chương 1
Nội dung dòng 1 chương 1...
Nội dung dòng 2 chương 1...

*** Tên chương 2
Nội dung dòng 1 chương 2...
```

**Acceptance Scenarios**:

1. **Given** một chương truyện đã hoàn thành bản dịch có tiêu đề "Chương 1: Khởi đầu mới" và phần nội dung dịch gồm 5 đoạn văn, **When** người dùng thực hiện xuất tệp ở chế độ Web, **Then** tệp tạo ra phải chứa dòng `*** Chương 1: Khởi đầu mới` ngay dòng đầu tiên, theo sau bởi 5 đoạn văn nội dung, và không có đoạn văn nào bị dồn/đẩy lên cùng dòng tiêu đề.
2. **Given** danh sách gồm nhiều chương (ví dụ Chương 1 và Chương 2), **When** người dùng chọn xuất tệp gộp nhiều chương theo định dạng Web, **Then** giữa các chương phải có khoảng cách dòng phân cách rõ ràng (`\n\n`) trước khi bắt đầu bằng dòng `*** Tên chương [N]`.
3. **Given** nội dung bản dịch có chứa tiêu đề lặp lại ở những dòng đầu tiên, **When** hệ thống trích xuất và định dạng, **Then** tiêu đề chỉ xuất hiện 1 lần duy nhất trên dòng có tiền tố `*** ` và không bị lặp lại trong phần thân nội dung chương.

---

### User Story 2 - Xử lý tính toàn vẹn của nội dung chương (Priority: P2)

Là một độc giả hoặc biên tập viên, tôi muốn đảm bảo mọi câu chữ trong phần thân truyện không bị thất thoát hoặc bị nhầm lẫn là tiêu đề phụ khi định dạng xuất tệp.

**Why this priority**: Đảm bảo nội dung tác phẩm luôn nguyên vẹn, chính xác 100% so với bản dịch đã duyệt.

**Independent Test**: Xuất một chương có nội dung chứa các từ khóa đặc biệt (ví dụ: nhân vật nhắc đến "Chương", "Hồi", "Tập" ở giữa đoạn văn) và xác minh các câu thoại/đoạn văn đó vẫn nằm trọn vẹn trong phần thân chương.

**Acceptance Scenarios**:

1. **Given** phần thân chương chứa các câu văn thông thường có từ "Chương", **When** xuất tệp Web, **Then** hệ thống không xóa nhầm hoặc ngắt đoạn sai các câu văn này.

---

### Edge Cases

- **Chương không có tiêu đề rõ ràng hoặc tiêu đề dạng chữ Hán chưa dịch**: Hệ thống phải tự động chuẩn hóa sang định dạng tiếng Việt chuẩn (`Chương [Số Thứ Tự]`) và gắn tiền tố `*** `.
- **Tiêu đề chương đã có sẵn dấu sao (`***`) từ trước**: Hệ thống chuẩn hóa để chỉ giữ đúng 1 tiền tố `*** ` duy nhất, tránh tình trạng `****** Tên chương`.
- **Nội dung chương có nhiều dòng trống liên tiếp**: Hệ thống dọn dẹp các dòng trống dư thừa nhưng vẫn giữ khoảng cách đoạn văn tự nhiên và rõ ràng.
- **Xuất hàng loạt nhiều chương**: Các chương phân cách nhau bởi 2 ký tự xuống dòng (`\n\n`) trước khi bắt đầu khối `*** Tên chương kế tiếp`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI gắn tiền tố `*** ` (ba dấu sao kèm một khoảng trắng) vào đầu dòng tiêu đề của mỗi chương khi xuất tệp ở chế độ Web.
- **FR-002**: Dòng tiêu đề chương PHẢI nằm riêng biệt trên một dòng, ngay trước dòng đầu tiên của nội dung chương.
- **FR-003**: Nội dung thân chương PHẢI bắt đầu ở dòng tiếp theo ngay sau dòng tiêu đề `*** [Tên chương]`.
- **FR-004**: Giữa các chương liên tiếp trong cùng một tệp PHẢI được ngăn cách bằng khoảng trống phân đoạn rõ ràng (`\n\n`).
- **FR-005**: Hệ thống PHẢI loại bỏ tình trạng trùng lặp tiêu đề trong phần thân nội dung nếu tiêu đề đã được hiển thị ở dòng `*** `.
- **FR-006**: Hệ thống PHẢI bảo toàn toàn bộ nội dung dịch của các đoạn văn, không làm mất dòng đầu tiên của chương do lỗi nhận diện tiêu đề.

### Key Entities

- **Chương truyện (Chapter)**: Đại diện cho một đơn vị chương sách, bao gồm tiêu đề chương (Title) và phần thân nội dung đã dịch (Content/Translation).
- **Tệp xuất bản Web (Web Export Document)**: Tệp văn bản tổng hợp chứa một hoặc nhiều chương truyện được định dạng chuẩn hóa theo quy cách `*** [Tên chương]\n[Nội dung]`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% các chương được xuất ra ở chế độ Web đều bắt đầu bằng định dạng chuẩn `*** [Tên chương]` trên một dòng độc lập.
- **SC-002**: 100% nội dung thân chương không bị dồn lên cùng dòng với tiêu đề `*** `.
- **SC-003**: Người dùng có thể sao chép hoặc tải tệp xuất bản và đăng tải trực tiếp lên các website đọc truyện mà không cần thao tác căn chỉnh lại vị trí tiêu đề thủ công.
- **SC-004**: Không có bất kỳ dòng nội dung dịch hợp lệ nào bị thất thoát trong quá trình làm sạch và phân tách tiêu đề/nội dung.

## Assumptions

- Định dạng chuẩn cho web truyện yêu cầu tiền tố `*** ` phía trước tên chương để các công cụ tự động tách chương của website đọc truyện nhận diện được mục lục.
- Thứ tự các chương trong tệp xuất ra tuân theo đúng thứ tự sắp xếp của dự án.
- Chế độ xuất tệp Audio hoặc các chế độ xuất khác không bị ảnh hưởng bởi quy tắc gắn `*** ` của chế độ Web.
