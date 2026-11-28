# Feature Specification: Cô lập Hạn mức theo Mô hình, Khôi phục Trạng thái Khóa & Minh bạch Nguyên nhân Cạn Quota

**Feature Branch**: `173-per-model-quota-key-recovery`

**Created**: 2026-11-28

**Status**: Draft

**Input**: User description: "Nhật ký tiến trình dịch tự động trên mô hình gemini-3.5-flash-lite cho thấy Chương 2 báo lỗi cạn hạn mức 500 lượt/ngày từ Google (chờ reset 12h5m53s) nhưng ngay trước đó Bảng điều khiển Quota hiển thị Khóa #1 mới dùng 16/500, Khóa #2 mới dùng 18/500 nhưng vẫn bị khóa 'Hết hạn mức ngày', trong khi Khóa #3 đạt 510/500 và Khóa #4 đạt 489/500; đồng thời giao diện vẫn hiển thị ngưỡng 1M TPM sai lệch so với thực tế 250K TPM / 500 RPD và người dùng không có nút mở khóa thủ công hay chuyển mô hình khác khi một mô hình đã cạn ngày."

## Clarifications

### Session 2026-11-28

- Q: Các khóa #1 (`16/500, Lỗi: 2`), #2 (`18/500, Lỗi: 2`), #3 (`510/500`) và #4 (`489/500`) có nằm cùng một Google Cloud Project không? → A: Không cùng project (mỗi khóa thuộc project riêng biệt). Điều này xác nhận Khóa #1 và Khóa #2 **không hề** cạn trần ngày dùng chung từ Google, mà bị hệ thống **tự nâng cấp oan sang khóa `Hết hạn mức ngày`** sau 2 lỗi `429` mơ hồ liên tiếp không chứa dấu hiệu cạn ngày rõ ràng (`per day` / `RPD`), sau đó giữ nguyên trạng thái khóa trong suốt phiên mở tab hiện tại vì thiếu cơ chế hồi phục ngắn hạn và thiếu nút Mở khóa thủ công.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cô lập trạng thái hạn mức theo từng cặp (Khóa, Mô hình) (Priority: P1)

Khi một khóa API cạn hạn mức ngày (`RPD`) hoặc tạm chạm giới hạn tốc độ (`RPM`) trên một mô hình cụ thể (ví dụ `gemini-3.5-flash-lite` đạt trần 500 lượt/ngày), trạng thái khóa chỉ nên áp dụng riêng cho cặp **(Khóa, Mô hình)** đó chứ không khóa cứng toàn bộ khóa đối với các mô hình khác. Nếu người dùng chuyển sang một mô hình AI khác còn hạn mức ngày trên Google (hoặc chọn mô hình dự phòng), khóa đó phải chạy lại được ngay thay vì bị từ chối oan bởi trạng thái cạn ngày của mô hình cũ.

**Why this priority**: Hiện tại khi một mô hình chạm giới hạn `500/ngày`, toàn bộ thẻ khóa bị đóng dấu `Hết hạn mức ngày` trên mọi mô hình dù Google AI Studio cấp hạn mức theo từng mô hình (và từng dự án). Người dùng đổi mô hình khác vẫn bị kẹt dừng tiến trình ngay lập tức ở Chương 1.

**Independent Test**: Có thể kiểm thử độc lập bằng cách đánh dấu một khóa hết hạn mức ngày trên Mô hình A, sau đó thực hiện yêu cầu dịch với Mô hình B trên chính khóa đó và xác minh Mô hình B vẫn hoạt động bình thường trong khi Mô hình A tiếp tục bị chặn cho tới thời điểm đặt lại ngày mới.

**Acceptance Scenarios**:

