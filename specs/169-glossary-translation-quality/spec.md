# Feature Specification: Cải Tiến Từ Điển Để Cải Thiện Chất Lượng Dịch

**Feature Branch**: `[169-glossary-translation-quality]`

**Created**: 2026-11-27

**Status**: Draft

**Input**: User description: "cải tiến từ điển để cải thiện chất lượng dịch"

## Clarifications

### Session 2026-11-27

- Q: Thanh thao tác hàng loạt trong bảng từ điển nên hỗ trợ những hành động nào cho các mục đang được chọn? → A: Bộ chuẩn hóa đầy đủ: Xóa hàng loạt, Ghim / Bỏ ghim hàng loạt, Đổi phân loại hàng loạt (Nhân vật / Địa danh / Thuật ngữ / Thành ngữ / Khác) và Gán giới tính hàng loạt cho nhân vật (kèm chọn tất cả trang hiện tại hoặc toàn bộ danh sách đang lọc).
- Q: Khi người dùng chọn chế độ Thay toàn bộ thuật ngữ lúc nhập tệp từ điển, hệ thống nên xử lý xác nhận an toàn và các mục hiện có như thế nào? → A: Thay thế toàn bộ danh sách từ điển chính bằng dữ liệu hợp lệ từ tệp nhập sau bước cảnh báo/xác nhận rõ số lượng mục cũ sẽ bị thay thế; giữ nguyên hàng chờ kiểm duyệt hiện có (không tự xóa).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cung cấp đầy đủ ngữ cảnh từ điển đồng nhất qua mọi bước dịch và biên tập (Priority: P1)

Khi người dịch chạy dịch một chương hoặc nhiều chương qua các bước dịch thô, chuốt văn phong và kiểm duyệt chất lượng, mọi mục từ điển liên quan đến đoạn văn (bao gồm mục khớp trực tiếp trong văn bản gốc và mục được ghim quan trọng) phải mang đầy đủ ngữ cảnh: cụm từ gốc, tên gọi phụ/biến thể, bản dịch tiếng Việt quy ước, phân loại thực thể, ghi chú ngữ cảnh sử dụng và hồ sơ xưng hô nhân vật. Thông tin này phải được truyền đồng nhất qua cả giai đoạn dịch thô lẫn giai đoạn chuốt văn phong và kiểm duyệt — khắc phục tình trạng bước chuốt văn thiếu ghi chú ngữ cảnh khiến câu chữ bị sửa lệch sắc thái hoặc vai vế.

Các mục từ điển áp dụng cho từng đoạn văn cần được sắp xếp theo nhóm vai trò rõ ràng (nhân vật kèm hồ sơ xưng hô lên đầu, tiếp đến địa danh, thuật ngữ/chiêu thức chuyên môn, thành ngữ và nhóm mục ghim tham chiếu) để quá trình dịch luôn tập trung đúng trọng tâm ngay cả khi dự án có hàng trăm mục từ điển. Khi tồn tại các mục trùng lặp hoặc xung đột (kể cả qua tên phụ/biến thể hoặc dạng chữ Giản thể/Phồn thể tương đương), hệ thống áp dụng một quy tắc ưu tiên tất định duy nhất xuyên suốt toàn bộ quy trình.

**Why this priority**: Đây là nguyên nhân trực tiếp nhất quyết định chất lượng bản dịch cuối cùng. Nếu từ điển đã có ghi chú sắc thái, quan hệ vai vế và nghĩa chuẩn nhưng bị mất ngữ cảnh ở bước chuốt văn hoặc xử lý xung đột thiếu nhất quán, bản dịch hoàn thiện vẫn sai xưng hô hoặc lệch nghĩa nhân vật/chiêu thức.

**Independent Test**: Có thể kiểm thử độc lập bằng cách tạo một bộ từ điển mẫu gồm nhân vật có ghi chú vai trò và hồ sơ xưng hô, địa danh, thuật ngữ có tên phụ và mục xung đột; chạy qua bước dịch thô, chuốt văn phong và kiểm duyệt cho một chương truyện và xác nhận ngữ cảnh đầy đủ, thứ tự ưu tiên và kết quả giải quyết xung đột được giữ nguyên nhất quán ở cả 3 bước.

**Acceptance Scenarios**:

