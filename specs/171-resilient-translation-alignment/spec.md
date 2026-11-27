# Feature Specification: Ổn Định Dịch Thuật, Bảo Toàn Cấu Trúc Đoạn & Chống Hoàn Tác Toàn Chương Cho Mô Hình Tốc Độ Cao

**Feature Branch**: `[171-resilient-translation-alignment]`

**Created**: 2026-11-28

**Status**: Draft

**Input**: User description: "Nhật ký chạy lại 4 chương lỗi (Chương 68–71) bằng mô hình tốc độ cao nhẹ: liên tục kích hoạt cứu nguy phân đoạn thích ứng cấp 1–3 do sót chữ Hán và lệch cấu trúc đoạn 1-1; rơi vào phiên âm dự phòng; chuốt văn bị từ chối và hoàn tác toàn bộ chương vì suy giảm từ điển hoặc lệch cấu trúc đoạn; bản dịch vẫn bỏ sót hẳn 1 đoạn hoặc lệch 33/40 đoạn và 56/55 đoạn; bỏ sót 8–13 thuật ngữ từ điển; và bước tự động sửa đoạn QA vẫn từ chối sửa hoặc giữ lại các chương ở trạng thái lỗi."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bảo toàn ánh xạ đoạn văn 1-1 ổn định ở cả Dịch thô và Chuốt văn (Priority: P1)

Khi người dịch chạy dịch thô hoặc chuốt văn phong trên các chương có độ dài 30–80+ đoạn bằng các mô hình AI tốc độ cao, hệ thống phải neo rõ ràng ranh giới từng đoạn văn gốc sao cho bản dịch và bản chuốt giữ khớp **1-1** số lượng và thứ tự đoạn, không tự ý gộp hai đoạn liền kề thành một, không tách một đoạn gốc thành nhiều đoạn thừa (ví dụ 56 đoạn so với 55 đoạn gốc) và không âm thầm bỏ sót cả đoạn văn (ví dụ 33 đoạn so với 40 đoạn gốc). Khi thực sự cần chia nhỏ để cứu nguy, các phân đoạn tách ra và kết quả ghép lại vẫn phải giữ nguyên sự toàn vẹn ranh giới đoạn 1-1 thay vì bỏ qua kiểm tra cấu trúc ở lượt thử lại.

**Why this priority**: Lệch số đoạn là nguyên nhân dây chuyền gây ra hầu hết các lỗi khác trong nhật ký thực tế: nó làm bước rà soát từ điển gióng sai cửa sổ đoạn nguồn, khiến chuốt văn bị từ chối toàn chương và làm bước sửa lỗi QA ghép nhầm vị trí đoạn cần sửa.

**Independent Test**: Có thể kiểm thử độc lập trên các chương mẫu gồm 40–60 đoạn (bao gồm đoạn hội thoại ngắn, lời dẫn dài và tiêu đề chương) bằng cách mô phỏng đầu ra AI thiếu, gộp hoặc tách nhẹ đoạn văn và xác nhận cơ chế neo đoạn giữ tỷ lệ khớp đoạn 1-1 ở cả lượt dịch đầu, lượt chia nhỏ cứu nguy và lượt ghép chuốt văn.

**Acceptance Scenarios**:

1. **Given** một chương tiếng Trung dài 40–60 đoạn có xen kẽ lời thoại ngắn, miêu tả và dòng phân cảnh, **When** hệ thống thực hiện dịch thô hoặc chuốt văn phong qua mô hình tốc độ cao, **Then** từng đoạn đầu ra khớp chính xác 1-1 với từng đoạn đầu vào theo đúng thứ tự mà không gộp đoạn, tách thừa hay bỏ sót nguyên đoạn nào.
2. **Given** một đoạn khối buộc phải kích hoạt phân đoạn thích ứng để xử lý lại khi gặp sự cố, **When** hệ thống dịch/chuốt các phần đã chia và ghép lại hoàn chỉnh, **Then** mọi phần con vẫn được kiểm tra bảo toàn số đoạn 1-1 và bản ghép cuối cùng khớp đúng tổng số đoạn thân bài của bản gốc.
3. **Given** mô hình trả về thiếu một đoạn văn hoặc thừa một dòng tách đoạn ở vị trí xác định được, **When** hệ thống kiểm tra và khôi phục cấu trúc ngay trong giai đoạn dịch thô hoặc chuốt văn, **Then** đoạn bị lệch được căn chỉnh hoặc bổ sung kịp thời trước khi chuyển sang giai đoạn sau, không để lọt lỗi thiếu nguyên đoạn sang tới bước kiểm duyệt cuối.

