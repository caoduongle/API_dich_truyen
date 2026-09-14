# Feature Specification: Tự Động Cuộn & Bôi Đen Đoạn Lỗi Khi Bấm "Mở Trong Bàn Dịch Để Sửa" (135-open-translator-highlight)

**Feature Branch**: `135-open-translator-highlight`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: "tôi muốn khi ấn nút mở trong bản dịch thì nó cũng sẽ làm như trên; khung soạn thảo bên dưới sẽ tự động cuộn đến và bôi đen (highlight) đoạn văn bị lặp lại đó, giúp bạn xóa hoặc chỉnh sửa ngay lập tức mà không phải tìm thủ công." kèm ảnh chụp màn hình thẻ lỗi Kiểm Định Hako với nút "Mở trong Bàn Dịch để sửa".

---

## Bối Cảnh & Mục Tiêu (Context & Goals)

Tại màn hình **Kiểm Định Hako** (rà soát chất lượng bản dịch tự động/AI), mỗi thẻ lỗi vi phạm (ví dụ: lặp lại câu chữ, dịch sai nghĩa gốc, sót Hán tự, mâu thuẫn xưng hô) đều có nút bấm **"Mở trong Bàn Dịch để sửa"** (`HakoIssueCard.tsx`).

Người dùng mong muốn hành vi tương tự như tính năng "Click để định vị" trên panel thẩm định của Bàn Dịch: Khi bấm nút mở từ thẻ lỗi kiểm định, hệ thống phải:
1. Chuyển ngay sang tab **Bàn Dịch** và nạp toàn bộ nội dung của chương truyện tương ứng.
2. Đợi dữ liệu chương nạp hoàn tất và tự động chọn đúng phân vùng dịch (Bản chuốt mịn hoặc Bản dịch thô) chứa đoạn lỗi.
3. Khung soạn thảo văn bản bên dưới sẽ **tự động cuộn mượt (auto-scroll) đến đúng vị trí đoạn văn vi phạm** và **tự động bôi đen (native selection highlight) toàn bộ đoạn trích làm bằng chứng**, đồng thời đưa con trỏ bàn phím (focus) vào ô soạn thảo.
4. Cho phép người dùng bấm phím xóa (Delete/Backspace) hoặc gõ chỉnh sửa ngay lập tức mà không phải tốn công cuộn dò tìm thủ công trong hàng ngàn dòng văn bản.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tự động định vị và bôi đen câu văn lỗi ngay khi mở chương từ thẻ Kiểm Định (Priority: P1) 🎯 MVP

Là một dịch giả hoặc biên tập viên đang rà soát danh sách lỗi trong màn hình Kiểm Định Hako, khi nhìn thấy một thẻ lỗi (ví dụ: thẻ báo lỗi dịch sai nghĩa gốc với trích đoạn bằng chứng: *"hắn há hốc mồm thở ra một ngàn khói trắng, gương mặt đờ đẫn ngẩn ngơ."*), tôi bấm nút **"Mở trong Bàn Dịch để sửa"**. Tôi muốn hệ thống mở ngay chương tương ứng trong Bàn Dịch, tự động cuộn khung soạn thảo đến dòng văn bản vi phạm và bôi đen chính xác câu văn đó để tôi có thể xóa hoặc sửa lại tức thì.

**Why this priority**: Đây là luồng nghiệp vụ quan trọng nhất mà người dùng yêu cầu trực tiếp. Việc phải đọc dò thủ công từng trang văn bản dài khi chuyển từ báo cáo kiểm duyệt sang bàn dịch gây mất thời gian và giảm hiệu suất biên tập.

**Independent Test**:
- Tại tab Kiểm Định Hako, chọn bất kỳ thẻ lỗi nào đang hiển thị có trích đoạn làm bằng chứng.
- Bấm nút "Mở trong Bàn Dịch để sửa".
- Xác minh: Hệ thống chuyển sang tab Bàn Dịch, chương được nạp đầy đủ, ô soạn thảo bên dưới tự động cuộn đến câu văn đó và câu văn được bôi đen (selected) sẵn sàng để chỉnh sửa.