1. **Given** Khóa #1 đã nhận phản hồi cạn hạn mức ngày từ nhà cung cấp AI trên Mô hình A, **When** người dùng chuyển sang Mô hình B và bắt đầu dịch, **Then** hệ thống cho phép Khóa #1 gọi Mô hình B bình thường mà không chặn oan bởi trạng thái cạn ngày của Mô hình A.
2. **Given** Khóa #1 đang ở trạng thái cạn hạn mức ngày trên Mô hình A, **When** hệ thống kiểm tra danh sách khóa khả dụng cho Mô hình A, **Then** Khóa #1 vẫn bị loại khỏi Mô hình A để tránh gọi lại vô ích cho tới khi sang ngày mới hoặc được người dùng mở khóa.
3. **Given** hai mô hình khác nhau trên cùng một khóa có trạng thái khác nhau (Mô hình A cạn ngày, Mô hình B khỏe), **When** mở Bảng điều khiển Quota, **Then** người dùng nhìn thấy rõ trạng thái hạn mức tách biệt theo từng mô hình thay vì chỉ thấy một nhãn khóa chung gây hiểu nhầm.

---

### User Story 2 - Chống khóa oan theo ngày, minh bạch nguyên nhân & cung cấp nút Mở khóa trực tiếp (Priority: P1)

Khi một khóa bị đánh dấu `Hết hạn mức ngày` hoặc `Đạt giới hạn ngày (tự đặt)`, hệ thống PHẢI đảm bảo việc khóa theo ngày chỉ xảy ra khi có bằng chứng cạn ngày rõ ràng từ nhà cung cấp (`per day` / `RPD`) hoặc khi khóa chạm ngưỡng ngày cá nhân do người dùng cài đặt — **tuyệt đối không** tự nâng cấp lỗi quá tải tốc độ ngắn hạn (`429` mơ hồ không kèm dấu hiệu theo ngày) thành khóa cả ngày dù lỗi đó lặp lại `2` lần liên tiếp trong khi lượt dùng trong ngày vẫn còn thấp. Trên từng thẻ khóa, người dùng cần nhìn thấy chính xác lý do khóa kèm nút bấm **Mở khóa / Đặt lại trạng thái** cho từng khóa hoặc toàn bộ nhóm khóa ngay trong Bảng điều khiển Quota để giải phóng khóa bị kẹt (hoặc sau khi nâng cấp thanh toán / đổi khóa mới) mà không phải đóng tab hay đợi tới nửa đêm.

**Why this priority**: Trong hai ảnh chụp thực tế của người dùng (với các khóa nằm ở dự án độc lập), Khóa #1 mới dùng `16/500` (`Lỗi: 2`) và Khóa #2 mới dùng `18/500` (`Lỗi: 2`) vẫn bị gắn nhãn `Hết hạn mức ngày` và bị giữ nguyên trong phiên làm việc hiện tại chỉ vì nhận `2` lỗi `429` mơ hồ liên tiếp, khiến người dùng mất sạch các khóa còn gần `500` lượt/ngày mà không thể tự mở khóa hay tự hồi phục sau vài chục giây.

**Independent Test**: Có thể kiểm thử độc lập bằng cách đưa 2 khóa vào trạng thái `Hết hạn mức ngày` (một do đạt giới hạn tự đặt, một do phản hồi từ nhà cung cấp), kiểm tra thẻ khóa hiển thị đúng lý do + thời gian hồi phục, sau đó bấm nút mở khóa và xác nhận khóa trở về trạng thái sẵn sàng gọi lại ngay lập tức.

**Acceptance Scenarios**:

