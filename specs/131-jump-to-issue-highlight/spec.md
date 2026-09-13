# Feature Specification: Định Vị & Làm Nổi Bật Đoạn Lỗi Khi Mở Bàn Dịch (Jump to Issue & Highlight in Translator)

**Feature Branch**: `131-jump-to-issue-highlight`

**Created**: 2026-09-13

**Status**: Draft

**Input**: User description: "tôi muốn cải tiến; khi ấn vào chỗ mở bản dịch để sửa thì sẽ mở thẳng đoạn lỗi luôn; đoạn lỗi sẽ được highlight ; đỡ phải đi tìm"

---

## Bối Cảnh & Mục Tiêu (Context & Goals)

Tại tab **Kiểm Định Hako**, khi phát hiện các vi phạm về chất lượng dịch thuật (lỗi xưng hô, lỗi dịch sai, sót Hán tự, lặp từ...), mỗi thẻ lỗi (`HakoIssueCard`) đều cung cấp nút hành động **"Mở trong Bàn Dịch để sửa"** (ảnh đính kèm `media_1789280493562.png`).

Hiện tại, khi người dùng nhấp vào nút này, hệ thống mới chỉ điều hướng sang tab Bàn Dịch (`translate`) và nạp nội dung của chương đó vào không gian làm việc. Người kiểm định hoặc dịch giả vẫn phải tự mình đọc dò thủ công qua hàng ngàn từ hoặc nhấn `Ctrl+F` để tự tìm xem câu văn lỗi nằm ở đoạn nào trong chương.

**Mục tiêu tính năng**:
Khi người dùng nhấp nút "Mở trong Bàn Dịch để sửa", hệ thống sẽ:
1. Tự động chuyển ngay sang tab Bàn Dịch và nạp đúng chương tương ứng.
2. Tự động cuộn màn hình (auto-scroll) đến đúng vị trí của đoạn trích lỗi (`vietnameseSnippet`).
3. Tự động bôi chọn (native selection range) và làm nổi bật trực quan (visual highlight / toast feedback) đoạn lỗi đó ngay lập tức.
4. Giúp người dùng bắt tay vào chỉnh sửa ngay mà không mất thời gian tìm kiếm.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mở trực tiếp và bôi chọn đoạn văn bản lỗi từ Thẻ lỗi Kiểm Định Hako (Priority: P1) 🎯 MVP

Người dùng đang xem xét một lỗi dịch thuật cụ thể tại thẻ lỗi trong tab Kiểm Định Hako (ví dụ lỗi dịch sai nghĩa gốc của câu: *"Món đồ nhỏ bạn gái tặng mà không vứt đi được, phiền chết đi được."*). Người dùng nhấp vào nút **"Mở trong Bàn Dịch để sửa"**. Hệ thống lập tức chuyển sang Bàn Dịch, tự động mở đúng phiên bản dịch phù hợp (Chuốt mịn hoặc Dịch thô), cuộn văn bản đến đúng dòng chứa câu lỗi, bôi chọn toàn bộ đoạn văn bản lỗi và đặt tiêu điểm (focus) vào ô soạn thảo để người dùng có thể gõ phím sửa ngay.

**Why this priority**: Đây là giá trị cốt lõi giải quyết trực tiếp nhu cầu của người dùng ("mở thẳng đoạn lỗi luôn, đoạn lỗi sẽ được highlight, đỡ phải đi tìm").

**Independent Test**:
- Bước 1: Tại tab Kiểm Định Hako, tìm một thẻ lỗi có trích đoạn bản dịch làm bằng chứng.
- Bước 2: Bấm nút "Mở trong Bàn Dịch để sửa".
- Bước 3: Quan sát màn hình lập tức chuyển sang Bàn Dịch, nội dung cuộn đến đoạn lỗi và câu văn vi phạm được bôi đen nổi bật.

**Acceptance Scenarios**:
1. **Given** người dùng đang ở tab Kiểm Định Hako và xem một thẻ lỗi có chứa trích đoạn bản dịch làm bằng chứng, **When** người dùng nhấp nút "Mở trong Bàn Dịch để sửa", **Then** hệ thống chuyển sang tab Bàn Dịch, nạp dữ liệu chương tương ứng, tự động cuộn đến vị trí đoạn lỗi và bôi chọn toàn bộ đoạn trích đó trong ô soạn thảo.
2. **Given** chương có cả Bản dịch thô (`rawTranslation`) và Bản chuốt mịn (`polishedTranslation`), và đoạn lỗi nằm trong bản chuốt mịn, **When** người dùng mở sửa từ thẻ lỗi, **Then** hệ thống tự động kích hoạt tab Chuốt mịn và bôi chọn đoạn lỗi trong khung soạn thảo chuốt mịn.
3. **Given** chương chỉ có Bản dịch thô hoặc lỗi xuất phát từ bản dịch thô, **When** người dùng mở sửa từ thẻ lỗi, **Then** hệ thống tự động kích hoạt tab Dịch thô và bôi chọn đoạn lỗi trong khung soạn thảo dịch thô.

