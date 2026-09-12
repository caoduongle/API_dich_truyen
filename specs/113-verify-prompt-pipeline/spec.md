# Feature Specification: Toàn Diện Rà Soát & Đồng Bộ Luồng Prompt (Dịch, Biên Dịch, Kiểm Định, Lọc Thuật Ngữ)

**Feature Branch**: `113-verify-prompt-pipeline`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "rà soát lại toàn bộ dự án; kiểm tra tất cả các chỗ có prompt hoặc chỗ điền prompt xem nó có hoạt động không; từ dịch đến biên dịch và kiểm định cùng với lọc thuật ngữ"

## Clarifications

### Session 2026-09-12
- Q: Bảo toàn từ điển khi văn bản đã được thế sẵn (`glossary: []`) có nghĩa là nhồi toàn bộ từ điển dự án vào mọi prompt hay không? → A: **KHÔNG.** Việc bảo toàn glossary ở cấp độ service/hook là để cung cấp kho từ điển tham chiếu cho các bộ lọc thông minh:
  1. **Phase 1 (Dịch thô)**: Nhận từ điển dự án để đính kèm bảng tra cứu đại từ, vai trò nhân vật và thực thể (giúp AI nhận biết giới tính, bối cảnh để xưng hô chuẩn xác thay vì thấy `[Tên_Việt]` mà không biết xưng hô thế nào).
  2. **Phase 2 (Chuốt văn phong)**: **TUYỆT ĐỐI KHÔNG nhồi toàn bộ từ điển vào prompt.** Hệ thống có bộ quét so khớp (`matchedTermsList`) chỉ trích xuất các thuật ngữ **thực sự xuất hiện** trong đoạn văn/chương đang dịch để đưa vào khối `[TỪ ĐIỂN RIÊNG ĐÃ XUẤT HIỆN TRONG ĐOẠN NÀY]`. Lỗi gán `glossary: []` trước đây đã tước mất kho dữ liệu của bộ lọc, khiến cho ngay cả các thuật ngữ có mặt trong đoạn cũng không thể hiển thị.
  3. **Phase 3 (QA Critique)**: Bảng từ điển tham chiếu được giới hạn (tối đa 150 mục) nhằm đối chiếu kiểm tra chéo lỗi dịch sai thuật ngữ (`terminology`) mà không gây tràn token.
- Q: Kiểm duyệt chất lượng (Quality Assurance / QA Critique) hoạt động như thế nào trong hệ thống? → A: Hệ thống vận hành mô hình kiểm duyệt 2 tầng (Two-Tier Audit Pipeline):
  1. **Tầng 1 - Luật Heuristic Hako cục bộ (Offline)**: Quét tức thì không tốn API token dựa trên luật biên tập Hako (sót Hán tự raw leak, lặp đoạn văn, lỗi đóng mở ngoặc kép, v.v.), có khả năng tự động sửa (autoFixable).
  2. **Tầng 2 - AI QA Critique chuyên sâu (Online Gemini)**: AI đóng vai chuyên gia thẩm định đối chiếu song song giữa bản gốc tiếng Trung và bản dịch tiếng Việt dựa trên bối cảnh Thể loại (`genre`), Tông giọng (`tone`), Cẩm nang dịch (`description`) và Bảng từ điển (`glossary`) để phát hiện 4 loại lỗi: Bỏ sót (`omission`), Thêm thắt (`addition`), Lặp lại (`repetition`), và Sai thuật ngữ (`terminology`).
  3. **Tích hợp & Khắc phục**: Chạy tự động trong hàng đợi dịch (lưu vào `Chapter.qaIssues` trong IndexedDB) hoặc thủ công trong Workspace; cung cấp tính năng "Viết lại câu" (`rewriteSentenceDirect`) kết hợp đúng thể loại/tông giọng để sửa lỗi ngay tại chỗ trên `UnifiedAuditPanel`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Truyền dẫn toàn diện thông tin cấu hình truyện vào Giai đoạn Dịch thô và Biên tập (Priority: P1)

