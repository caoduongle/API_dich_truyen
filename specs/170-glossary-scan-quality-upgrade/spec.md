# Feature Specification: Cải Tiến Chất Lượng Quét Thuật Ngữ Cho Mô Hình Tốc Độ Cao

**Feature Branch**: `[170-glossary-scan-quality-upgrade]`

**Created**: 2026-11-27

**Status**: Draft

**Input**: User description: "tìm cách cải tiến quét dịch thuật để cải thiện chất lượng dịch; tôi dùng model gemini 3.5 flash lite mà nó lại thành như này khi tôi quét thuật ngữ (kèm bảng từ điển 592 mục thực tế từ truyện Phim Trường Đào Sinh)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Chuẩn hóa Phiên âm Hán-Việt, Bản dịch Việt và Ghi chú thuần Việt khi quét thuật ngữ (Priority: P1)

Khi người dịch chạy quét thuật ngữ bằng các mô hình AI nhẹ hoặc tốc độ cao, mọi mục được đưa vào từ điển chính phải có định dạng chuẩn mực tiếng Việt:
- Cột **Phiên âm (âm Hán-Việt)** tuyệt đối không được chứa Bính âm tiếng Phổ thông (có dấu thanh hoặc không dấu thanh như bính âm Latinh) hay giữ nguyên chữ Hán gốc; nếu phát hiện Bính âm hoặc chữ Hán lạc vào cột phiên âm, hệ thống phải nhận diện và xử lý trước khi lưu.
- Cột **Tiếng Việt** tuyệt đối không được giữ nguyên Bính âm của tên người thuần Trung Quốc; chỉ cho phép dùng tên tiếng Anh/phương Tây khi thuật ngữ thực sự là phiên âm ngoại quốc có đối chiếu hợp lệ.
- Cột **Ghi chú** phải viết bằng tiếng Việt thuần túy; hệ thống phải phát hiện các đoạn chữ Hán bị rò rỉ vào phần ghi chú (do mô hình nhẹ sao chép từ văn bản nguồn) và xử lý/đánh dấu để giữ sạch ngữ cảnh dịch ở các bước biên tập về sau.

**Why this priority**: Phiên âm Bính âm, tên tiếng Việt giữ Bính âm thô và ghi chú dính chữ Hán trực tiếp phá hỏng chất lượng bước dịch thô, chuốt văn phong và bộ kiểm tra sót chữ Hán vì đưa tín hiệu sai ngôn ngữ vào toàn bộ quy trình dịch.

**Independent Test**: Có thể kiểm thử độc lập bằng cách đưa đầu ra quét chứa đồng thời các lỗi điển hình (cột phiên âm chứa Bính âm có dấu thanh/không dấu hoặc chữ Hán nguyên bản, cột tiếng Việt giữ nguyên Bính âm, ghi chú lẫn chữ Hán) vào bộ hậu kiểm quét và xác nhận tất cả các mục sai chuẩn đều bị chặn khỏi từ điển chính hoặc chuyển kiểm duyệt với lý do tiếng Việt cụ thể.

**Acceptance Scenarios**:

1. **Given** một ứng viên thuật ngữ do quá trình quét trả về có cột phiên âm chứa Bính âm tiếng Phổ thông (có dấu thanh điệu hoặc viết liền không dấu kiểu bính âm) hoặc chứa ký tự chữ Hán, **When** hệ thống chạy bước hậu kiểm chuẩn hóa kết quả quét, **Then** mục đó không được đưa thẳng vào từ điển chính ở trạng thái lỗi mà được đánh dấu cần kiểm duyệt với lý do rõ ràng (hoặc tách lọc sạch trước khi lưu nếu có giá trị chuẩn hóa thay thế hợp lệ).
2. **Given** một ứng viên nhân vật chữ Hán thuần Trung Quốc có nghĩa tiếng Việt trùng khớp hoặc chỉ là phiên âm Bính âm Latinh thay vì Hán-Việt, **When** hệ thống đánh giá độ tin cậy của ứng viên, **Then** ứng viên bị chặn không tự động ghi nhận làm tên chính thức và được chuyển sang hàng chờ kiểm duyệt kèm cảnh báo nghi ngờ sai định dạng tên.
3. **Given** một ứng viên thuật ngữ có cột ghi chú ngữ cảnh chứa chữ Hán xen kẽ tiếng Việt, **When** hệ thống kiểm tra và làm sạch trước khi lưu, **Then** hệ thống không cho phép ghi chú chứa ký tự Hán chưa dịch lọt nguyên trạng vào từ điển chính dùng cho bước dịch và biên tập.