---

### User Story 2 - Hậu kiểm chuốt văn theo từng đoạn thay vì từ chối và hoàn tác toàn bộ chương (Priority: P1)

Hiện tại, chỉ cần một lượt chuốt văn làm tốt 95% số đoạn trong chương nhưng vô tình đổi mất dấu ngoặc thoại, lệch dấu câu hoặc sót 1 thuật ngữ ở duy nhất 1–2 đoạn, hệ thống lập tức **từ chối và hoàn tác toàn bộ chương**, vứt bỏ toàn bộ công sức chuốt mịn ở các đoạn còn lại và dừng sớm các lượt chuốt kế tiếp. Cơ chế hậu kiểm chuốt văn phải chuyển sang đánh giá và hợp nhất ở **cấp độ từng đoạn văn**: giữ lại toàn bộ các đoạn đã chuốt mượt mà và đạt chuẩn trung thành, đồng thời chỉ hoàn tác riêng 1–2 đoạn bị suy giảm chất lượng về phiên bản lượt trước để chu trình chuốt văn tiếp tục hội tụ mượt mà.

**Why this priority**: Trong nhật ký của người dùng, cả 3 chương (68, 70, 71) đều bị chặn ở câu thông báo "Từ chối bản chuốt vì làm suy giảm độ trung thành... Khôi phục bản lượt trước và dừng chuốt sớm", khiến mọi bản dịch giữ nguyên trạng thái thô cứng hoặc còn nguyên lỗi từ điển chưa được sửa.

**Independent Test**: Có thể kiểm thử độc lập bằng cách đưa một bản chuốt văn gồm 40 đoạn trong đó 38 đoạn mượt mà hơn hẳn lượt trước và chỉ 2 đoạn có lỗi (1 đoạn sót tên từ điển, 1 đoạn mất dấu ngoặc thoại hoặc tách nhầm 1 câu); xác nhận hệ thống chấp nhận 38 đoạn tốt, chỉ giữ lại bản lượt trước cho đúng 2 đoạn lỗi, và cho phép quy trình chuốt tiếp tục chạy bình thường.

**Acceptance Scenarios**:

1. **Given** bản chuốt văn lượt `K` làm tốt đa số đoạn văn nhưng có 1–3 đoạn cục bộ bị suy giảm tuân thủ từ điển, biến đổi cách ngắt câu hoặc làm mất ngoặc thoại, **When** bộ hậu kiểm độ trung thành đối chiếu từng đoạn với lượt `K-1` và bản gốc, **Then** hệ thống hợp nhất bản chuốt ở cấp đoạn — chấp nhận mọi đoạn cải thiện đạt chuẩn và chỉ giữ nguyên phiên bản lượt `K-1` tại đúng các đoạn bị suy giảm.
2. **Given** một chương vừa được hợp nhất cục bộ vài đoạn lỗi nhưng phần lớn chương vẫn chuốt tốt, **When** vòng lặp chuốt văn chuẩn bị bước sang lượt `K+1`, **Then** hệ thống không dừng chuốt sớm toàn chương một cách oan uổng mà tiếp tục các lượt chuốt còn lại hoặc ghi nhận hội tụ bình thường khi đủ ngưỡng.
3. **Given** bản chuốt lượt `K` bị cắt cụt nặng phần cuối, sai lệch cấu trúc không thể căn chỉnh hoặc có đa số đoạn văn bị suy giảm nghiêm trọng so với lượt trước, **When** bộ hậu kiểm đánh giá mức độ thiệt hại tổng thể, **Then** hệ thống mới kích hoạt hoàn tác toàn bộ bản lượt trước và dừng chuốt sớm để bảo vệ an toàn dữ liệu.

---

### User Story 3 - Đồng bộ ngữ cảnh từ điển & truyền danh sách lỗi tuân thủ giữa các giai đoạn để giảm sót chữ Hán và lệch thuật ngữ (Priority: P1)

