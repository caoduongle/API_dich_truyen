# Feature Specification: Cải Tiến Cẩm Nang Dịch Thuật, Quy Tắc Dịch, Tông Giọng Biên Tập & Thể Loại Chính

**Feature Branch**: `167-translation-guidelines-style-upgrade`

**Created**: 2026-11-27

**Status**: Draft

**Input**: User description: "cải tiến cẩm nang dịch thuật; quy tắc dịch; tông giọng biên tập; thể loại chính để cải thiện chất lượng dịch"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Chuẩn hóa & mở rộng hệ thống Thể loại chính kèm chỉ dẫn văn phong chuyên sâu (Priority: P1)

Biên dịch viên khi tạo dự án mới hoặc chỉnh sửa thông tin dự án hiện có có thể chọn **Thể loại chính** từ một danh mục phong phú, đồng nhất bao phủ đầy đủ các dòng tiểu thuyết mạng phổ biến (như Tiên Hiệp, Võ Hiệp, Huyền Huyễn, Huyền Huyễn Phương Tây, Đô Thị, Ngôn Tình, Cổ Đại / Xuyên Không, Cung Đấu / Gia Đấu, Lịch Sử / Quân Sự, Khoa Huyễn / Võng Du, Mạt Thế / Sinh Tồn, Vô Hạn Lưu, Linh Dị / Thần Quái, Huyền Nghi / Trinh Thám, Hệ Thống / Điền Văn, Đồng Nhân / Light Novel, Hài Hước / Sảng Văn) hoặc tự nhập một thể loại tùy chỉnh khi tác phẩm mang đặc thù riêng. Mỗi thể loại được gắn sẵn bộ chỉ dẫn văn phong chuyên sâu gồm định hướng từ vựng, hệ thống xưng hô tiêu biểu, nhịp câu, sắc thái hội thoại và tự sự, cùng các lỗi dịch thường gặp cần tránh, đồng thời gợi ý các tông giọng biên tập tương thích.

**Why this priority**: Thể loại chính là khung ngữ cảnh nền tảng quyết định cách dùng từ Hán-Việt hay thuần Việt, cách xưng hô và không khí chung của cả bộ truyện. Mở rộng danh mục và thay mô tả sơ sài bằng bộ chỉ dẫn hành vi cụ thể tạo ra bước nhảy vọt trực tiếp về chất lượng bản dịch trên mọi dự án.

**Independent Test**: Có thể kiểm thử độc lập bằng cách mở màn hình tạo mới và màn hình chỉnh sửa dự án, kiểm tra tính đồng nhất của danh mục thể loại, chọn một thể loại mới hoặc nhập thể loại tùy chỉnh, rồi dịch cùng một đoạn văn mẫu để xác nhận chỉ dẫn chuyên sâu của thể loại đó được phản ánh vào bản dịch.

**Acceptance Scenarios**:

1. **Given** người dùng mở hộp thoại tạo truyện mới hoặc chỉnh sửa thông tin truyện, **When** mở danh sách chọn Thể loại chính, **Then** cả hai màn hình hiển thị cùng một danh mục thể loại đầy đủ (gồm các thể loại phổ biến hiện đại, cổ phong, kỳ ảo, trinh thám, sinh tồn, hài hước và tùy chọn thể loại tự nhập) kèm mô tả ngắn dễ phân biệt.
2. **Given** người dùng chọn một thể loại có sẵn (ví dụ Cung Đấu / Gia Đấu hoặc Khoa Huyễn / Võng Du), **When** thực hiện dịch và chuốt văn một chương truyện, **Then** hệ thống tự động áp dụng bộ chỉ dẫn văn phong chi tiết của thể loại đó (bao gồm quy chuẩn từ vựng, xưng hô, nhịp văn và tránh lỗi đặc thù của thể loại) và đề xuất các tông giọng biên tập phù hợp.
3. **Given** người dùng cần dịch một tác phẩm thuộc dòng đặc thù không nằm trong danh sách sẵn có, **When** chọn tùy chọn thể loại khác và nhập tên thể loại tùy chỉnh, **Then** hệ thống lưu chính xác tên thể loại tùy chỉnh, hiển thị lại đúng khi mở chỉnh sửa và áp dụng trực tiếp làm ngữ cảnh thể loại trong suốt quá trình dịch.
4. **Given** một dự án cũ đã tồn tại từ trước khi nâng cấp, **When** người dùng mở thông tin dự án hoặc dịch chương tiếp theo, **Then** giá trị thể loại cũ vẫn được nhận diện, hiển thị bình thường và ánh xạ sang bộ chỉ dẫn tương ứng mà không bắt buộc người dùng phải cấu hình lại.