---

### User Story 2 - Chặn từ phổ thông, câu thoại, mã ngắn và mảnh tên bị cắt cụt làm hỏng chất lượng dịch (Priority: P1)

Trong kết quả quét thực tế từ các mô hình tốc độ cao, từ điển dễ bị nhiễm ba nhóm mục gây hại nặng khi áp dụng dịch tự động:
1. **Từ phổ thông, danh từ sinh hoạt, cụm câu nói hoặc mã ngắn vô nghĩa**: ví dụ từ chỉ đồ vật/địa điểm thông thường (như từ tương đương "máy tính", "phố đi bộ", "nặc danh"), cụm câu hoàn chỉnh/câu bình luận, hoặc mã ký tự ngắn không phải tên riêng (như ký hiệu phân khu 2 ký tự Latinh-số), và từ đơn 1 chữ Hán quá rủi ro. Khi các từ này lọt vào từ điển chính, hệ thống sẽ ép thay thế cứng cả những câu miêu tả bình thường thành tên riêng sai ngữ cảnh.
2. **Mảnh cắt cụt hoặc biến thể dư thừa của mục đã tồn tại**: ví dụ cùng một nhân vật/địa danh đã có tên đầy đủ 3–4 chữ, nhưng lượt quét sau lại trích xuất thêm phần tên cắt 2 chữ (không phải biệt danh mới mà chỉ là mảnh tiền tố/hậu tố của tên gốc), hoặc trích xuất lặp lại kèm chức danh ("Bác sĩ X" vs "X", "Thuyền trưởng Y" vs "Y", phần mở rộng có/không có hậu tố chỉ loại) gây phân mảnh và xung đột trong từ điển.
3. **Thành ngữ phổ thông hoặc khái niệm chung** bị phân loại nhầm vào mục tên riêng/vật phẩm bắt buộc giữ nguyên.

Hệ thống phải có bộ lọc phân loại thông minh để chặn hoặc đẩy vào hàng chờ kiểm duyệt các ứng viên thuộc các nhóm trên trước khi điền vào từ điển chính.

**Why this priority**: Một mục từ điển rác kiểu "máy tính", "phố đi bộ", 1 chữ Hán rời rạc hoặc mảnh tên cắt cụt sẽ gây sai sót lan truyền trên hàng trăm chương truyện và tạo hàng loạt xung đột giả ở bước kiểm duyệt.

**Independent Test**: Có thể kiểm thử độc lập trên tập đầu ra quét hỗn hợp gồm tên nhân vật hợp lệ, một danh từ phổ thông sinh hoạt, một câu hoàn chỉnh 4+ chữ mang nghĩa động từ-tân ngữ, một mã ngắn 2 ký tự Latinh-số, một thực thể 1 chữ Hán, và một mảnh cắt trùng với mục đã có sẵn trong từ điển; xác nhận các mục hợp lệ được thêm sạch, rác rõ rệt bị loại bỏ, và các trường hợp ranh giới mơ hồ được chuyển sang hàng chờ kiểm duyệt.

**Acceptance Scenarios**:

1. **Given** đầu ra quét chứa cụm câu thoại/câu bình luận thông thường, mã ký hiệu Latinh-số quá ngắn không phải tên riêng hoặc mục có chuỗi ký tự Hán chứa dấu câu thừa, **When** bộ lọc chất lượng đánh giá ứng viên, **Then** các mục nhiễu rõ rệt này bị loại bỏ khỏi cả từ điển chính lẫn bản gợi ý hoàn thiện, không tạo rác tích lũy.
2. **Given** từ điển đã có tên đầy đủ của một nhân vật/địa danh/kịch bản (ví dụ 3–4 chữ Hán) và lượt quét mới đề xuất một cụm ngắn hơn nằm lọt bên trong cụm đã có (hoặc chỉ khác phần danh xưng/hậu tố chỉ loại) mà không xuất hiện độc lập rõ ràng trong đoạn văn, **When** hệ thống đối chiếu với văn cảnh và từ điển hiện có, **Then** mục trùng lặp cắt cụt đó không được tự động thêm thành mục riêng trong từ điển chính, mà được chặn hoặc chuyển vào hàng chờ kiểm duyệt kèm liên kết tới mục đầy đủ hiện có.
3. **Given** một ứng viên chỉ gồm 1 chữ Hán duy nhất hoặc là danh từ phổ thông ngắn có nguy cơ cao là từ dùng thường nhật (không phải nhân vật xuất hiện lặp lại kèm vai trò rõ ràng), **When** hệ thống xét duyệt đầu ra quét, **Then** mục đó không được tự động kích hoạt vào từ điển chính mà được chuyển sang hàng chờ kiểm duyệt để người dịch quyết định thủ công.