Khi người dịch cấu hình các thông số văn học của tiểu thuyết trong bảng Cấu hình & Chỉnh sửa thông tin Truyện—bao gồm **Thể loại chính** (12 thể loại: Tiên Hiệp, Võ Hiệp, Ngôn Tình, Đô Thị, Huyền Huyễn, Huyền Huyễn Phương Tây, Vô Hạn Lưu, Lịch Sử / Quân Sự, Khoa Huyễn / Võng Du, Linh Dị / Thần Quái, Hệ Thống / Điền Văn, Khác), **Tông giọng biên dịch & biên tập** (8 tông giọng), và **Giới thiệu tóm tắt / Quy tắc dịch** (các nguyên tắc xưng hô, giọng điệu đặc thù của tác phẩm)—hệ thống phải truyền tải chính xác, đầy đủ và có sức nặng chỉ thị (system instruction directive) đến các payload AI ở cả Giai đoạn 1 (Dịch thô) và Giai đoạn 2 (Chuốt văn phong / Biên dịch), không để thất thoát hoặc xem nhẹ bất kỳ quy tắc nào.

**Why this priority**: Cấu hình truyện là linh hồn định hình chất lượng bản dịch. Nếu người dùng dày công thiết lập phong cách truyện và quy tắc dịch thuật nhưng AI không nhận được hoặc chỉ nhận một phần mờ nhạt, bản dịch sẽ bị biến dạng về tông giọng và sai lệch xưng hô cốt lõi.

**Independent Test**: Cấu hình thể loại "Linh Dị / Thần Quái", tông giọng "Kịch tính ly kỳ", và quy tắc dịch "Xưng hô ngôi thứ nhất là ta, không khí u ám ma mị". Chạy thử một đoạn văn bản tiếng Trung, kiểm tra xem nội dung prompt và system instruction được tạo ra có chứa đầy đủ các chỉ thị này và kết quả tiếng Việt phản ánh đúng phong cách u ám, kịch tính.

**Acceptance Scenarios**:

1. **Given** người dùng thiết lập Thể loại "Linh Dị / Thần Quái" và Tông giọng "Kịch tính ly kỳ", **When** hệ thống tạo payload Dịch thô (Phase 1) hoặc Chuốt văn phong (Phase 2), **Then** chỉ đạo văn phong thể loại tương ứng từ bộ quy chuẩn văn học và tông giọng đã chọn phải hiện diện rõ ràng trong cả `systemInstruction` và khối `prompt`.
2. **Given** người dùng nhập quy tắc dịch tùy chỉnh trong "Giới thiệu tóm tắt / Quy tắc dịch" (ví dụ: nguyên tắc phân vai xưng hô huynh - muội, bối cảnh tâm linh), **When** thực hiện chuốt văn ở Giai đoạn 2, **Then** các quy tắc này phải được đưa vào `systemInstruction` như một điều khoản quy định bắt buộc phải tuân thủ, thay vì chỉ là một dòng mô tả phụ trong nội dung người dùng.
3. **Given** người dùng sửa đổi cấu hình truyện trong modal và nhấn "Lưu thay đổi", **When** nạp lại trang hoặc mở chương tiếp theo để dịch, **Then** toàn bộ giá trị mới cập nhật được nạp tự động vào tiến trình dịch mà không yêu cầu khởi động lại ứng dụng.

---

### User Story 2 - Điền và ghi nhớ "Yêu cầu bổ sung khi biên tập" (Priority: P1)