---

### User Story 2 - Nâng cấp hệ thống Tông giọng biên tập với quy chuẩn diễn đạt cụ thể (Priority: P1)

Biên dịch viên có thể lựa chọn **Tông giọng biên tập** từ bộ danh mục mở rộng, đồng nhất giữa màn hình tạo dự án và chỉnh sửa dự án (bao gồm các tông giọng hiện có cùng các sắc thái còn thiếu như Trầm lắng tinh tế, Hài hước dí dỏm, Sắc sảo cung đấu và tùy chọn tông giọng tự nhập). Khi xem hoặc chọn từng tông giọng, người dùng nhìn thấy mô tả rõ ràng về sự khác biệt của tông giọng đó đối với tỷ lệ Hán-Việt / thuần Việt, nhịp điệu câu văn, sắc thái cảm xúc và độ tự nhiên của hội thoại. Ở hậu trường dịch thuật, mỗi tông giọng được chuyển hóa thành bộ quy chuẩn hành vi cụ thể áp dụng xuyên suốt từ bước dịch thô, chuốt văn bản địa hóa đến bước kiểm duyệt chất lượng, thay vì chỉ là một nhãn tên rời rạc.

**Why this priority**: Trong hệ thống hiện tại, tông giọng biên tập gần như chỉ là một cụm từ ngắn không kèm hướng dẫn cụ thể, khiến kết quả giữa các tông giọng khó phân biệt rõ rệt và dễ bị hòa lẫn ở bước chuốt văn. Biến tông giọng thành quy chuẩn hành vi rõ ràng giúp kiểm soát giọng văn nhất quán qua từng chương.

**Independent Test**: Có thể kiểm thử độc lập bằng cách dịch cùng một đoạn nguyên tác với hai tông giọng khác nhau (ví dụ Trang nghiêm cổ phong và Bình dị dân dã hoặc Hài hước dí dỏm) trong khi giữ nguyên thể loại, sau đó đối chiếu văn phong, lựa chọn từ ngữ và nhịp câu của hai bản dịch đầu ra.

**Acceptance Scenarios**:

1. **Given** người dùng đang cấu hình tông giọng cho dự án mới hoặc dự án sẵn có, **When** xem danh sách Tông giọng biên tập, **Then** cả hai màn hình cung cấp danh mục tông giọng mở rộng giống hệt nhau kèm tóm tắt tác động thực tế lên văn phong để người dùng dễ lựa chọn.
2. **Given** người dùng chọn một tông giọng cụ thể và chạy quy trình dịch một chương truyện, **When** bản dịch đi qua bước dịch thô, bước chuốt văn và bước kiểm duyệt, **Then** cả ba bước đều nhận cùng bộ quy chuẩn diễn đạt chi tiết của tông giọng đó (về tỷ lệ Hán-Việt, nhịp câu, sắc thái hội thoại và lời dẫn).
3. **Given** người dùng chọn tùy chọn tông giọng tùy chỉnh và mô tả sắc thái mong muốn, **When** lưu dự án và dịch chương, **Then** hệ thống bảo toàn mô tả tông giọng tùy chỉnh và đưa trực tiếp vào định hướng biên tập của toàn bộ các bước dịch.
4. **Given** người dùng đổi thể loại chính sang một nhóm có phong cách khác biệt, **When** mở lại lựa chọn tông giọng, **Then** hệ thống đánh dấu gợi ý những tông giọng hài hòa nhất với thể loại vừa chọn nhưng vẫn tôn trọng quyền tự chọn bất kỳ tông giọng nào của người dùng.

---

### User Story 3 - Cấu trúc hóa Cẩm nang dịch thuật & Quy tắc dịch, hỗ trợ mẫu khởi tạo và nhập/xuất đầy đủ (Priority: P1)