---

### User Story 3 - Truyền ngữ cảnh từ điển hiện có và phong cách truyện ngay từ Vòng 1 khi quét (Priority: P2)

Khi người dịch bắt đầu quét thuật ngữ ở **Vòng 1** (không chỉ từ Vòng 2 trở đi) hoặc quét tiếp nối vào bộ từ điển đã có sẵn mục từ các chương/tệp trước, quá trình quét phải nhận được:
1. Thông tin bối cảnh truyện hiện hành (thể loại truyện, tông giọng và nguyên tắc xưng hô/quy ước tên ngoại lai trong cẩm nang nếu có).
2. Ngữ cảnh các thuật ngữ đã tồn tại liên quan trực tiếp đến chương đang quét kèm **bản dịch tiếng Việt chuẩn đã chốt**, giúp mô hình tốc độ cao giữ nhất quán cách gọi nhân vật/địa danh xuyên suốt các chương và không trích xuất lại những thực thể đã có dưới dạng mảnh cắt hoặc tên biến thể khác nghĩa.
3. Quy tắc trích xuất rõ ràng ngay trong chỉ dẫn quét: phân biệt tên thuần Trung Quốc (bắt buộc Hán-Việt cả ở cột phiên âm lẫn tiếng Việt, cấm điền Bính âm) với tên phiên âm phương Tây; cấm trích xuất danh từ phổ thông, câu văn, mã kỹ thuật hoặc thành ngữ đại chúng; và viết ghi chú hoàn toàn bằng tiếng Việt không kèm chữ Hán.

**Why this priority**: Các mô hình AI nhẹ thường cho chất lượng kém chủ yếu vì thiếu neo ngữ cảnh ở Vòng 1 và hướng dẫn tách chưa siết chặt quy tắc Bính âm/từ phổ thông. Khi có neo ngữ cảnh đầy đủ ngay từ đầu, chất lượng trích xuất tăng mạnh mà không cần đổi sang mô hình đắt hơn.

**Independent Test**: Có thể kiểm thử độc lập bằng cách chạy quét ở Vòng 1 trên một chương truyện thuộc dự án đã có sẵn thể loại, cẩm nang xưng hô và vài thuật ngữ nền; xác nhận yêu cầu gửi tới mô hình ở ngay Vòng 1 đã mang đủ neo thể loại, tông giọng, danh sách thuật ngữ đã biết liên quan đến chương (kèm nghĩa Việt quy ước) và bộ quy tắc chống Bính âm/từ phổ thông.

**Acceptance Scenarios**:

1. **Given** một dự án đã có thông tin thể loại, tông giọng, cẩm nang hướng dẫn và một số thuật ngữ từ điển nền, **When** người dùng kích hoạt quét thuật ngữ tại Vòng 1 trên một chương mới, **Then** ngữ cảnh gửi cho quá trình phân tích ngay tại Vòng 1 đã bao gồm bối cảnh thể loại/tông giọng và các thuật ngữ đã có xuất hiện trong chương (kèm nghĩa Việt quy ước) để giữ đồng bộ tên gọi.
2. **Given** văn bản chương chứa xen kẽ tên người thuần Trung Quốc, tên phiên âm phương Tây và các đồ vật sinh hoạt thường ngày, **When** xây dựng chỉ dẫn trích xuất thuật ngữ, **Then** chỉ dẫn quy định tường minh cấm Bính âm tiếng Phổ thông ở cột phiên âm Hán-Việt, cấm để sót chữ Hán trong ghi chú, và cấm trích xuất từ thông thường hay mảnh cắt trùng lặp.

---

### User Story 4 - Cổng hậu kiểm độ tin cậy & Tóm tắt minh bạch sau khi quét (Priority: P2)