Khi dịch các chương đã qua bước tiền xử lý từ điển hoặc có bộ từ điển lớn, chỉ dẫn dịch thô phải bảo đảm tính nhất quán để mô hình tốc độ cao không chép sót ký tự Hán đi kèm tên tiếng Việt (gây kích hoạt chia nhỏ liên hoàn tới cấp 3 rồi rơi vào phiên âm dự phòng) và không bỏ sót quy tắc nhân vật/từ điển. Đồng thời, ngay sau khi kết thúc Giai đoạn Dịch thô và phát hiện còn `N` điểm lệch từ điển, sai đại từ hoặc sót chữ Hán (ví dụ 4–13 điểm lệch như trong nhật ký thực tế), danh sách lỗi cụ thể đó phải được chuyển tiếp làm chỉ dẫn sửa trực tiếp cho Giai đoạn Chuốt văn đầu tiên thay vì để Giai đoạn Chuốt văn lặp lại y nguyên 8–13 lỗi cũ.

**Why this priority**: Trong nhật ký Chương 70 và 71, bước dịch thô đã phát hiện chính xác 12–13 điểm lệch từ điển, nhưng vì thông tin này không được truyền sang Giai đoạn Chuốt văn (và Giai đoạn Chuốt văn lại bị hoàn tác), tới tận Kiểm duyệt cuối vẫn lặp lại đúng danh sách thiếu tên nhân vật `"千江月"`, `"天马"`, `"钱仓一"`, `"地狱之门"`.

**Independent Test**: Có thể kiểm thử độc lập bằng cách đưa văn bản đã đánh dấu từ điển qua bước tạo ngữ cảnh dịch thô để xác nhận đầy đủ quy tắc từ điển/nhân vật và không phát sinh chữ Hán thừa; sau đó giả lập bản dịch thô còn 5 lỗi từ điển và xác nhận lượt chuốt văn đầu tiên nhận đầy đủ danh sách 5 thuật ngữ cần sửa này trong chỉ dẫn biên tập.

**Acceptance Scenarios**:

1. **Given** một chương sử dụng văn bản đã quét tiền xử lý từ điển có chứa ký hiệu đánh dấu tên tiếng Việt hoặc bảng từ điển đầy đủ, **When** hệ thống chuẩn bị ngữ cảnh gửi mô hình dịch thô tốc độ cao, **Then** các tên trong văn bản không tạo ra mẫu chữ Hán dễ khiến mô hình chép sót nguyên văn cạnh tên Việt, trong khi bảng quy chiếu nhân vật/xưng hô vẫn giữ nguyên hiệu lực.
2. **Given** bản dịch thô vừa hoàn thành bị bộ kiểm tra tuân thủ tất định phát hiện một số thuật ngữ chưa khớp từ điển, sai đại từ nhân xưng hoặc còn sót cụm chữ Hán cụ thể, **When** hệ thống khởi tạo lượt chuốt văn phong tiếp theo, **Then** danh sách cụ thể các mục vi phạm kèm cặp tên quy ước đúng được đính kèm rõ ràng vào nhiệm vụ sửa của lượt chuốt đầu tiên.
3. **Given** một chương chỉ gặp lỗi sót chữ Hán hoặc lệch định dạng nhẹ tại một vài đoạn cục bộ sau lần dịch thô đầu tiên, **When** hệ thống chọn chiến lược khắc phục, **Then** ưu tiên cô lập và dịch/chuốt lại đúng những đoạn khiếm khuyết thay vì chia đôi lặp lại toàn bộ chương qua nhiều cấp phân đoạn gây chậm và lãng phí hạn mức.

---

### User Story 4 - Nâng cấp tự động sửa lỗi QA có mục tiêu: phục hồi đoạn bị thiếu/lệch, sửa an toàn hơn và giải thích rõ lý do nếu từ chối (Priority: P2)

Khi kết thúc chuốt văn mà bước Kiểm duyệt vẫn còn các lỗi nghiêm trọng (thiếu thuật ngữ từ điển, mất dấu ngoặc lời thoại, sai lệch dấu kết đoạn quan trọng hoặc bị sót/lệch vị trí đoạn văn), cơ chế **Tự động sửa đoạn QA** phải:
- Xác định chính xác đoạn nguồn tương ứng ngay cả khi số đoạn dịch đang bị lệch so với bản gốc (không chỉ đứng yên hoặc từ chối do gióng lệch đoạn).
- Có khả năng khôi phục hoặc tách bổ sung đoạn văn khi lỗi nghiêm trọng là bỏ sót đoạn hoặc gộp nhầm hai đoạn.
- Nếu lần sửa đầu của một đoạn vẫn vô tình vi phạm một ràng buộc an toàn (như quên giữ cặp dấu ngoặc thoại `"..."` hoặc vẫn thiếu tên từ điển bắt buộc), cho phép **tối đa 1 lượt thử sửa bổ sung có phản hồi cụ thể** cho riêng đoạn đó trước khi quyết định hoàn tác.
- Luôn ghi rõ **lý do tiếng Việt cụ thể** cho từng đoạn bị từ chối sửa (ví dụ: `"Đoạn 39: Bản sửa vẫn làm mất ngoặc thoại trực tiếp"` thay vì câu chung `"1 đoạn không đạt kiểm tra an toàn"`).

