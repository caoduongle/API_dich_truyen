# Feature Specification: Rà Soát Lại Có Ghi Nhớ Quyết Định Kiểm Định (Smart Decision-Aware Re-audit)

**Feature Branch**: `114-hako-smart-rescan`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "tôi muốn cải tiến tính năng; sau khi ấn kiểm định thì nó ra lỗi như trên; ở chỗ lỗi nó có 3 nút bác bỏ; cần xem lại và xác nhận; hiện tại các nút này ấn vào cũng như không; không có 1 tác dụng gì cả; giờ tôi muốn sau khi ấn các nút này; và tôi ấn nút rà soát lại; nó sẽ dựa vào các kết quả mà tôi ấn vào trước để xem là nên rà soát lại như nào đối với các lỗi này"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ghi nhớ các lỗi đã Bác bỏ khi rà soát lại (Priority: P1)

Người kiểm định chất lượng (moderator/editor) thực hiện kiểm định dự án và phát hiện một số cảnh báo là trường hợp ngoại lệ có chủ đích (ví dụ: giữ nguyên chữ Hán cho tên thần chú, ấn kiếm, hoặc đặc thù hành văn) nên bấm nút "Bác bỏ". Khi người dùng ấn nút "Rà soát lại", hệ thống ghi nhớ quyết định bác bỏ này và không cảnh báo lại như một lỗi mới ở trạng thái "Chờ duyệt", giúp người dùng không phải thẩm định lại nhiều lần cùng một vấn đề đã xử lý.

**Why this priority**: Đây là cốt lõi của trải nghiệm kiểm định: thao tác "Bác bỏ" phải có giá trị thực tế và được ghi nhớ thay vì bị xóa sạch mỗi lần chạy lại quy trình quét.

**Independent Test**: Có thể kiểm tra độc lập bằng cách: Chọn chương có từ bị phát hiện cảnh báo, bấm "Bác bỏ", sau đó bấm "Rà soát lại" -> Lỗi đó vẫn giữ nguyên trạng thái "Đã bỏ qua", không bị biến thành lỗi mới "Chờ duyệt".

**Acceptance Scenarios**:

1. **Given** một cảnh báo lỗi trong chương đã được người kiểm định bấm nút "Bác bỏ" (`dismissed`), **When** người kiểm định ấn nút "Rà soát lại", **Then** hệ thống ghi nhớ quyết định cũ, giữ nguyên trạng thái "Đã bỏ qua" và không hiển thị cảnh báo này như một lỗi mới cần duyệt.
2. **Given** người dùng đã bác bỏ một số lỗi và muốn xem lại, **When** sử dụng bộ lọc trạng thái "Đã bỏ qua", **Then** hệ thống hiển thị chính xác các lỗi đã bác bỏ cùng thời điểm và thông tin chi tiết.

---

### User Story 2 - Tự động phát hiện lỗi đã sửa và chuyển sang Đã giải quyết (Priority: P1)

Người kiểm định bấm "Xác nhận lỗi" đối với một lỗi thực sự trong bản dịch, sau đó chuyển sang Bàn Dịch để biên tập lại văn bản (sửa lỗi chính tả, xóa ký tự Hán sót). Khi người dùng quay lại và bấm "Rà soát lại", hệ thống tự động đối chiếu: nếu đoạn lỗi cũ không còn xuất hiện trong văn bản mới, lỗi đó được chuyển sang trạng thái "Đã giải quyết" (`resolved`) với biểu tượng thành công; nếu đoạn lỗi chưa được sửa hoặc sửa chưa hết, hệ thống vẫn duy trì trạng thái "Đã xác nhận lỗi" để người dùng tiếp tục theo dõi.

**Why this priority**: Mang lại vòng lặp phản hồi hoàn chỉnh cho quy trình dịch - duyệt - sửa: người dùng nhìn thấy rõ ràng lỗi nào đã sửa thành công và lỗi nào vẫn còn tồn đọng.

**Independent Test**: Chọn chương có lỗi sót chữ Hán, bấm "Xác nhận lỗi", mở Bàn Dịch sửa xóa chữ Hán đó rồi quay lại bấm "Rà soát lại" -> Lỗi chuyển thành "Đã giải quyết".

**Acceptance Scenarios**:

1. **Given** một lỗi đã được "Xác nhận lỗi", người dùng đã chỉnh sửa bản dịch để khắc phục lỗi, **When** người dùng bấm "Rà soát lại", **Then** hệ thống nhận diện lỗi không còn tồn tại trong bản dịch mới và tự động cập nhật trạng thái lỗi thành "Đã giải quyết" (`resolved`).
2. **Given** một lỗi đã được "Xác nhận lỗi" nhưng người dùng chưa sửa bản dịch ở đoạn đó, **When** người dùng bấm "Rà soát lại", **Then** lỗi vẫn duy trì trạng thái "Đã xác nhận lỗi" kèm toàn bộ ghi chú trước đó, không bị đặt lại về "Chờ duyệt".

---

### User Story 3 - Bảo toàn trạng thái Cần xem lại và ghi chú thảo luận (Priority: P2)