---

### User Story 2 - Tìm kiếm thông minh và thích ứng khi trích đoạn lỗi có sai khác nhẹ (Priority: P2)

Đôi khi trích đoạn lỗi từ AI hoặc bộ quét Heuristic có chứa thêm dấu ngoặc kép bọc ngoài (`"..."`, `“...”`), dấu chấm lửng cuối câu (`...`), hoặc khoảng trắng thừa so với văn bản gốc trong ô soạn thảo. Hệ thống cung cấp cơ chế tìm kiếm thông minh (chuẩn hóa khoảng trắng, lược bỏ dấu bao quanh) để vẫn định vị chính xác vị trí câu văn trong nội dung chương thay vì báo không tìm thấy.

**Why this priority**: Tăng tính bền vững và trải nghiệm liền mạch, đảm bảo tỷ lệ định vị thành công cao ngay cả khi định dạng trích dẫn của AI có độ lệch nhẹ.

**Independent Test**:
- Kiểm thử với một trích đoạn lỗi có dấu ngoặc kép hoặc dấu ba chấm cuối câu không khớp hoàn toàn từng ký tự với bản dịch thô/chuốt -> Hệ thống vẫn bôi chọn đúng câu văn tương ứng trong editor.

**Acceptance Scenarios**:
1. **Given** đoạn trích lỗi có chứa dấu ngoặc kép bao quanh nhưng trong văn bản gốc không có dấu ngoặc này, **When** người dùng bấm mở để sửa, **Then** hệ thống tự động lược bỏ dấu bao quanh và bôi chọn đúng câu văn trong ô soạn thảo.
2. **Given** đoạn trích lỗi có các ký tự xuống dòng hoặc nhiều khoảng trắng liên tiếp, **When** hệ thống tìm kiếm trong editor, **Then** hệ thống áp dụng thuật toán so khớp chuẩn hóa để định vị đúng phân đoạn văn bản.

---

### User Story 3 - Phản hồi thị giác trực quan và thông báo trạng thái rõ ràng (Priority: P2)

Khi chuyển sang Bàn Dịch, người dùng nhận được phản hồi trực quan rõ ràng xác nhận vị trí lỗi đã được tìm thấy. Trong trường hợp hiếm hoi đoạn văn bản lỗi đã được người dùng chỉnh sửa hoặc xóa bỏ từ trước khiến câu văn không còn tồn tại, hệ thống cung cấp thông báo trạng thái thân thiện, không gây hoang mang.

**Why this priority**: Cung cấp phản hồi ngữ cảnh tức thời giúp người dùng an tâm và hiểu rõ trạng thái văn bản.

**Independent Test**:
- Mở một lỗi hợp lệ -> Thấy thông báo nhỏ xác nhận "Đã định vị đoạn lỗi trong bản dịch".
- Mở một lỗi mà văn bản đó đã bị xóa trước đó -> Thấy thông báo "Không tìm thấy đoạn văn vi phạm trong bản dịch hiện tại, có thể nội dung đã được sửa." và không làm lỗi ứng dụng.

**Acceptance Scenarios**:
1. **Given** đoạn trích lỗi được định vị và bôi chọn thành công trong Bàn Dịch, **When** màn hình hiển thị, **Then** hệ thống hiển thị thông báo ngắn xác nhận vị trí đã được tìm thấy để người dùng bắt đầu biên tập.
2. **Given** đoạn văn bản vi phạm không còn tồn tại trong nội dung chương (do đã được sửa trước đó), **When** người dùng bấm mở từ thẻ lỗi, **Then** hệ thống nạp chương bình thường, giữ nguyên vị trí đầu trang và hiển thị thông báo giải thích nhẹ nhàng.

---

## Edge Cases