1. **Given** một khóa bị đánh dấu `Hết hạn mức ngày` hoặc tạm nghỉ từ phiên trước, **When** người dùng mở Bảng điều khiển Quota, **Then** thẻ khóa hiển thị rõ lý do cụ thể (kèm thời gian còn lại tới mốc đặt lại ngày của nhà cung cấp nếu có) và nút thao tác cho phép mở khóa lại khóa đó hoặc mở khóa tất cả.
2. **Given** người dùng bấm nút mở khóa cho một khóa đang bị gắn cờ cạn ngày, **When** thao tác xác nhận hoàn tất, **Then** trạng thái sức khỏe của khóa được đưa về sẵn sàng ngay lập tức để phiên dịch tiếp theo có thể thử gọi lại khóa đó.
3. **Given** người dùng xóa một khóa cũ hoặc thay thế bằng chuỗi khóa mới ở cấu hình AI, **When** danh sách khóa được lưu, **Then** trạng thái cạn ngày của khóa cũ không được kế thừa hay ảnh hưởng nhầm sang khóa mới.

---

### User Story 3 - Chuẩn hóa ngưỡng tham chiếu mô hình & báo trạng thái sẵn sàng trước khi dịch (Priority: P1)

Bảng điều khiển Quota và bộ đếm ngưỡng cá nhân phải sử dụng giá trị tham chiếu sát với giới hạn thực tế hiện hành của từng dòng mô hình (như `15 RPM / 250K TPM / 500 RPD` thay vì mặc định `1M TPM` gây ảo giác còn rất nhiều dư địa), đồng thời hiển thị rõ cho người dùng biết còn bao nhiêu khóa thực sự khả dụng cho **mô hình đang chọn** trước khi bấm Bắt đầu dịch.

**Why this priority**: Trong ảnh của người dùng, khung `TPM (60S)` hiển thị `0 / 1M` và giới hạn ngày cho thấy ngưỡng `500`, trong khi bản thân phản hồi từ Google AI Studio ở log và ảnh trước xác nhận giới hạn thực của mô hình là `15 RPM`, `250K TPM`, `500 RPD`. Khi toàn bộ 8 khóa đã cạn trên mô hình đang chọn, việc cảnh báo sẵn sàng trước khi bấm dịch giúp người dùng chuyển mô hình hoặc mở khóa ngay thay vì bấm chạy rồi dừng liên tục.

**Independent Test**: Có thể kiểm thử độc lập bằng cách chọn từng dòng mô hình phổ biến trên Bảng điều khiển Quota và màn hình dịch tự động, xác minh chỉ số tham chiếu `RPM / TPM / RPD` khớp chuẩn mô hình và chỉ số khóa khả dụng phản ánh đúng trạng thái riêng của mô hình đang chọn.

**Acceptance Scenarios**:

1. **Given** người dùng chọn mô hình thuộc dòng nhẹ tốc độ cao (như `gemini-3.5-flash-lite`), **When** xem giới hạn mặc định hoặc thiết lập ngưỡng cá nhân cho khóa chưa tùy chỉnh, **Then** giao diện hiển thị ngưỡng tham chiếu sát với thực tế (`15 RPM`, `250K TPM`, `500 RPD`) thay vì `1M TPM` hoặc `1.500 RPD`.
2. **Given** tất cả khóa cho mô hình đang chọn đều đang cạn hạn mức ngày trong khi các mô hình khác vẫn còn khóa khả dụng, **When** người dùng xem Bảng điều khiển Quota hoặc màn hình dịch tự động, **Then** hệ thống hiển thị cảnh báo rõ rằng mô hình hiện tại đã hết khóa khả dụng hôm nay kèm gợi ý các hành động hợp lệ (đổi sang mô hình khác còn hạn mức, chờ reset, hoặc mở khóa thủ công nếu vừa nâng cấp/đổi khóa).

---

### User Story 4 - Bảo vệ khóa trước lỗi `429` mơ hồ lặp lại & giảm tiêu hao RPD từ chia nhỏ GĐ1 (Priority: P2)