Người dịch nhập hướng dẫn tùy biến tại ô **"Yêu cầu bổ sung khi biên tập"** (ví dụ: *"truyện tiên hiệp hãy làm cho câu từ bay bổng hơn"*, *"chú ý xưng hô tỷ muội thân mật"*). Hệ thống phải đảm bảo:
1. Trường thông tin này lưu trữ bền vững (không bị reset về rỗng khi người dùng chuyển qua tab khác, chọn chương khác hoặc reload trang).
2. Đồng bộ nhất quán giữa giao diện Bảng dịch tự động hàng loạt (`TranslationConfigPanel`) và Trình soạn thảo biên dịch đơn chương (`BilingualEditor`).
3. Truyền tải trọn vẹn vào payload của Giai đoạn 2 (chuốt văn phong) cho tất cả các chu trình mài giũa (từ lượt 1 đến lượt 5).

**Why this priority**: Đây là ô nhập prompt trực tiếp của người dùng tại giao diện làm việc hàng ngày (được người dùng chụp ảnh nhấn mạnh). Nếu ô này không có tác dụng, bị mất chữ khi đổi giao diện, hoặc chỉ thị không vào đến AI, người dùng mất đi khả năng can thiệp tức thì vào văn phong biên tập.

**Independent Test**: Điền một yêu cầu cụ thể vào ô "Yêu cầu bổ sung khi biên tập" trong AutoTranslator, chuyển sang tab Workspace và quay lại; kiểm tra xem nội dung vẫn còn nguyên vẹn. Kích hoạt biên tập một chương, kiểm tra payload AI gửi đi có chứa chính xác đoạn hướng dẫn vừa nhập.

**Acceptance Scenarios**:

1. **Given** người dùng nhập *"truyện tiên hiệp hãy làm cho câu từ bay bổng hơn"* vào ô yêu cầu biên tập, **When** hệ thống khởi tạo payload Chuốt văn phong Giai đoạn 2, **Then** trường `additionalInstructions` trong payload phải chứa nguyên văn câu này và được nhấn mạnh trong prompt gửi tới Gemini API.
2. **Given** người dùng nhập hướng dẫn biên tập tại tab Dịch tự động, **When** chuyển sang tab Biên tập song ngữ hoặc làm mới trang, **Then** hướng dẫn đó vẫn được duy trì nguyên vẹn theo dự án đang mở.
3. **Given** người dùng chọn chu trình chuốt nhiều vòng (2 đến 5 lượt), **When** AI thực hiện từng vòng biên tập liên tiếp, **Then** yêu cầu bổ sung của người dùng vẫn được áp dụng xuyên suốt kết hợp cùng chiến lược chuốt chuyên sâu của từng lượt (ngữ pháp -> văn học -> nhịp điệu).

---

### User Story 3 - Bảo toàn tri thức Từ điển khi áp dụng văn bản đánh dấu trước (Priority: P2)

Khi người dùng kích hoạt tính năng "Áp dụng từ điển trực tiếp vào văn bản gốc" trên giao diện soạn thảo hoặc trong chế độ dịch tự động có văn bản đã thay thế thuật ngữ (`processedSourceText`), hệ thống không được loại bỏ bảng từ điển khỏi danh sách đối chiếu gửi cho AI (không gửi mảng `[]`). AI vẫn phải nhận được danh sách định nghĩa thuật ngữ (chữ Trung, Hán Việt, tiếng Việt, phân loại thực thể và ghi chú vai trò) để hiểu rõ ngữ cảnh câu văn, tránh việc thông báo sai lệch là *"Không có từ điển tùy chọn"*.

**Why this priority**: Hiện tại khi văn bản đã được thế sẵn `[Tên_Việt]`, hệ thống đang truyền `glossary: []`, khiến AI Phase 1 nhận thông báo "Không có từ điển tùy chọn", và Phase 2 bỏ qua hoàn toàn phần liệt kê danh sách thuật ngữ đối chiếu. Điều này làm giảm chất lượng nhận diện ngữ cảnh và đại từ nhân xưng của AI.

**Independent Test**: Tạo một dự án có từ điển nhân vật (ví dụ: "Tiêu Viêm", vai trò "Nam chính"). Bấm áp dụng từ điển vào văn bản gốc để xuất hiện `[Tiêu Viêm]`, sau đó bấm Dịch thô hoặc Chuốt văn. Kiểm tra xem payload gửi đi vẫn liệt kê thông tin từ điển để AI hiểu bối cảnh của "Tiêu Viêm", thay vì ghi nhận "Không có từ điển tùy chọn".

