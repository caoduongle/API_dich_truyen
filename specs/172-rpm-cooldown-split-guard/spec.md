# Feature Specification: Bảo vệ Hạn mức RPM, Chặn Bão Chia Nhỏ & Đánh giá Chính xác Trạng thái Phục hồi

**Feature Branch**: `172-rpm-cooldown-split-guard`

**Created**: 2026-11-28

**Status**: Draft

**Input**: User description: "Nhật ký tiến trình dịch tự động 76 chương trên mô hình tốc độ cao bị chạm trần hạn mức lượt gọi theo phút (15/15 RPM), kích hoạt bão chia nhỏ 2→4→8→16 phần kèm phiên âm dự phòng hàng loạt, bỏ qua chương khi gặp lỗi quá tải tạm thời, ghi sai nhãn 'Phản hồi rỗng' cho lỗi hạn mức, chia nhỏ lặp lại do lệch cấu trúc đoạn/cắt cụt chuốt văn, và giữ oan cờ 'còn đoạn dùng phiên âm dự phòng' sau khi GĐ2 và kiểm duyệt AI đã phục hồi sạch."

## Clarifications

### Session 2026-11-28

- Q: Hệ thống nên thực thi giới hạn RPM và TPM người dùng đã cấu hình cho từng khóa như thế nào trước mỗi lượt gọi AI? → A: Chặn và điều tiết chủ động trước từng lượt gọi kết hợp xoay vòng sang khóa nguội nhất còn dư ngưỡng 60 giây; nếu toàn bộ khóa cùng sắp chạm ngưỡng thì tự chờ đúng số giây để cửa sổ trượt 60 giây mở lại rồi chạy tiếp liên tục.
- Q: Khi nhà cung cấp AI trả về lỗi 429 chứa chữ "quota" hoặc "exhausted" nhưng không ghi rõ giới hạn theo ngày trong khi số lượt hôm nay còn thấp, hệ thống nên xử lý khóa đó thế nào? → A: Tạm nghỉ ngắn 45–60 giây trước; chỉ đánh dấu Hết hạn mức ngày khi thông báo lỗi nêu rõ giới hạn theo ngày hoặc khóa tiếp tục lỗi 429 liên tiếp ngay sau khi đã chờ hết chu kỳ hồi phục.
- Q: Số lần chờ chủ động mở cửa sổ 60 giây theo ngưỡng RPM/TPM người dùng cài có bị tính chung vào giới hạn chờ lỗi 429/503 tối đa mỗi chương không? → A: Tách riêng hai bộ đếm — chờ chủ động theo RPM/TPM không giới hạn số lần để chạy liên tục xuyên suốt lô dài (chỉ dừng khi xong, cạn hạn mức ngày thật sự hoặc người dùng bấm Dừng), còn chờ lỗi 429/503 bị động vẫn giữ trần an toàn mỗi chương.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Chặn bão chia nhỏ và tự động chờ hồi phục khi chạm hạn mức tốc độ hoặc quá tải tạm thời (Priority: P1)

Khi người dùng chạy dịch tự động nhiều chương liên tiếp bằng mô hình AI có giới hạn lượt gọi theo phút (RPM) chặt chẽ, nếu toàn bộ khóa API đang ở trạng thái tạm nghỉ vì chạm trần tốc độ hoặc nhà cung cấp AI báo quá tải nhu cầu tạm thời, hệ thống phải nhận diện đây là sự cố hạ tầng chứ không phải lỗi nội dung văn bản. Thay vì hoảng loạn chia nhỏ chương thành 2 → 4 → 8 → 16 mảnh rồi dồn dập gọi lại và ép cả chương rơi sang phiên âm dự phòng thô, hệ thống tự động chờ hết thời gian hồi phục an toàn rồi thử lại đúng bước đang thực hiện ở cả ba giai đoạn (dịch thô, chuốt văn phong, kiểm duyệt chất lượng).