- **Chương có dung lượng lớn (trên 10,000 từ), vị trí lỗi nằm ở gần cuối chương**: Quá trình cuộn phải đảm bảo mượt mà, tính toán vị trí cuộn có khoảng đệm an toàn (buffer lines) để đoạn văn bản không bị che khuất bởi thanh công cụ trên cùng hoặc mép màn hình.
- **Đoạn trích lỗi xuất hiện lặp lại nhiều lần trong chương**: Hệ thống bôi chọn lần xuất hiện phù hợp nhất (mặc định lần xuất hiện đầu tiên) và định vị rõ ràng.
- **Mở từ danh sách chương tổng thể (chưa chỉ định lỗi cụ thể)**: Nếu người dùng bấm nút "Mở trong Bàn Dịch" từ danh sách tổng hợp chương (không xuất phát từ một thẻ lỗi cụ thể), hệ thống mở chương bình thường ở vị trí mặc định mà không kích hoạt chế độ tìm kiếm đoạn lỗi.
- **Chuyển tab khi đang có các tác vụ dịch nền**: Việc chuyển tab và kích hoạt highlight không làm gián đoạn hoặc xung đột với các tiến trình tự động dịch đang chạy ngầm.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Nút "Mở trong Bàn Dịch để sửa" trên thẻ lỗi (`HakoIssueCard`) PHẢI truyền đầy đủ thông tin nhận diện lỗi bao gồm ID chương (`chapterId`) và đoạn trích văn bản vi phạm (`vietnameseSnippet`).
- **FR-002**: Trình điều hướng ứng dụng PHẢI chuyển người dùng sang tab Bàn Dịch (`translate`), nạp dữ liệu của chương tương ứng và chuyển tiếp yêu cầu định vị đoạn lỗi xuống không gian làm việc của Bàn Dịch.
- **FR-003**: Không gian làm việc Bàn Dịch PHẢI tự động kích hoạt giai đoạn dịch phù hợp (`activeStage` là `polished` hoặc `raw`) nơi đoạn văn bản lỗi đang hiện diện.
- **FR-004**: Hệ thống PHẢI tự động cuộn (auto-scroll) ô văn bản mục tiêu (`HTMLTextAreaElement`) đến đúng vị trí xuất hiện của đoạn lỗi với khoảng đệm an toàn phía trên (tối thiểu 2 dòng hiển thị) để văn bản không bị sát mép trên.
- **FR-005**: Hệ thống PHẢI bôi chọn (native selection range) chính xác từ vị trí bắt đầu đến vị trí kết thúc của đoạn lỗi trong ô soạn thảo, đồng thời đặt tiêu điểm (focus) vào ô soạn thảo đó.
- **FR-006**: Thuật toán định vị PHẢI hỗ trợ cơ chế chuẩn hóa (chuẩn hóa khoảng trắng, lược bỏ dấu ngoặc kép bao ngoài và dấu chấm lửng) để tăng khả năng so khớp thành công khi đoạn trích dẫn có sai khác định dạng nhỏ.
- **FR-007**: Hệ thống PHẢI hiển thị thông báo phản hồi trực quan (toast notification) khi định vị thành công hoặc khi không tìm thấy đoạn văn bản trong nội dung chương.
- **FR-008**: Thông tin định vị đoạn lỗi PHẢI được tự động dọn dẹp sau khi đã thực hiện xong (one-time consumption) để tránh việc cuộn lặp lại ngoài ý muốn khi người dùng chuyển đổi tab sau đó.

---

### Key Entities

- **Đoạn trích lỗi (Issue Snippet)**: Chuỗi văn bản tiếng Việt chứa điểm bất thường hoặc sai phạm quy chuẩn được trích xuất làm bằng chứng kiểm định.
- **Ngữ cảnh điều hướng sâu (Deep Link Target)**: Gói thông tin truyền từ Kiểm Định Hako sang Bàn Dịch gồm ID chương, đoạn trích cần bôi chọn, và ID lỗi.
- **Trạng thái bôi chọn (Selection State)**: Vị trí bắt đầu (`selectionStart`), vị trí kết thúc (`selectionEnd`) và độ dịch chuyển cuộn (`scrollTop`) trong khung soạn thảo.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% các lần bấm nút "Mở trong Bàn Dịch để sửa" từ thẻ lỗi đưa người dùng đến đúng vị trí đoạn lỗi trong Bàn Dịch.
- **SC-002**: Thời gian từ khi bấm nút đến khi đoạn văn bản được bôi chọn và cuộn vào tầm mắt hoàn tất trong vòng dưới 300ms.
- **SC-003**: Tỷ lệ định vị thành công đạt trên 95% đối với các đoạn trích dẫn có chứa dấu ngoặc kép, khoảng trắng thừa hoặc xuống dòng.
- **SC-004**: 0% trường hợp crash ứng dụng hoặc lỗi lệch vùng nhớ khi chuyển đổi giữa Kiểm Định Hako và Bàn Dịch.
- **SC-005**: 100% test cases cho luồng deep link và highlight đoạn văn bản trong Bàn Dịch vượt qua kiểm thử tự động.

---

## Assumptions

- Người dùng truy cập Bàn Dịch trên trình duyệt hỗ trợ các phương thức DOM chuẩn (`setSelectionRange`, `scrollTop`, `focus`).
- Bản dịch của chương đã được lưu trữ trong cơ sở dữ liệu IndexedDB của dự án và sẵn sàng nạp vào editor.
- Mặc định ưu tiên tìm kiếm và bôi chọn trên Bản chuốt mịn (`polished`) nếu chương đã qua chuốt mịn, nếu chưa thì tìm trên Bản dịch thô (`raw`).
