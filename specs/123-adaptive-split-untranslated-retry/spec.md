# Feature Specification: Tự động kích hoạt Adaptive Content Split Retry khi gặp lỗi UNTRANSLATED_CHINESE_LEFTOVER

**Feature Branch**: `123-adaptive-split-untranslated-retry`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "Tự động kích hoạt Adaptive Content Split Retry khi gặp lỗi UNTRANSLATED_CHINESE_LEFTOVER trong dịch thô GĐ1 và chuốt văn GĐ2 thay vì bỏ qua chương"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tự động cứu nguy phân đoạn khi dịch thô (GĐ1) bị sót chữ Hán (Priority: P1) 🎯 MVP

Là một người dùng dịch tiểu thuyết tự động,  
Tôi muốn hệ thống tự động phát hiện khi kết quả dịch thô Giai đoạn 1 chứa tỉ lệ chữ Hán bất thường và tự động chia nhỏ khối văn bản để dịch lại từng phần,  
Để chương truyện không bị đánh dấu lỗi hay bị bỏ qua một cách đáng tiếc trong khi tiến trình dịch đang chạy.

**Why this priority**: Dịch thô là nền tảng đầu vào của toàn bộ pipeline 3 giai đoạn. Nếu GĐ1 thất bại do văn bản dài khiến mô hình AI sao chép lại chữ Hán gốc và chương bị bỏ qua ngay lập tức, người dùng mất hoàn toàn dữ liệu chương đó và chuỗi tiến trình dịch tự động bị gián đoạn.

**Independent Test**:
1. Nhập một chương truyện có nội dung dài hoặc câu từ phức tạp dễ gây hiện tượng nhại lại chữ Hán.
2. Mô phỏng hoặc kích hoạt dịch thô GĐ1 tạo ra kết quả có tỉ lệ chữ Hán vượt ngưỡng cho phép.
3. Xác minh hệ thống tự động bắt giữ lỗi sót chữ Hán, phát thông báo kích hoạt cơ chế chia nhỏ thích ứng, chia khối văn bản nguồn thành các phân đoạn nhỏ hơn và tiến hành dịch lại từng phân đoạn thành công.
4. Xác minh kết quả cuối cùng của GĐ1 được ghép nối hoàn chỉnh, bảo toàn tiêu đề chương và không còn sót chữ Hán.

**Acceptance Scenarios**:
1. **Given** văn bản dịch thô GĐ1 trả về có tỉ lệ chữ Hán vượt ngưỡng cho phép, **When** hệ thống kiểm định chất lượng phát hiện lỗi chữ Hán chưa dịch, **Then** hệ thống không báo lỗi thất bại ngay mà tự động chia nhỏ văn bản nguồn thành các phần thích ứng và dịch lại từng phần độc lập.
2. **Given** các phân đoạn con được dịch lại thành công, **When** tất cả các phần hoàn tất, **Then** hệ thống ghép nối các bản dịch con theo đúng thứ tự ban đầu, bảo toàn tiêu đề chương và chuyển tiếp mượt mà sang Giai đoạn 2.
3. **Given** hệ thống kích hoạt chia nhỏ cứu nguy cho GĐ1, **When** tiến trình đang thực thi, **Then** giao diện hiển thị nhật ký thời gian thực giải thích rõ đang phân đoạn dịch lại thay vì thông báo bỏ qua chương.

---

### User Story 2 - Tự động kích hoạt chia nhỏ thích ứng khi chuốt văn (GĐ2) bị sót chữ Hán (Priority: P1)

Là một người dùng biên tập và chuốt văn phong truyện,  
Tôi muốn chu trình chuốt văn Giai đoạn 2 tự động kích hoạt cơ chế chia nhỏ thích ứng khi phát hiện kết quả chuốt bị lẫn chữ Hán gốc,  
Để bản dịch chuốt luôn đạt chất lượng mượt mà, thuần Việt mà không bị thoái lui (fallback) non nớt hoặc làm đứt quãng chu trình mài giũa nhiều lượt.

**Why this priority**: Trong quá trình chuốt văn phong với các chỉ dẫn biên tập phức tạp, mô hình AI đôi khi nhại lại một số đoạn tiếng Trung từ văn bản đối chiếu. Kích hoạt chia nhỏ thích ứng cho GĐ2 giúp xử lý trọn vẹn từng đoạn ngữ cảnh hẹp, giữ đúng mạch cảm xúc tiểu thuyết.