**Why this priority**: Trong nhật ký thực tế 76 chương, ngay khi chạm ngưỡng `15/15 RPM` dù hạn mức theo token và theo ngày còn rất dư, hệ thống đã coi lỗi hạn mức như lỗi nội dung rỗng và thực hiện chuỗi chia 16 mảnh ở cả Giai đoạn 1 và Giai đoạn 2, đốt thêm hàng chục lượt gọi chắc chắn thất bại mỗi chương, làm tê liệt hàng loạt chương liên tiếp và phá hỏng bản dịch bằng phiên âm dự phòng. Ngoài ra, lỗi quá tải tạm thời (`high demand`) khiến chương bị bỏ qua ngay lập tức mà không chờ thử lại.

**Independent Test**: Có thể kiểm thử độc lập bằng cách mô phỏng toàn bộ khóa API chạm hạn mức tốc độ theo phút hoặc trả về lỗi quá tải tạm thời tại bất kỳ giai đoạn nào (dịch thô, chuốt văn, kiểm duyệt), xác minh hệ thống không thực hiện bất kỳ lượt chia đôi chương nào, chờ đúng nhịp hồi phục có giới hạn và hoàn tất bước đang chạy khi khóa mở lại.

**Acceptance Scenarios**:

1. **Given** tiến trình dịch tự động đang chạy và toàn bộ khóa API cùng bước vào trạng thái tạm nghỉ do chạm giới hạn lượt gọi theo phút, **When** bước dịch thô, chuốt văn hoặc kiểm duyệt nhận phản hồi chạm hạn mức tốc độ, **Then** hệ thống tuyệt đối không kích hoạt chia nhỏ phân đoạn và không chuyển sang phiên âm dự phòng, mà tự động tạm chờ đến thời điểm khóa sớm nhất hồi phục (trong giới hạn an toàn) rồi thử lại đúng yêu cầu ban đầu.
2. **Given** nhà cung cấp AI trả về thông báo quá tải nhu cầu tạm thời cho một chương, **When** hệ thống tiếp nhận lỗi tạm thời này, **Then** hệ thống không bỏ qua chương ngay lập tức và không chia nhỏ chương, mà thực hiện chờ ngắn có kiểm soát và thử lại đúng bước đó trước khi kết luận thất bại.
3. **Given** người dùng bấm dừng tiến trình trong lúc hệ thống đang tạm chờ hồi phục hạn mức hoặc chờ quá tải, **When** lệnh dừng được kích hoạt, **Then** thời gian chờ kết thúc ngay lập tức, không phát sinh thêm lượt gọi nào và dữ liệu đã có của chương được giữ nguyên an toàn.
4. **Given** hệ thống đã dùng hết số lần tự động chờ hồi phục hoặc chờ quá tải cho phép trên một chương mà toàn bộ khóa vẫn chưa sẵn sàng, **When** lần thử lại cuối vẫn gặp lỗi hạn mức hoặc quá tải, **Then** chương được báo lỗi rõ ràng về giới hạn hạ tầng mà không ghi đè bản dịch hiện có bằng bản phiên âm dự phòng hỏng.

---

### User Story 2 - Ghi nhãn nguyên nhân sự cố chính xác và bảo vệ tiến trình dịch hàng loạt (Priority: P1)

Khi xem nhật ký tiến trình dịch tự động, người dùng cần biết chính xác lý do tại sao một bước phải tạm chờ, thử lại hoặc kích hoạt chia nhỏ. Mọi sự cố chạm hạn mức tốc độ hoặc quá tải tạm thời phải được hiển thị đúng bản chất hạ tầng thay vì bị gắn nhãn sai là `"Phản hồi rỗng"`. Đồng thời, khi toàn bộ khóa API đã cạn hạn mức không thể hồi phục trong khung chờ an toàn, tiến trình dịch hàng loạt phải dừng ngay một cách sạch sẽ thay vì tiếp tục chạy qua hàng chục chương tiếp theo để tạo ra chuỗi lỗi dây chuyền.

**Why this priority**: Việc gắn nhầm lỗi hạn mức tốc độ thành `"Phản hồi rỗng"` khiến người dùng hiểu sai nguyên nhân chương hỏng là do mô hình AI trả về rỗng, đồng thời khi phiên dịch hàng loạt vẫn lết qua 10–30 chương tiếp theo trong trạng thái khóa bị nghẽn, hệ thống vừa kéo dài trạng thái khóa RPM vừa làm người dùng phải lọc lại toàn bộ các chương bị hỏng hàng loạt.