Biên dịch viên có một không gian soạn thảo **Cẩm nang dịch thuật & Quy tắc dịch** rõ ràng hơn thay cho một ô ghi chú nhỏ lẫn lộn giữa tóm tắt cốt truyện và quy tắc kỹ thuật. Người dùng có thể áp dụng nhanh **mẫu quy tắc khởi tạo** theo đúng thể loại đã chọn với các mục tách bạch (bối cảnh tóm tắt, quy tắc xưng hô mặc định, mức độ dùng Hán-Việt / thuần Việt, quy ước danh xưng / chức vị / tên phiên âm ngoại lai, và danh sách điều cần tránh), hoặc vẫn chỉnh sửa tự do dạng văn bản thuần khi muốn. Ngoài ra, tính năng **nhập cẩm nang dịch thuật** từ tài liệu Markdown hoạt động trên cả màn hình tạo dự án lẫn màn hình chỉnh sửa dự án hiện có, đọc và trích xuất đầy đủ quy tắc trên toàn bộ độ dài tài liệu (không âm thầm cắt bỏ phần nội dung sau vài nghìn ký tự đầu), đồng thời hiển thị **bảng xem trước** cho phép người dùng quyết định ghi đè hay hợp nhất trước khi áp dụng. Người dùng cũng có thể xuất cẩm nang hiện tại thành tệp Markdown để sao lưu hoặc dùng chung cho các bộ truyện cùng hệ.

**Why this priority**: Cẩm nang dịch thuật là nơi chứa quy tắc sống còn của riêng từng bộ truyện. Việc cắt cụt âm thầm nội dung sau mốc ký tự ngắn, thiếu tính năng nhập lại khi đang biên tập dự án, và không có cấu trúc mẫu hay xem trước khiến quy tắc quan trọng thường xuyên bị thất lạc hoặc vô tình ghi đè dữ liệu đang làm việc.

**Independent Test**: Có thể kiểm thử độc lập bằng cách: (a) chèn mẫu khởi tạo cho một thể loại, (b) nhập một tệp cẩm nang dài hơn 10.000 ký tự có quy tắc quan trọng nằm ở phần cuối trên màn hình chỉnh sửa dự án đã có sẵn dữ liệu, kiểm tra xem trước và lựa chọn hợp nhất/ghi đè, và (c) xuất cẩm nang ra tệp rồi kiểm tra tính đầy đủ của nội dung xuất.

**Acceptance Scenarios**:

1. **Given** người dùng đang tạo dự án mới hoặc chỉnh sửa dự án hiện có và đã chọn Thể loại chính, **When** bấm sử dụng mẫu cẩm nang khởi tạo theo thể loại, **Then** hệ thống điền khung cấu trúc gồm các nhóm quy tắc chuẩn (bối cảnh, xưng hô, Hán-Việt/thuần Việt, danh xưng/cấp bậc, điều cần tránh) phù hợp với thể loại đó; nếu ô quy tắc đang có nội dung, hệ thống hỏi xác nhận hoặc cho chọn chèn bổ sung để tránh mất dữ liệu.
2. **Given** người dùng tải lên một tệp cẩm nang dịch thuật dài (ví dụ trên 10.000 ký tự) có phần quy tắc xưng hô và cấm kỵ nằm ở nửa sau tài liệu, **When** hệ thống phân tích tệp cẩm nang, **Then** toàn bộ các mục quy tắc trọng yếu trong tài liệu được thu nhận đầy đủ thay vì bị cắt bỏ âm thầm tại ngưỡng ngắn; nếu tài liệu vượt quá giới hạn tối đa cho phép, hệ thống thông báo rõ phần nội dung chưa xử lý hết.
3. **Given** người dùng đang chỉnh sửa một dự án đã có sẵn thể loại, tông giọng, quy tắc dịch và bảng thuật ngữ, **When** tải lên một tệp cẩm nang mới trong màn hình chỉnh sửa dự án, **Then** hệ thống hiển thị màn hình xem trước gồm thể loại đề xuất, tông giọng đề xuất, nội dung quy tắc trích xuất và số lượng thuật ngữ, cho phép người dùng chọn áp dụng toàn bộ, chỉ bổ sung vào phần hiện có hoặc giữ nguyên từng mục trước khi lưu.
4. **Given** một dự án đã hoàn thiện bộ quy tắc dịch thuật, **When** người dùng chọn xuất cẩm nang dịch thuật, **Then** hệ thống tạo ra tệp Markdown có cấu trúc rõ ràng chứa thể loại, tông giọng và toàn bộ quy tắc dịch hiện hành để có thể nhập lại cho dự án khác.