Người kiểm định đánh dấu một lỗi là "Cần xem lại" và nhập ghi chú lưu ý cụ thể (ví dụ: "Cần hỏi lại tác giả raw về đại từ xưng hô ở đoạn này"). Khi người dùng bấm "Rà soát lại", hệ thống bảo toàn quyết định "Cần xem lại" cùng nội dung ghi chú nếu đoạn văn chưa thay đổi, hoặc chuyển sang "Đã giải quyết" nếu đoạn văn đã được sửa chữa.

**Why this priority**: Bảo vệ công sức phân tích và ghi chép của người kiểm duyệt, tránh thất thoát thông tin ghi chú thảo luận giữa các lần rà soát.

**Independent Test**: Gắn nhãn "Cần xem lại" cho 1 lỗi kèm ghi chú văn bản, bấm "Rà soát lại" -> Thẻ lỗi vẫn giữ nguyên trạng thái "Cần xem lại" và nội dung ghi chú không đổi.

**Acceptance Scenarios**:

1. **Given** một lỗi có trạng thái "Cần xem lại" kèm ghi chú của người kiểm định, **When** người dùng bấm "Rà soát lại" mà nội dung văn bản liên quan chưa sửa, **Then** trạng thái "Cần xem lại" và nội dung ghi chú được giữ nguyên vẹn.
2. **Given** một lỗi "Cần xem lại" đã được sửa đạt yêu cầu trong bản dịch mới, **When** người dùng bấm "Rà soát lại", **Then** hệ thống chuyển trạng thái lỗi sang "Đã giải quyết".

---

### User Story 4 - Nhận diện lỗi mới phát sinh và tóm tắt kết quả sau rà soát (Priority: P3)

Sau khi người dùng chỉnh sửa bản dịch, có thể phát sinh thêm lỗi mới ngoài ý muốn. Khi bấm "Rà soát lại", hệ thống nhận diện các lỗi mới phát sinh, đánh dấu là "Lỗi mới" ở trạng thái "Chờ duyệt" để người dùng không bỏ sót, đồng thời hiển thị thông báo tổng kết ngắn gọn về kết quả rà soát (bao nhiêu lỗi đã khắc phục, bao nhiêu lỗi còn tồn tại, bao nhiêu lỗi mới).

**Why this priority**: Giúp người kiểm định nắm bắt ngay bức tranh tổng thể sau mỗi lần rà soát mà không phải lội qua từng thẻ lỗi để đếm thủ công.

**Independent Test**: Sửa bản dịch thêm một chữ Hán mới vào một chương, bấm "Rà soát lại" -> Lỗi mới xuất hiện ở trạng thái "Chờ duyệt" kèm thông báo tổng kết hiển thị đúng số lượng lỗi mới.

**Acceptance Scenarios**:

1. **Given** bản dịch được biên tập lại làm phát sinh vi phạm mới, **When** người dùng bấm "Rà soát lại", **Then** lỗi mới xuất hiện ở trạng thái "Chờ duyệt" và có nhãn nhận diện lỗi mới phát hiện.
2. **Given** tiến trình rà soát lại hoàn thành, **When** hệ thống hiển thị kết quả, **Then** thanh thông báo tổng kết phản ánh chính xác số lỗi đã giải quyết, số lỗi chưa sửa và số lỗi mới phát hiện.

---

### Edge Cases