**Independent Test**: Có thể kiểm thử độc lập bằng cách kiểm tra nhật ký phát sinh cho từng loại sự cố (chạm hạn mức tốc độ, quá tải tạm thời, phản hồi rỗng thực sự, vi phạm bộ lọc an toàn, sót chữ Hán, lệch cấu trúc đoạn, bản chuốt bị cắt cụt) và xác nhận tiến trình hàng loạt dừng ngay khi cạn hoàn toàn khả năng hồi phục khóa.

**Acceptance Scenarios**:

1. **Given** một bước dịch gặp lỗi chạm hạn mức tốc độ hoặc quá tải tạm thời và cần tạm chờ thử lại, **When** hệ thống ghi dòng nhật ký trạng thái, **Then** thông điệp ghi rõ là đang tạm chờ hồi phục hạn mức tốc độ hoặc quá tải dịch vụ tạm thời kèm thời gian chờ ước tính, tuyệt đối không gắn nhãn `"Phản hồi rỗng"`.
2. **Given** mô hình AI thực sự trả về nội dung rỗng hoặc bị cắt cụt dù khóa API vẫn hoạt động bình thường, **When** hệ thống kích hoạt cứu nguy chia nhỏ nội dung, **Then** nhật ký vẫn ghi chính xác nguyên nhân `"Phản hồi rỗng"` hoặc `"Bản chuốt văn bị cắt cụt"` như kỳ vọng.
3. **Given** toàn bộ khóa API đã vượt giới hạn số lần chờ hồi phục tối đa hoặc hết hạn mức theo ngày trong một phiên dịch nhiều chương, **When** chương hiện tại thất bại vì không còn khóa khả dụng, **Then** tiến trình dịch tự động dừng hàng loạt ngay tại điểm đó kèm hướng dẫn rõ ràng cho người dùng thay vì tiếp tục đốt yêu cầu qua các chương kế tiếp.

---

### User Story 3 - Giảm tần suất chia nhỏ dư thừa ở giai đoạn dịch thô và chuốt văn để bảo toàn hạn mức tốc độ (Priority: P1)

Ngay cả trước khi cạn hạn mức, mỗi lần chia nhỏ 2 → 4 → 8 phần ở giai đoạn dịch thô (vì nghi ngờ lệch cấu trúc đoạn 1-1) hoặc giai đoạn chuốt văn (vì nghi ngờ bản chuốt bị cắt cụt) làm số lượt gọi AI tăng từ 3 đến 15 lần trên một chương. Hệ thống cần tránh kích hoạt chia nhỏ không cần thiết khi sai khác đoạn văn chỉ mang tính trình bày nhỏ hoặc có thể xử lý bằng hợp nhất/khớp cấu trúc an toàn, đồng thời điều tiết nhịp gửi yêu cầu giữa các bước để không tự đẩy nhóm khóa vượt trần lượt gọi mỗi phút.

**Why this priority**: Quan sát trên 35 chương đầu trong nhật ký thực tế cho thấy trước khi lỗi 429 bùng phát, rất nhiều chương đã kích hoạt chuỗi cứu nguy nhiều tầng do lệch cấu trúc đoạn 1-1 ở Giai đoạn 1 và cảnh báo cắt cụt ở Giai đoạn 2, làm mức tiêu thụ RPM chạm đúng ngưỡng `15/15` trong ảnh chụp màn hình dù dung lượng token mới đạt chưa tới 20% giới hạn.

**Independent Test**: Có thể kiểm thử độc lập trên các chương có sai khác ngắt dòng nhẹ hoặc các lượt chuốt có sự chênh lệch nhỏ không làm mất nội dung, xác minh hệ thống xử lý thành công mà không kích hoạt chia nhỏ nhiều tầng không cần thiết, đồng thời giữ tổng số lượt gọi mỗi phút trong ngưỡng an toàn khi chạy liên tục.

**Acceptance Scenarios**:

1. **Given** bản dịch thô Giai đoạn 1 bảo toàn đủ nội dung gốc và không sót chữ Hán, nhưng chỉ có khác biệt hình thức ngắt đoạn nhỏ có thể căn chỉnh lại an toàn thành cấu trúc 1-1, **When** hệ thống kiểm tra tính tương đồng cấu trúc đoạn, **Then** hệ thống chuẩn hóa và phục hồi căn chỉnh trước thay vì kích hoạt chia nhỏ chương thành 2–8 phần để dịch lại từ đầu.
2. **Given** một lượt chuốt văn Giai đoạn 2 tạo ra bản chuốt đạt chuẩn ở hầu hết các đoạn và chỉ thiếu hoặc biến dạng ở tỷ lệ nhỏ đoạn cục bộ hoặc sai khác độ dài giả do rút gọn tự nhiên mà không mất nghĩa, **When** hệ thống thẩm định chất lượng lượt chuốt, **Then** hệ thống ưu tiên hợp nhất cục bộ hoặc đánh giá theo độ bảo toàn đoạn thực tế thay vì lập tức chia nhỏ cả chương thành nhiều phần để chuốt lại.
3. **Given** tiến trình dịch tự động đang chạy với tập khóa API đã được người dùng cấu hình ngưỡng `RPM` và `TPM`, **When** hệ thống chuẩn bị gửi bất kỳ lượt gọi nào trong các bước dịch thô, chuốt văn, kiểm duyệt, sửa lỗi hoặc chuyển sang chương kế tiếp, **Then** hệ thống kiểm tra mức tiêu thụ trong 60 giây gần nhất của từng khóa trước khi gửi: tự động xoay sang khóa khác còn dư ngưỡng (ưu tiên khóa nguội nhất) nếu khóa hiện tại sắp chạm trần, và nếu tất cả khóa đều sắp chạm ngưỡng thì tự chờ đúng số giây để cửa sổ trượt 60 giây mở lại rồi tiếp tục chạy liên tục mà không cần người dùng bấm tiếp tục.

---

### User Story 4 - Đánh giá chính xác trạng thái cần rà soát lại trên bản dịch cuối cùng (Priority: P2)

Trong quá trình tự động cứu nguy, có những chương gặp trục trặc cục bộ ở Giai đoạn 1 và phải dùng phiên âm dự phòng cho một câu khó, nhưng sau đó Giai đoạn 2 (chuốt văn phong nhiều lượt) và Giai đoạn 3 (kiểm duyệt AI & sửa lỗi có mục tiêu) đã xử lý lại đoạn đó hoàn chỉnh, không còn sót chữ Hán, khớp cấu trúc và đạt chuẩn kiểm duyệt. Hệ thống cần đánh giá trạng thái `"còn đoạn dùng phiên âm dự phòng"` dựa trên tình trạng thực sự của **bản dịch cuối cùng** sau toàn bộ quy trình, thay vì giữ cố định nhãn cảnh báo từ bản nháp Giai đoạn 1.

**Why this priority**: Trong nhật ký 76 chương, nhiều chương (như chương 2, 19, 22, 28, 38) đã đạt kết luận `"Đạt chuẩn! Không phát hiện lỗi bỏ sót, thêm thắt hoặc lặp lại"` từ kiểm duyệt AI sau Giai đoạn 2 nhưng vẫn bị gắn cờ `[Cần rà soát lại] ... (còn đoạn dùng phiên âm dự phòng)`, khiến người dùng mất thời gian kiểm tra lại những chương thực chất đã dịch hoàn chỉnh.

**Independent Test**: Có thể kiểm thử độc lập bằng hai kịch bản đối chứng: (a) Giai đoạn 1 có đánh dấu phiên âm dự phòng cục bộ nhưng bản dịch cuối sau Giai đoạn 2 và kiểm duyệt hoàn toàn sạch chữ Hán và đạt chuẩn; (b) Bản dịch cuối vẫn còn chữ Hán sót hoặc đoạn chưa phục hồi được. Xác minh chỉ kịch bản (b) giữ cảnh báo cần rà soát lại.

**Acceptance Scenarios**:

1. **Given** một chương từng kích hoạt phiên âm dự phòng ở Giai đoạn 1 nhưng sau khi hoàn tất Giai đoạn 2 và Giai đoạn 3 bản dịch cuối cùng không còn sót chữ Hán, khớp cấu trúc hợp lệ và đạt kiểm duyệt, **When** hệ thống tổng hợp trạng thái hoàn tất của chương, **Then** chương được ghi nhận là hoàn chỉnh bình thường và không gắn cảnh báo `"còn đoạn dùng phiên âm dự phòng"`.
2. **Given** một chương từng kích hoạt phiên âm dự phòng ở Giai đoạn 1 và bản dịch cuối cùng sau Giai đoạn 2/Giai đoạn 3 vẫn còn sót chữ Hán hoặc đoạn chưa chuyển ngữ hoàn chỉnh hoặc còn lỗi kiểm duyệt mức nghiêm trọng, **When** hệ thống tổng hợp trạng thái hoàn tất của chương, **Then** hệ thống vẫn giữ cảnh báo `[Cần rà soát lại]` kèm lý do chính xác để người dùng xử lý.

---

### Edge Cases

- **Người dùng bấm dừng giữa lúc chờ hồi phục**: Khi đang đếm chờ 30–60 giây để khóa API hồi phục RPM, thao tác hủy của người dùng phải ngắt chờ ngay lập tức trong vòng dưới 1 giây, không đợi hết đồng hồ chờ.
- **Lỗi chạm hạn mức xảy ra bên trong một nhánh chia nhỏ vì lỗi nội dung**: Nếu một chương đang được chia đôi vì lý do nội dung hợp lệ (ví dụ sót chữ Hán hoặc vi phạm bộ lọc an toàn) và một mảnh con bị lỗi 429 RPM ở nửa chừng, mảnh con đó phải tạm chờ hồi phục hạn mức rồi thử lại đúng mảnh đó, KHÔNG được tiếp tục chia mảnh con đó thành 4–8–16 mảnh vì lỗi 429.
- **Hỗn hợp khóa đang tạm nghỉ RPM và khóa đã cạn hẳn hạn mức ngày**: Nếu trong nhóm khóa có khóa còn cơ hội hồi phục trong vài chục giây và khóa khác đã hết hạn mức ngày hoàn toàn, hệ thống chỉ tính thời gian chờ theo khóa có thể hồi phục gần nhất và không chờ vô ích nếu toàn bộ khóa đều cạn hạn mức dài hạn. Với khóa mới dùng ít lượt trong ngày nhưng nhận lỗi 429 có thông báo chung chung không ghi rõ theo ngày, hệ thống ưu tiên tạm nghỉ 45–60 giây trước thay vì khóa oan cả ngày ngay lập tức.
- **Lỗi 503 quá tải hoặc 429 xảy ra ở bước Kiểm duyệt chất lượng (Giai đoạn 3)**: Nếu Giai đoạn 1 và Giai đoạn 2 đã tạo xong bản chuốt chất lượng cao nhưng bước Kiểm duyệt cuối gặp lỗi hạn mức/quá tải và hết lượt chờ thử lại, hệ thống phải bảo toàn nguyên vẹn bản dịch tốt đã hoàn tất từ Giai đoạn 2 thay vì xóa mất hay ghi đè bằng bản lỗi.
- **Khôi phục Giai đoạn 2 không hết chữ Hán**: Nếu Giai đoạn 1 dùng phiên âm dự phòng và Giai đoạn 2 chỉ sửa được một phần nhưng vẫn còn lại ký tự tiếng Trung chưa dịch hoặc cụm phiên âm Hán-Việt bất thường ở bản dịch cuối, trạng thái cảnh báo cần rà soát lại vẫn phải được bật.
- **Phản hồi rỗng thực sự vẫn được cứu nguy**: Khi khóa API trả về kết quả thành công bình thường nhưng nội dung văn bản bị rỗng (không phải lỗi mạng, không phải lỗi hạn mức, không phải quá tải dịch vụ), luồng cứu nguy chia nhỏ vẫn phải hoạt động để cứu chương và ghi đúng nhãn `"Phản hồi rỗng"`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI phân tách rạch ròi nhóm sự cố hạ tầng (chạm giới hạn tốc độ RPM, hết hạn mức, dịch vụ quá tải tạm thời, lỗi kết nối mạng) khỏi nhóm sự cố chất lượng nội dung (phản hồi rỗng thực sự, vi phạm bộ lọc an toàn, sót chữ Hán, lệch cấu trúc đoạn, cắt cụt văn bản).
- **FR-002**: Hệ thống KHÔNG ĐƯỢC kích hoạt chia nhỏ phân đoạn thích ứng (adaptive split) hoặc chuyển sang phiên âm dự phòng (sino fallback) đối với bất kỳ sự cố hạ tầng nào ở mọi giai đoạn (dịch thô, chuốt văn phong, kiểm duyệt chất lượng và sửa lỗi có mục tiêu).
- **FR-003**: Khi toàn bộ khóa API đang tạm thời bị giới hạn lượt gọi theo phút (cooldown RPM), hệ thống PHẢI tự động chờ đến mốc hồi phục khả dụng gần nhất cộng thêm khoảng đệm an toàn (trong ngưỡng tối đa cho phép mỗi lần chờ và giới hạn số lần chờ bị động trên mỗi chương đối với lỗi 429/503 từ nhà cung cấp) rồi thử lại đúng thao tác đang dở dang thay vì ném lỗi ngay hoặc chia nhỏ văn bản. Bộ đếm giới hạn số lần chờ lỗi bị động này PHẢI tách biệt hoàn toàn với nhịp chờ chủ động giữ chuẩn `RPM`/`TPM` ở FR-009 (vốn không bị giới hạn số lần chừng nào khóa vẫn còn hạn mức ngày và người dùng chưa bấm dừng).
- **FR-004**: Khi nhận lỗi quá tải dịch vụ tạm thời (như thông báo lưu lượng cao tạm thời) từ nhà cung cấp AI, hệ thống PHẢI tự động chuyển khóa khác (nếu còn khóa sẵn sàng) hoặc thực hiện chờ ngắn có kiểm soát và thử lại đúng bước đang chạy trước khi đánh dấu lỗi chương.
- **FR-005**: Mọi cơ chế chờ hồi phục hạn mức hoặc chờ quá tải PHẢI hỗ trợ hủy tức thì khi người dùng dừng tiến trình, bảo đảm không tiếp tục gửi yêu cầu mới và không làm hỏng hoặc ghi đè bản dịch hợp lệ đã có.
- **FR-006**: Hệ thống PHẢI ghi nhãn nguyên nhân sự cố chính xác vào nhật ký tiến trình theo đúng phân loại của FR-001; tuyệt đối không hiển thị `"Phản hồi rỗng"` cho các sự cố chạm hạn mức, quá tải tạm thời hoặc lỗi kết nối.
- **FR-007**: Khi một chương thất bại vì toàn bộ khóa API đã cạn hạn mức không thể hồi phục trong khung chờ cho phép, tiến trình dịch tự động hàng loạt PHẢI dừng sạch sẽ và thông báo lý do rõ ràng cho người dùng, không tiếp tục chạy qua các chương kế tiếp.
- **FR-008**: Ở bước kiểm tra cấu trúc đoạn Giai đoạn 1 và kiểm tra cắt cụt Giai đoạn 2, hệ thống PHẢI ưu tiên cơ chế căn chỉnh chuẩn hóa hoặc hợp nhất/khôi phục cục bộ cho các sai khác hình thức nhỏ trước khi kích hoạt chia nhỏ đa tầng, nhằm giảm số lượt gọi bổ sung dư thừa trên mỗi chương.
- **FR-009**: Trước mọi lượt gọi AI (bao gồm từng bước trong Giai đoạn 1, Giai đoạn 2, Giai đoạn 3 và mọi lượt thử lại bên trong cùng một chương lẫn giữa các chương liên tiếp), hệ thống PHẢI thực thi điều tiết chủ động bằng cách đối chiếu mức tiêu thụ thực tế trong cửa sổ 60 giây gần nhất của từng khóa với hạn mức `RPM` và `TPM` do người dùng cấu hình; nếu khóa hiện tại sắp chạm ngưỡng thì tự động xoay sang khóa khác còn dư ngưỡng (ưu tiên khóa nguội nhất), và nếu toàn bộ khóa cùng sắp chạm ngưỡng thì tự động chờ đúng số giây còn lại để cửa sổ trượt 60 giây mở lại rồi chạy tiếp liên tục mà không cần người dùng bấm tiếp tục.
- **FR-010**: Nếu bước kiểm duyệt chất lượng (Giai đoạn 3) không thể hoàn tất do hết số lần chờ hồi phục hạn mức hoặc quá tải, hệ thống PHẢI giữ nguyên bản dịch đã hoàn thành tốt ở Giai đoạn 2 và báo trạng thái hoàn tất kèm lưu ý chưa kiểm duyệt thay vì làm mất công sức dịch của chương đó.
- **FR-011**: Trạng thái cảnh báo chương cần rà soát lại do dùng phiên âm dự phòng PHẢI được đánh giá lại trên bản dịch cuối cùng sau khi kết thúc Giai đoạn 2 và Giai đoạn 3: chỉ gắn cờ khi bản dịch cuối vẫn còn tồn dư chưa chuyển ngữ hoặc lỗi chưa được phục hồi, và xóa bỏ cờ nếu bản dịch cuối đã sạch chữ Hán, khớp cấu trúc và đạt chuẩn kiểm duyệt.
- **FR-012**: Khi khóa API thực sự trả về kết quả thành công nhưng rỗng nội dung hoặc bị cắt cụt do mô hình AI (không phải lỗi hạ tầng), cơ chế cứu nguy chia nhỏ theo từng cấp vẫn PHẢI hoạt động bình thường với đúng nhãn mô tả tương ứng.
- **FR-013**: Khi nhà cung cấp AI trả về lỗi 429 chứa từ khóa chung về hạn mức nhưng không nêu rõ giới hạn theo ngày và số lượt dùng hôm nay của khóa vẫn còn thấp hơn hạn mức ngày, hệ thống PHẢI ưu tiên đặt khóa vào trạng thái tạm nghỉ tốc độ ngắn (45–60 giây) thay vì khóa cứng cả ngày; chỉ đánh dấu khóa hết hạn mức ngày khi phản hồi ghi rõ giới hạn theo ngày, khi khóa chạm ngưỡng lượt gọi ngày tối đa người dùng cài đặt, hoặc khi khóa tiếp tục báo lỗi 429 liên tiếp ngay sau khi đã hết thời gian tạm nghỉ mà không hoàn thành thêm lượt gọi nào.