**Why this priority**: Trong nhật ký Chương 69, 70, 71, bước Sửa đoạn QA liên tục báo `"Giữ nguyên bản trước sửa (1 đoạn không đạt kiểm tra an toàn)"` hoặc `"2 đoạn bị từ chối/hoàn tác"` mà người dùng không biết lý do và không thể sửa dứt điểm lỗi thiếu đoạn gốc.

**Independent Test**: Có thể kiểm thử độc lập trên các đoạn mẫu bị mất ngoặc thoại, thiếu tên từ điển hoặc bị bỏ sót một đoạn nguồn trong tình trạng lệch tổng số đoạn; xác nhận lượt sửa có phản hồi sửa thành công các lỗi đơn giản và ghi nhận rõ lý do tiếng Việt khi bắt buộc phải từ chối.

**Acceptance Scenarios**:

1. **Given** một đoạn văn mắc lỗi nghiêm trọng (mất ngoặc thoại hoặc thiếu tên quy ước) và lần gọi sửa đầu tiên vô tình vẫn thiếu đúng ràng buộc đó, **When** cơ chế kiểm tra an toàn phát hiện điểm thiếu sót cụ thể, **Then** hệ thống thực hiện tối đa 1 lượt sửa lại cục bộ kèm phản hồi chỉ đích danh lỗi vừa vướng trước khi chấp nhận hoặc hoàn tác đoạn đó.
2. **Given** một lỗi nghiêm trọng thuộc loại thiếu hoàn toàn đoạn văn bản gốc sau một đoạn đã dịch hoặc gộp nhầm hai đoạn làm lệch tổng số đoạn thân bài, **When** bước Sửa đoạn QA xử lý các lỗi cấu trúc có thể phục hồi an toàn, **Then** hệ thống dịch bổ sung đúng đoạn thiếu hoặc tách khôi phục đúng vị trí tương ứng để khép kín độ khớp 1-1 mà không làm hỏng các đoạn lân cận.
3. **Given** một đoạn sửa vẫn vi phạm tiêu chuẩn an toàn sau giới hạn thử sửa, **When** hệ thống hoàn tác đoạn đó về nguyên trạng trước sửa, **Then** nhật ký QA ghi rõ số thứ tự đoạn và nguyên nhân tiếng Việt cụ thể khiến bản sửa bị từ chối.

---

### User Story 5 - Phân loại minh bạch trạng thái chương lỗi & nhật ký cứu nguy gọn gàng sau khi dịch hàng loạt (Priority: P2)

Sau khi chuốt văn và chạy xong bước Tự động sửa đoạn QA trên mỗi chương, hệ thống phải đánh giá lại danh sách lỗi nghiêm trọng thực sự còn tồn đọng: nếu toàn bộ lỗi nghiêm trọng đã được sửa an toàn hết, chương đó phải được xóa khỏi hàng đợi chương lỗi; chỉ giữ lại trong danh sách lỗi những chương thực sự còn lỗi nghiêm trọng chưa khắc phục được (hoặc phải dùng văn bản dự phòng một phần), kèm một dòng tóm tắt ngắn gọn lý do tồn đọng theo từng nhóm lỗi để người dùng xử lý dứt điểm thay vì chạy lặp lại mãi trên cả 4 chương.

**Why this priority**: Tránh tình trạng người dịch vừa thấy hệ thống thông báo `"Đã sửa an toàn 8 đoạn"`, nhưng cuối phiên toàn bộ các chương vẫn tiếp tục nằm trong danh sách `"Có 4 chương lỗi"` khiến lần bấm dịch lại sau tiếp tục dịch lại từ đầu cả chương ổn lẫn chương lỗi.