1. **Given** một mục từ điển có ghi chú ngữ cảnh sử dụng, phân loại và hồ sơ nhân vật, **When** hệ thống chuẩn bị ngữ cảnh từ điển cho bước dịch thô, chuốt văn phong và kiểm duyệt chất lượng, **Then** cả 3 bước đều nhận đầy đủ nghĩa tiếng Việt quy ước, tên phụ/biến thể, ghi chú ngữ cảnh và hồ sơ xưng hô của mục đó mà không bị rơi mất ghi chú ở bước chuốt văn.
2. **Given** một dự án có nhiều loại mục từ điển khớp với chương hiện tại cùng với các mục được ghim, **When** ngữ cảnh từ điển được tổng hợp cho phân đoạn cần dịch, **Then** các mục được nhóm theo thứ tự ưu tiên vai trò rõ ràng (nhân vật và hồ sơ xưng hô trước, tiếp theo là địa danh, thuật ngữ/kỹ năng, thành ngữ/cụm từ và nhóm mục ghim tham chiếu) và tách biệt rõ giữa mục xuất hiện trực tiếp trong đoạn với mục ghim tham chiếu chung.
3. **Given** từ điển có hai mục trùng cụm gốc (bao gồm trường hợp trùng qua Giản thể/Phồn thể hoặc qua tên phụ/biến thể) nhưng khác bản dịch tiếng Việt, **When** lựa chọn mục thắng cuộc cho các bước dịch và kiểm tra, **Then** mọi bước đều chọn cùng một mục thắng cuộc theo thứ tự ưu tiên rõ ràng (mục được ghim > nguồn nhập thủ công > nguồn cẩm nang > nguồn quét tự động > mục có hồ sơ nhân vật chi tiết hơn > cụm dài hơn > mới hơn).

---

### User Story 2 - Khớp thuật ngữ thông minh, loại bỏ báo lỗi giả do cụm từ lồng nhau (Priority: P1)

Khi văn bản tiếng Trung chứa một thuật ngữ dài đã có trong từ điển (ví dụ họ tên đầy đủ của nhân vật như "Trương Tam Phong" hoặc tên chiêu thức dài), đồng thời trong từ điển cũng tồn tại một mục ngắn hơn nằm lọt bên trong cụm dài đó (ví dụ tên đơn hoặc danh xưng 1–2 chữ), hệ thống phải ưu tiên khớp và áp dụng cụm dài nhất tại vị trí xuất hiện đó. Cụm ngắn bị bao trùm hoàn toàn bởi cụm dài không được phép chèn đè vào giữa cụm dài và không được phép kích hoạt cảnh báo "vi phạm từ điển" giả khi bản dịch tiếng Việt đã sử dụng đúng bản dịch của cụm dài.

Ngoài ra, việc đối chiếu và thay thế an toàn phải nhận diện đồng đều cả tên chính, danh sách tên phụ/biến thể và các biến thể chữ Giản thể/Phồn thể tương ứng.

**Why this priority**: Trong tiểu thuyết dài kỳ, việc trùng một phần tên gọi (họ + tên, tên nhân vật + chức danh, tên chiêu thức ngắn nằm trong tên chiêu thức cấp cao) xảy ra rất phổ biến. Nếu hệ thống báo lỗi giả hoặc thay thế chồng lấn, người dịch tốn thời gian sửa nhầm hoặc quy trình tự động phải sửa đi sửa lại không cần thiết, làm giảm độ ổn định và độ mượt của bản dịch.

**Independent Test**: Có thể kiểm thử độc lập trên một đoạn văn chứa đồng thời cụm từ điển dài (ví dụ tên đầy đủ hoặc biệt hiệu dài) và bản dịch đúng của cụm dài đó, trong khi từ điển cũng chứa một mục con ngắn hơn nằm trong cụm dài; xác nhận quá trình đối chiếu không tạo cảnh báo thiếu từ điển giả, nhưng vẫn phát hiện chính xác nếu cụm ngắn xuất hiện độc lập ở vị trí khác trong cùng đoạn mà chưa được dịch đúng.

**Acceptance Scenarios**:

1. **Given** từ điển chứa cả cụm dài A (ví dụ tên đầy đủ 3 chữ Hán) lẫn cụm ngắn B là một phần của A (ví dụ 2 chữ cuối của A), và đoạn văn chỉ xuất hiện cụm dài A còn bản dịch dùng đúng bản dịch của A, **When** hệ thống kiểm tra mức độ tuân thủ từ điển, **Then** không có cảnh báo sai thuật ngữ nào được phát sinh cho cụm B tại vị trí đã khớp A.
2. **Given** đoạn văn chứa cả cụm dài A ở một câu và cụm ngắn B đứng độc lập ngoài A ở câu khác trong cùng đoạn, **When** bản dịch sử dụng đúng bản dịch của A nhưng dịch sai hoặc bỏ qua nghĩa của B tại vị trí độc lập, **Then** hệ thống vẫn phát hiện và báo chính xác cảnh báo thiếu thuật ngữ đối với B.
3. **Given** một mục từ điển được khai báo kèm tên phụ/biến thể hoặc viết bằng dạng chữ Phồn thể khác với dạng Giản thể trong văn bản chương, **When** hệ thống đối chiếu cho bước dịch và bước kiểm tra tuân thủ, **Then** hệ thống nhận diện chính xác thuật ngữ dựa trên cả tên chính lẫn tên phụ/biến thể ở mọi dạng chữ tương đương.