Sau mỗi lần phân tích chương hoặc khi kết thúc tiến trình quét thuật ngữ sỉ, mọi kết quả thô do AI trả về phải đi qua một **cổng hậu kiểm độ tin cậy tất định** chia ứng viên thành đúng 3 luồng xử lý:
1. **Đạt chuẩn (High Confidence)**: Đầy đủ chữ Hán gốc khớp văn bản, phiên âm Hán-Việt hợp lệ, bản dịch tiếng Việt đúng quy ước, ghi chú sạch chữ Hán, không phải từ phổ thông nhiễu và không chồng lấn mảnh cắt → tự động thêm vào từ điển chính (và làm giàu giới tính nhân vật nếu ngữ cảnh rõ ràng).
2. **Nghi ngờ / Cần duyệt (Borderline / Low Confidence)**: Từ đơn 1 chữ Hán, nghi ngờ dính Bính âm hoặc ký tự Hán trong phiên âm/ghi chú, hoặc nghi ngờ là mảnh cắt/trùng một phần với mục đã tồn tại → tự động đưa vào hàng chờ kiểm duyệt kèm lý do tiếng Việt cụ thể để người dịch duyệt 1 chạm.
3. **Rác rõ rệt (Noise / Invalid)**: Đại từ nhân xưng, hư từ, câu thoại dài bất thường, mã ngắn không mang chữ Hán hoặc thực thể rỗng → loại bỏ trực tiếp, không làm bẩn từ điển hay hàng chờ.

Cuối phiên quét, nhật ký tiến trình hiển thị bảng tóm tắt rõ ràng số lượng theo 3 nhóm (đã thêm sạch, đã chuyển chờ duyệt do thiếu tin cậy, và đã lọc bỏ nhiễu) để người dùng nắm ngay hiệu quả lọc sạch.

**Why this priority**: Người dùng cần niềm tin và khả năng kiểm soát khi chạy quét tự động trên truyện dài hàng trăm chương bằng mô hình tốc độ cao — vừa giảm gánh nặng dọn rác thủ công, vừa không âm thầm mất các tên nhân vật thật sự nằm ở ngưỡng nhạy cảm.

**Independent Test**: Có thể kiểm thử độc lập bằng cách chạy một kịch bản quét gồm đủ 3 loại ứng viên (đạt chuẩn, nghi ngờ dính Bính âm/từ đơn, và rác đại từ/mã ngắn); xác nhận đúng ứng viên đạt chuẩn vào từ điển chính, ứng viên nghi ngờ vào hàng chờ với lý do chi tiết, rác bị loại bỏ, và nhật ký kết thúc ghi chính xác cả 3 bộ đếm.

**Acceptance Scenarios**:

1. **Given** kết quả trích xuất của một chương gồm 3 từ đạt chuẩn, 2 từ nghi ngờ (1 từ dính Bính âm ở phiên âm và 1 nhân vật 1 chữ Hán) và 2 mục rác (đại từ phổ thông và mã 2 ký tự Latinh), **When** quy trình quét chạy qua cổng hậu kiểm, **Then** đúng 3 từ đạt chuẩn được thêm vào từ điển chính, đúng 2 từ nghi ngờ được đưa vào hàng chờ kiểm duyệt kèm lý do tiếng Việt cụ thể, và 2 mục rác bị loại bỏ hoàn toàn.
2. **Given** một phiên quét thuật ngữ sỉ nhiều chương kết thúc (hoàn tất hoặc tạm dừng), **When** hệ thống ghi tổng kết cuối phiên trong nhật ký quét, **Then** bản tóm tắt hiển thị rõ số mục mới thêm vào từ điển, số mục chuyển vào hàng chờ cần kiểm duyệt và số mục nhiễu đã được lọc bỏ tự động.

---

### Edge Cases