**Acceptance Scenarios**:
1. **Given** người dùng bấm nút "Mở trong Bàn Dịch để sửa" tại một thẻ lỗi của chương chưa được mở trước đó, **When** tab Bàn Dịch hiển thị và nạp xong dữ liệu chương, **Then** khung soạn thảo tự động cuộn đến vị trí đoạn trích lỗi và bôi đen toàn bộ đoạn trích đó.
2. **Given** đoạn lỗi nằm trong Bản chuốt mịn (hoặc Bản dịch thô), **When** chương được mở lên, **Then** hệ thống tự động kích hoạt đúng phân vùng chứa đoạn lỗi (tab Biên tập hoặc tab Dịch thô) trước khi thực hiện cuộn và bôi đen.
3. **Given** người dùng đang ở tab Biên tập và câu văn lỗi đã được bôi đen, **When** người dùng gõ phím hoặc nhấn Backspace/Delete, **Then** câu văn lỗi lập tức được thay thế hoặc xóa bỏ mà không cần thao tác chuột thêm.

---

### User Story 2 - Loại bỏ xung đột thời gian nạp dữ liệu chương & Giữ yêu cầu Highlight không bị mất (Priority: P1)

Khi chuyển từ màn hình Kiểm Định sang Bàn Dịch, dữ liệu chương cần được truy vấn từ kho lưu trữ cục bộ (IndexedDB). Quá trình này diễn ra bất đồng bộ. Hệ thống phải đảm bảo yêu cầu bôi đen (highlight request) được giữ lại cho đến khi dữ liệu chương thực sự đã được đưa vào khung soạn thảo, tuyệt đối không được kích hoạt sớm trên dữ liệu rỗng hoặc dữ liệu của chương cũ trước đó rồi tự động hủy bỏ.

**Why this priority**: Nếu xử lý định vị chạy trước khi văn bản chương mới được hiển thị vào khung soạn thảo, hệ thống sẽ kết luận sai là "Không tìm thấy đoạn văn" và xóa mất lệnh bôi đen, khiến người dùng mở chương lên mà không thấy cuộn hay bôi đen gì cả.

**Independent Test**:
- Đang mở Chương A trong Bàn Dịch, sau đó chuyển sang tab Kiểm Định Hako.
- Chọn một lỗi thuộc Chương B và bấm "Mở trong Bàn Dịch để sửa".
- Xác minh: Hệ thống nạp nội dung Chương B thành công, và đoạn lỗi của Chương B được cuộn và bôi đen chính xác, không bị lỗi do còn lưu vết Chương A.

**Acceptance Scenarios**:
1. **Given** Bàn Dịch đang hiển thị một chương khác hoặc đang ở trạng thái rỗng, **When** người dùng bấm mở sửa một lỗi từ Kiểm Định, **Then** cơ chế định vị kiên nhẫn chờ đến khi văn bản của đúng chương mục tiêu được nạp vào editor rồi mới thực thi cuộn và bôi chọn.
2. **Given** quá trình định vị và bôi đen hoàn tất thành công, **When** người dùng tiếp tục thao tác soạn thảo hoặc chuyển đổi qua lại giữa các phân vùng, **Then** trạng thái highlight dùng 1 lần được giải phóng sạch sẽ, không tự ý cuộn nhảy lại làm gián đoạn người dùng.

---

### User Story 3 - Tìm kiếm bền bỉ với định dạng trích dẫn phức tạp hoặc lệch ký tự (Priority: P2)

Trích đoạn làm bằng chứng từ bộ kiểm duyệt AI hoặc công cụ quét quy chuẩn đôi khi có chứa dấu ngoặc kép bọc ngoài (`"..."`, `“...”`, `'...'`), khoảng trắng thừa, hoặc dấu chấm lửng (`...`). Hệ thống định vị cần tự động chuẩn hóa và tìm kiếm linh hoạt (exact match → trimmed quotes → whitespace normalization) để đảm bảo luôn định vị và bôi đen đúng đoạn văn bản trong khung soạn thảo.

**Why this priority**: Đảm bảo trải nghiệm định vị ổn định và không phụ thuộc vào việc AI có bọc trích dẫn trong ngoặc kép hay không.

**Independent Test**:
- Kiểm thử với thẻ lỗi có trích đoạn chứa dấu ngoặc kép bọc ngoài `""` mà trong văn bản bản dịch không có ngoặc kép.
- Xác minh: Khung soạn thảo vẫn bôi đen đúng nội dung bên trong dấu ngoặc kép.

