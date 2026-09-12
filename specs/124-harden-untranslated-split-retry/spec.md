# Feature Specification: Gia cố cơ chế phân đoạn cứu nguy và chống sót chữ Hán cho mô hình Flash-Lite

**Feature Branch**: `124-harden-untranslated-split-retry`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "BẮT ĐẦU DỊCH LẠI CÁC CHƯƠNG LỖI | Mô hình: 'gemini-3.5-flash-lite' ... Lỗi xử lý chương '第一卷 — 恐怖广播': UNTRANSLATED_CHINESE_LEFTOVER: Bản dịch chứa tỉ lệ chữ Hán bất thường (28.2% > 10%), nghi ngờ AI chưa dịch. Bỏ qua chương '第一卷 — 恐怖广播' lỗi và tiếp tục... tôi vẫn gặp lỗi"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tách biệt phân đoạn độ dài văn bản với độ sâu thử lại và gia cố chỉ thị chống sót chữ Hán (Priority: P1) 🎯 MVP

Là một người dùng dịch tiểu thuyết sử dụng các mô hình gọn nhẹ (như Flash-Lite),  
Tôi muốn các chương dài khi được chia nhỏ ban đầu không bị tiêu hao số lượt thử lại cứu nguy, đồng thời các lượt thử lại phải được tự động bổ sung chỉ thị nghiêm cấm sao chép chữ Hán,  
Để mô hình AI tập trung dịch 100% sang tiếng Việt và không bị chạm trần giới hạn thử lại quá sớm dẫn đến việc bỏ qua chương.

**Why this priority**: Hiện tại, việc chia nhỏ văn bản dài (> 2000 token) trước khi dịch đang vô tình làm tăng cấp độ sâu đệ quy, khiến hệ thống chỉ còn 1 cơ hội thử lại khi gặp lỗi chữ Hán trước khi bỏ cuộc. Khắc phục điều này đảm bảo mọi phân đoạn luôn có đầy đủ 2 cấp thử lại cứu nguy độc lập kèm chỉ thị kiên quyết chống sót chữ Hán.

**Independent Test**:
1. Nhập một chương truyện dài trên 2000 token chứa câu từ dễ bị nhại lại chữ Hán.
2. Thiết lập mô hình dịch gọn nhẹ (Flash-Lite).
3. Mô phỏng hoặc kích hoạt trường hợp phân đoạn con đầu tiên trả về tỉ lệ chữ Hán vượt ngưỡng (ví dụ: 28.2%).
4. Xác minh hệ thống nhận diện đây là lượt thử lại lỗi cấp 1 (thay vì bị cạn kiệt số cấp thử lại), tự động bổ sung cảnh báo nghiêm cấm giữ nguyên chữ Hán vào chỉ thị dịch, chia tiếp phân đoạn và dịch lại thành công mà không bị ném lỗi bỏ qua chương.

**Acceptance Scenarios**:
1. **Given** một chương dài được chia nhỏ ban đầu do độ dài vượt ngưỡng, **When** một phân đoạn con phát sinh lỗi sót chữ Hán, **Then** bộ đếm cấp độ thử lại lỗi bắt đầu tính từ cấp 1 độc lập với việc phân đoạn độ dài trước đó.
2. **Given** hệ thống kích hoạt thử lại phân đoạn do lỗi sót chữ Hán, **When** gửi yêu cầu dịch lại tới mô hình AI, **Then** yêu cầu được tự động chèn thêm chỉ thị bắt buộc dịch toàn bộ sang tiếng Việt và nghiêm cấm sao chép nguyên tác chữ Hán.
3. **Given** phân đoạn con dịch lại thành công sau khi được gia cố chỉ thị, **When** hoàn tất, **Then** toàn bộ văn bản chương được ghép nối liền mạch, giữ đúng tiêu đề chương và tiến trình dịch chuyển tiếp bình thường.

---

### User Story 2 - Cứu nguy phân cấp đa tầng (Multi-tier Fallback) cho các phân đoạn con ngoan cố (Priority: P1)