---

### User Story 4 - Kiểm tra mâu thuẫn cấu hình & áp dụng nhất quán theo thứ tự ưu tiên (Priority: P2)

Khi người dùng phối hợp Thể loại chính, Tông giọng biên tập và Quy tắc dịch, hệ thống chủ động phát hiện các mâu thuẫn rõ rệt (ví dụ chọn thể loại Đô Thị hiện đại nhưng lại chọn tông giọng Trang nghiêm cổ phong, hoặc chọn tông Trang nghiêm cổ phong nhưng trong quy tắc dịch lại ghi cấm dùng từ Hán-Việt) và hiển thị cảnh báo nhẹ không chặn thao tác lưu kèm gợi ý điều chỉnh nhanh. Trong toàn bộ chuỗi xử lý bản dịch (dịch thô, chuốt văn nhiều lượt, kiểm duyệt chất lượng và sửa cục bộ), mọi chỉ dẫn được tổng hợp theo thứ tự ưu tiên rõ ràng: **Quy tắc dịch riêng của dự án > Tông giọng biên tập > Chỉ dẫn Thể loại chính**, đồng thời tuyệt đối giữ nguyên cấu trúc đoạn và dòng của nguyên tác.

**Why this priority**: Khi cho phép kết hợp linh hoạt thể loại, tông giọng và quy tắc tự do, người dùng rất dễ vô tình tạo ra chỉ dẫn trái ngược nhau làm AI lúng túng và cho ra bản dịch thiếu ổn định. Thiết lập cảnh báo sớm và thứ tự ưu tiên phân minh đảm bảo mọi thành phần bổ trợ cho nhau thay vì triệt tiêu nhau.

**Independent Test**: Có thể kiểm thử độc lập bằng cách tạo một cấu hình cố tình mâu thuẫn (chọn cặp thể loại/tông giọng xung đột hoặc viết quy tắc riêng ngược với mặc định của thể loại), quan sát cảnh báo và nút gợi ý sửa trên giao diện, sau đó giữ nguyên để dịch thử một đoạn văn bản nhằm xác nhận quy tắc riêng thắng thế mặc định thể loại.

**Acceptance Scenarios**:

1. **Given** người dùng chọn Thể loại chính là Đô Thị và Tông giọng biên tập là Trang nghiêm cổ phong (hoặc nhập quy tắc cấm Hán-Việt đi kèm tông Cổ phong), **When** cấu hình thay đổi trên giao diện, **Then** hệ thống hiển thị cảnh báo mâu thuẫn văn phong không gây gián đoạn kèm lý do cụ thể và một gợi ý điều chỉnh phù hợp, nhưng vẫn cho phép người dùng lưu nếu đây là chủ ý sáng tạo riêng.
2. **Given** bộ chỉ dẫn mặc định của thể loại quy định một cách xưng hô chung (ví dụ "ta - ngươi" trong Tiên Hiệp), nhưng Quy tắc dịch riêng của dự án quy định ngoại lệ rõ ràng (ví dụ nhân vật chính luôn xưng "tôi" ở góc nhìn thứ nhất), **When** chạy dịch thô, chuốt văn và kiểm duyệt chất lượng, **Then** cả ba bước đều ưu tiên áp dụng quy tắc riêng của dự án mà không tự ý sửa ngược lại theo mặc định thể loại.
3. **Given** dự án áp dụng đầy đủ bộ chỉ dẫn thể loại, tông giọng và quy tắc dịch chi tiết, **When** dịch và chuốt văn một chương truyện có nhiều đoạn thoại và xuống dòng đặc biệt, **Then** chất lượng văn phong thay đổi rõ rệt đúng định hướng nhưng số lượng đoạn và ranh giới dòng so với nguyên tác vẫn được bảo toàn tuyệt đối.

---

### Edge Cases