Khi một khóa còn dưới hạn mức ngày (như `16/500` hoặc `18/500`) gặp các phản hồi `429` không nêu rõ giới hạn theo ngày (`per day` / `RPD`), hệ thống phải áp dụng cơ chế giãn cách tạm nghỉ ngắn hạn tăng dần có kiểm soát (thay vì khóa cứng cả ngày từ lần lỗi thứ hai) để khóa tự hồi phục trở lại vòng quay sau thời gian ngắn; chỉ khi nhận thông báo cạn ngày tường minh từ nhà cung cấp lúc lượt dùng cục bộ còn rất thấp (`< 25%` ngưỡng ngày) thì mới hiển thị gợi ý kiểm tra khả năng khóa đã được dùng từ thiết bị/ứng dụng khác hoặc chung dự án. Đồng thời, tiếp tục giảm tiêu hao lượt gọi ngày không cần thiết ở Giai đoạn 1 bằng cách mở rộng căn chỉnh an toàn cho các lệch cấu trúc đoạn nhỏ.

**Why this priority**: Nguyên nhân gốc rễ khiến Khóa #1 (`16/500, Lỗi: 2`) và Khóa #2 (`18/500, Lỗi: 2`) chết oan dù khác dự án với Khóa #3 (`510/500`) và Khóa #4 (`489/500`) là cơ chế leo thang `2` lỗi `429` mơ hồ thành khóa cả ngày. Chặn đường leo thang sai này kết hợp giảm chia nhỏ cấp 1 trên Chương 2 (2 lần chia làm tốn gấp 3 lượt gọi RPD) giúp bảo toàn toàn bộ hạn mức ngày thực sự của người dùng.

**Independent Test**: Có thể kiểm thử độc lập bằng cách mô phỏng một khóa mới dùng `16/500` lượt nhận liên tiếp `2–3` phản hồi `429` không có từ khóa giới hạn ngày và xác minh khóa chỉ chuyển sang tạm nghỉ ngắn hạn tăng dần (tự mở lại sau thời gian chờ ngắn) thay vì bị khóa `Hết hạn mức ngày`; đồng thời kiểm tra Chương có `2–3` đoạn lệch nhỏ được căn chỉnh an toàn không kích hoạt chia nhỏ cấp 1 nếu đủ điều kiện toàn vẹn nội dung.

**Acceptance Scenarios**:

1. **Given** một khóa còn dưới hạn mức ngày (`requestsToday < giới hạn ngày`) nhận `2` hoặc `3` phản hồi `429` liên tiếp nhưng thông điệp lỗi không có dấu hiệu giới hạn ngày (`per day` / `RPD`), **When** hệ thống cập nhật trạng thái khóa, **Then** khóa chỉ đi vào trạng thái tạm nghỉ ngắn hạn theo bậc tăng dần (ví dụ `60s → 120s`, có trần hợp lý) và tự khả dụng lại sau khi hết thời gian nghỉ, tuyệt đối không bị gắn cờ `Hết hạn mức ngày`.
2. **Given** một khóa nhận lỗi cạn hạn mức ngày **tường minh** từ nhà cung cấp (`per day` / `RPD`) trong khi số lượt gọi ghi nhận hôm nay trên ứng dụng chưa tới `25%` hạn mức ngày, **When** hệ thống cập nhật trạng thái khóa và ghi nhật ký, **Then** thẻ khóa và thông báo nêu rõ khóa vừa chạm giới hạn ngày thực từ máy chủ dù bộ đếm cục bộ còn thấp (gợi ý khả năng khóa đã tiêu hao từ ứng dụng/thiết bị khác hoặc dùng chung dự án).
3. **Given** một bản dịch thô Giai đoạn 1 sạch chữ Hán, giữ đủ nội dung và tiêu đề chương nhưng có sai khác tách/gộp đoạn nhỏ hơn ngưỡng chia nhỏ nghiêm trọng, **When** bước kiểm tra toàn vẹn Giai đoạn 1 đánh giá trước khi cứu nguy chia nhỏ, **Then** hệ thống ưu tiên khôi phục căn chỉnh đoạn tại chỗ thay vì lập tức chia nhỏ 2 phần để tiết kiệm hạn mức RPD.

---

### Edge Cases

