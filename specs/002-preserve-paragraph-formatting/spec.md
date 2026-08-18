# Feature Specification: Preserve Paragraph Layout in Translation

**Feature Branch**: `002-preserve-paragraph-formatting`

**Created**: 2026-08-18

**Status**: Draft

**Input**: User description: "hãy kiểm tra lại phần dịch; khi dịch thì thay vì giữ nguyên bố cục thì nó lại khiến cho các đoạn dính hết vào nhau; khiến việc xuất file gặp lỗi"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bảo tồn 100% cấu trúc phân đoạn văn bản gốc khi dịch (Priority: P1) 🎯 MVP

Là một người đọc và dịch truyện, tôi muốn khi AI thực hiện dịch thuật (cả Dịch thô Giai đoạn 1 và Chuốt văn Giai đoạn 2), bản dịch tiếng Việt tạo ra phải giữ nguyên 100% bố cục xuống dòng, khoảng cách đoạn văn của nguyên tác tiếng Trung, thay vì dồn nén toàn bộ câu chữ của cả chương thành một khối chữ khổng lồ.

**Why this priority**: Đây là vấn đề nghiêm trọng ảnh hưởng trực tiếp đến trải nghiệm đọc, tính dễ đọc của tiểu thuyết, và làm sai lệch cấu trúc khi xuất file cho web/audio.

**Independent Test**: Dịch một chương truyện tiếng Trung có 10 đoạn văn riêng biệt. Sau khi hoàn thành dịch thô và chuốt văn, bản dịch tiếng Việt nhận được phải có đúng 10 đoạn văn tương ứng được phân tách bằng các dòng ngắt đoạn (`\n\n`).

**Acceptance Scenarios**:

1. **Given** văn bản tiếng Trung gốc có N đoạn văn được phân tách bằng dòng ngắt đoạn, **When** hệ thống thực hiện dịch thô (Giai đoạn 1) hoặc chuốt văn (Giai đoạn 2), **Then** bản dịch tiếng Việt thu được phải duy trì cấu trúc N đoạn văn tách biệt tương ứng.
2. **Given** các đoạn văn có lời thoại của nhân vật đứng trên từng dòng riêng, **When** AI hoàn thành dịch thuật, **Then** mỗi câu thoại vẫn đứng riêng trên một dòng độc lập, không bị gộp chung vào đoạn văn miêu tả phía trước hoặc phía sau.

---

### User Story 2 - Phân tách độc lập tiêu đề chương và câu văn đầu tiên (Priority: P1)

Là một biên tập viên, tôi muốn tiêu đề chương (ví dụ: "Chương 1: Đài Phát Thanh Kinh Hoàng") nằm riêng biệt trên một dòng ở đầu bản dịch và không bị nối dính liền vào câu văn đầu tiên của thân truyện (ví dụ không bị dính thành "Chương 1: Đài Phát Thanh Kinh Hoàng. Đôi môi đỏ thắm...").

**Why this priority**: Giúp các công cụ xuất file, tách chương và người đọc dễ dàng phân biệt đâu là tiêu đề và đâu là nội dung mở đầu của tác phẩm.

**Independent Test**: Dịch chương 1 có tiêu đề "第一章 恐怖广播", kiểm tra bản dịch tiếng Việt đảm bảo dòng đầu tiên là tiêu đề, sau đó là dòng trống ngắt đoạn, rồi mới đến đoạn văn đầu tiên.

**Acceptance Scenarios**:

1. **Given** văn bản tiếng Trung bắt đầu bằng tiêu đề chương, **When** AI trả về kết quả dịch, **Then** tiêu đề chương và câu văn đầu tiên phải được phân tách bằng ký tự xuống dòng rõ ràng (`\n\n` hoặc `\n`), không kết thúc bằng dấu chấm và nối tiếp câu sau trên cùng một dòng.

---

### User Story 3 - Tự động phục hồi và chuẩn hóa phân đoạn (Priority: P2)

Là một người dùng, tôi muốn hệ thống có cơ chế hậu xử lý thông minh để tự động nhận diện và tách dòng nếu bản dịch từ AI vô tình trả về tiêu đề dính liền với nội dung mở đầu.

**Why this priority**: Cung cấp lớp phòng thủ bổ sung (defense-in-depth), đảm bảo ngay cả khi AI có xu hướng gộp câu, hệ thống vẫn tự động sửa lỗi trước khi lưu vào cơ sở dữ liệu.