- **Dự án cũ trước bản nâng cấp**: Dự án lưu trữ trước đây chỉ có tên thể loại cũ, tên tông giọng cũ hoặc đoạn văn bản tự do ngắn trong phần giới thiệu không được lỗi khi mở, vẫn hiển thị nguyên vẹn giá trị cũ và tự động kế thừa chỉ dẫn mới nếu khớp tên.
- **Tệp cẩm nang quá dài hoặc chứa bảng từ vựng lớn**: Khi tệp cẩm nang vượt quá 15.000–30.000 ký tự do chứa hàng trăm dòng thuật ngữ xen kẽ quy tắc dịch, hệ thống phải ưu tiên bảo toàn phần quy tắc/hướng dẫn thay vì bị phần bảng từ vựng đẩy trôi mất quy tắc, và thông báo rõ nếu vẫn còn phần nội dung vượt giới hạn xử lý.
- **Tệp cẩm nang rỗng, sai định dạng hoặc không có tiêu đề rõ ràng**: Hệ thống thông báo lỗi rõ ràng, thân thiện bằng tiếng Việt và không làm mất hay ghi đè dữ liệu hiện tại của dự án.
- **Thể loại hoặc tông giọng tùy chỉnh không hợp lệ**: Nhập chuỗi chỉ gồm khoảng trắng hoặc ký tự trống khi chọn tùy biến phải được nhắc bổ sung hoặc quay về giá trị hợp lệ mặc định; không lưu giá trị rỗng.
- **Thay đổi quy tắc dịch giữa chừng khi truyện đã dịch nhiều chương**: Cập nhật thể loại, tông giọng hoặc quy tắc dịch chỉ áp dụng cho các chương dịch mới, dịch lại, chuốt văn hoặc kiểm duyệt về sau, không tự ý làm hỏng hay ghi đè các chương đã hoàn thành trước đó.
- **Phân tích tự động không khả dụng hoặc ngoại tuyến khi tải tệp cẩm nang**: Hệ thống vẫn trích xuất được các phần cấu trúc cơ bản và bảng từ điển chuẩn từ tệp Markdown để người dùng tiếp tục chỉnh sửa thủ công, kèm thông báo trạng thái rõ ràng.
- **Xung đột nhiều quy tắc cùng lúc**: Khi vừa có xung đột thể loại–tông giọng vừa có xung đột tông giọng–quy tắc riêng, các cảnh báo được gom gọn dễ đọc và thứ tự ưu tiên phân xử vẫn giữ tính tất định.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI cung cấp một danh mục Thể loại chính thống nhất và mở rộng trên cả màn hình tạo dự án mới và màn hình chỉnh sửa dự án, bao gồm các thể loại tiểu thuyết mạng phổ biến và khả năng nhập Thể loại tùy chỉnh.
- **FR-002**: Mỗi Thể loại chính có sẵn PHẢI đi kèm một bộ chỉ dẫn dịch thuật chuyên sâu (bao gồm định hướng từ vựng, hệ thống xưng hô, nhịp văn, đặc trưng hội thoại/tự sự và lỗi thường gặp cần tránh), thay thế cho mô tả đơn dòng chung chung.
- **FR-003**: Hệ thống PHẢI cung cấp một danh mục Tông giọng biên tập thống nhất và mở rộng trên cả màn hình tạo dự án mới và màn hình chỉnh sửa dự án, kèm mô tả ngắn dễ hiểu và khả năng nhập Tông giọng tùy chỉnh.
- **FR-004**: Mỗi Tông giọng biên tập có sẵn PHẢI được gắn bộ quy chuẩn diễn đạt hành vi cụ thể (về mức độ dùng từ Hán-Việt so với thuần Việt, nhịp điệu câu, giọng tự sự và cách xử lý hội thoại) để các bước dịch và biên tập thực thi nhất quán.
- **FR-005**: Khi người dùng chọn một Thể loại chính, hệ thống PHẢI gợi ý các Tông giọng biên tập tương thích nhất với thể loại đó mà không khóa hay cản trở người dùng chọn tông giọng khác.
- **FR-006**: Trình soạn thảo Quy tắc dịch & Cẩm nang dịch thuật PHẢI hỗ trợ cấu trúc rõ ràng theo các nhóm quy chuẩn quan trọng (tóm tắt bối cảnh, quy ước xưng hô, chính sách Hán-Việt / thuần Việt, quy ước danh xưng / cấp bậc / tên phiên âm ngoại lai, và danh sách điều cần tránh) trong khi vẫn cho phép chỉnh sửa trực tiếp dạng văn bản thuần.
- **FR-007**: Người dùng PHẢI có thể chèn hoặc khởi tạo nhanh mẫu cẩm nang phù hợp với Thể loại chính đang chọn; nếu vùng quy tắc hiện tại đã có nội dung, hệ thống PHẢI yêu cầu xác nhận hoặc lựa chọn giữa thay thế và chèn bổ sung trước khi ghi đè.
- **FR-008**: Tính năng tải lên và phân tích tệp cẩm nang dịch thuật (`.md`) PHẢI khả dụng ở cả quy trình tạo dự án mới và quy trình chỉnh sửa thông tin dự án hiện có.
- **FR-009**: Khi phân tích tệp cẩm nang dịch thuật có dung lượng lớn, hệ thống PHẢI đọc và bảo toàn các phần quy tắc dịch nằm xuyên suốt tài liệu (không âm thầm cắt bỏ ở ngưỡng ký tự đầu quá ngắn) và PHẢI hiển thị cảnh báo rõ ràng nếu nội dung vượt quá giới hạn tối đa có thể xử lý.
- **FR-010**: Trước khi áp dụng kết quả phân tích từ tệp cẩm nang vào biểu mẫu dự án (đặc biệt khi dự án đã có dữ liệu), hệ thống PHẢI hiển thị màn hình/khung xem trước cho phép người dùng kiểm tra và lựa chọn giữ nguyên, hợp nhất hay ghi đè đối với Thể loại, Tông giọng, Quy tắc dịch và Từ điển thuật ngữ.
- **FR-011**: Người dùng PHẢI có thể xuất cấu hình cẩm nang hiện hành của dự án (bao gồm Thể loại, Tông giọng và toàn bộ Quy tắc dịch) ra tệp Markdown chuẩn hóa để lưu trữ hoặc tái sử dụng cho dự án khác.
- **FR-012**: Hệ thống PHẢI kiểm tra theo thời gian thực các cặp cấu hình mâu thuẫn rõ rệt giữa Thể loại chính, Tông giọng biên tập và Quy tắc dịch, hiển thị cảnh báo không chặn thao tác lưu kèm giải thích và gợi ý xử lý một chạm.
- **FR-013**: Toàn bộ các công đoạn trong quy trình dịch (dịch thô, chuốt văn một hoặc nhiều lượt, kiểm duyệt chất lượng và sửa cục bộ) PHẢI tiếp nhận đầy đủ chỉ dẫn Thể loại chính, quy chuẩn Tông giọng biên tập và Quy tắc dịch riêng của dự án theo thứ tự ưu tiên tất định: **Quy tắc dịch riêng của dự án > Tông giọng biên tập > Chỉ dẫn Thể loại chính**, đồng thời bảo toàn tuyệt đối cấu trúc đoạn và dòng của nguyên tác.
- **FR-014**: Hệ thống PHẢI đảm bảo tương thích ngược hoàn toàn với mọi dự án đã lưu trước đây: các giá trị thể loại cũ, tông giọng cũ và ghi chú tự do không cấu trúc vẫn được nạp, hiển thị và sử dụng trong quá trình dịch mà không gây mất dữ liệu hoặc bắt buộc người dùng chuyển đổi thủ công.