**Independent Test**: Mô phỏng phiên dịch lại hàng loạt gồm 2 chương: 1 chương sửa sạch toàn bộ lỗi nghiêm trọng sau bước Sửa đoạn QA và 1 chương vẫn còn 2 lỗi nghiêm trọng bị từ chối; xác nhận chương thứ nhất được đánh dấu hoàn tất bình thường và chương thứ hai lưu đúng vào hàng đợi chương lỗi kèm tóm tắt số lỗi còn lại.

**Acceptance Scenarios**:

1. **Given** một chương từng có 8 lỗi nghiêm trọng sau Kiểm duyệt nhưng bước Sửa đoạn QA đã sửa an toàn sạch toàn bộ lỗi nghiêm trọng đó (chỉ còn cảnh báo nhẹ không nghiêm trọng hoặc 0 lỗi), **When** phiên dịch hoàn tất chương, **Then** chương được ghi nhận hoàn tất sạch và không bị giữ lại trong danh sách chương lỗi cần dịch lại.
2. **Given** một chương vẫn còn lỗi nghiêm trọng chưa sửa được hoặc có phân đoạn rơi vào bản dự phòng, **When** kết thúc quá trình xử lý chương và tổng kết phiên dịch hàng loạt, **Then** chương được giữ lại trong danh sách lỗi kèm tóm tắt chính xác số lỗi nghiêm trọng còn lại theo nhóm (ví dụ: còn 2 lỗi thuật ngữ, 1 lỗi thiếu đoạn).

---

### Edge Cases