---

### User Story 3 - Tự động làm giàu hồ sơ nhân vật và lọc nhiễu khi quét/trích xuất từ điển (Priority: P2)

Khi người dùng quét thuật ngữ hàng loạt hoặc bật trích xuất thực thể tự động trong lúc dịch, hệ thống nâng cao chất lượng đầu vào của từ điển bằng ba cơ chế:
1. Lọc bỏ các từ phổ thông quá chung chung hoặc rác dễ gây nhiễu ngữ cảnh dịch (ví dụ danh từ thường ngắn thiếu tính tên riêng hoặc cụm không mang giá trị quy ước) trước khi đưa thẳng vào từ điển chính.
2. Khi danh sách thuật ngữ đã biết vượt quá vài trăm mục, việc lọc bỏ các thuật ngữ đã biết không bị cắt ngắn mù quáng mà ưu tiên loại trừ đúng các mục thực sự liên quan đến chương đang quét, giúp giảm hẳn tình trạng quét lặp lại hoặc đẩy nhầm mục trùng vào hàng chờ kiểm duyệt.
3. Với thực thể phân loại là nhân vật mới được phát hiện, nếu ngữ cảnh chương cung cấp dấu hiệu rõ ràng về giới tính hoặc vai vế xưng hô mặc định, hệ thống tự động gợi ý/điền sẵn thông tin giới tính vào hồ sơ nhân vật cho mục mới phát hiện. Tuy nhiên, hệ thống không bao giờ tự động ghi đè hồ sơ nhân vật hoặc bản dịch mà người dịch đã chỉnh sửa thủ công hoặc đã ghim.

**Why this priority**: Khi truyện dài hàng trăm chương, từ điển rác hoặc từ điển thiếu giới tính nhân vật làm giảm mạnh độ chuẩn xác của đại từ (hắn/nàng/y) và gây phình to danh sách thuật ngữ trùng lặp. Tự động làm giàu có kiểm soát giúp chất lượng từ điển tăng dần theo tiến độ truyện mà vẫn bảo vệ công sức biên tập thủ công của người dịch.

**Independent Test**: Có thể kiểm thử độc lập bằng cách mô phỏng quá trình quét/trích xuất một chương với từ điển hiện có lớn hơn 300 mục (trong đó có mục xuất hiện trong chương ở vị trí cuối danh sách) và chứa tên nhân vật kèm dấu hiệu giới tính rõ ràng cùng một vài cụm từ nhiễu; xác nhận từ nhiễu bị loại hoặc chuyển kiểm duyệt, từ đã có trong chương không bị trích xuất lặp lại, nhân vật mới được gắn giới tính gợi ý chính xác, và nhân vật đã chỉnh sửa thủ công không bị ghi đè.

**Acceptance Scenarios**:

1. **Given** một dự án đã có hơn 300 mục từ điển và đang quét tiếp chương mới có chứa các thuật ngữ nằm ở phần cuối danh sách từ điển đó, **When** hệ thống lập danh sách loại trừ cho chương đang quét, **Then** các thuật ngữ đã có mặt trong văn bản chương luôn được đưa vào danh sách bỏ qua trước tiên thay vì bị cắt bỏ do giới hạn danh sách cố định.
2. **Given** kết quả trích xuất thực thể từ một chương chứa cả tên nhân vật có bằng chứng giới tính rõ ràng và các cụm từ quá ngắn/chung chung dễ gây nhiễu, **When** hệ thống xử lý và phân loại thực thể mới, **Then** mục nhân vật mới được bổ sung gợi ý giới tính phù hợp (hoặc để "chưa rõ" nếu bằng chứng mơ hồ), trong khi các cụm nhiễu rõ rệt bị lọc bỏ hoặc đánh dấu cần kiểm duyệt thay vì tự động kích hoạt vào từ điển chính.
3. **Given** một nhân vật đã có trong từ điển và được người dịch thiết lập thủ công hồ sơ giới tính/xưng hô hoặc đánh dấu ghim, **When** quá trình dịch hoặc quét chương tiếp theo phát hiện lại nhân vật này, **Then** hồ sơ xưng hô và bản dịch hiện có của người dùng được giữ nguyên tuyệt đối, không bị ghi đè bởi gợi ý tự động.

---

### User Story 4 - Chẩn đoán sức khỏe từ điển và xử lý xung đột nhanh trước khi dịch (Priority: P2)