**Acceptance Scenarios**:

1. **Given** văn bản gốc đã được thế sẵn thuật ngữ dạng `[Tên_Việt]`, **When** gửi yêu cầu Dịch thô (Phase 1), **Then** bảng từ điển tham chiếu vẫn được cung cấp đầy đủ thông tin về loại từ và ghi chú nhân vật để AI nắm bắt bối cảnh toàn cục.
2. **Given** văn bản dịch thô đang được chuốt ở Giai đoạn 2, **When** văn bản đối chiếu chứa các thuật ngữ đã thế dấu ngoặc, **Then** khối `[TỪ ĐIỂN RIÊNG ĐÃ XUẤT HIỆN TRONG ĐOẠN NÀY]` trong prompt chuốt văn vẫn liệt kê đầy đủ các thuật ngữ tương ứng kèm tần suất xuất hiện.
3. **Given** từ điển chứa các biến thể chữ Hán phồn thể/giản thể, **When** đối chiếu từ điển, **Then** các thuật ngữ tương đương theo bảng chuẩn hóa Hán tự đều được nhận diện và bảo toàn chính xác.

---

### User Story 4 - Đồng bộ kiểm định chất lượng bản dịch (QA Critique & Hako Audit) với bối cảnh tiểu thuyết (Priority: P2)

Khi người dùng hoặc hệ thống kích hoạt Giai đoạn 3 (Kiểm duyệt chất lượng QA Critique) hoặc kiểm tra chất lượng qua Hako Checker:
1. Payload kiểm định AI phải tiếp nhận thông tin bối cảnh dự án (Thể loại, Tông giọng, Quy tắc dịch xưng hô, và Từ điển dự án) để đánh giá lỗi chính xác (tránh cảnh báo nhầm việc xưng hô đặc thù hoặc thuật ngữ đã được quy ước trong cẩm nang dịch).
2. Khi dịch tự động hàng loạt có bật kiểm định chất lượng, các vấn đề phát hiện được (`issues`) phải được lưu trữ vào dữ liệu chương và hiển thị tập trung tại Unified Audit Panel để người dùng dễ dàng xem xét, phân loại và sửa đổi bằng một cú nhấp chuột.

**Why this priority**: Hiện tại QA Critique chỉ nhận `sourceText` và `translatedText` mà hoàn toàn không có thông tin từ điển hay quy tắc dịch, dẫn tới việc không thể thẩm định lỗi thuật ngữ (`terminology`) và dễ bắt lỗi sai khi dịch giả cố tình dùng văn phong đặc thù. Ngoài ra, kết quả QA trong AutoTranslator bị trôi mất trên màn hình log mà không lưu lại cho người dùng duyệt.

**Independent Test**: Thiết lập quy tắc xưng hô riêng và chạy QA Critique cho một chương có các đoạn cố tình sai khác so với ngôn ngữ thông thường nhưng đúng theo quy tắc cẩm nang. Kiểm tra xem QA có hiểu bối cảnh và không báo lỗi oan, đồng thời các lỗi bỏ sót thực sự (omissions) được hiển thị đầy đủ trên Bảng điều khiển kiểm định thống nhất.

**Acceptance Scenarios**:

1. **Given** một bản dịch hoàn thiện, **When** kích hoạt QA Critique (thủ công hoặc tự động), **Then** payload kiểm định tiếp nhận kèm theo từ điển và quy tắc xưng hô để phát hiện chuẩn xác các lỗi bỏ sót (omission), thêm thắt (hallucination), và sai lệch thuật ngữ (terminology).
2. **Given** tiến trình dịch tự động hoàn tất với tùy chọn kiểm định chất lượng được bật, **When** người dùng mở chương đó trong Workspace, **Then** các cảnh báo kiểm định xuất hiện trên Bảng kiểm định thống nhất (Unified Audit Panel) sẵn sàng cho hành động sửa lỗi nhanh hoặc viết lại bằng AI.
3. **Given** một vấn đề kiểm định được chọn để "Viết lại bằng AI" (`rewriteSentenceDirect`), **When** gửi yêu cầu viết lại, **Then** AI viết lại câu được tiếp nhận bối cảnh thể loại và tông giọng của truyện để câu văn sau khi sửa giữ nguyên phong vị tác phẩm.

---

### User Story 5 - Trích xuất và phân tích thuật ngữ thông minh hoạt động chính xác (Priority: P3)

Các cơ chế liên quan đến lọc và trích xuất thuật ngữ—bao gồm: Quét lọc thuật ngữ sỉ qua nhiều chương (`useGlossaryScan`), Phân tích cẩm nang dịch thuật `.md` (`analyzeGuidelinesDirect`), Trích xuất nhanh từ văn bản (`extract-glossary`), và Bôi đen tra cứu định nghĩa tức thì (`fetchQuickDefinition`)—phải hoạt động ổn định, phân tách rõ ràng vai trò thực thể, xử lý chuẩn xác tên phiên âm phương Tây và danh từ chỉ loại tiếng Trung (ví dụ: *阿帕茶 -> Trà Abbacchio*), và loại trừ các từ đã biết qua các vòng quét lặp.

**Why this priority**: Khâu chuẩn bị thuật ngữ là nền tảng trước khi dịch. Các prompt trích xuất cần hoạt động nhạy bén, chính xác theo đúng cấu trúc dữ liệu để giảm thiểu công sức nhập tay của người dịch.

**Independent Test**: Nạp một đoạn văn bản tiếng Trung chứa tên nhân vật phiên âm kiểu phương Tây và danh từ chỉ loại; thực hiện quét thuật ngữ; xác nhận kết quả trả về đúng tên gốc tiếng Anh và danh từ phân loại được đảo lên phía trước bằng tiếng Việt.

**Acceptance Scenarios**:

1. **Given** đoạn văn tiếng Trung chứa tên nhân vật hoặc địa danh phiên âm ngoại quốc có hậu tố danh từ chỉ loại (như 茶, 镇, 城), **When** chạy trích xuất thuật ngữ, **Then** AI trả về tên tiếng Anh gốc kèm danh từ tiếng Việt được đảo lên trước (ví dụ: `阿帕茶` -> `Trà Abbacchio`).
2. **Given** quét thuật ngữ qua nhiều vòng lặp (vòng 2 trở đi), **When** gửi yêu cầu phân tích, **Then** danh sách các từ đã phát hiện ở các vòng trước được đưa vào phần loại trừ để AI tập trung tìm kiếm các nhân vật phụ và chiêu thức bị sót.
3. **Given** người dùng bôi đen một cụm từ tiếng Trung trong trình soạn thảo để tra cứu nhanh, **When** popup tra cứu xuất hiện, **Then** kết quả phiên âm Hán-Việt, dịch nghĩa và loại từ được trả về tức thì phù hợp với thể loại của bộ truyện.

---

### Edge Cases