Là một người dùng dịch tự động hàng loạt,  
Tôi muốn khi một phân đoạn con nhỏ vẫn tiếp tục chứa chữ Hán sau khi chia nhỏ đến cấp tối đa, hệ thống tự động chuyển sang dịch từng dòng độc lập (line-by-line) hoặc phiên âm Hán-Việt cho đoạn nhỏ đó thay vì đánh sập và bỏ qua toàn bộ cả chương truyện,  
Để 99% nội dung của chương đã dịch thành công được bảo toàn trọn vẹn và chương truyện vẫn về đích hoàn tất.

**Why this priority**: Trong một chương truyện gồm hàng chục đoạn văn, nếu chỉ có một đoạn ngắn chứa bài thơ hoặc câu thần chú khiến mô hình AI lúng túng và trả về chữ Hán, việc hủy bỏ và bỏ qua cả chương là sự lãng phí rất lớn đối với người dùng.

**Independent Test**:
1. Tạo tình huống một đoạn văn ngắn trong chương liên tục trả về chữ Hán vượt ngưỡng dù đã phân đoạn đến cấp tối đa.
2. Xác minh hệ thống không ném lỗi làm dừng cả chương, mà tự động kích hoạt chế độ cứu nguy phân cấp: dịch từng dòng độc lập để cô lập câu khó.
3. Nếu vẫn còn sót chữ Hán trên câu khó nhất, hệ thống tự động phiên âm Hán-Việt âm chuẩn cho các ký tự Hán còn sót lại, đánh dấu lưu ý kiểm duyệt và ghép nối thành công vào chương.
4. Xác minh trạng thái của chương được ghi nhận hoàn thành thay vì bị bỏ qua.

**Acceptance Scenarios**:
1. **Given** một phân đoạn con đạt giới hạn độ sâu phân đoạn chia nhỏ mà vẫn còn sót chữ Hán, **When** xử lý cứu nguy cấp 2, **Then** hệ thống tự động chuyển phân đoạn con đó sang chế độ dịch phân rã từng câu/dòng để cô lập đoạn văn lỗi.
2. **Given** phân đoạn con sau khi phân rã từng dòng vẫn còn một vài từ Hán chưa dịch, **When** hoàn tất cứu nguy cấp cuối, **Then** hệ thống chuyển đổi các ký tự Hán còn sót sang phiên âm Hán-Việt tương ứng, ghi nhận cảnh báo chẩn đoán và bảo toàn toàn bộ bản dịch của chương.
3. **Given** chương được cứu nguy phân cấp thành công, **When** kiểm tra kết quả cuối cùng, **Then** chương truyện có trạng thái hoàn thành và tỉ lệ chữ Hán toàn chương giảm xuống dưới ngưỡng an toàn (< 5%).

---

### User Story 3 - Tối ưu hóa dữ liệu đầu vào và minh bạch nhật ký tiến trình (Priority: P2)

Là một người dùng theo dõi bảng điều khiển dịch thuật,  
Tôi muốn hệ thống không bị trùng lặp nhồi nhét từ điển khi văn bản đã được tiền xử lý, và bảng nhật ký hiển thị chính xác từng cấp độ cứu nguy đang diễn ra,  
Để tôi nắm rõ tình trạng xử lý của từng chương và mô hình AI không bị quá tải ngữ cảnh gây ra lỗi nhại lại văn bản.

**Why this priority**: Việc gửi văn bản đã đánh dấu từ điển kèm theo việc nhồi nhét lại toàn bộ văn bản thô khiến mô hình Flash-Lite bị bối rối và có xu hướng nhại lại chữ Hán. Đồng thời nhật ký rõ ràng giúp người dùng tin tưởng vào khả năng tự phục hồi của hệ thống.

**Independent Test**:
1. Bật tính năng sử dụng văn bản đã quét từ điển trên một chương có nhiều thuật ngữ.
2. Xác minh yêu cầu dịch gửi đi được chuẩn hóa gọn gàng, không bị nhân đôi văn bản đánh dấu gây nhiễu ngữ cảnh.
3. Theo dõi bảng nhật ký thời gian thực và xác minh các thông điệp cứu nguy hiển thị rành mạch: "Cứu nguy cấp 1", "Dịch từng câu cô lập", "Phiên âm Hán-Việt câu khó" thay vì nhảy cóc thông báo lỗi.