Tại màn hình quản lý từ điển của truyện, người dịch có thể xem ngay tổng quan "Sức khỏe từ điển" phản ánh trực tiếp các vấn đề làm suy giảm chất lượng dịch, bao gồm:
- Số nhóm thuật ngữ đang xung đột bản dịch tiếng Việt (cùng cụm chữ Hán chuẩn hóa hoặc trùng qua tên phụ/biến thể nhưng có nghĩa tiếng Việt khác nhau);
- Số mục nhân vật chưa có hồ sơ giới tính hoặc quy tắc đại từ tự sự (dễ gây dịch lẫn lộn "hắn/nàng");
- Số mục chưa hoàn thiện (trống bản dịch tiếng Việt).

Người dịch có thể bấm chọn trực tiếp từng nhóm chẩn đoán để lọc nhanh danh sách xuống đúng các mục cần xử lý và sửa/gộp xung đột hoặc bổ sung hồ sơ nhân vật ngay tại chỗ mà không làm mất ghi chú hoặc tên phụ sẵn có.

**Why this priority**: Người dùng thường không nhận ra vì sao một bộ từ điển hàng trăm mục lại tạo ra bản dịch thiếu nhất quán nếu không nhìn thấy các xung đột âm thầm (ví dụ cùng một nhân vật có hai bản dịch khác nhau hoặc nhân vật chưa có giới tính). Công cụ chẩn đoán giúp người dùng xử lý dứt điểm lỗi gốc trước khi bấm dịch hàng loạt.

**Independent Test**: Có thể kiểm thử độc lập bằng cách mở màn hình quản lý từ điển với bộ dữ liệu gồm ít nhất một cặp xung đột khác nghĩa (bao gồm trường hợp Giản/Phồn thể hoặc trùng biến thể), một nhân vật thiếu hồ sơ giới tính và một mục thiếu nghĩa tiếng Việt; xác nhận bộ đếm sức khỏe hiển thị chính xác từng loại vấn đề và bộ lọc nhanh đưa người dùng tới đúng nhóm mục đó để chỉnh sửa.

**Acceptance Scenarios**:

1. **Given** bộ từ điển của truyện có 1 cặp thuật ngữ trùng nghĩa gốc Giản/Phồn thể nhưng khác nghĩa Việt, 2 nhân vật chưa có thông tin giới tính/xưng hô và 1 mục trống nghĩa Việt, **When** người dùng mở giao diện quản lý từ điển, **Then** khu vực chẩn đoán sức khỏe từ điển hiển thị chính xác số lượng từng nhóm vấn đề và không đếm trùng lặp mục hoàn chỉnh.
2. **Given** khu vực chẩn đoán sức khỏe từ điển đang hiển thị cảnh báo cho từng nhóm, **When** người dùng kích hoạt lọc theo một nhóm vấn đề (ví dụ "Xung đột dịch nghĩa" hoặc "Nhân vật thiếu hồ sơ"), **Then** danh sách hiển thị chỉ các mục thuộc nhóm vấn đề đó để người dùng sửa trực tiếp hoặc hợp nhất, và số liệu chẩn đoán cập nhật ngay sau khi chỉnh sửa xong.
3. **Given** bộ từ điển không có xung đột hay thiếu sót nào trong các hạng mục trên, **When** người dùng mở giao diện quản lý từ điển, **Then** trạng thái sức khỏe từ điển hiển thị rõ tình trạng sẵn sàng, không gây nhiễu bằng cảnh báo thừa.

---

### User Story 5 - Thao tác hàng loạt trên từ điển và chọn chế độ Thay toàn bộ / Chỉ thêm khi nhập tệp (Priority: P2)

Khi dọn dẹp hoặc chuẩn hóa một bộ từ điển lớn trước khi dịch hàng loạt, người dịch có thể chọn nhiều mục trực tiếp trong bảng từ điển (chọn từng dòng, chọn tất cả trang hiện tại hoặc chọn toàn bộ danh sách đang lọc) và sử dụng thanh thao tác hàng loạt để thực hiện nhanh 4 hành động chuẩn hóa: Xóa hàng loạt (kèm xác nhận), Ghim / Bỏ ghim hàng loạt, Đổi phân loại hàng loạt (Nhân vật / Địa danh / Thuật ngữ / Thành ngữ / Khác) và Gán giới tính hàng loạt cho các mục nhân vật mà không làm mất các quy tắc xưng hô khác đã thiết lập.

