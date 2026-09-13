# Feature Specification: Đồng Bộ Phạm Vi Hiển Thị & Cơ Chế Quyết Định Lỗi Kiểm Định Hako (Hako Review Scope & Decision Sync)

**Feature Branch**: `130-hako-review-scope-sync`

**Created**: 2026-09-13

**Status**: Draft

**Input**: User description: "kiểm tra lại ngay các nút bác bỏ; cần kiểm tra; xác nhận lỗi ở tab kiểm định hako hoạt động như nào; rõ ràng tôi đã ấn xác nhận lỗi và chuyển sang các chương khác; vậy mà lỗi vẫn chình ình hiện ra trong khi tôi không hề chọn chương có lỗi"

---

## Bối Cảnh & Phân Tích Vấn Đề (Context & Problem Analysis)

Qua mô tả của người dùng và 2 ảnh chụp giao diện đính kèm, hệ thống đang tồn tại 3 vấn đề cốt lõi về trải nghiệm người dùng (UX) và logic điều phối dữ liệu:

1. **Lệch pha phạm vi giữa Bộ chọn chương và Bảng danh sách lỗi (Scope Disconnection)**:
   - Ở phía trên (`HakoChapterSelector`), người dùng đã chuyển sang chọn 12 chương khác (ví dụ các chương từ #59 đến #70) và **không hề chọn Chương 140**.
   - Tuy nhiên ở phía dưới (`HakoIssueReviewPanel`), danh sách lỗi lại hiển thị toàn bộ 8 lỗi thuộc 7 chương đã quét từ các lần trước trong phiên làm việc, bao gồm cả Chương 140 ("lỗi vẫn chình ình hiện ra trong khi tôi không hề chọn chương có lỗi").
   - Nguyên nhân: Bảng duyệt lỗi nhận `issues={session.issues}` (toàn bộ lỗi trong phiên) và bộ lọc chương (`filterChapterId`) mặc định là `all`, hoàn toàn tách rời khỏi `selectedChapterIds` ở bộ chọn chương phía trên.

2. **Cơ chế hoạt động của 3 nút "Bác bỏ", "Cần xem lại", "Xác nhận lỗi" chưa đáp ứng kỳ vọng duyệt luồng công việc (Triage Workflow)**:
   - Hiện tại, khi người dùng bấm "Xác nhận lỗi", hệ thống chỉ cập nhật thuộc tính `decision = 'confirmed'` và đổi giao diện nút sang màu tím đậm (`variant="primary"`).
   - Vì bộ lọc mặc định là "Tất cả trạng thái", thẻ lỗi vẫn nằm nguyên vị trí trên màn hình khiến người dùng có cảm giác "ấn vào cũng như không", không thấy lỗi biến mất khỏi hàng đợi cần xử lý.

3. **Hiện tượng lỗi đã xác nhận bất ngờ biến thành "Đã giải quyết" (`resolved`) ngoài ý muốn**:
   - Trong ảnh 1 đính kèm, lỗi #49 thuộc Chương 140 đang hiển thị huy hiệu màu xanh lục **"Đã giải quyết"** (`resolved`) và nhãn **"Đã khắc phục"**, dù người dùng phản ánh rõ ràng là mình đã ấn "Xác nhận lỗi".
   - Nguyên nhân: Logic hòa giải lỗi `reconcileIssuesWithDecisions` tự động chuyển mọi lỗi `confirmed` thành `resolved` nếu lượt quét mới không tìm thấy dấu vân tay (fingerprint) của lỗi cũ. Khi quét AI không ổn định (không trả lại đúng lỗi cũ) hoặc khi người dùng chưa hề sửa bản dịch, hệ thống đã tự ý kết luận lỗi "đã được khắc phục", gây sai lệch hoàn toàn thực tế kiểm định.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tự động đồng bộ phạm vi lỗi theo danh sách chương đang chọn (Priority: P1)

Người kiểm định đang làm việc với dự án tiểu thuyết. Sau khi hoàn thành kiểm định và xử lý lỗi ở các chương trước (ví dụ Chương 140), người dùng di chuyển lên bộ chọn chương và chọn một nhóm chương mới (ví dụ Chương 59 đến Chương 70). Bảng danh sách lỗi bên dưới phải tự động phản ánh theo ngữ cảnh làm việc hiện tại: chỉ hiển thị các lỗi thuộc về các chương đang được chọn, không để các lỗi của các chương không liên quan xuất hiện gây nhiễu.

**Why this priority**: Đây là phàn nàn trực tiếp và gây khó chịu nhất của người dùng ("rõ ràng tôi chuyển sang các chương khác, vậy mà lỗi vẫn chình ình hiện ra trong khi tôi không hề chọn chương có lỗi").

**Independent Test**:
- Bước 1: Quét kiểm định Chương 1 và Chương 2 (có phát hiện lỗi ở cả 2 chương).
- Bước 2: Tại bộ chọn chương, bỏ chọn Chương 2, chỉ giữ lại Chương 1.
- Bước 3: Kiểm tra bảng lỗi bên dưới -> Chỉ hiển thị các lỗi của Chương 1, toàn bộ lỗi của Chương 2 bị ẩn.
- Bước 4: Có tùy chọn nút gạt/bộ lọc để người dùng chủ động xem lại "Tất cả các chương đã quét trong dự án" nếu có nhu cầu tra cứu tổng thể.

**Acceptance Scenarios**:
1. **Given** phiên làm việc có lỗi ở Chương A và Chương B, **When** người dùng chỉ chọn Chương B trong danh sách chương, **Then** bảng kiểm định bên dưới mặc định chỉ hiển thị các lỗi thuộc Chương B.
2. **Given** người dùng muốn tra cứu lại toàn bộ các lỗi đã phát hiện trong toàn bộ dự án, **When** người dùng chọn phạm vi "Toàn bộ phiên làm việc" tại bộ lọc chương, **Then** hệ thống hiển thị đầy đủ lỗi của tất cả các chương đã từng kiểm định.
3. **Given** người dùng chọn một nhóm chương mới chưa từng được kiểm định, **When** chưa bấm nút "Bắt đầu kiểm định", **Then** hệ thống hiển thị trạng thái hướng dẫn rõ ràng: "Chưa có kết quả kiểm định cho các chương đang chọn. Hãy bấm 'Bắt đầu kiểm định' để rà soát".

---

### User Story 2 - Minh bạch hóa vòng đời và trạng thái của các nút Bác bỏ / Cần xem lại / Xác nhận lỗi (Priority: P1)

Người kiểm định thực hiện đánh giá từng thẻ lỗi được AI hoặc quy tắc phát hiện:
- Bấm **"Xác nhận lỗi"**: Hệ thống ghi nhận đây là lỗi dịch thuật thực sự cần dịch giả sửa. Thẻ lỗi được đánh dấu rõ ràng là "Đã xác nhận".
- Bấm **"Bác bỏ"**: Hệ thống ghi nhận đây là cảnh báo sai / ngoại lệ cố ý. Thẻ lỗi được đánh dấu là "Đã bỏ qua".
- Bấm **"Cần xem lại"**: Hệ thống ghi nhận cần hội ý thêm hoặc kiểm tra lại raw, cho phép lưu ghi chú của moderator.
Khi người dùng đang ở chế độ xem "Hàng đợi chờ duyệt" (Pending Queue), ngay khi người dùng đưa ra quyết định cho một lỗi, lỗi đó được chuyển trạng thái ngay lập tức và người dùng có thể dễ dàng lọc chỉ xem những lỗi chưa xử lý.

**Why this priority**: Giúp người dùng hiểu rõ tác dụng của từng nút, không còn mơ hồ về việc bấm nút có tác dụng gì và lỗi đi về đâu.

**Independent Test**:
- Tại một thẻ lỗi "Chờ duyệt", bấm "Xác nhận lỗi" -> Thẻ cập nhật trạng thái rõ rệt sang "Đã xác nhận lỗi" với phản hồi thị giác tức thì.
- Chuyển bộ lọc trạng thái sang "Chờ duyệt" -> Lỗi vừa xác nhận không còn nằm trong danh sách chờ duyệt.

**Acceptance Scenarios**:
1. **Given** một thẻ lỗi ở trạng thái "Chờ duyệt", **When** người dùng bấm "Xác nhận lỗi", **Then** hệ thống cập nhật quyết định thành `confirmed`, lưu vào cơ sở dữ liệu cục bộ, hiển thị nhãn "Đã xác nhận lỗi" và cập nhật số đếm thống kê trên thanh tóm tắt.
2. **Given** người dùng bấm "Bác bỏ", **When** quyết định được lưu, **Then** thẻ lỗi chuyển sang trạng thái `dismissed` ("Đã bỏ qua"), không làm tăng số lỗi cần khắc phục trong báo cáo xuất ra.
3. **Given** người dùng muốn chuyển đổi qua lại giữa các quyết định (ví dụ từ Bác bỏ sang Xác nhận lỗi hoặc ngược lại), **When** bấm nút quyết định tương ứng, **Then** hệ thống cho phép đổi trạng thái mượt mà không bị khóa cứng.

---

### User Story 3 - Ngăn chặn tự ý chuyển lỗi sang "Đã giải quyết" khi chưa có bằng chứng sửa bản dịch (Priority: P1)

Khi người dùng đã xác nhận một lỗi trong Chương 140, hệ thống tuyệt đối không được tự động chuyển lỗi này sang trạng thái "Đã giải quyết" (`resolved`) trừ khi:
1. Chương đó thực sự được quét lại trong lượt phân tích hiện tại.
2. Bản dịch tiếng Việt của chương đó đã thực sự thay đổi so với thời điểm phát hiện lỗi (nội dung đã được biên tập lại).
3. Đợt quét lại xác nhận lỗi đó không còn tồn tại trong văn bản mới.
Nếu chương không nằm trong danh sách quét đợt này, hoặc nội dung bản dịch chưa hề được người dùng sửa, trạng thái "Đã xác nhận lỗi" (`confirmed`) của người dùng PHẢI được bảo toàn nguyên vẹn 100%.

**Why this priority**: Loại bỏ lỗi logic nguy hiểm làm biến đổi quyết định của người dùng từ "lỗi cần sửa" thành "đã khắc phục thành công", gây báo cáo sai lệch về chất lượng dự án.

**Independent Test**:
- Bấm "Xác nhận lỗi" cho 1 lỗi ở Chương 140.
- Chọn quét các chương khác (ví dụ Chương 59 đến 70).
- Sau khi quét xong, kiểm tra lại lỗi của Chương 140 -> Lỗi vẫn phải giữ nguyên trạng thái "Đã xác nhận lỗi", tuyệt đối không bị chuyển thành "Đã giải quyết".

**Acceptance Scenarios**:
1. **Given** một lỗi đã được "Xác nhận lỗi" ở Chương A, **When** người dùng quét kiểm định các chương khác không bao gồm Chương A, **Then** trạng thái của lỗi Chương A giữ nguyên là "Đã xác nhận", không bị ảnh hưởng bởi tiến trình quét mới.
2. **Given** một lỗi đã được "Xác nhận lỗi", **When** người dùng quét lại chính chương đó nhưng nội dung bản dịch chưa hề được sửa, **Then** hệ thống tiếp tục giữ trạng thái "Đã xác nhận lỗi", không tự động đổi thành "Đã giải quyết".
3. **Given** người dùng thực sự mở Bàn Dịch và sửa hết đoạn lỗi, **When** chạy rà soát lại chính chương đó, **Then** hệ thống mới chuyển trạng thái sang "Đã giải quyết" kèm ghi nhận thời gian khắc phục.

---

### User Story 4 - Trải nghiệm lọc trạng thái linh hoạt và hàng đợi xử lý lỗi (Priority: P2)

Bảng điều khiển cung cấp thanh công cụ lọc trực quan, cho phép người dùng dễ dàng chuyển đổi giữa:
- Xem tất cả các lỗi.
- Chỉ xem lỗi cần xử lý ("Chờ duyệt").
- Xem lỗi đã xác nhận cần dịch giả sửa ("Đã xác nhận").
- Xem lỗi đã bác bỏ ("Đã bỏ qua").
- Xem lỗi đã được sửa thành công ("Đã giải quyết").
Kèm theo số lượng lỗi cụ thể trên từng bộ lọc để người dùng nắm bắt tiến độ duyệt một cách minh bạch.

**Why this priority**: Cải thiện công thái học duyệt lỗi (Moderation UX), giúp người kiểm định xử lý hàng chục lỗi nhanh chóng mà không bị rối mắt.

**Acceptance Scenarios**:
1. **Given** danh sách có nhiều lỗi ở các trạng thái khác nhau, **When** người dùng chọn bộ lọc "Chờ duyệt", **Then** chỉ các lỗi chưa có quyết định được hiển thị.
2. **Given** người dùng chọn "Đặt lại bộ lọc", **When** ấn nút, **Then** toàn bộ bộ lọc quay về trạng thái mặc định phù hợp với các chương đang chọn.

---

## Edge Cases

- **Người dùng không chọn chương nào trong selector**: Bảng danh sách lỗi hiển thị thông báo rỗng kèm hướng dẫn người dùng tích chọn ít nhất 1 chương ở bảng trên.
- **Người dùng chọn 12 chương nhưng chỉ 2 chương có lỗi**: Bảng lỗi chỉ hiển thị lỗi của 2 chương này, kèm ghi chú cho biết 10 chương còn lại đạt chuẩn (không phát hiện lỗi).
- **Người dùng chuyển đổi chương liên tục khi đang có bộ lọc chi tiết**: Hệ thống bảo toàn các tiêu chí lọc (mức độ, phân loại) nhưng làm mới danh sách lỗi theo các chương mới chọn một cách mượt mà, không gây crash hoặc giật màn hình.
- **Chương có lỗi bị xóa khỏi dự án**: Toàn bộ lỗi liên kết với chương đã xóa được tự động dọn dẹp khỏi phiên làm việc.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `HakoCheckerWorkspace` và `HakoIssueReviewPanel` PHẢI đồng bộ phạm vi hiển thị lỗi với danh sách chương đang được chọn (`selectedChapterIds`) trong `HakoChapterSelector`.
- **FR-002**: Bộ lọc chương trong `HakoIssueReviewPanel` PHẢI cung cấp 2 chế độ phạm vi rõ ràng:
  - `selected`: Chỉ hiển thị lỗi của các chương đang được chọn ở bộ chọn chương phía trên (mặc định).
  - `all_session`: Hiển thị toàn bộ lỗi đã phát hiện trong phiên làm việc của toàn bộ dự án.
  - Từng chương cụ thể trong danh sách chương khả dụng.
- **FR-003**: Khi người dùng thay đổi lựa chọn chương ở `HakoChapterSelector`, danh sách lỗi hiển thị ở chế độ mặc định PHẢI cập nhật ngay lập tức theo các chương được chọn mà không cần tải lại trang.
- **FR-004**: Thao tác bấm nút "Xác nhận lỗi" (`confirmed`), "Bác bỏ" (`dismissed`), và "Cần xem lại" (`review_needed`) PHẢI lập tức cập nhật trạng thái của thẻ lỗi, đổi giao diện nút bấm (active state) rõ ràng, cập nhật bộ đếm thống kê và lưu trữ bền vững vào IndexedDB.
- **FR-005**: Hệ thống TUYỆT ĐỐI KHÔNG được tự động chuyển trạng thái của một lỗi sang "Đã giải quyết" (`resolved`) đối với các chương KHÔNG nằm trong danh sách chương được quét lại ở lượt phân tích hiện tại (`scannedChapterIds`).
- **FR-006**: Đối với các chương ĐƯỢC quét lại, hệ thống CHỈ chuyển trạng thái sang `resolved` khi và chỉ khi bản dịch tiếng Việt của chương đó có sự thay đổi (dựa trên dấu vết sửa đổi hoặc kiểm tra chuỗi) VÀ lỗi đó không còn được phát hiện trong văn bản mới.
- **FR-007**: Bảng điều khiển kiểm định PHẢI hiển thị thông báo rỗng (EmptyState) rõ ràng khi các chương đang chọn không có lỗi nào, nêu rõ: các chương đang chọn không phát hiện lỗi hoặc chưa được bấm quét kiểm định.
- **FR-008**: Bảng tổng kết thống kê lỗi (`stats`) PHẢI phản ánh chính xác số lượng lỗi tương ứng theo phạm vi chương đang hiển thị (phạm vi các chương đang chọn hoặc toàn bộ phiên).

---

### Key Entities

- **Phạm vi kiểm định (Review Scope)**: Ngữ cảnh lọc chương hiện tại của bảng duyệt lỗi, bao gồm danh sách các ID chương đang được chọn (`selectedChapterIds`) hoặc toàn bộ các chương trong phiên (`session.chapters`).
- **Quyết định kiểm định (Quality Issue Decision)**: Trạng thái thẩm định của moderator cho từng lỗi:
  - `pending`: Chờ duyệt (lỗi mới phát hiện).
  - `confirmed`: Đã xác nhận lỗi (cần dịch giả sửa).
  - `review_needed`: Cần xem lại (nghi vấn cần kiểm tra thêm hoặc thảo luận).
  - `dismissed`: Đã bỏ qua / Bác bỏ (báo sai hoặc ngoại lệ cố ý).
  - `resolved`: Đã giải quyết (chỉ áp dụng khi văn bản bản dịch đã thực sự được sửa chữa làm biến mất vi phạm).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% các lỗi hiển thị trên màn hình ở chế độ mặc định thuộc về đúng các chương đang được người dùng tích chọn trong `HakoChapterSelector`. Lỗi của các chương không chọn tuyệt đối không xuất hiện ở chế độ này.
- **SC-002**: 0% trường hợp lỗi đã xác nhận (`confirmed`) bị tự ý chuyển thành "Đã giải quyết" (`resolved`) khi người dùng quét một tập chương khác hoặc chưa hề sửa đổi bản dịch.
- **SC-003**: Thao tác bấm "Xác nhận lỗi", "Bác bỏ", "Cần xem lại" phản hồi thị giác ngay lập tức (< 50ms) và lưu trữ bền vững vào IndexedDB.
- **SC-004**: Người dùng có thể chuyển đổi linh hoạt giữa việc xem lỗi của riêng các chương đang chọn và xem tổng thể lỗi toàn dự án chỉ với 1 cú click chuột tại bộ lọc.
- **SC-005**: 100% test cases cho quy trình lọc theo phạm vi chương và thuật toán hòa giải quyết định kiểm định vượt qua thành công trong bộ kiểm thử tự động.

---

## Assumptions

- Người dùng sử dụng tính năng kiểm định theo từng đợt chương (tối đa 12 chương mỗi đợt) theo đúng quy định giới hạn để đảm bảo tốc độ xử lý.
- Dữ liệu các lỗi của các chương đã quét trước đó vẫn được lưu trữ trong IndexedDB của phiên làm việc để có thể xuất báo cáo tổng thể bất kỳ lúc nào.
- Bộ lọc mặc định nên ưu tiên hiển thị những gì người dùng đang tập trung thao tác (các chương đang chọn) để tránh quá tải thông tin thị giác.