**Acceptance Scenarios**:
1. **Given** trích đoạn làm bằng chứng trong thẻ lỗi có chứa dấu ngoặc kép hoặc dấu ba chấm bao quanh, **When** định vị trong khung soạn thảo, **Then** hệ thống bôi đen chính xác câu văn tương ứng mà không bị báo lỗi không tìm thấy.
2. **Given** đoạn trích lỗi là một đoạn văn dài nhiều dòng, **When** cuộn tới vị trí lỗi, **Then** khung soạn thảo cuộn có khoảng cách đệm hiển thị hợp lý (ít nhất 2 dòng nhìn thấy ở trên) để câu văn không bị che khuất bởi thanh công cụ phía trên.

---

### User Story 4 - Đồng bộ chọn thẻ lỗi trên Panel Thẩm Định trong Bàn Dịch (Priority: P3)

Khi người dùng chuyển sang Bàn Dịch thông qua nút "Mở trong Bàn Dịch để sửa" của một lỗi cụ thể, panel kiểm định chất lượng bên phải (`UnifiedAuditPanel`) cũng tự động chuyển sang tab phù hợp ("Góp ý AI" hoặc "Quy chuẩn Hako") và làm nổi bật (focus) thẻ lỗi tương ứng, giúp người dùng dễ dàng xem gợi ý sửa câu hoặc bấm nút "Viết lại bằng AI" nếu muốn.

**Why this priority**: Tạo sự đồng bộ và liền mạch 100% giữa màn hình Kiểm Định tổng quan và Bàn Dịch chi tiết.

**Independent Test**:
- Bấm "Mở trong Bàn Dịch để sửa" từ một lỗi thuộc loại Góp ý AI.
- Quan sát tại Bàn Dịch: Thẻ lỗi đó cũng được làm sáng hoặc chọn trong danh sách thẻ lỗi của panel kiểm định chất lượng bên phải.

**Acceptance Scenarios**:
1. **Given** người dùng mở sửa từ một thẻ lỗi có định danh (`issueId`), **When** Bàn Dịch xuất hiện, **Then** panel kiểm định chất lượng bên phải tự động chuyển sang tab chứa lỗi đó và hiển thị trạng thái đang tập trung vào thẻ lỗi đó.

---

## Edge Cases

- **Đoạn văn lỗi đã được sửa trước đó**: Nếu người dùng đã xóa hoặc sửa câu văn đó từ trước khiến đoạn trích không còn tồn tại trong bản dịch, hệ thống mở chương bình thường, giữ nguyên con trỏ ở đầu trang và hiển thị thông báo nhẹ nhàng: *"Không tìm thấy đoạn văn vi phạm trong bản dịch hiện tại, có thể nội dung đã được sửa."*
- **Đoạn văn bản xuất hiện nhiều lần trong chương (ví dụ câu thoại ngắn trùng lặp)**: Hệ thống ưu tiên bôi đen vị trí xuất hiện đầu tiên phù hợp với ngữ cảnh lỗi.
- **Chương có dung lượng cực lớn (hàng chục ngàn từ)**: Thao tác cuộn và chọn vùng bôi đen phải diễn ra mượt mà, không làm đơ giao diện người dùng.
- **Người dùng bấm nút mở từ danh sách tổng hợp chương (không chỉ định thẻ lỗi cụ thể)**: Hệ thống nạp chương bình thường mà không kích hoạt chế độ cuộn/bôi đen đoạn trích.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Nút "Mở trong Bàn Dịch để sửa" trên thẻ lỗi (`HakoIssueCard`) PHẢI truyền đầy đủ định danh chương (`chapterId`), đoạn trích dẫn làm bằng chứng (`snippet`), và định danh lỗi (`issueId`) sang trình điều hướng ứng dụng.
- **FR-002**: Hệ thống PHẢI chuyển sang tab Bàn Dịch (`translate`), nạp toàn bộ nội dung của chương chỉ định từ cơ sở dữ liệu và chuyển tiếp yêu cầu định vị đoạn lỗi xuống trình biên tập.
- **FR-003**: Hệ thống PHẢI đồng bộ hóa vòng đời nạp dữ liệu chương: Thao tác tìm kiếm, cuộn và bôi đen đoạn trích CHỈ ĐƯỢC PHÉP thực thi sau khi nội dung văn bản của đúng chương chỉ định đã được nạp đầy đủ vào trạng thái của khung soạn thảo.
- **FR-004**: Khung soạn thảo PHẢI tự động xác định và chuyển sang phân vùng dịch phù hợp (`activeStage` là `polished` hoặc `raw`) nơi đoạn trích lỗi thực tế xuất hiện.
- **FR-005**: Khung soạn thảo PHẢI tự động cuộn (auto-scroll) mượt mà đến vị trí dòng văn bản chứa đoạn lỗi, có khoảng đệm an toàn tối thiểu 2 dòng phía trên để người dùng dễ quan sát toàn bộ ngữ cảnh xung quanh.
- **FR-006**: Khung soạn thảo PHẢI bôi đen (native selection range) chính xác từ vị trí bắt đầu đến kết thúc của đoạn trích lỗi, đồng thời kích hoạt tiêu điểm bàn phím (`focus`) vào ô văn bản để người dùng có thể thực hiện thao tác xóa hoặc chỉnh sửa ngay tức khắc.
- **FR-007**: Thuật toán tìm kiếm đoạn trích PHẢI hỗ trợ chuẩn hóa: tự động loại bỏ các ký tự bao quanh như ngoặc kép đơn/kép (`"`, `'`, `“`, `”`, `«`, `»`) và dấu chấm lửng (`...`, `…`) trước khi so khớp với nội dung bản dịch.
- **FR-008**: Hệ thống PHẢI hiển thị thông báo phản hồi (toast notification) tương ứng khi đoạn lỗi được định vị thành công hoặc khi đoạn văn không còn tồn tại trong bản dịch.
- **FR-009**: Trạng thái định vị ban đầu (`initialHighlightSnippet`) PHẢI được dọn dẹp sạch sẽ sau khi đã thực hiện thành công để ngăn ngừa hiện tượng tự động cuộn lại ngoài ý muốn trong các lần chuyển đổi tab tiếp theo.
- **FR-010**: Bảng thẩm định chất lượng bên phải (`UnifiedAuditPanel`) NÊN nhận biết định danh lỗi đang được mở để kích hoạt tab phân loại phù hợp và định vị thẻ lỗi tương ứng trong bảng điều khiển.