- **Chương có dòng phân cảnh (`***`, `---`), thơ hoặc khối thông báo hệ thống**: Việc neo cấu trúc đoạn 1-1 không được đếm nhầm hoặc làm biến dạng dòng phân cảnh hay dòng tiêu đề chương thành đoạn tự sự thông thường.
- **Chương có câu nhạy cảm bị nhà cung cấp AI chặn thực sự**: Vẫn phải duy trì cơ chế phân rã chia nhỏ cô lập riêng câu bị chặn và cứu nguy dự phòng cho câu đó mà không làm thất lạc các đoạn bình thường xung quanh.
- **Khác biệt giữa các chế độ `"Dịch lại từ đầu"`, `"Chuốt lại từ bản thô"` và `"Tiếp tục dịch"`**: Hợp nhất cấp đoạn ở Giai đoạn Chuốt văn và truyền danh sách lỗi tuân thủ phải hoạt động thống nhất ở cả ba chế độ dịch hàng loạt lẫn thao tác dịch/chuốt đơn chương trong không gian làm việc.
- **Chương rất ngắn (1–5 đoạn) vs chương rất dài (80–120 đoạn)**: Chương quá dài vượt ngưỡng vẫn có thể phân khúc tiền xử lý, nhưng từng khúc và bản ghép cuối phải bảo toàn ánh xạ đoạn 1-1 tuyệt đối.
- **Tương thích dữ liệu & cài đặt người dùng hiện có**: Không làm thay đổi định dạng lưu trữ chương, từ điển hay tự ý thay đổi cấu hình số lượt chuốt, bật/tắt kiểm duyệt QA hoặc tự sửa lỗi của người dùng.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI bảo toàn ánh xạ đoạn văn **1-1** (cả số lượng đoạn thân bài và trật tự đoạn) qua cơ chế neo đoạn tường minh trong suốt cả Giai đoạn Dịch thô, phân khúc tiền xử lý/chia nhỏ thích ứng và Giai đoạn Chuốt văn phong.
- **FR-002**: Hệ thống PHẢI kiểm tra tính toàn vẹn khớp số đoạn **1-1** trên cả lượt dịch chính lẫn các nhánh con sau khi chia nhỏ cứu nguy (thay vì bỏ qua kiểm tra cấu trúc ở lượt thử lại), đồng thời áp dụng bước căn chỉnh an toàn trước khi kết luận lệch cấu trúc.
- **FR-003**: Khi chuẩn bị dữ liệu đầu vào cho Giai đoạn Dịch thô (kể cả khi chương đang dùng văn bản đã tiền xử lý từ điển hay văn bản gốc thuần túy), hệ thống PHẢI cung cấp chỉ dẫn từ điển rõ ràng, không mâu thuẫn để hạn chế tối đa việc mô hình tốc độ cao để sót ký tự Hán liền kề tên tiếng Việt hoặc bỏ qua thuật ngữ đã quy ước.
- **FR-004**: Khi Giai đoạn Dịch thô chỉ gặp khiếm khuyết cục bộ ở một số ít đoạn (như sót chữ Hán rải rác hoặc lệch định dạng nhẹ tại vài đoạn), hệ thống PHẢI ưu tiên cô lập và xử lý đúng các đoạn lỗi thay vì kích hoạt chia nhỏ toàn chương qua nhiều cấp lặp đi lặp lại.
- **FR-005**: Hệ thống PHẢI thay thế cơ chế từ chối và hoàn tác toàn chương ở Giai đoạn Chuốt văn bằng **đánh giá độ trung thành và hợp nhất ở cấp độ từng đoạn văn**: mọi đoạn văn cải thiện mượt mà, bảo toàn thuật ngữ từ điển, không bịa tên riêng mới và giữ đúng cấu trúc 1-1 được giữ lại; chỉ riêng những đoạn bị suy giảm chất lượng mới hoàn tác về phiên bản lượt trước.
- **FR-006**: Hệ thống CHỈ ĐƯỢC phép hoàn tác toàn bộ chương và dừng chuốt sớm khi xảy ra suy giảm mang tính thảm họa (chẳng hạn bản chuốt bị cắt cụt nặng, mất khả năng gióng hàng đoạn hàng loạt, hoặc tỷ lệ lớn số đoạn trong chương đồng loạt suy giảm).
- **FR-007**: Hệ thống PHẢI truyền danh sách các vi phạm tuân thủ tất định phát hiện được sau Giai đoạn Dịch thô (thuật ngữ lệch từ điển, sai đại từ giới tính, sót cụm chữ Hán) trực tiếp vào chỉ dẫn mục tiêu của lượt Chuốt văn kế tiếp để sửa ngay các lỗi đã biết.
- **FR-008**: Bước Tự động sửa đoạn QA PHẢI gióng khớp chính xác từng lỗi nghiêm trọng về đúng đoạn nguồn tương ứng kể cả khi số đoạn đang bị lệch, và hỗ trợ cơ chế phục hồi an toàn đối với lỗi bỏ sót đoạn hoặc gộp nhầm đoạn khi có đủ thông tin đối chiếu.
- **FR-009**: Trong bước Tự động sửa đoạn QA, nếu lần sửa đầu tiên của một đoạn vẫn thất bại ở một kiểm tra an toàn tất định (chẳng hạn vẫn mất dấu ngoặc thoại trực tiếp hoặc vẫn thiếu thuật ngữ bắt buộc), hệ thống PHẢI hỗ trợ tối đa **1 lượt sửa khắc phục bổ sung** có đính kèm đúng lỗi an toàn vừa vướng cho riêng đoạn đó trước khi hoàn tác.
- **FR-010**: Hệ thống PHẢI ghi nhật ký lý do tiếng Việt cụ thể, dễ hiểu cho từng đoạn bị giữ lại trong bước hợp nhất chuốt văn hoặc bị từ chối trong bước Tự động sửa đoạn QA (thay thế các thông báo chung chung không nêu rõ nguyên nhân).
- **FR-011**: Sau khi hoàn tất bước Tự động sửa đoạn QA, hệ thống PHẢI đánh giá lại danh sách lỗi nghiêm trọng thực tế còn tồn đọng của chương: chỉ giữ chương trong hàng đợi lỗi khi vẫn còn lỗi nghiêm trọng chưa khắc phục hoặc đoạn dùng phiên âm dự phòng, kèm tóm tắt số lỗi tồn đọng theo nhóm.
- **FR-012**: Toàn bộ cải tiến PHẢI tương thích ngược hoàn toàn với dữ liệu dự án, chương truyện, bảng từ điển hiện có và tôn trọng đầy đủ các chế độ dịch người dùng đã chọn (`Dịch lại từ đầu`, `Chuốt lại từ bản thô`, `Tiếp tục dịch`).
- **FR-013**: Hệ thống PHẢI bảo đảm chi phí lượt gọi API trung bình trên mỗi chương bình thường không tăng lên so với hiện tại (nhờ giảm vòng lặp chia nhỏ đa tầng và giảm các lượt chuốt bị hoàn tác vô ích).

### Key Entities