**Acceptance Scenarios**:
1. **Given** chương truyện sử dụng văn bản nguồn đã quét từ điển, **When** hệ thống tạo nội dung yêu cầu dịch, **Then** văn bản được làm sạch chuẩn xác, tránh lặp lại cùng một đoạn văn nhiều lần trong ngữ cảnh gửi AI.
2. **Given** hệ thống kích hoạt các bước cứu nguy phân cấp, **When** thực thi từng bước, **Then** giao diện nhật ký phát thông điệp thời gian thực tương ứng với từng cấp độ cứu nguy.

---

### Edge Cases

- **Văn bản chỉ toàn thơ chữ Hán cổ**: Khi gặp một đoạn thơ tứ tuyệt hoặc ngũ ngôn mà AI Flash-Lite không thể dịch thoát nghĩa, cơ chế phiên âm Hán-Việt dòng thơ sẽ giữ nguyên vẹn cấu trúc vần thơ thay vì ném lỗi bỏ qua chương.
- **Mô hình AI bị mất kết nối mạng hoặc lỗi hạn mức (429)**: Các lỗi mạng hoặc cạn kiệt hạn mức API phải được giữ nguyên phân loại lỗi hệ thống để kích hoạt chờ hoặc xoay vòng key, không bị nhầm lẫn với lỗi sót chữ Hán.
- **Tiêu đề chương chứa chữ Hán đặc thù**: Đảm bảo tiêu đề chương (ví dụ: "第一卷 — 恐怖广播" -> "Quyển 1 — Khủng Bố Quảng Bá") được dịch chuẩn xác và tách biệt dòng rõ ràng, không bị tính gộp sai lệch vào tỉ lệ chữ Hán của phần nội dung.
- **Người dùng hủy tiến trình (Abort)**: Khi người dùng bấm dừng, mọi bước cứu nguy phân cấp đang chạy ngầm phải lập tức dừng lại an toàn.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI tách biệt hoàn toàn việc phân đoạn thích ứng do độ dài văn bản ban đầu (văn bản vượt ngưỡng token) khỏi bộ đếm cấp độ sâu thử lại lỗi (`splitRetryDepth`), bảo đảm mỗi phân đoạn luôn có đầy đủ hạn mức 2 cấp thử lại cứu nguy độc lập khi phát sinh lỗi.
- **FR-002**: Khi kích hoạt thử lại phân đoạn do lỗi sót chữ Hán (`UNTRANSLATED_CHINESE_LEFTOVER`), hệ thống PHẢI tự động bổ sung chỉ thị tăng cường chống sót chữ Hán vào yêu cầu gửi tới mô hình AI, nhấn mạnh yêu cầu dịch 100% sang tiếng Việt và cấm sao chép chữ Hán gốc.
- **FR-003**: Khi một phân đoạn con đạt giới hạn độ sâu phân đoạn chia nhỏ tối đa mà vẫn không vượt qua kiểm định chữ Hán, hệ thống PHẢI tự động kích hoạt cơ chế dịch phân rã từng dòng (line-by-line fallback) cho riêng phân đoạn con đó nhằm cô lập và dịch từng câu đơn lẻ.
- **FR-004**: Khi cơ chế dịch từng dòng hoàn tất trên phân đoạn con khó, nếu vẫn còn câu đơn lẻ chứa chữ Hán chưa dịch, hệ thống PHẢI tự động chuyển đổi các ký tự Hán còn sót sang phiên âm Hán-Việt tương ứng thay vì ném lỗi làm gián đoạn toàn bộ chương.
- **FR-005**: Lỗi sót chữ Hán ở một phân đoạn con tuyệt đối KHÔNG ĐƯỢC làm hủy bỏ, xóa sạch hay bỏ qua các phân đoạn con khác của chương đã được dịch thành công trước đó.
- **FR-006**: Trong Giai đoạn 2 (Chuốt văn phong), nếu một phân đoạn con bị vi phạm kiểm định chữ Hán sau các cấp thử lại, hệ thống PHẢI bảo lưu bản dịch thô hợp lệ của phân đoạn đó từ Giai đoạn 1 và cho phép toàn chương tiếp tục hoàn thành.
- **FR-007**: Hệ thống PHẢI chuẩn hóa cấu trúc dữ liệu yêu cầu dịch thuật khi sử dụng văn bản đã quét từ điển, loại bỏ việc chèn lặp kép văn bản nguồn và văn bản thay thế gây tràn ngữ cảnh hoặc nhiễu loạn mô hình Flash-Lite.
- **FR-008**: Hệ thống PHẢI hiển thị thông điệp nhật ký chẩn đoán thời gian thực cho từng tầng cứu nguy (phân đoạn cấp 1, phân đoạn cấp 2, dịch từng dòng cô lập, phiên âm Hán-Việt dự phòng) để người dùng theo dõi minh bạch tiến độ.
- **FR-009**: Trong chế độ dịch tự động hàng loạt, hệ thống PHẢI bảo đảm chương truyện hoàn thành chu trình cứu nguy phân cấp và lưu kết quả hợp lệ vào cơ sở dữ liệu thay vì rơi vào danh sách chương bị bỏ qua (`batchFailedIds`).