### Key Entities

- **Phân loại sự cố thực thi**: Đại diện cho bản chất của mỗi lần thất bại hoặc cần thử lại (nhóm hạ tầng có thể hồi phục theo thời gian như RPM/quá tải, nhóm cạn hạn mức dài hạn, nhóm lỗi nội dung cần chia nhỏ hoặc sửa cục bộ).
- **Trạng thái hồi phục nhóm khóa**: Thông tin về thời điểm sớm nhất có khóa sẵn sàng gọi lại, phân biệt giữa khóa đang tạm nghỉ ngắn theo phút và khóa đã cạn hạn mức dài hạn, cùng bộ đếm số lần đã chờ trên chương hiện tại.
- **Trạng thái toàn vẹn bản dịch cuối**: Đánh giá tổng hợp sau toàn bộ các giai đoạn (thô, chuốt văn, kiểm duyệt/sửa lỗi) cho biết bản dịch cuối cùng đã sạch chữ Hán, đúng cấu trúc đoạn và hoàn chỉnh hay vẫn còn tồn dư từ bước dự phòng cần người dùng rà soát.
- **Bản ghi nhật ký chẩn đoán**: Thông điệp hiển thị cho người dùng trong nhật ký tiến trình, mang đúng cấp độ, giai đoạn xảy ra và nguyên nhân thực tế.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% các sự cố chạm giới hạn lượt gọi theo phút (429 RPM) hoặc quá tải tạm thời (503) trong quá trình dịch thô, chuốt văn hoặc kiểm duyệt kích hoạt cơ chế chờ hồi phục và thử lại đúng bước (0 lần kích hoạt chia nhỏ phân đoạn 2→4→8→16 phần và 0 lần kích hoạt phiên âm dự phòng vì lỗi hạ tầng).
- **SC-002**: 0% dòng nhật ký ghi nhãn sai `"Phản hồi rỗng"` khi nguyên nhân thực sự là giới hạn tốc độ, cạn hạn mức, quá tải tạm thời hoặc lỗi mạng.
- **SC-003**: Trên tập chương mẫu có chứa sai khác ngắt dòng nhẹ hoặc các đợt chuốt có độ dài dao động tự nhiên không mất nghĩa, số lần kích hoạt chia nhỏ đa tầng không cần thiết ở Giai đoạn 1 và Giai đoạn 2 giảm ít nhất 60% so với trước khi áp dụng tính năng, giúp giảm áp lực RPM đáng kể trong phiên dịch nhiều chương liên tiếp.
- **SC-004**: 100% chương từng kích hoạt phiên âm dự phòng ở Giai đoạn 1 nhưng đã được Giai đoạn 2 và Giai đoạn 3 phục hồi sạch chữ Hán và đạt chuẩn kiểm duyệt sẽ được đánh dấu hoàn chỉnh bình thường (không còn cảnh báo giả `"còn đoạn dùng phiên âm dự phòng"`), trong khi 100% chương vẫn còn sót chữ Hán ở bản cuối tiếp tục được gắn cảnh báo đúng quy định.
- **SC-005**: Khi người dùng bấm dừng tiến trình trong lúc hệ thống đang chờ hồi phục RPM hoặc chờ quá tải, tiến trình dừng hoàn toàn trong dưới 1 giây mà không phát sinh thêm yêu cầu nào.
- **SC-006**: Khi toàn bộ khóa API cạn hạn mức không thể hồi phục trong khung chờ an toàn, tiến trình dịch hàng loạt dừng lại ngay sau chương gặp lỗi đó thay vì tiếp tục thất bại hàng loạt qua các chương kế tiếp.
- **SC-007**: Trong phiên dịch liên tục nhiều chương với cấu hình giới hạn RPM/TPM cá nhân trên nhiều khóa, hệ thống tự điều tiết xoay khóa và chờ mở cửa sổ 60 giây mà không dừng oan giữa chừng (0% khóa bị đánh dấu nhầm "Hết hạn mức ngày" ở lần chạm lỗi 429 mơ hồ đầu tiên khi số lượt dùng trong ngày vẫn còn thấp).