Ngoài ra, khi nhập dữ liệu từ tệp từ điển hoặc cẩm nang, ngoài chế độ **Chỉ thêm thuật ngữ** mặc định (áp dụng các lựa chọn xử lý trùng lặp: rà soát, bỏ qua, hoặc ghi đè theo từng mục trùng), người dùng có thể chọn rõ chế độ **Thay toàn bộ thuật ngữ** để thay thế sạch toàn bộ danh sách từ điển chính hiện có bằng dữ liệu hợp lệ từ tệp nhập sau một bước cảnh báo xác nhận rõ số lượng mục cũ sẽ bị thay thế, đồng thời vẫn giữ nguyên hàng chờ kiểm duyệt hiện có.

**Why this priority**: Khi người dịch cần làm sạch hàng loạt từ rác sau khi AI quét, gán nhanh giới tính cho nhiều nhân vật mới hoặc nạp lại một bộ từ điển chuẩn mới từ tệp ngoài, thao tác từng dòng tốn rất nhiều thời gian và dễ bỏ sót. Bổ sung thao tác hàng loạt và chế độ thay thế toàn bộ an toàn giúp rút ngắn thao tác chuẩn bị từ điển từ hàng chục phút xuống vài giây.

**Independent Test**: Có thể kiểm thử độc lập tại màn hình quản lý từ điển bằng cách (1) lọc và chọn nhiều mục rồi thực hiện xóa, ghim/bỏ ghim, đổi loại, gán giới tính hàng loạt và xác nhận dữ liệu cập nhật chính xác; (2) nhập một tệp từ điển hợp lệ theo từng chế độ **Chỉ thêm thuật ngữ** và **Thay toàn bộ thuật ngữ** để kiểm tra hộp thoại xác nhận, kết quả thay thế từ điển chính và việc bảo toàn hàng chờ kiểm duyệt.

**Acceptance Scenarios**:

1. **Given** người dùng đang xem bảng từ điển (đã lọc hoặc chưa lọc) có nhiều mục, **When** người dùng chọn nhiều dòng (từng mục, cả trang hiện tại hoặc toàn bộ danh sách đang lọc) và thực hiện Ghim / Bỏ ghim, Đổi phân loại, Gán giới tính nhân vật hoặc Xóa hàng loạt (có xác nhận), **Then** toàn bộ các mục phù hợp được cập nhật hàng loạt trong một lần lưu, các thuộc tính hồ sơ nhân vật khác không bị mất và vùng chọn được làm sạch khi cần.
2. **Given** dự án đang có sẵn từ điển chính và một số mục trong hàng chờ kiểm duyệt, **When** người dùng nhập tệp từ điển hợp lệ và chọn chế độ **Thay toàn bộ thuật ngữ** rồi xác nhận cảnh báo nêu rõ số lượng mục cũ sẽ bị thay thế, **Then** toàn bộ từ điển chính được thay thế bằng dữ liệu hợp lệ từ tệp nhập trong khi hàng chờ kiểm duyệt hiện có vẫn được giữ nguyên.
3. **Given** người dùng mở luồng nhập tệp từ điển với chế độ **Thay toàn bộ thuật ngữ** nhưng tệp tải lên không có bất kỳ thuật ngữ hợp lệ nào, **When** hệ thống kiểm tra bản xem trước trước khi áp dụng, **Then** thao tác thay thế toàn bộ bị chặn và toàn bộ từ điển hiện tại được giữ nguyên an toàn.

---

### Edge Cases