- **Đơn vị đoạn văn neo 1-1 (Anchored Paragraph Unit)**: Đơn vị đại diện cho một đoạn văn/dòng thoại gốc gắn với vị trí thứ tự cố định giúp đối chiếu, hợp nhất và phục hồi chính xác từng đoạn qua các bước dịch, chuốt và sửa lỗi.
- **Kết quả hợp nhất hậu kiểm cấp đoạn (Paragraph-Level Fidelity Merge Result)**: Kết quả kiểm định sau mỗi lượt chuốt văn ghi rõ tổng số đoạn chấp nhận bản mới, số lượng và vị trí các đoạn hoàn tác cục bộ về lượt trước, lý do hoàn tác từng đoạn, và cờ quyết định có hoàn tác toàn chương hay tiếp tục chuốt lượt sau hay không.
- **Danh sách lỗi tuân thủ bàn giao (Stage Compliance Handoff List)**: Tập hợp các lỗi thuật ngữ, đại từ hoặc sót chữ Hán đã nhận diện ở bước trước được đính kèm làm danh sách mục tiêu phải xử lý cho giai đoạn liền sau.
- **Báo cáo phục hồi lỗi QA có mục tiêu (Targeted Repair Outcome Report)**: Tổng hợp kết quả sửa từng đoạn ở bước QA gồm số đoạn sửa đạt chuẩn ngay, số đoạn sửa đạt sau 1 lượt nhắc lại, số đoạn từ chối kèm lý do cụ thể theo từng đoạn, và tập lỗi nghiêm trọng còn lại sau sửa.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tối thiểu **98%** các chương truyện tiêu chuẩn (30–80 đoạn) sau dịch thô và chuốt văn duy trì chính xác số lượng đoạn văn khớp 1-1 với bản gốc, không xảy ra lỗi bỏ sót nguyên đoạn hay tách thêm đoạn ngoài nguyên tác.
- **SC-002**: Giảm ít nhất **85%** số lần bị hoàn tác toàn bộ bản chuốt chương chỉ vì 1–3 đoạn sai lệch cục bộ so với hành vi trước đây, giữ lại trọn vẹn phần cải thiện văn phong ở các đoạn không lỗi.
- **SC-003**: Giảm ít nhất **70%** số lần kích hoạt phân đoạn thích ứng đa tầng (cấp 2–3 hoặc rơi xuống phiên âm dự phòng) trên các chương thông thường không bị chặn nội dung nhạy cảm.
- **SC-004**: Tỷ lệ tuân thủ thuật ngữ từ điển đạt tối thiểu **98%** sau khi hoàn tất chuốt văn và tự sửa đoạn QA trên các chương có từ điển hoạt động (bao gồm cả chương dùng văn bản tiền xử lý từ điển).
- **SC-005**: Bước Tự động sửa đoạn QA xử lý thành công tối thiểu **80%** các lỗi nghiêm trọng định danh được (lỗi thuật ngữ, mất ngoặc thoại, sót chữ Hán, thiếu đoạn đơn lẻ) trong giới hạn tối đa 1 lượt thử lại cục bộ, và ghi rõ nguyên nhân tiếng Việt cho **100%** trường hợp bị từ chối còn lại.
- **SC-006**: **100%** các chương đã khắc phục sạch lỗi nghiêm trọng sau chuốt văn và sửa đoạn QA được chuyển sang trạng thái hoàn tất đúng chuẩn, không bị giữ oan trong danh sách chương lỗi cuối phiên.
- **SC-007**: Tổng số lượt gọi API tiêu thụ trung bình trên mỗi chương khi dùng mô hình tốc độ cao nhẹ không tăng (và giảm rõ rệt ở các chương từng lặp nhiều vòng chia nhỏ và hoàn tác).

## Assumptions

- Giải pháp tiếp tục vận hành hoàn toàn ở phía trình duyệt, tương thích trực tiếp với mô hình AI tốc độ cao nhẹ mà người dùng đang cấu hình mà không yêu cầu người dùng bắt buộc phải chuyển sang mô hình đắt hơn.
- Dữ liệu chương truyện, từ điển hiện tại và các tùy chọn cấu hình hiện hành của người dùng được giữ nguyên, không cần di chuyển lại dữ liệu cũ.
- Các trường hợp nội dung thực sự bị nhà cung cấp AI chặn vì chính sách an toàn vẫn tiếp tục dùng cơ chế cô lập chia nhỏ và dự phòng để không làm gián đoạn hoặc mất trắng toàn chương.