### Key Entities *(include if feature involves data)*

- **Hồ sơ Thể loại chính (Primary Genre Profile)**: Đại diện cho một dòng truyện chuẩn hóa, gồm tên thể loại, nhóm phân loại, mô tả hiển thị cho người dùng, bộ chỉ dẫn văn phong dịch thuật chuyên sâu, danh sách tông giọng khuyên dùng và mẫu cẩm nang khởi tạo tương ứng.
- **Hồ sơ Tông giọng biên tập (Editing Tone Profile)**: Đại diện cho một phong cách diễn đạt và biên tập, gồm tên tông giọng, mô tả tác động trực quan cho người dùng, và bộ quy chuẩn hành vi cụ thể về từ vựng, nhịp câu, lời thoại và văn phong tự sự.
- **Cẩm nang Dịch thuật & Quy tắc dịch (Project Translation Guidelines & Ruleset)**: Tập hợp hướng dẫn đặc thù của một bộ truyện, bao gồm tóm tắt bối cảnh và các quy tắc dịch có cấu trúc hoặc văn bản tự do (xưng hô, tỷ lệ Hán-Việt/thuần Việt, danh xưng/tên ngoại lai, điều cần tránh), hỗ trợ nhập từ và xuất ra tài liệu Markdown.
- **Cảnh báo Xung đột Văn phong (Style Conflict Warning)**: Kết quả kiểm tra tính nhất quán giữa thể loại, tông giọng và quy tắc dịch của dự án, gồm mức độ cảnh báo, mô tả điểm mâu thuẫn và đề xuất điều chỉnh tùy chọn.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% danh mục Thể loại chính và Tông giọng biên tập đồng nhất hoàn toàn giữa màn hình tạo dự án mới và màn hình chỉnh sửa dự án hiện có (không còn chênh lệch danh sách hoặc thiếu tùy chọn tùy chỉnh ở một trong hai nơi).
- **SC-002**: 100% các Thể loại chính và Tông giọng biên tập dựng sẵn đều sở hữu bộ chỉ dẫn hành vi chi tiết riêng biệt được truyền xuyên suốt cả bước dịch thô, chuốt văn và kiểm duyệt chất lượng.
- **SC-003**: Biên dịch viên có thể thiết lập hoàn chỉnh thể loại, tông giọng phù hợp và bộ quy tắc dịch có cấu trúc từ mẫu khởi tạo trong dưới 60 giây mà không cần tự nghĩ bố cục từ đầu.
- **SC-004**: Khi nhập một tệp cẩm nang dịch thuật dài 15.000 ký tự chứa các quy tắc dịch đặt ở cuối tài liệu, 100% các phần quy tắc trọng yếu đều được giữ lại trong bản xem trước và sau khi áp dụng (0 trường hợp bị cắt mất âm thầm).
- **SC-005**: Trong kiểm thử so sánh trên cùng đoạn nguyên tác giữa hai tông giọng hoặc hai cấu hình quy tắc đối lập (bao gồm trường hợp quy tắc dự án ghi đè mặc định thể loại), kết quả dịch phản ánh đúng quy tắc ưu tiên cao hơn trong 100% trường hợp kiểm thử có chủ đích và giữ nguyên 100% số đoạn so với nguyên tác.
- **SC-006**: 100% dự án cũ tạo trước khi phát hành nâng cấp mở lên, chỉnh sửa và dịch tiếp bình thường với đầy đủ dữ liệu thể loại, tông giọng và ghi chú hiện có mà không phát sinh lỗi hay mất dữ liệu.