- **Nghệ danh có nguồn gốc từ danh từ thường**: Một số truyện (như truyện sinh tồn/phim trường) dùng nghệ danh nhân vật trùng từ thông thường gồm 2–3 chữ Hán (ví dụ tên món ăn, con vật hoặc nghề nghiệp). Hệ thống không được xóa mù quáng mọi danh từ 2–3 chữ có ngữ cảnh nhân vật rõ ràng; chỉ loại từ phổ thông/hư từ/cụm câu vô nghĩa rõ rệt, còn các danh từ phổ thông khả nghi nhưng được phân loại nhân vật với tần suất/ngữ cảnh hội thoại rõ thì chuyển vào hàng chờ kiểm duyệt thay vì vứt bỏ hoặc tự động ép vào từ điển chính.
- **Tên viết bằng chữ cái Latinh kết hợp chữ Hán** (ví dụ mã nhân vật hoặc tên tổ chức đặc thù): Không được chặn nhầm tên riêng phương Tây dài hợp lệ hay tên công trình đặc biệt có từ 2 chữ Hán trở lên, nhưng phải chặn các mã ngắn không có chữ Hán kiểu 1 chữ cái + 1–2 chữ số đứng rời.
- **Tên đầy đủ và tên gọi tắt cùng tồn tại thực sự trong truyện**: Nếu truyện dùng cả tên đầy đủ 3 chữ lẫn cách gọi thân mật 2 chữ (ví dụ tên riêng 2 chữ cuối khi xưng hô) ở các đoạn hội thoại độc lập hoàn toàn ngoài tên đầy đủ, hệ thống giữ quyền cho người dùng duyệt từ hàng chờ thay vì xóa vĩnh viễn.
- **Tài liệu quét có ghi chú tiếng Việt dùng dấu ngoặc đơn hoặc trích dẫn**: Các ký tự Hán nằm trong ghi chú phải bị phát hiện và làm sạch/cảnh báo ngay cả khi nằm trong dấu ngoặc kép hoặc ngoặc đơn, trừ khi không còn sót ký tự Hán nào sau khi làm sạch hợp lệ.
- **Dự án đã có sẵn hàng trăm thuật ngữ từ lần quét trước**: Việc lấy ngữ cảnh neo cho Vòng 1 và các vòng sau phải ưu tiên đúng các thuật ngữ có xuất hiện trong chương hiện tại để vừa giữ nhất quán bản dịch Việt vừa không vượt giới hạn ngữ cảnh.
- **Tương thích với bộ từ điển đã tồn tại (kể cả dữ liệu cũ có sẵn từ điển 500+ mục)**: Việc quét nâng cấp và cổng hậu kiểm chỉ áp dụng kiểm soát chất lượng cho ứng viên mới/hậu kiểm kết quả quét mới và bổ sung khả năng phát hiện vấn đề mà không tự ý xóa dữ liệu từ điển người dùng đã lưu từ trước.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI mở rộng chỉ dẫn và ngữ cảnh gửi đi trong tác vụ phân tích/quét thuật ngữ để truyền bối cảnh dự án (thể loại, tông giọng, nguyên tắc dịch từ cẩm nang) cùng danh sách thuật ngữ đã biết liên quan đến chương (kèm bản dịch tiếng Việt quy ước hiện có) **ngay từ Vòng quét đầu tiên (Vòng 1)** cũng như các vòng quét sâu tiếp theo.
- **FR-002**: Chỉ dẫn trích xuất thuật ngữ PHẢI nêu rõ và nhấn mạnh các ràng buộc chất lượng đầu ra: (a) cột phiên âm là âm Hán-Việt chuẩn tiếng Việt, tuyệt đối KHÔNG dùng Bính âm tiếng Phổ thông hay chữ Hán; (b) tên thuần Trung Quốc dùng Hán-Việt trong cột tiếng Việt, chỉ khôi phục tiếng Anh cho từ phiên âm phương Tây; (c) ghi chú viết hoàn toàn bằng tiếng Việt, KHÔNG chứa chữ Hán; (d) không trích xuất danh từ phổ thông sinh hoạt, câu hoàn chỉnh, mã ngắn không phải tên riêng, hay mảnh cắt trùng lặp của thuật ngữ đã có.
- **FR-003**: Hệ thống PHẢI triển khai bộ phát hiện Bính âm tiếng Phổ thông và ký tự Hán lạc chỗ trên kết quả quét: phát hiện các chuỗi mang dấu thanh điệu Bính âm (như `ā á ǎ à ē é ě è ī í ǐ ì ō ó ǒ ò ū ú ǔ ù ǖ ǘ ǚ ǜ`), chuỗi bính âm đặc trưng không dấu (như `zh/ch/sh/q/x/z` ghép âm đặc thù tiếng Hoa không thuộc tiếng Việt) hoặc ký tự chữ Hán xuất hiện trong cột phiên âm hoặc cột ghi chú tiếng Việt.
- **FR-004**: Khi phát hiện cột phiên âm chứa chữ Hán hoặc Bính âm, hoặc cột tiếng Việt của một thực thể chữ Hán bị điền bằng chuỗi Bính âm tiếng Phổ thông (chứ không phải Hán-Việt hay tên ngoại lai hợp lệ), cổng hậu kiểm PHẢI chặn ứng viên đó không cho tự động điền vào từ điển chính và định tuyến sang hàng chờ kiểm duyệt kèm lý do tiếng Việt cụ thể.
- **FR-005**: Khi cột ghi chú của một ứng viên quét chứa ký tự chữ Hán rò rỉ, hệ thống PHẢI tự động làm sạch phần ký tự Hán dư thừa nếu nội dung tiếng Việt còn lại vẫn có nghĩa rõ ràng hoặc chuyển ứng viên sang hàng chờ kiểm duyệt nếu ghi chú chỉ là chữ Hán/thiếu nghĩa rõ.
- **FR-006**: Hệ thống PHẢI mở rộng bộ lọc nhiễu đầu vào quét để loại bỏ trực tiếp các mục rác rõ rệt: từ/cụm phổ thông quá thông dụng thiếu giá trị tên riêng (danh từ đồ vật sinh hoạt, nơi chốn đại chúng, đại từ, hư từ, câu bình luận/lệnh hành động có độ dài cấu trúc câu thông thường), mã ký hiệu Latinh-số quá ngắn không chứa chữ Hán, và mục có cụm chữ Hán kèm dấu câu không hợp lệ.
- **FR-007**: Hệ thống PHẢI kiểm tra chồng lấn mảnh cắt (sub-term / composite overlap) giữa ứng viên mới với các thuật ngữ đã tồn tại trong từ điển chính hoặc vừa trích xuất trong cùng lượt: nếu cụm chữ Hán của ứng viên mới là một phần nằm trong thuật ngữ dài hơn đã có trong từ điển (hoặc ngược lại chứa thêm danh xưng/hậu tố chỉ loại của mục đã có) mà cụm ngắn hơn không có bằng chứng xuất hiện độc lập rõ ràng ngoài cụm dài trong văn bản chương, hệ thống PHẢI chặn không thêm trùng vào từ điển chính và chuyển kiểm duyệt (hoặc hợp nhất) với lý do chỉ rõ mục gốc liên quan.
- **FR-008**: Hệ thống PHẢI định tuyến các thực thể đơn âm tiết (đúng 1 ký tự Hán) sang hàng chờ kiểm duyệt thay vì tự động thêm vào từ điển chính, tránh việc thay thế cứng 1 ký tự làm hỏng hàng loạt từ ghép thông thường khi dịch.
- **FR-009**: Mọi ứng viên do quá trình quét đề xuất PHẢI đi qua một hàm đánh giá hậu kiểm hợp nhất duy nhất trước khi phân bổ vào từ điển chính hay hàng chờ kiểm duyệt, áp dụng đồng nhất cho cả luồng quét sỉ nhiều chương lẫn trích xuất đơn lẻ.
- **FR-010**: Bộ chỉ số Sức khỏe Từ điển hiện có (hoặc kiểm tra chất lượng từ điển) PHẢI nhận diện thêm trạng thái cảnh báo đối với các mục đang tồn tại trong từ điển có cột phiên âm nghi ngờ Bính âm/chữ Hán hoặc ghi chú còn lẫn chữ Hán, giúp người dịch dễ dàng phát hiện và xử lý các mục lỗi cũ đã lưu trước đó.
- **FR-011**: Sau khi kết thúc phiên quét thuật ngữ sỉ, nhật ký quét PHẢI hiển thị bản tóm tắt định lượng gồm ít nhất 3 số liệu: số mục đạt chuẩn đã thêm vào từ điển chính, số mục nghi ngờ/chồng lấn đã chuyển sang hàng chờ kiểm duyệt, và số mục rác/nhiễu đã được lọc bỏ.
- **FR-012**: Toàn bộ cải tiến chất lượng quét và cổng hậu kiểm PHẢI tương thích ngược hoàn toàn với cấu trúc dữ liệu từ điển và dự án hiện tại, không làm thay đổi cấu trúc lưu trữ cốt lõi hay tự ý xóa dữ liệu từ điển người dùng đã lưu từ trước.
- **FR-013**: Hệ thống PHẢI bảo đảm quá trình kiểm tra hậu kiểm không phát sinh thêm lời gọi API bên ngoài (chạy hoàn toàn tất định phía trình duyệt), tránh làm tăng tiêu thụ hạn mức RPM đối với các mô hình tốc độ cao.