- **Chưa có quyết định nào trước khi rà soát lại**: Toàn bộ lỗi ở trạng thái "Chờ duyệt" sẽ được cập nhật mới tương ứng với nội dung hiện tại của bản dịch.
- **Văn bản chương bị xóa rỗng hoặc rút ngắn đột ngột**: Các lỗi đã xác nhận ở các đoạn không còn tồn tại sẽ được đánh dấu là "Đã giải quyết" (do không còn phát hiện vi phạm), kèm thông báo nếu đoạn văn bị mất.
- **Tiến trình rà soát bị hủy giữa chừng (User Abort)**: Toàn bộ quyết định kiểm duyệt trước đó và kết quả của các chương đã kịp phân tích xong phải được bảo toàn, không làm mất dữ liệu phiên làm việc.
- **Trùng lặp nhiều lỗi giống hệt nhau trong cùng một đoạn**: Hệ thống phân biệt dựa trên vị trí đoạn và ngữ cảnh để gán quyết định chính xác cho từng trường hợp.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI có cơ chế tạo dấu vân tay định danh duy nhất (issue fingerprint) cho từng lỗi dựa trên định danh chương, loại lỗi, và đoạn trích văn bản tiếng Việt làm cơ sở đối chiếu giữa các lần quét.
- **FR-002**: Khi người dùng nhấn "Rà soát lại", hệ thống PHẢI đối chiếu danh sách vi phạm mới quét được với danh sách lỗi đã có quyết định trong phiên kiểm định hiện tại thay vì xóa trắng toàn bộ.
- **FR-003**: Đối với các lỗi đã có quyết định "Bác bỏ" (`dismissed`), hệ thống PHẢI tự động giữ nguyên quyết định này khi rà soát lại nếu vi phạm vẫn còn, không tạo thêm lỗi mới ở trạng thái chờ duyệt.
- **FR-004**: Đối với các lỗi đã có quyết định "Xác nhận lỗi" (`confirmed`) hoặc "Cần xem lại" (`review_needed`), nếu lần quét mới không còn phát hiện vi phạm tại vị trí đó (bản dịch đã được sửa), hệ thống PHẢI cập nhật trạng thái lỗi thành "Đã giải quyết" (`resolved`).
- **FR-005**: Đối với các lỗi đã có quyết định "Xác nhận lỗi" hoặc "Cần xem lại" mà vi phạm vẫn còn tồn tại trong bản dịch mới, hệ thống PHẢI duy trì trạng thái quyết định và toàn bộ nội dung ghi chú (`moderatorNote`) của người kiểm định.
- **FR-006**: Đối với các vi phạm mới phát sinh chưa từng xuất hiện hoặc chưa có trong danh sách lỗi trước đó, hệ thống PHẢI khởi tạo ở trạng thái "Chờ duyệt" (`pending`) và có nhãn đánh dấu nhận diện lỗi mới.
- **FR-007**: Bảng điều khiển kiểm định PHẢI hỗ trợ hiển thị và lọc theo trạng thái "Đã giải quyết" (`resolved`) bên cạnh các trạng thái hiện có (Chờ duyệt, Đã xác nhận, Cần xem lại, Đã bỏ qua).
- **FR-008**: Bảng thống kê tổng quan PHẢI cập nhật số lượng lỗi "Đã giải quyết" và hiển thị thông báo tổng kết biến động sau khi hoàn tất rà soát lại (số lỗi đã khắc phục, số lỗi còn tồn tại, số lỗi mới).
- **FR-009**: Hệ thống PHẢI cho phép người kiểm định có thể chuyển đổi thủ công một lỗi đã giải quyết quay lại trạng thái khác nếu muốn tiếp tục xem xét.

### Key Entities

- **Lỗi kiểm định (Quality Issue)**: Điểm nghi vấn chất lượng trong bản dịch. Thuộc tính nghiệp vụ gồm: định danh chương, tiêu đề chương, loại lỗi, mức độ nghiêm trọng, đoạn trích tiếng Việt bằng chứng, đoạn raw đối ứng (nếu có), lời giải thích, gợi ý sửa, quyết định của người kiểm định (`pending`, `confirmed`, `review_needed`, `dismissed`, `resolved`), ghi chú người kiểm định, nguồn phát hiện (quy tắc hoặc AI), thời gian tạo.
- **Phiên kiểm định (Review Session)**: Phiên làm việc của người kiểm định trên một dự án dịch. Thuộc tính gồm: mã phiên, mã dự án, tên dự án, danh sách các chương được chọn, danh sách toàn bộ các lỗi kèm trạng thái quyết định và lịch sử cập nhật.
- **Thống kê biến động rà soát (Re-audit Diff Summary)**: Kết quả so sánh giữa lần quét mới và quyết định cũ, bao gồm: số lỗi mới phát hiện, số lỗi đã khắc phục thành công, số lỗi chưa khắc phục còn tồn đọng, và số lỗi được giữ nguyên bỏ qua.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% quyết định kiểm duyệt của người dùng (Bác bỏ, Cần xem lại, Xác nhận lỗi) được bảo toàn nguyên vẹn sau khi thực hiện thao tác "Rà soát lại".
- **SC-002**: 100% các lỗi đã được sửa thành công trong bản dịch được tự động chuyển sang trạng thái "Đã giải quyết" mà không cần thao tác bấm nút thủ công từng lỗi.
- **SC-003**: Tỷ lệ báo sai lặp lại (false positive re-alert) đối với các lỗi đã bị bác bỏ đạt 0% khi rà soát lại cùng một nội dung văn bản.
- **SC-004**: Người dùng có thể quan sát kết quả tổng kết (lỗi đã sửa, lỗi còn lại, lỗi mới) ngay trên màn hình trong vòng chưa đầy 1 giây sau khi tiến trình quét hoàn thành.
- **SC-005**: Mức độ hài lòng của người kiểm định tăng lên rõ rệt khi các nút hành động (Bác bỏ, Cần xem lại, Xác nhận) mang lại hiệu lực trực tiếp cho chu trình làm việc.

## Assumptions

- Người dùng thực hiện sửa đổi bản dịch trong ứng dụng (thông qua nút "Mở trong Bàn Dịch để sửa" hoặc chuyển tab dịch) trước khi bấm "Rà soát lại".
- Cơ chế quét chất lượng (quy tắc kiểm tra nhanh và kiểm định ngữ nghĩa AI) tiếp tục cung cấp đoạn trích tiếng Việt làm cơ sở đối chiếu.
- Các lỗi đã có quyết định vẫn được lưu trữ trong phiên làm việc cục bộ của dự án để đảm bảo không phụ thuộc vào kết nối mạng.
- Xuất báo cáo kiểm định sẽ tự động ưu tiên các lỗi còn tồn đọng chưa được giải quyết, đồng thời có thể liệt kê các lỗi đã khắc phục thành công.