- **Từ điển rất lớn (hơn 1.000 mục)**: Khi dịch hoặc quét một chương truyện dài, hệ thống không được gửi toàn bộ từ điển dư thừa làm loãng ngữ cảnh, mà chỉ giữ lại các mục thực sự xuất hiện trong chương (kèm biến thể) cùng các mục được ghim trong giới hạn hợp lý.
- **Thuật ngữ đơn âm tiết (1 ký tự Hán)**: Các mục chỉ có 1 ký tự Hán không được phép thay thế cưỡng bức vào giữa từ ghép nhiều chữ hoặc báo lỗi giả khi ký tự đó nằm trong một từ vựng khác; chỉ được đối chiếu khi đứng độc lập rõ ràng.
- **Nhân vật mơ hồ giới tính ở đầu truyện**: Khi đoạn trích chưa có bằng chứng rõ ràng về giới tính nhân vật mới, hệ thống giữ trạng thái "chưa rõ" thay vì đoán bừa để tránh khóa sai đại từ nhân xưng về sau.
- **Xung đột giữa tên chính của mục A và tên phụ/biến thể của mục B**: Phải được phát hiện trong chẩn đoán xung đột và xử lý nhất quán theo cùng quy tắc ưu tiên ở cả bước dịch lẫn bước kiểm tra.
- **Từ điển kế thừa từ phiên bản cũ hoặc tệp nhập ngoài**: Các mục từ điển cũ không có trường hồ sơ nhân vật, tên phụ hoặc mức độ ghim vẫn hoạt động bình thường ở mọi bước dịch, quét và chẩn đoán mà không phát sinh lỗi hay yêu cầu chuyển đổi thủ công bắt buộc.
- **Mục trùng chữ Hán nhưng giống hệt nghĩa tiếng Việt**: Không được tính là xung đột sai nghĩa trong chẩn đoán gây hoang mang (chỉ tính là trùng lặp để gộp nếu cần), nhưng vẫn áp dụng quy tắc chọn đại diện duy nhất có đầy đủ hồ sơ nhất khi dịch.
- **Nhập tệp rỗng hoặc không có mục hợp lệ ở chế độ Thay toàn bộ thuật ngữ**: Hệ thống chặn thao tác thay thế và giữ nguyên toàn bộ từ điển hiện tại, tránh xóa trắng dữ liệu do tệp lỗi.
- **Gán giới tính hàng loạt trên tập chọn hỗn hợp (gồm cả nhân vật lẫn địa danh/thuật ngữ)**: Chỉ áp dụng cập nhật giới tính cho các mục phân loại là nhân vật (và bảo toàn các trường hồ sơ xưng hô khác đã có), không làm hỏng dữ liệu của các mục không phải nhân vật.
- **Thay đổi bộ lọc hoặc xóa mục khi đang chọn nhiều dòng**: Trạng thái chọn hàng loạt tự động loại bỏ các mục không còn tồn tại để tránh thao tác nhầm.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI truyền đầy đủ ngữ cảnh của từng mục từ điển liên quan (cụm gốc, tên phụ/biến thể, bản dịch tiếng Việt quy ước, phân loại, ghi chú ngữ cảnh và hồ sơ xưng hô nhân vật nếu có) đồng nhất qua cả bước dịch thô, bước chuốt văn phong (bao gồm các lượt chuốt văn liên tiếp) và bước kiểm duyệt chất lượng.
- **FR-002**: Hệ thống PHẢI sắp xếp ngữ cảnh từ điển được đưa vào mỗi lần dịch/biên tập theo nhóm vai trò ưu tiên rõ ràng: nhân vật có hồ sơ xưng hô, các nhân vật khác, địa danh, thuật ngữ/kỹ năng/vật phẩm, thành ngữ/cụm từ và nhóm mục được ghim tham chiếu.
- **FR-003**: Hệ thống PHẢI áp dụng duy nhất một bộ quy tắc giải quyết xung đột tất định khi có nhiều mục trùng cụm gốc (qua dạng chữ chuẩn hóa Giản/Phồn thể hoặc qua tên phụ/biến thể), với thứ tự ưu tiên: được ghim > nhập thủ công > từ cẩm nang > quét tự động > có hồ sơ nhân vật phong phú hơn > cụm dài hơn > tạo mới hơn.
- **FR-004**: Trong quá trình kiểm tra tuân thủ từ điển và thay thế thuật ngữ an toàn, khi một vị trí trong văn bản gốc đã khớp với một thuật ngữ dài hơn thuộc từ điển, hệ thống PHẢI loại trừ phạm vi ký tự đã khớp khỏi việc so khớp các thuật ngữ ngắn hơn bị bao trùm hoàn toàn bên trong nó, nhằm loại bỏ hoàn toàn báo lỗi giả và chèn đè thuật ngữ.
- **FR-005**: Hệ thống PHẢI bảo đảm việc kiểm tra tuân thủ vẫn phát hiện chính xác nếu thuật ngữ ngắn xuất hiện ở một vị trí độc lập khác trong cùng đoạn văn mà không nằm trong phạm vi của thuật ngữ dài đã khớp, đồng thời không so khớp nhầm thuật ngữ 1 ký tự Hán nằm bên trong từ ghép khác.
- **FR-006**: Hệ thống PHẢI hỗ trợ nhận diện đầy đủ cả cụm chữ Hán chính và danh sách tên phụ/biến thể (kể cả khác biệt Giản thể/Phồn thể) khi chọn từ điển liên quan cho dịch thô, chuốt văn phong, kiểm duyệt chất lượng và phát hiện xung đột.
- **FR-007**: Khi lập danh sách thuật ngữ đã biết để loại trừ trùng lặp trong quá trình quét thuật ngữ nhiều vòng hoặc trích xuất cho một chương, hệ thống PHẢI ưu tiên đưa vào danh sách loại trừ các thuật ngữ đã tồn tại thực sự xuất hiện trong chương đó trước, sau đó mới bổ sung các mục phổ biến/được ghim trong giới hạn dung lượng ngữ cảnh cho phép.
- **FR-008**: Khi tiếp nhận thực thể mới phát hiện từ bước dịch hoặc quét thuật ngữ, hệ thống PHẢI lọc bỏ các từ nhiễu quá ngắn/chung chung thiếu giá trị quy ước (ví dụ đại từ đơn thuần, từ nối hoặc mục có cấu trúc không hợp lệ) hoặc đẩy sang hàng chờ kiểm duyệt thay vì tự động thêm vào từ điển chính.
- **FR-009**: Khi phát hiện thực thể mới loại nhân vật chưa có trong từ điển, nếu dữ liệu trích xuất hoặc văn cảnh đoạn gốc cung cấp dấu hiệu rõ ràng về giới tính, hệ thống PHẢI tự động điền gợi ý giới tính tương ứng vào hồ sơ nhân vật của mục mới (mặc định bỏ qua/giữ trạng thái chưa rõ khi thiếu bằng chứng); KHÔNG BAO GIỜ tự động ghi đè hồ sơ nhân vật hoặc bản dịch của mục đã được người dùng chỉnh sửa thủ công hoặc đã ghim.
- **FR-010**: Màn hình quản lý từ điển PHẢI cung cấp chỉ số tổng hợp "Sức khỏe từ điển" đếm chính xác ít nhất 3 nhóm vấn đề ảnh hưởng trực tiếp tới chất lượng dịch: (a) xung đột bản dịch tiếng Việt giữa các mục tương đương (kể cả Giản/Phồn thể và tên phụ), (b) nhân vật chưa có hồ sơ giới tính hoặc đại từ tự sự, và (c) mục thiếu bản dịch tiếng Việt.
- **FR-011**: Người dùng PHẢI có thể bấm chọn trực tiếp từng nhóm chẩn đoán trong khu vực Sức khỏe từ điển để lọc danh sách xuống đúng các mục đang gặp vấn đề và xử lý/chỉnh sửa ngay tại chỗ với trạng thái tổng hợp tự động cập nhật lại sau mỗi thay đổi.
- **FR-012**: Mọi cải tiến về đối chiếu, làm giàu hồ sơ và chẩn đoán PHẢI tương thích ngược hoàn toàn với dữ liệu dự án, từ điển và bản sao lưu hiện có mà không làm mất hay hỏng dữ liệu cũ.
- **FR-013**: Màn hình quản lý từ điển PHẢI cung cấp chế độ chọn nhiều mục (chọn từng dòng, chọn tất cả trang hiện tại và chọn toàn bộ danh sách đang lọc) cùng thanh thao tác hàng loạt hiển thị rõ số lượng mục đang chọn.
- **FR-014**: Thanh thao tác hàng loạt PHẢI hỗ trợ đủ 4 nhóm hành động: (a) Xóa hàng loạt (có hộp thoại xác nhận nêu rõ số mục sẽ xóa), (b) Ghim / Bỏ ghim hàng loạt, (c) Đổi phân loại hàng loạt (Nhân vật, Địa danh, Thuật ngữ/Bí kíp, Thành ngữ, Khác), và (d) Gán giới tính hàng loạt cho các mục phân loại nhân vật mà vẫn bảo toàn các thuộc tính hồ sơ nhân vật khác đã tồn tại.
- **FR-015**: Luồng nhập tệp từ điển PHẢI cung cấp lựa chọn rõ ràng giữa hai chế độ: **Chỉ thêm thuật ngữ** (mặc định, giữ nguyên các tùy chọn xử lý mục trùng lặp hiện có) và **Thay toàn bộ thuật ngữ** (thay thế toàn bộ danh sách từ điển chính hiện tại bằng toàn bộ mục hợp lệ đọc được từ tệp nhập).
- **FR-016**: Khi người dùng chọn chế độ **Thay toàn bộ thuật ngữ**, hệ thống PHẢI hiển thị cảnh báo/xác nhận nêu rõ số lượng thuật ngữ hiện tại sẽ bị thay thế trước khi áp dụng, PHẢI giữ nguyên hàng chờ kiểm duyệt hiện có (không tự xóa), và PHẢI chặn thao tác thay thế nếu tệp nhập không có mục hợp lệ nào.