- **Chuyển mô hình giữa lúc một mô hình khác đã cạn RPD**: Nếu Khóa #1 cạn RPD ở `gemini-3.5-flash-lite` nhưng còn nguyên hạn mức ở `gemini-2.5-flash`, việc đổi mô hình trong cấu hình phải lập tức cập nhật bộ đếm khóa khả dụng và cho phép chạy tiếp mà không cần tải lại trang.
- **Mở khóa thủ công khi khóa thực tế trên Google vẫn hết quota**: Nếu người dùng bấm Mở khóa dù trên phía Google khóa vẫn hết hạn mức ngày, lần gọi tiếp theo nhận lỗi `per day limit exceeded` từ Google phải tự động khóa lại cặp `(Khóa, Mô hình)` đó sạch sẽ mà không gây vòng lặp vô hạn.
- **Khóa chạm giới hạn cá nhân tự đặt (`510/500` như ảnh Khóa #3)**: Khi `requestsToday >= maxRpd` cá nhân trên mô hình đó, nút mở khóa cần thông báo rõ đang chạm giới hạn tự đặt (hoặc cho phép người dùng nâng ngưỡng `maxRpd` / đặt lại bộ đếm phiên tự đặt có xác nhận rõ ràng, không âm thầm vượt giới hạn người dùng đã đặt).
- **Trình phân loại tôn trọng thời gian đặt lại thực tế từ Google**: Khi Google trả về mốc chờ dài nhiều giờ (ví dụ `Please retry in 12h5m53.42s`) cùng tín hiệu `per day`, hệ thống lưu mốc mở khóa chính xác theo thời gian nhà cung cấp báo (`now + 12h5m53s`) thay vì lệch múi giờ nếu gần sát nửa đêm.
- **Bảo mật dữ liệu khóa API**: Tất cả nhãn hiển thị lý do, cảnh báo dùng chung dự án hay nhật ký đều chỉ tham chiếu số thứ tự khóa (`Khóa #1..#8`) và mã che rút gọn, tuyệt đối không ghi chuỗi khóa đầy đủ.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI theo dõi trạng thái khả dụng (`Khỏe`, `Tạm nghỉ RPM`, `Quá tải`, `Hết hạn mức ngày`) tách biệt theo từng cặp **(Khóa, Mô hình)** cho các lỗi giới hạn tốc độ và hạn mức của từng mô hình, chỉ áp dụng khóa toàn cục trên mọi mô hình cho lỗi xác thực không hợp lệ (`401/403`).
- **FR-002**: Khi người dùng chọn một mô hình AI khác để dịch, bộ điều phối khóa và giao diện Bảng điều khiển Quota PHẢI đánh giá khả năng sử dụng của từng khóa dựa trên trạng thái riêng của mô hình đang chọn đó.
- **FR-003**: Mỗi thẻ khóa trên Bảng điều khiển Quota PHẢI hiển thị rõ nguyên nhân cụ thể khi khóa không khả dụng (ví dụ: cạn hạn mức ngày từ nhà cung cấp kèm đếm ngược thời gian hồi phục còn lại, đạt giới hạn ngày cá nhân tự đặt, hay đang tạm nghỉ tốc độ), kèm nhãn cảnh báo tách biệt khi khóa đó chỉ hết hạn mức trên một số mô hình cụ thể.
- **FR-004**: Bảng điều khiển Quota PHẢI cung cấp thao tác **Mở khóa / Đặt lại trạng thái** cho từng khóa riêng lẻ và cho toàn bộ nhóm khóa, cho phép xóa cờ khóa tạm nghỉ hoặc cờ hết hạn mức ngày từ phiên trước của mô hình đang chọn để người dùng thử lại ngay lập tức.
- **FR-005**: Nếu một khóa bị chặn do đạt giới hạn ngày cá nhân tự đặt (như `510 / 500`), thao tác mở khóa hoặc nâng ngưỡng PHẢI thông báo rõ cho người dùng để tránh tự ý phá vỡ giới hạn an toàn người dùng đã cài.
- **FR-006**: Khi phản hồi lỗi `429` theo ngày từ nhà cung cấp có đính kèm khoảng thời gian chờ dài (như `12h5m53s`), hệ thống PHẢI dùng mốc hồi phục chính xác giữa thời điểm nhà cung cấp yêu cầu và thời điểm đặt lại ngày mới thay vì chỉ ước lượng cứng.
- **FR-007**: Hạn mức tham chiếu mặc định hiển thị cho từng mô hình trên Bảng điều khiển Quota và cấu hình ngưỡng cá nhân PHẢI phản ánh đúng định mức thực tế của dòng mô hình đó (chẳng hạn `15 RPM / 250K TPM / 500 RPD` cho dòng Flash Lite hiện hành) và hỗ trợ cập nhật tự động theo thông tin mô hình nếu có.
- **FR-008**: Trước khi bắt đầu hoặc ngay tại trạng thái tổng quan của mô hình đang chọn, hệ thống PHẢI tính và hiển thị đúng số khóa thực sự khả dụng trên mô hình đó (không đếm nhầm khóa đang cạn ngày của mô hình đó là sẵn sàng).
- **FR-009**: Hệ thống TUYỆT ĐỐI KHÔNG được tự động gắn cờ `Hết hạn mức ngày` cho các lỗi `429` mơ hồ không chứa dấu hiệu giới hạn theo ngày (`per day` / `RPD`) khi số lượt gọi trong ngày của khóa vẫn còn thấp hơn hạn mức ngày — kể cả khi lỗi đó lặp lại `2` lần trở lên liên tiếp; các lỗi `429` mơ hồ này PHẢI được xử lý bằng tạm nghỉ ngắn hạn tăng dần có giới hạn (chẳng hạn giãn thời gian nghỉ ngắn giữa các lần thử lại) để khóa tự hồi phục. Chỉ được gắn cờ `Hết hạn mức ngày` khi nhà cung cấp trả về thông báo cạn ngày tường minh hoặc khóa chạm ngưỡng ngày tự đặt, và khi gặp cạn ngày tường minh lúc lượt cục bộ còn thấp (`< 25%` ngưỡng ngày) mới ghi chú gợi ý kiểm tra nguồn tiêu hao ngoài ứng dụng hoặc dùng chung dự án.
- **FR-010**: Giai đoạn dịch thô (GĐ1) PHẢI giảm thêm các trường hợp chia nhỏ cấp 1 không cần thiết do sai khác tách/gộp đoạn thuần hình thức khi toàn bộ nội dung tiếng Trung đã được dịch sạch (`0` chữ Hán sót) và độ dài đạt chuẩn an toàn, nhằm tiết kiệm số lượt gọi ngày (`RPD`) trên mỗi chương.
- **FR-011**: Mọi trạng thái khóa theo cặp `(Khóa, Mô hình)` mới PHẢI tương thích ngược hoàn toàn với dữ liệu phiên làm việc đã lưu trước đó mà không làm mất lịch sử thống kê ngày hiện tại hay yêu cầu thay đổi cấu trúc lưu trữ chính của truyện/chương.

### Key Entities

- **Trạng thái hạn mức theo (Khóa, Mô hình)**: Trạng thái sức khỏe, bộ đếm ngày, thời điểm mở khóa dự kiến và lý do chi tiết gắn riêng cho từng mô hình đã chạy trên một khóa API.
- **Thông số tham chiếu mô hình**: Bộ giá trị chuẩn `RPM`, `TPM`, `RPD` thực tế của từng dòng mô hình AI làm mốc hiển thị và cảnh báo.
- **Cơ chế phân loại và giãn cách `429` ngắn hạn**: Quy tắc tách biệt giữa quá tải tốc độ tạm thời (chỉ tạm nghỉ ngắn có hồi phục, kể cả khi lặp lại ở lượt dùng ngày thấp) với cạn hạn mức ngày thực sự (chỉ khóa ngày khi có xác nhận tường minh từ nhà cung cấp hoặc chạm ngưỡng ngày cài đặt).
- **Hành động khôi phục trạng thái khóa**: Thao tác chủ động từ người dùng nhằm giải phóng trạng thái khóa kẹt của một khóa hoặc toàn bộ nhóm khóa trên mô hình đang chọn.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% trường hợp chuyển sang mô hình AI khác còn hạn mức trên khóa vừa báo cạn ngày ở mô hình cũ có thể gửi yêu cầu dịch thành công ngay ở lượt tiếp theo (0 lần bị chặn oan chéo giữa hai mô hình).
- **SC-002**: Người dùng có thể mở khóa thủ công một khóa bị gắn cờ từ phiên trước và kích hoạt lại tiến trình dịch trong vòng 1 thao tác bấm trên Bảng điều khiển Quota.
- **SC-003**: 100% trường hợp khóa còn dưới hạn mức ngày gặp `2` lỗi `429` mơ hồ liên tiếp không bị khóa oan thành `Hết hạn mức ngày` (tự hồi phục sau nhịp tạm nghỉ ngắn), và 100% thẻ khóa ở trạng thái không khả dụng hiển thị rõ nguyên nhân phân biệt giữa: chạm giới hạn tự đặt, cạn ngày tường minh từ nhà cung cấp kèm thời gian chờ còn lại, và lưu ý kiểm tra nguồn dùng ngoài (khi cạn ngày tường minh ở mức `< 25%` hạn mức ngày).
- **SC-004**: Chỉ số `TPM`, `RPM`, `RPD` tham chiếu mặc định trên Bảng điều khiển Quota khớp chính xác với giới hạn thực tế của dòng mô hình đang chọn (ví dụ `250K TPM / 500 RPD` thay vì `1M TPM` cho Flash Lite).
- **SC-005**: Tỷ lệ kích hoạt chia nhỏ cấp 1 ở GĐ1 vì sai khác ngắt dòng nhẹ (sạch chữ Hán, giữ đủ nội dung) giảm thêm ít nhất 50% trên các chương dài nhiều thoại ngắn, giảm trực tiếp số lượt gọi RPD tiêu thụ mỗi chương.
- **SC-006**: 0% thông tin khóa API thô bị lộ trong bất kỳ cảnh báo chẩn đoán hay nhật ký nào.

## Assumptions

- Phản hồi của Google AI Studio trong ảnh và log thực tế (`limit: 500, model: gemini-3.5-flash-lite, Please retry in 12h5m53s`) kết hợp xác nhận từ người dùng rằng tất cả các khóa nằm ở các Google Cloud Project tách biệt xác nhận rằng: Khóa #3 (`510/500`) và Khóa #4 (`489/500`) chạm hạn mức `500 RPD` thật của mô hình (`15 RPM`, `250K TPM`), còn Khóa #1 (`16/500, Lỗi: 2`) và Khóa #2 (`18/500, Lỗi: 2`) bị kẹt `Hết hạn mức ngày` là do lỗi phân loại leo thang sau `2` lỗi `429` mơ hồ liên tiếp chứ không phải cạn hạn mức thật.
- Các khóa từng bị lưu trạng thái `Hết hạn mức ngày` từ phiên chạy cũ trước bản vá (lúc trình duyệt chưa đặt lại sang ngày mới) có thể cần một cơ chế mở khóa chủ động hoặc tự cô lập theo mô hình để không tiếp tục chặn người dùng ngay sau khi cập nhật.
- Không cần thay đổi cấu trúc lưu trữ truyện/chương trong cơ sở dữ liệu chính; toàn bộ trạng thái khóa theo mô hình chỉ mở rộng an toàn phần dữ liệu thống kê quota cục bộ trên trình duyệt.