### Key Entities

- **Ứng viên thuật ngữ quét (Scanned Term Candidate)**: Bản ghi thô do mô hình sinh ra trong một lượt phân tích chương, gồm cụm chữ Hán gốc, phiên âm đề xuất, nghĩa tiếng Việt đề xuất, phân loại, ghi chú ngữ cảnh và đoạn văn gốc đi kèm.
- **Kết quả hậu kiểm quét (Scan Quality Verdict)**: Phân loại quyết định cho từng ứng viên gồm 3 trạng thái: **Chấp nhận vào từ điển chính**, **Chuyển hàng chờ kiểm duyệt (kèm lý do cụ thể)**, hoặc **Loại bỏ nhiễu**.
- **Ngữ cảnh neo quét theo chương (Chapter Scan Anchor Context)**: Gói ngữ cảnh truyền cho lượt quét gồm thông tin thể loại/tông giọng/cẩm nang dự án và danh sách các thuật ngữ đã có xuất hiện trong chương kèm bản dịch tiếng Việt quy ước để đồng bộ tên gọi ngay từ Vòng 1.
- **Thống kê phiên quét (Scan Quality Telemetry)**: Bộ đếm cộng dồn cho một phiên quét nhiều chương gồm số lượng mục thêm sạch, số lượng mục chuyển duyệt và số lượng mục bị lọc nhiễu.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% ứng viên quét có cột phiên âm chứa dấu thanh điệu Bính âm tiếng Phổ thông hoặc ký tự Hán, hoặc cột ghi chú chứa chữ Hán chưa làm sạch bị chặn không điền nguyên trạng vào từ điển chính.
- **SC-002**: 100% ứng viên thuộc nhóm đại từ/hư từ/từ phổ thông trong danh sách lọc, mã ký hiệu Latinh-số ngắn không chứa chữ Hán và cụm câu có dấu câu thừa bị lọc bỏ ngay sau bước hậu kiểm mà không điền vào từ điển chính.
- **SC-003**: 100% mảnh tên cắt cụt chỉ xuất hiện lồng bên trong một thuật ngữ dài đã tồn tại trong từ điển và 100% ứng viên đơn âm tiết (1 ký tự Hán) không còn tự động lọt vào từ điển chính.
- **SC-004**: 100% các lượt quét từ Vòng 1 trở đi nhận đầy đủ bối cảnh thể loại/tông giọng dự án và danh sách thuật ngữ đã biết có mặt trong chương (kèm nghĩa Việt quy ước) trong giới hạn ngữ cảnh quy định.
- **SC-005**: Cổng hậu kiểm hoàn tất đánh giá trên một chương tiêu chuẩn trong thời gian dưới 10 mili-giây và phát sinh đúng **0** lời gọi mạng/AI bổ sung.
- **SC-006**: Trên tập kiểm thử tái hiện các lỗi từ mẫu từ điển thực tế 592 mục, tỷ lệ giữ sai định dạng (Bính âm, rò rỉ chữ Hán trong ghi chú, mã ngắn `A1/A2`, từ đơn 1 chữ và mảnh cắt lồng nhau) bị đẩy sang duyệt hoặc lọc sạch đạt ít nhất **95%**.
- **SC-007**: Người dịch nhìn thấy đầy đủ 3 chỉ số thống kê kết quả hậu kiểm (đã thêm sạch / chuyển chờ duyệt / đã lọc bỏ) ngay khi phiên quét kết thúc.

## Assumptions

- Giải pháp tiếp tục vận hành hoàn toàn ở phía trình duyệt và sử dụng chung hạ tầng quét/dịch hiện có; không thay thế mô hình AI của người dùng mà nâng cấp chất lượng đầu vào ngữ cảnh và cổng hậu kiểm tất định phía client.
- Người dùng vẫn có quyền xem và duyệt thủ công mọi mục được đưa vào hàng chờ kiểm duyệt, đồng thời các mục đã có sẵn trong từ điển từ trước sẽ không bị tự động xóa mất.
- Danh sách bộ từ điển 592 mục do người dùng cung cấp được dùng làm tập kiểm chứng thực tế đại diện cho các lỗi phổ biến của mô hình tốc độ cao (Bính âm, rò chữ Hán trong ghi chú, từ phổ thông, mảnh cắt tên, thuật ngữ 1 chữ và thiếu ngữ cảnh Vòng 1).