**Independent Test**:
1. Chạy chu trình chuốt văn phong GĐ2 cho một chương truyện.
2. Tạo tình huống kết quả chuốt văn bị vi phạm ngưỡng chữ Hán chưa dịch.
3. Xác minh hệ thống phân loại lỗi này vào nhóm cứu nguy phân đoạn, chia đồng bộ cả văn bản gốc và bản nháp thô thành các cặp phân đoạn tương ứng, rồi chuốt lại từng cặp phân đoạn.
4. Xác minh kết quả chuốt được hợp nhất trọn vẹn, không còn sót chữ Hán và giữ nguyên tiêu đề chương.

**Acceptance Scenarios**:
1. **Given** một lượt chuốt văn GĐ2 trả về kết quả vi phạm ngưỡng chữ Hán chưa dịch, **When** hệ thống kiểm định bản chuốt, **Then** hệ thống tự động chia nhỏ thích ứng văn bản nguồn và bản nháp tương ứng để chuốt lại từng phần.
2. **Given** các phân đoạn chuốt con hoàn thành đạt chuẩn thuần Việt, **When** hợp nhất kết quả, **Then** hệ thống ghép nối văn bản theo thứ tự đoạn tự nhiên và ghi nhận lượt chuốt hoàn tất.
3. **Given** chu trình chuốt được cấu hình nhiều lượt (multi-round polish), **When** một lượt chuốt con phải chia nhỏ cứu nguy thành công, **Then** các lượt chuốt tiếp theo vẫn tiếp tục vận hành bình thường trên văn bản đã được cứu nguy.

---

### User Story 3 - Bảo vệ tiến trình dịch hàng loạt và xử lý suy biến giới hạn phân đoạn (Priority: P2)

Là một người dùng dịch hàng loạt nhiều chương (Batch Translation),  
Tôi muốn hệ thống duy trì tính ổn định của hàng đợi, tự động cứu nguy phân đoạn khi gặp lỗi chữ Hán chưa dịch và chỉ ghi nhận thất bại có thông tin chẩn đoán rõ ràng khi đã thử hết độ sâu phân đoạn cho phép,  
Để tối đa hóa số lượng chương dịch thành công liên tục mà không bị dừng đột ngột hoặc bỏ qua oan các chương truyện.

**Why this priority**: Khi người dùng cắm máy dịch cả trăm chương truyện qua đêm, việc một chương bị bỏ qua ngay lập tức chỉ vì AI nhại chữ Hán ở một đoạn văn dài sẽ làm lãng phí thời gian và giảm trải nghiệm tự động hóa.

**Independent Test**:
1. Thiết lập hàng đợi dịch tự động nhiều chương với tùy chọn tiếp tục khi gặp lỗi.
2. Cho chạy qua các chương gặp lỗi sót chữ Hán.
3. Xác minh các chương lỗi tự động thực hiện cứu nguy chia nhỏ và hoàn thành bình thường mà không rơi vào danh sách chương bị bỏ qua.
4. Giả lập một trường hợp cực đoan khi phân đoạn đã chia nhỏ đến độ sâu tối đa (max depth) mà AI vẫn không thể dịch, xác minh hệ thống dừng thử lại an toàn, ghi nhận log giải thích nguyên nhân và chuyển sang chương tiếp theo mà không làm treo ứng dụng.

**Acceptance Scenarios**:
1. **Given** tiến trình dịch hàng loạt đang chạy với tùy chọn tự động bỏ qua chương lỗi khi gặp sự cố, **When** một chương gặp lỗi sót chữ Hán ở GĐ1 hoặc GĐ2, **Then** hệ thống ưu tiên thực hiện toàn bộ chu trình chia nhỏ cứu nguy trước khi đưa ra bất kỳ quyết định bỏ qua chương nào.
2. **Given** một phân đoạn văn bản đã đạt giới hạn độ sâu chia nhỏ tối đa mà vẫn không thể vượt qua kiểm định chữ Hán, **When** xử lý suy biến, **Then** hệ thống áp dụng phương án xử lý an toàn có kiểm soát, phát cảnh báo chẩn đoán minh bạch trên nhật ký và chuyển tiếp có trật tự.
3. **Given** phiên dịch kết thúc, **When** người dùng kiểm tra thống kê, **Then** số lượng chương cứu nguy thành công nhờ chia nhỏ được phản ánh chính xác trong nhật ký tiến trình.

---

### Edge Cases