- **Trường nhập liệu bỏ trống**: Khi người dùng không điền "Yêu cầu bổ sung khi biên tập" hoặc "Giới thiệu tóm tắt / Quy tắc dịch", hệ thống phải tự động áp dụng các câu lệnh mặc định tối ưu (không gửi chuỗi rỗng gây đứt gãy prompt hoặc làm AI hoang mang).
- **Văn bản gốc chứa ký tự điều khiển ẩn hoặc prompt injection**: Toàn bộ nội dung từ người dùng và văn bản truyện phải được lọc qua bộ khử ký tự vô hình (`sanitizePromptInput`) và bao bọc bởi chỉ thị an toàn (`ANTI_INJECTION_DEFENSE_DIRECTIVE`) trước khi ghép vào prompt.
- **Tác phẩm có dung lượng cẩm nang quy tắc dịch quá dài**: Nếu phần quy tắc dịch vượt quá giới hạn ký tự an toàn, hệ thống phải cắt tỉa thông minh hoặc tóm tắt các điều khoản quan trọng nhất thay vì làm tràn context window của mô hình.
- **Hạn mức API Key cá nhân cạn kiệt trong lúc gọi prompt**: Khi một API key gặp lỗi 429 hoặc chạm ngưỡng cá nhân, hệ thống phải tự động xoay tua sang key tiếp theo mà không làm mất trạng thái prompt đang xử lý dở dang.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống BẮT BUỘC truyền dẫn đầy đủ 3 thuộc tính cấu hình tiểu thuyết (`genre`, `tone`, `description`) vào cả `systemInstruction` và khối `prompt` của Giai đoạn 1 (Dịch thô) và Giai đoạn 2 (Chuốt văn phong).
- **FR-002**: Tại Giai đoạn 2 (Chuốt văn phong), hệ thống BẮT BUỘC đưa quy tắc dịch thuật từ `description` vào `systemInstruction` với tư cách là quy định bắt buộc phải tuân thủ (tương đương Giai đoạn 1).
- **FR-003**: Trường "Yêu cầu bổ sung khi biên tập" (`additionalInstructions`) BẮT BUỘC được lưu trữ bền vững theo từng dự án trong cơ sở dữ liệu IndexedDB và đồng bộ tức thời giữa Bảng dịch tự động (`TranslationConfigPanel`) và Trình soạn thảo đơn chương (`BilingualEditor`).
- **FR-004**: Khi người dùng để trống `additionalInstructions`, hệ thống BẮT BUỘC sử dụng một chỉ dẫn biên tập mặc định chuẩn mực ("Hãy tối ưu ngữ điệu mượt mà, bay bổng nhất có thể, giữ trọn vẹn văn phong tiểu thuyết") đồng nhất ở cả dịch đơn chương và dịch hàng loạt.
- **FR-005**: Khi áp dụng tính năng "Áp dụng từ điển trực tiếp vào bản gốc" hoặc dịch bằng văn bản đã qua xử lý (`processedSourceText`), hệ thống KHÔNG ĐƯỢC gán `glossary` thành mảng rỗng `[]`. Bảng từ điển đối chiếu và danh sách thuật ngữ xuất hiện BẮT BUỘC phải tiếp tục được gửi kèm trong prompt để AI hiểu đầy đủ bối cảnh thực thể.
- **FR-006**: Payload kiểm định chất lượng Giai đoạn 3 (`buildQaCritiquePayload`) BẮT BUỘC tiếp nhận bổ sung thông tin `genre`, `tone`, `description`, và `glossary` của dự án để đánh giá chính xác các tiêu chí về xưng hô và thuật ngữ.
- **FR-007**: Khi tùy chọn kiểm định chất lượng (`enableAiQaCritique`) được bật trong quá trình dịch tự động hàng loạt, các lỗi kiểm định phát hiện được BẮT BUỘC phải được lưu trữ vào thuộc tính chương và hiển thị sẵn sàng trên Bảng kiểm định thống nhất (`UnifiedAuditPanel`).
- **FR-008**: Chức năng viết lại câu nhắm mục tiêu (`rewriteSentenceDirect`) BẮT BUỘC tiếp nhận thông tin thể loại (`genre`) và tông giọng (`tone`) của dự án để đảm bảo câu văn sau khi viết lại đồng điệu với phong cách của toàn bộ tác phẩm.
- **FR-009**: Hệ thống trích xuất thực thể phát sinh trong Giai đoạn 2 (`discoveredEntities` khi `isExtractionEnabled = true`) BẮT BUỘC kế thừa đầy đủ các hướng dẫn nghiêm ngặt về khôi phục tên tiếng Anh và giữ nguyên dạng chữ Hán như tại Giai đoạn 1.
- **FR-010**: Tất cả các trường nhập liệu prompt của người dùng (`additionalInstructions`, `description`, v.v.) BẮT BUỘC phải được làm sạch qua bộ lọc ký tự vô hình (`sanitizePromptInput`) trước khi đưa vào template prompt.