### Key Entities

- **Mục từ điển (Dictionary Entry)**: Đơn vị quy ước thuật ngữ gắn với truyện, gồm cụm chữ Hán chính, danh sách tên phụ/biến thể tùy chọn, bản dịch tiếng Việt quy ước, phiên âm Hán-Việt, phân loại (nhân vật, địa danh, thuật ngữ, thành ngữ, khác), ghi chú ngữ cảnh sử dụng, nguồn gốc (thủ công, cẩm nang, quét tự động), trạng thái ghim và hồ sơ nhân vật tùy chọn.
- **Hồ sơ nhân vật (Character Pronoun Profile)**: Tập quy tắc xưng hô gắn với mục nhân vật, gồm giới tính (nam, nữ, trung lập, chưa rõ), đại từ tự sự ngôi thứ 3 mặc định, đại từ tự xưng mặc định và danh sách quan hệ xưng hô cặp đôi với các nhân vật khác.
- **Nhóm xung đột từ điển (Conflict Group)**: Tập hợp từ hai mục từ điển trở lên ánh xạ về cùng một cụm chữ Hán chuẩn hóa hoặc chia sẻ chung tên phụ/biến thể nhưng lại quy ước bản dịch tiếng Việt khác nhau, cần chọn một mục đại diện nhất quán khi dịch và cảnh báo cho người dùng xử lý.
- **Báo cáo sức khỏe từ điển (Dictionary Health Diagnostic)**: Tập các bộ đếm và danh sách định danh phân loại theo mức độ sẵn sàng của bộ từ điển (xung đột nghĩa dịch, nhân vật thiếu hồ sơ giới tính/xưng hô, mục thiếu nghĩa dịch tiếng Việt), cập nhật tức thời theo dữ liệu từ điển hiện tại của truyện.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% các bước xử lý văn bản (dịch thô, mọi lượt chuốt văn phong và kiểm duyệt chất lượng) nhận cùng một bản ghi ngữ cảnh đầy đủ (bao gồm ghi chú sử dụng và tên phụ/biến thể) và cùng một kết quả chọn mục thắng cuộc cho mọi trường hợp trùng lặp/xung đột trong cùng bộ từ điển.
- **SC-002**: 0 cảnh báo "vi phạm từ điển" giả phát sinh từ các cụm từ ngắn bị bao trùm hoàn toàn bởi một thuật ngữ dài hơn đã được dịch đúng quy ước trong cùng đoạn văn, trong khi 100% trường hợp cụm ngắn xuất hiện độc lập bên ngoài phạm vi cụm dài mà bị dịch sai vẫn bị phát hiện chính xác.
- **SC-003**: Khi quy mô từ điển vượt quá 500 mục, tỷ lệ trích xuất lặp lại các thuật ngữ đã tồn tại trong chương đang quét giảm ít nhất 90% so với việc cắt cứng danh sách loại trừ theo thứ tự đầu bảng.
- **SC-004**: 100% thực thể nhiễu rõ rệt thuộc danh sách từ phổ thông vô nghĩa bị chặn không tự động điền vào từ điển chính, và 100% hồ sơ nhân vật do người dùng chỉnh sửa thủ công hoặc ghim được bảo toàn nguyên vẹn qua các lần dịch và quét lặp.
- **SC-005**: Người dùng có thể nhận biết toàn bộ các xung đột nghĩa dịch và danh sách nhân vật thiếu hồ sơ giới tính của một dự án trong vòng dưới 5 giây thông qua khu vực chẩn đoán sức khỏe từ điển và lọc tới đúng nhóm cần sửa chỉ với 1 thao tác chọn.
- **SC-006**: 100% dự án từ điển hiện có (bao gồm từ điển tạo trước khi có tính năng này và bản nhập từ tệp ngoài) mở được, dịch được và hiển thị chẩn đoán chính xác mà không yêu cầu chuyển đổi dữ liệu thủ công.
- **SC-007**: Người dùng có thể chuẩn hóa hàng loạt (xóa, ghim/bỏ ghim, đổi phân loại hoặc gán giới tính) cho từ 20 mục từ điển trở lên trong một thao tác duy nhất dưới 10 giây, không làm mất dữ liệu hồ sơ nhân vật hiện có ngoài thuộc tính được chọn cập nhật.
- **SC-008**: 100% thao tác nhập tệp ở chế độ **Thay toàn bộ thuật ngữ** đều yêu cầu xác nhận rõ ràng trước khi ghi đè, giữ nguyên 100% mục đang nằm trong hàng chờ kiểm duyệt và không bao giờ xóa trắng từ điển khi tệp nhập không chứa mục hợp lệ.

## Assumptions

- Ứng dụng tiếp tục vận hành hoàn toàn ở phía trình duyệt với bộ dữ liệu dự án và từ điển lưu cục bộ hiện tại; không bổ sung dịch vụ máy chủ trung gian mới.
- Mọi thay đổi cải tiến dữ liệu từ điển mang tính tương thích mở rộng: không thay đổi hoặc phá vỡ cấu trúc lưu trữ cốt lõi của dự án đã lưu trước đó.
- Quyền quyết định của người dịch luôn cao hơn đề xuất tự động: mọi mục được người dùng nhập tay, chỉnh sửa thủ công hoặc đánh dấu ghim luôn giữ nguyên giá trị và thắng thế khi giải quyết xung đột.
- Ngôn ngữ giao diện và thông báo người dùng tiếp tục sử dụng tiếng Việt nhất quán với hệ thống hiện tại.