## Assumptions

- Việc lưu trữ dữ liệu dự án tiếp tục tương thích với cấu trúc lưu trữ hiện có của ứng dụng; nếu bổ sung cấu trúc cho quy tắc dịch hoặc giá trị tùy chỉnh, mọi dự án cũ vẫn đọc ghi an toàn mà không đòi hỏi thao tác nâng cấp thủ công từ phía người dùng.
- Việc phân tích tệp cẩm nang Markdown khi nhập có thể tận dụng khả năng phân tích tự động khi trực tuyến/có khóa hợp lệ, và vẫn phải có cơ chế đọc cấu trúc Markdown cục bộ dự phòng để không làm gián đoạn hoàn toàn khi phân tích tự động không khả dụng.
- Cơ chế phát hiện mâu thuẫn tập trung vào các cặp xung đột văn phong rõ ràng, xác định được bằng quy tắc tất định (chẳng hạn bối cảnh hiện đại đi kèm văn phong cổ phong cung đình, hoặc tông cổ phong đi kèm lệnh cấm Hán-Việt), và luôn đóng vai trò cảnh báo tham khảo để giữ toàn quyền quyết định cho dịch giả.
- Bất biến bảo toàn cấu trúc đoạn/dòng 1-1 so với nguyên tác luôn đứng ở mức ưu tiên cao hơn mọi chỉ dẫn tu từ hay gom/tách câu của thể loại và tông giọng.
- Ngôn ngữ hiển thị giao diện, mẫu cẩm nang khởi tạo và cảnh báo trong phạm vi tính năng này là tiếng Việt phục vụ dịch giả truyện tiếng Trung sang tiếng Việt.