---

### Key Entities

- **Đoạn trích bằng chứng (Evidence Snippet)**: Chuỗi văn bản tiếng Việt ghi nhận lỗi vi phạm (ví dụ câu bị lặp, câu dịch sai nghĩa, câu sót raw) trích từ nội dung bản dịch.
- **Yêu cầu định vị đoạn lỗi (Highlight Intent)**: Gói thông tin điều hướng bao gồm `chapterId`, `snippet`, và `issueId` được truyền từ Kiểm Định Hako sang Bàn Dịch.
- **Vùng chọn văn bản (Text Selection)**: Tọa độ bắt đầu (`selectionStart`), kết thúc (`selectionEnd`) và vị trí cuộn (`scrollTop`) của phần tử soạn thảo văn bản.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% các lần bấm nút "Mở trong Bàn Dịch để sửa" từ thẻ lỗi đưa người dùng đến đúng vị trí câu văn lỗi trong khung soạn thảo của Bàn Dịch.
- **SC-002**: Thời gian từ khi bấm nút đến khi câu văn được cuộn vào tầm mắt và bôi đen hoàn tất không vượt quá 350ms trên cấu hình tiêu chuẩn.
- **SC-003**: 0% trường hợp bị mất lệnh bôi đen do bất đồng bộ thời gian nạp chương giữa kho dữ liệu và khung soạn thảo.
- **SC-004**: Tỷ lệ định vị thành công đạt trên 95% đối với các trích đoạn có dấu ngoặc kép, khoảng trắng thừa hoặc định dạng trích dẫn AI.
- **SC-005**: 100% bộ kiểm thử chất lượng theo hiến pháp (`npm run lint`, `npm test`, `npm run build`) vượt qua sạch sẽ mà không có bất kỳ lỗi nào.

---

## Assumptions

- Trình duyệt người dùng hỗ trợ các API DOM chuẩn cho trường nhập liệu văn bản (`setSelectionRange`, `scrollTop`, `focus`).
- Dữ liệu chương truyện tồn tại hợp lệ trong cơ sở dữ liệu IndexedDB của ứng dụng.
- Nếu chương có cả bản dịch thô và bản chuốt mịn, hệ thống ưu tiên kiểm tra sự hiện diện của đoạn lỗi trên bản chuốt mịn trước.