- **Văn bản ngắn không thể phân đoạn thêm**: Khi khối văn bản nguồn quá ngắn (dưới ngưỡng tối thiểu có thể cắt theo câu/đoạn tự nhiên), hệ thống không tiếp tục cố gắng chia nhỏ mà xử lý kết thúc thử lại an toàn để tránh vòng lặp vô hạn.
- **Trích dẫn chữ Hán đặc thù hợp lệ**: Các cụm từ danh xưng, thuật ngữ cổ trang hoặc khẩu quyết võ công ngắn nằm trong giới hạn tỉ lệ cho phép không bị nhận diện nhầm thành lỗi sót chữ Hán để kích hoạt chia nhỏ không cần thiết.
- **Lỗi mạng hoặc người dùng hủy tiến trình giữa chừng**: Khi người dùng nhấn nút dừng/hủy hoặc xảy ra ngắt kết nối trong khi các phân đoạn con đang được dịch lại, hệ thống phải hủy bỏ ngay lập tức các tác vụ con đang chờ mà không tạo ra trạng thái dữ liệu mồ côi hoặc ghi đè kết quả dở dang.
- **Độ sâu phân đoạn chạm trần (Max Depth Reached)**: Khi một phân đoạn đã chia nhỏ đến cấp tối đa (cấp 2) mà mô hình AI vẫn kiên quyết trả về văn bản chưa dịch:
  - Đối với GĐ1 (Dịch thô): Báo lỗi cụ thể cho phân đoạn đó để người dùng nhận biết đoạn văn bản nguồn có vấn đề thay vì âm thầm lưu văn bản tiếng Trung gốc vào cơ sở dữ liệu.
  - Đối với GĐ2 (Chuốt văn): Bảo lưu bản dịch thô hợp lệ của phân đoạn tương ứng từ GĐ1 kèm cờ ghi nhận phân đoạn bán phần để bảo vệ tiến độ toàn chương.
- **Giữ nguyên định dạng tiêu đề và ngắt dòng**: Khi hợp nhất các phân đoạn con sau khi thử lại, hệ thống bảo đảm tiêu đề chương không bị nhân bản, các khoảng cách dòng và cấu trúc đoạn văn bản gốc được giữ nguyên vẹn.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI nhận diện sự kiện vi phạm tỉ lệ ký tự chữ Hán chưa dịch (`UNTRANSLATED_CHINESE_LEFTOVER`) trong Giai đoạn 1 (Dịch thô) như một lỗi có thể khắc phục tự động thông qua cơ chế phân đoạn thích ứng.
- **FR-002**: Khi phát sinh lỗi vi phạm tỉ lệ chữ Hán ở Giai đoạn 1, hệ thống PHẢI tự động kích hoạt quy trình chia nhỏ khối văn bản nguồn thành 2 hoặc nhiều phân đoạn thích ứng theo ranh giới đoạn văn tự nhiên để dịch lại từng phần.
- **FR-003**: Hệ thống PHẢI nhận diện sự kiện vi phạm tỉ lệ ký tự chữ Hán chưa dịch (`UNTRANSLATED_CHINESE_LEFTOVER`) trong Giai đoạn 2 (Chuốt văn phong) như một lỗi có thể kích hoạt cơ chế chia nhỏ thích ứng đệ quy.
- **FR-004**: Khi phát sinh lỗi vi phạm tỉ lệ chữ Hán ở Giai đoạn 2, hệ thống PHẢI tự động phân đoạn đồng bộ cả văn bản nguồn và bản dịch thô tương ứng thành các cặp phân đoạn thích ứng để thực hiện chuốt lại độc lập.
- **FR-005**: Hệ thống PHẢI kiểm định độc lập chất lượng và tỉ lệ chữ Hán của từng phân đoạn con sau khi dịch hoặc chuốt lại trước khi chấp nhận kết quả của phân đoạn đó.
- **FR-006**: Hệ thống PHẢI ghép nối tuần tự các phân đoạn con đã xử lý thành công thành một văn bản hoàn chỉnh duy nhất, đảm bảo tính liên tục của nội dung và bảo toàn đúng định dạng tiêu đề chương.
- **FR-007**: Hệ thống PHẢI giới hạn độ sâu phân đoạn thích ứng tối đa (không vượt quá 2 cấp phân đoạn đệ quy) nhằm ngăn chặn tình trạng bùng nổ tác vụ hoặc tiêu tốn tài nguyên vô hạn.
- **FR-008**: Khi một phân đoạn con đạt giới hạn độ sâu tối đa mà vẫn không thể vượt qua kiểm định chữ Hán:
  - Ở Giai đoạn 1: Hệ thống PHẢI dừng thử lại phân đoạn đó và ghi nhận lỗi rõ ràng, tuyệt đối không chấp nhận lưu trữ văn bản tiếng Trung gốc chưa dịch vào kết quả bản dịch.
  - Ở Giai đoạn 2: Hệ thống PHẢI bảo lưu bản dịch thô hợp lệ của phân đoạn đó từ Giai đoạn 1 để tránh mất mát dữ liệu và cho phép chương tiếp tục hoàn thành.