### Key Entities *(include if feature involves data)*

- **Adaptive Split Context**: Cấu trúc theo dõi ngữ cảnh phân đoạn trong bộ nhớ, phân biệt rõ giữa chỉ số phân đoạn độ dài (`chunkIndex`) và cấp độ thử lại lỗi (`retryDepth`).
- **Resilient Content Segment**: Đơn vị phân đoạn văn bản được trang bị khả năng cứu nguy đa tầng (chia nhỏ -> dịch từng câu -> phiên âm Hán-Việt) kèm thông tin chất lượng của từng tầng.
- **Prompt Reinforcement Directive**: Cụm chỉ thị tăng cường được kích hoạt động khi phát hiện lỗi chất lượng, hướng dẫn mô hình AI xử lý triệt để ngôn ngữ đích.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0% chương truyện gặp lỗi sót chữ Hán bị bỏ qua mà không trải qua đầy đủ chu trình cứu nguy phân cấp đa tầng.
- **SC-002**: Tỉ lệ dịch thành công đối với các chương dài (> 2000 token) khi sử dụng các mô hình gọn nhẹ (Flash-Lite) đạt tối thiểu 95% mà không cần người dùng thao tác dịch lại thủ công.
- **SC-003**: 100% các chương truyện được cứu nguy thành công có tỉ lệ chữ Hán toàn chương dưới 5%, bảo đảm chất lượng thuần Việt và bảo toàn trọn vẹn tiêu đề chương.
- **SC-004**: Không làm tăng quá 15% thời gian xử lý trung bình đối với các chương dịch thông thường không phát sinh lỗi sót chữ Hán.
- **SC-005**: Thông điệp thông báo trạng thái cứu nguy tương ứng xuất hiện trên giao diện người dùng trong vòng dưới 1 giây sau khi phát hiện sự cố ở mỗi tầng.

## Assumptions

- Việc phiên âm Hán-Việt đối với các ký tự Hán còn sót ở tầng cứu nguy cuối cùng sử dụng bảng chuyển đổi ngữ âm Hán-Việt tiêu chuẩn sẵn có trong hệ thống.
- Các mô hình gọn nhẹ như Flash-Lite phản hồi tốt hơn khi văn bản được chia thành các đoạn ngắn và có chỉ thị cảnh báo nghiêm ngặt về ngôn ngữ đích.
- Việc lưu trữ kết quả của chương truyện sau khi cứu nguy thành công hoàn toàn tương thích với lược đồ cơ sở dữ liệu IndexedDB hiện tại mà không đòi hỏi nâng cấp cấu trúc lưu trữ.