## Assumptions

- Ngưỡng thời gian chờ tự động tối đa cho mỗi lần hồi phục RPM (ví dụ 120 giây/lần chờ và tối đa 2 lần chờ bị động mỗi chương khi vẫn phát sinh lỗi `429`/`503` từ nhà cung cấp) chỉ áp dụng cho nhánh xử lý lỗi bị động để tránh treo vô hạn khi mạng hoặc khóa gặp sự cố thật; nhịp chờ chủ động giữ chuẩn `RPM`/`TPM` trước khi gửi yêu cầu không bị giới hạn số lần để bảo đảm chạy liên tục cả lô dài.
- Với lỗi quá tải tạm thời từ nhà cung cấp AI (503 high demand), một khoảng chờ ngắn theo cấp số nhân hoặc theo nhịp khóa nguội (1–3 lần thử lại) là đủ để vượt qua các đỉnh tải tức thời.
- Việc giảm tần suất chia nhỏ dư thừa ở Giai đoạn 1 và Giai đoạn 2 không được làm giảm tiêu chuẩn chống sót chữ Hán hay làm mất nội dung gốc; mọi nới lỏng hoặc căn chỉnh cấu trúc đều phải đi kèm xác minh bảo toàn nội dung tiếng Việt đầy đủ.
- Trạng thái cảnh báo cần rà soát lại ở cấp chương vẫn phải tương thích ngược với dữ liệu chương đã lưu trước đây mà không yêu cầu di chuyển cấu trúc lưu trữ.