### Key Entities

- **ProjectTranslationConfig**: Tập hợp các tham số định hình văn phong dự án gồm: Thể loại chính (`genre`), Tông giọng biên dịch (`tone`), Giới thiệu / Quy tắc dịch thuật đặc thù (`description`), và Yêu cầu bổ sung khi biên tập (`additionalInstructions`).
- **PromptPayload**: Cấu trúc dữ liệu hoàn chỉnh gửi tới Gemini API gồm: `systemInstruction` (chỉ thị hệ thống có đóng khung an toàn văn học), `prompt` (nội dung đối chiếu và yêu cầu người dùng), và `schema` (JSON Schema chuẩn hóa đầu ra).
- **QualityCritiqueResult**: Kết quả kiểm định chất lượng chứa đánh giá tổng quan (`isValid`), danh sách các vấn đề phát hiện (`issues`), phân loại theo loại lỗi (`omission`, `addition`, `repetition`, `terminology`, `other`), mức độ nghiêm trọng (`severity`), và đoạn trích văn bản lỗi (`targetText`).
- **GlossaryExtractionContext**: Bối cảnh thực hiện bóc tách thuật ngữ gồm văn bản truyện nguồn, danh sách các từ đã biết cần bỏ qua qua các lượt quét lặp, và quy chuẩn chuẩn hóa tên ngoại quốc / danh từ phân loại tiếng Trung.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% các trường nhập liệu prompt và cấu hình văn học từ người dùng (Thể loại, Tông giọng, Quy tắc dịch, Yêu cầu bổ sung khi biên tập) được phản ánh nguyên vẹn trong payload AI gửi đến Gemini API mà không bị thất thoát hoặc xóa trắng bất kể thao tác chuyển đổi giao diện hay nạp lại trang.
- **SC-002**: 100% các cuộc gọi Giai đoạn 1 và Giai đoạn 2 khi văn bản đã được thế trước thuật ngữ đều duy trì bảng từ điển đối chiếu trong prompt, triệt tiêu hoàn toàn trường hợp AI nhận thông báo sai lệch là "Không có từ điển tùy chọn".
- **SC-003**: 100% các cảnh báo kiểm định chất lượng phát sinh từ chế độ dịch tự động hàng loạt được lưu trữ thành công và hiển thị tức thời trên Bảng kiểm định thống nhất khi người dùng mở chương.
- **SC-004**: Tất cả các tác vụ AI (Dịch thô, Chuốt văn, QA Critique, Quét thuật ngữ, Viết lại câu) tuân thủ 100% cấu trúc phân đoạn (`\n\n`), giữ nguyên tiêu đề chương riêng biệt, và phản hồi đúng JSON Schema định sẵn.
- **SC-005**: Toàn bộ hệ thống vượt qua tuyệt đối các cổng kiểm thử chất lượng (`npm run lint`, `npm test`, `npm run build`) mà không có bất kỳ cảnh báo kiểu dữ liệu hay lỗi thực thi nào.

## Assumptions

- Người dùng sở hữu ít nhất một Google Gemini API Key hợp lệ được cấu hình trong trình duyệt để thực thi các tác vụ AI trực tiếp.
- Mọi dữ liệu bản thảo truyện, cấu hình dự án, và từ điển tiếp tục được lưu trữ hoàn toàn cục bộ trên trình duyệt người dùng thông qua IndexedDB tuân thủ nguyên tắc kiến trúc Pure Client-Side SPA.
- Các mô hình Gemini được chọn hỗ trợ cơ chế Structured Outputs (`responseSchema`) thông qua giao thức Google Gemini REST API v1beta.