**Independent Test**: Truyền một chuỗi văn bản mẫu có dạng `Chương 1: Tiêu đề. Câu mở đầu...` qua bộ tiền/hậu xử lý văn bản, xác minh kết quả tự động tách thành 2 dòng riêng.

**Acceptance Scenarios**:

1. **Given** văn bản dịch trả về có dạng `Chương X: [Tên chương]. [Nội dung]`, **When** hệ thống lưu trữ hoặc chuẩn hóa chương, **Then** hệ thống tự động tách thành `Chương X: [Tên chương]\n\n[Nội dung]`.

---

### Edge Cases

- **Đoạn văn thơ hoặc kệ ngắn**: Các câu thơ 4 chữ, 5 chữ, 7 chữ đứng liền kề nhau trên các dòng riêng biệt cần được giữ nguyên từng dòng thơ.
- **Dịch chia nhỏ (Divide & Conquer / Chunking)**: Khi một chương quá dài được chia thành nhiều đoạn nhỏ để dịch song song, quá trình ghép nối (Merge) phải bảo toàn các dòng ngắt đoạn giữa các chunk mà không làm dính dòng cuối chunk trước vào dòng đầu chunk sau.
- **Văn bản gốc chứa nhiều khoảng trắng thừa ở đầu dòng**: Làm sạch khoảng trắng thụt lề kiểu Trung Quốc (`\u3000`) nhưng vẫn giữ nguyên ngắt dòng đoạn văn.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System Prompt của Giai đoạn 1 (Dịch thô) và Giai đoạn 2 (Chuốt văn) PHẢI quy định điều khoản bắt buộc: "GIỮ NGUYÊN 100% CẤU TRÚC PHÂN ĐOẠN (PARAGRAPH BREAKS). Mỗi đoạn văn tiếng Trung phải tương ứng với một đoạn văn tiếng Việt, phân tách bằng dòng trống. TUYỆT ĐỐI KHÔNG nén các đoạn văn lại thành một khối văn bản duy nhất".
- **FR-002**: System Prompt PHẢI yêu cầu: "Tiêu đề chương PHẢI đứng trên một dòng riêng biệt ở đầu bài, không nối liền câu mở đầu vào sau tiêu đề".
- **FR-003**: Khi thuật toán Divide & Conquer ghép các phân đoạn dịch lại với nhau, hệ thống PHẢI dùng ký tự xuống dòng `\n\n` giữa các phân đoạn thay vì nối liền chuỗi.
- **FR-004**: Hệ thống PHẢI có module tiện ích làm sạch/chuẩn hóa văn bản (`src/utils/textCleaner.ts` hoặc `server/utils/text.ts`) để phát hiện và tự động tách dòng nếu tiêu đề chương và câu đầu tiên bị dính liền bởi dấu chấm.
- **FR-005**: Màn hình Lịch sử chương dịch và Trình dịch thuật PHẢI hiển thị các đoạn văn bản rõ ràng, có khoảng cách đoạn văn tự nhiên (dùng CSS `whitespace-pre-wrap` và khoảng cách đoạn chuẩn).

### Key Entities

- **Đoạn văn (Paragraph)**: Khối văn bản liền mạch kết thúc bằng ký tự ngắt dòng (`\n\n`).
- **Tiêu đề chương (Chapter Title)**: Dòng văn bản định danh đầu tiên của chương.
- **Thân chương (Chapter Body)**: Tập hợp các đoạn văn nội dung theo đúng thứ tự tác phẩm.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% các chương truyện được dịch mới duy trì số lượng đoạn văn tương ứng với bản gốc tiếng Trung (độ lệch phân đoạn < 5%).
- **SC-002**: 100% các chương không còn hiện tượng toàn bộ chương bị nén thành một khối chữ duy nhất không xuống dòng.
- **SC-003**: 100% tiêu đề chương trong bản dịch thô và bản chuốt được phân tách rõ ràng trên dòng riêng biệt.
- **SC-004**: Tệp xuất ra cho Web truyện và Audio tự động nhận diện chính xác tiêu đề và nội dung từng đoạn mà không gặp lỗi dính dòng.

## Assumptions

- Người dùng mong muốn cấu trúc phân đoạn giống như cách trình bày tiểu thuyết tiêu chuẩn tại Việt Nam (các đoạn văn cách nhau 1 dòng trống).
- Việc giữ nguyên phân đoạn không làm giảm chất lượng câu từ tiếng Việt mà còn giúp việc đọc và theo dõi diễn biến truyện dễ dàng hơn nhiều.