- **FR-009**: Hệ thống PHẢI ghi nhận và hiển thị thông điệp nhật ký thời gian thực giải thích rõ nguyên nhân kích hoạt phân đoạn cứu nguy do sót chữ Hán, số lượng phân đoạn đang xử lý và kết quả cứu nguy.
- **FR-010**: Trong chế độ dịch tự động hàng loạt, hệ thống PHẢI hoàn tất toàn bộ chu trình phân đoạn thích ứng cứu nguy trước khi đưa ra quyết định đánh dấu thất bại hoặc bỏ qua chương truyện.
- **FR-011**: Hệ thống PHẢI hỗ trợ điều phối so le các định danh truy cập khả dụng giữa các phân đoạn con nhằm tránh gây nghẽn hạn mức tức thời.

### Key Entities *(include if feature involves data)*

- **Translation Chapter Task**: Đại diện cho đơn vị xử lý dịch thuật của một chương truyện, bao gồm thông tin nguồn gốc, văn bản thô, văn bản chuốt, trạng thái tiến trình và lịch sử thực thi cứu nguy.
- **Adaptive Content Segment**: Đại diện cho một phân đoạn văn bản được phân tách tự động theo ngữ cảnh đoạn văn, mang thông tin vị trí thứ tự, cấp độ sâu phân đoạn và nội dung nguồn/đích tương ứng.
- **Quality Verification Incident**: Đại diện cho sự kiện phát hiện sai lệch chất lượng văn bản dịch thuật (tỉ lệ chữ Hán bất thường, phản hồi rỗng), mang thông số định lượng vi phạm và chỉ thị kích hoạt chiến lược cứu nguy tương ứng.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tỉ lệ cứu nguy thành công đối với các chương từng phát sinh lỗi sót chữ Hán đạt tối thiểu 85% thông qua phân đoạn thích ứng tự động mà không cần người dùng thao tác can thiệp thủ công.
- **SC-002**: 100% các trường hợp phát sinh lỗi sót chữ Hán ở cả Giai đoạn 1 và Giai đoạn 2 đều kích hoạt quy trình phân đoạn thích ứng cứu nguy trước khi áp dụng bất kỳ chính sách bỏ qua chương nào.
- **SC-003**: 100% các kết quả dịch sau khi ghép nối từ các phân đoạn con bảo toàn nguyên vẹn thứ tự nội dung và tiêu đề chương ban đầu mà không bị sót hoặc nhân bản đoạn văn.
- **SC-004**: Giảm ít nhất 80% số lượng chương bị rơi vào trạng thái bỏ qua trong các đợt dịch tự động hàng loạt liên quan đến hiện tượng mô hình AI nhại chữ Hán.
- **SC-005**: Thông điệp chẩn đoán và nhật ký trạng thái kích hoạt phân đoạn cứu nguy xuất hiện trên giao diện người dùng trong vòng dưới 1 giây kể từ thời điểm phát hiện lỗi vi phạm.

## Assumptions

- Ngưỡng xác định vi phạm chữ Hán tiếp tục tuân thủ quy chuẩn kiểm định sẵn có của hệ thống (tỉ lệ ký tự chữ Hán vượt quá 10% trên tổng ký tự đối với các đoạn văn bản có độ dài tiêu chuẩn).
- Thuật toán phân đoạn tự động thực hiện cắt văn bản dựa trên ranh giới ngắt đoạn hoặc câu kết thúc tự nhiên, bảo toàn ngữ cảnh ngữ nghĩa trọn vẹn nhất có thể cho mô hình AI.
- Giới hạn phân đoạn thích ứng được ấn định tối đa ở cấp độ sâu là 2 (tương đương chia thành 2 đến 3 phần ở mỗi cấp) nhằm đảm bảo cân đối tối ưu giữa thời gian phản hồi và khả năng cứu nguy thành công.
- Người dùng có thể theo dõi tiến trình cứu nguy thông qua bảng nhật ký trực quan của ứng dụng và có thể hủy tiến trình an toàn bất kỳ lúc nào nếu mong muốn.
