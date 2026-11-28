# Feature Specification: Lọc Từ điển Chặt theo Chương & Cổng Kết nối Chuẩn OpenAI (/v1/chat/completions)

**Feature Branch**: `174-chapter-glossary-filter-openai-adapter`  
**Created**: 2026-11-28  
**Status**: Draft  
**Input**: User description: "Lọc glossary theo chương (filter_glossary): Thay vì đẩy toàn bộ 577 mục từ điển vào mọi request (dễ làm model nhẹ như Flash-Lite bị quá tải), chỉ lọc đúng các mục có xuất hiện trong văn bản nguồn của chương đang dịch. Thêm adapter chuẩn /v1/chat/completions: Giữ nguyên pipeline Dịch thô -> Chuốt văn -> QA Critique (vốn đang rất bài bản ở repo bạn), chỉ cần mở thêm cổng OpenAI-compatible là cắm được cả DeepSeek, Qwen, Groq, NVIDIA NIM lẫn Ollama/LM Studio chạy local vô hạn."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Chạy trọn vẹn pipeline Dịch thô → Chuốt văn → QA Critique qua cổng chuẩn `/v1/chat/completions` (Priority: P1)

Là một biên dịch viên sử dụng ứng dụng, tôi muốn chọn chế độ nhà cung cấp tương thích chuẩn OpenAI (`/v1/chat/completions`) ngoài Google Gemini mặc định để cắm trực tiếp DeepSeek, Qwen, Groq, NVIDIA NIM hoặc các mô hình chạy cục bộ như Ollama và LM Studio, mà vẫn giữ nguyên toàn bộ chất lượng quy trình Dịch thô (GĐ1), Chuốt văn 3 lượt (GĐ2), Kiểm duyệt QA Critique (GĐ3), sửa lỗi cục bộ và trích xuất từ điển.

**Why this priority**: Phụ thuộc duy nhất vào một nhà cung cấp khiến người dùng bị tắc tiến trình mỗi khi chạm hạn mức ngày của gói miễn phí, trong khi họ hoàn toàn có thể chạy mô hình cục bộ không giới hạn qua Ollama/LM Studio hoặc các API tốc độ cao tương thích OpenAI.

**Independent Test**: Có thể kiểm thử độc lập bằng cách chọn một cấu hình OpenAI-compatible (hoặc giả lập cổng `/v1/chat/completions`), chạy dịch một chương đầy đủ từ Dịch thô → Chuốt văn → QA Critique và xác minh cả 3 bước cùng trích xuất thực thể đều nhận dữ liệu đúng định dạng và hoàn tất bình thường.

**Acceptance Scenarios**:

1. **Given** người dùng đã cấu hình nhà cung cấp chuẩn OpenAI với địa chỉ gốc, mã mô hình và khóa hợp lệ (hoặc trống khóa nếu chạy cục bộ), **When** bắt đầu dịch tự động hoặc dịch từng chương, **Then** toàn bộ các bước Dịch thô, Chuốt văn, Kiểm duyệt QA, Sửa lỗi mục tiêu và Viết lại câu đều định tuyến sang cổng `/v1/chat/completions` của nhà cung cấp đó thay vì gửi về Google Gemini.
2. **Given** người dùng đang chọn chế độ Google Gemini (mặc định ban đầu), **When** thực hiện bất kỳ thao tác dịch thuật hoặc kiểm tra quota nào, **Then** hệ thống vận hành y hệt hành vi mặc định vốn có với cơ chế xoay vòng khóa và theo dõi hạn mức Gemini không bị ảnh hưởng.

---

### User Story 2 - Lọc từ điển chặt theo văn bản nguồn của chương (`filter_glossary`) trên mọi bước gọi AI (Priority: P1)

Khi dự án có hàng trăm mục từ điển tích lũy qua nhiều tập (ví dụ 577 mục), tôi muốn hệ thống lọc chặt và chỉ đưa vào ngữ cảnh đúng các mục thực sự xuất hiện trong văn bản nguồn của chương/phân đoạn đang dịch — không tự động chèn thêm hàng loạt mục ghim không hề xuất hiện trong chương và không gửi danh sách mục đã biết dài dằng dặc gây quá tải cho các mô hình nhẹ (như Flash Lite hoặc mô hình cục bộ nhỏ) — đồng thời hiển thị gọn gàng số lượng mục đã lọc trên tổng số mục (ví dụ `24/577 mục`).

**Why this priority**: Việc nhồi thêm tới 50 mục ghim dư thừa ở GĐ1/GĐ2/GĐ3 hoặc tới 150 mục neo ở bước phân tích từ điển khiến mọi lượt gọi đều mang thêm hàng nghìn token rác dù chương hiện tại không nhắc đến các thực thể đó, dễ làm mô hình nhẹ bị nhiễu, chậm hoặc cắt ngắn phản hồi JSON.

**Independent Test**: Có thể kiểm thử độc lập trên một dự án mẫu có 577 mục từ điển (gồm 120 mục đánh dấu ghim), chọn một chương chỉ chứa 18 mục trong văn bản nguồn và kiểm tra nội dung gửi đi ở cả GĐ1, GĐ2, GĐ3 và bước phân tích từ điển đều chỉ chứa đúng các mục khớp chương (hoặc chế độ ghim tùy chọn được tắt mặc định).

**Acceptance Scenarios**:

1. **Given** một dự án có 577 mục từ điển (trong đó có nhiều mục ghim ở các chương khác) và văn bản nguồn chương hiện tại chỉ xuất hiện 18 mục (tính cả dạng giản thể, phồn thể và biến thể), **When** hệ thống chuẩn bị ngữ cảnh cho Dịch thô, Chuốt văn, Kiểm duyệt QA và Sửa lỗi cục bộ, **Then** danh sách từ điển đưa vào chỉ bao gồm đúng 18 mục xuất hiện trong chương, loại bỏ 559 mục không xuất hiện (tỷ lệ hiển thị rõ dạng `18/577 mục`).
2. **Given** người dùng chạy bước phân tích/quét từ điển mới cho chương, **When** hệ thống đính kèm danh sách thuật ngữ đã biết để tránh trùng lặp, **Then** danh sách tham chiếu đối chiếu chỉ chứa các mục có xuất hiện trong văn bản nguồn chương (hoặc giới hạn thật nhỏ ở mức tối thiểu hợp lý) thay vì nhồi cả 150 mục không liên quan.
3. **Given** người dùng vẫn có nhu cầu đặc biệt muốn đính kèm một số lượng nhỏ từ điển ghim cố định bất kể có xuất hiện trong chương hay không, **When** mở phần tùy chọn chất lượng/từ điển, **Then** tùy chọn này được tắt mặc định để ưu tiên lọc chặt theo chương và chỉ kích hoạt khi người dùng chủ động bật.

---

### User Story 3 - Cấu hình mẫu nhanh (Preset), tải mô hình `/v1/models`, chạy local không cần Key & kiểm tra kết nối (Priority: P1)

Trong giao diện Cấu hình AI, tôi muốn chuyển đổi qua lại rõ ràng giữa **Google Gemini** và **Chuẩn OpenAI (`/v1/chat/completions`)**, có sẵn các nút chọn mẫu nhanh (DeepSeek, Qwen, Groq, NVIDIA NIM, Ollama cục bộ, LM Studio cục bộ, Tùy chỉnh), cho phép bỏ trống API Key đối với máy chủ cục bộ, tự tải danh sách mô hình từ cổng chuẩn `/v1/models` hoặc nhập tay mã mô hình, và có nút **Kiểm tra kết nối** trả kết quả tức thì.

**Why this priority**: Người dùng phổ thông không nhớ chính xác đường dẫn API của từng dịch vụ (DeepSeek, Qwen, Groq, NVIDIA NIM, Ollama, LM Studio). Cung cấp sẵn mẫu đúng chuẩn và hỗ trợ bỏ trống key khi chạy cục bộ giúp cắm là chạy ngay trong vài giây.

**Independent Test**: Mở Cấu hình AI, chọn từng mẫu nhanh như `Ollama (Local)` và `DeepSeek`, xác minh địa chỉ gốc và gợi ý mô hình tự điền đúng, cho phép lưu khi không nhập API Key nếu là địa chỉ cục bộ, bấm tải danh sách mô hình và kiểm tra kết nối hoạt động mượt.

**Acceptance Scenarios**:

1. **Given** người dùng mở Cấu hình AI và chọn chế độ OpenAI-compatible, **When** bấm chọn mẫu `Ollama (Local)` hoặc `LM Studio (Local)`, **Then** hệ thống tự điền sẵn địa chỉ gốc cục bộ tương ứng (`localhost`), gợi ý mã mô hình mẫu và cho phép lưu + chạy dịch ngay mà **không bắt buộc nhập API Key**.
2. **Given** người dùng chọn mẫu dịch vụ đám mây (DeepSeek, Qwen, Groq, NVIDIA NIM) hoặc nhập URL máy chủ từ xa, **When** kiểm tra hợp lệ trước khi chạy, **Then** hệ thống yêu cầu phải có ít nhất một khóa API hợp lệ (hỗ trợ nhập nhiều khóa để xoay vòng khi chạm giới hạn) và từ chối địa chỉ không an toàn.
3. **Given** người dùng đã điền thông tin kết nối chuẩn OpenAI, **When** bấm nút **Tải danh sách Model** hoặc **Kiểm tra kết nối**, **Then** ứng dụng truy vấn cổng `/v1/models` để liệt kê nhanh các mô hình khả dụng (hoặc xác nhận kết nối thành công/thất bại kèm thời gian phản hồi và gợi ý khắc phục).

---

### User Story 4 - Tương thích đầu ra JSON linh hoạt & chẩn đoán lỗi kết nối/CORS rõ ràng (Priority: P2)

Vì không phải nhà cung cấp hay mô hình cục bộ nào cũng hỗ trợ ép khuôn JSON nghiêm ngặt giống nhau (và một số mô hình suy luận hay chèn thẻ `<think>...</think>` hoặc khối markdown), hệ thống phải tự động thích ứng định dạng phản hồi và hiển thị hướng dẫn tiếng Việt cụ thể khi gặp lỗi CORS trên máy chủ cục bộ hoặc lỗi xác thực/hạn mức.

**Why this priority**: Ollama/LM Studio và một số mô hình trên NVIDIA NIM/DeepSeek khác nhau ở mức hỗ trợ cấu trúc JSON và chính sách CORS trình duyệt; nếu thiếu cơ chế tự hạ cấp mượt và hướng dẫn CORS, người dùng rất dễ gặp lỗi khó hiểu ngay lần thử đầu tiên.

**Independent Test**: Mô phỏng nhà cung cấp từ chối chế độ schema nghiêm ngặt (`400 Bad Request` do tham số định dạng) hoặc trả về JSON bọc trong khối `<think>...</think>` và ```` ```json ... ``` ````; xác minh hệ thống tự chuyển sang chế độ JSON tương thích và bóc tách sạch kết quả, đồng thời mô phỏng lỗi mạng CORS cục bộ để xác minh thông báo hướng dẫn bật CORS.

**Acceptance Scenarios**:

1. **Given** máy chủ OpenAI-compatible từ chối yêu cầu vì không hỗ trợ khuôn schema JSON nghiêm ngặt, **When** lượt gọi đầu thất bại với lỗi định dạng tham số phản hồi, **Then** hệ thống tự động thử lại ngay bằng chế độ JSON object / chỉ dẫn JSON trong cùng phiên mà không làm gián đoạn tiến trình dịch.
2. **Given** mô hình trả về nội dung có kèm thẻ suy luận nội bộ (`<think>...</think>`) hoặc bao quanh bởi thẻ code markdown, **When** ứng dụng phân tích kết quả cho Dịch thô, Chuốt văn hoặc QA Critique, **Then** phần nhiễu bên ngoài được lọc sạch tự động để lấy đúng dữ liệu cấu trúc hợp lệ.
3. **Given** người dùng kết nối tới Ollama/LM Studio cục bộ nhưng trình duyệt chặn yêu cầu do thiếu cấu hình cho phép nguồn gốc chéo (CORS), **When** lỗi kết nối xảy ra, **Then** hệ thống hiển thị thông báo tiếng Việt cụ thể nêu rõ khả năng bị chặn CORS cùng hướng dẫn ngắn gọn cách bật cho phép CORS trên phần mềm chạy mô hình cục bộ.

---

### Edge Cases

- **Chương không có bất kỳ thuật ngữ nào khớp trong từ điển 577 mục**: Danh sách lọc trả về rỗng, thông báo trong prompt ghi gọn không có thuật ngữ xuất hiện ở chương này, không lỗi và không tự ý nhồi thêm mục từ chương khác.
- **Khớp biến thể chữ Hán phồn/giản và tên phụ (`variants`)**: Khi văn bản gốc dùng phồn thể hoặc biệt danh biến thể nhưng từ điển lưu giản thể (hoặc ngược lại), bộ lọc vẫn nhận diện chính xác để không bỏ sót nhân vật đang xuất hiện trong chương.
- **Tài liệu dài phải chia nhỏ (split) ở GĐ1/GĐ2**: Khi một chương dài được tách thành nhiều đoạn để dịch, mỗi phân đoạn phải lọc từ điển riêng theo đúng văn bản nguồn của phân đoạn đó thay vì dùng lại toàn bộ từ điển cả chương hoặc cả truyện.
- **Chạy mô hình cục bộ không có API key vs máy chủ đám mây bắt buộc API key**: Máy chủ cục bộ (`localhost` / `127.0.0.1`) chấp nhận chuỗi khóa trống (không gửi tiêu đề xác thực rỗng gây lỗi máy chủ); máy chủ từ xa yêu cầu có khóa hợp lệ và hỗ trợ xoay vòng nhiều khóa khi người dùng cấu hình nhiều khóa.
- **Bảo mật URL & khóa API**: Chỉ chấp nhận địa chỉ giao thức web chuẩn; yêu cầu kết nối bảo mật với máy chủ từ xa (chỉ cho phép HTTP thông thường với địa chỉ cục bộ `localhost` / `127.0.0.1`), không bao giờ lộ khóa API thô trong log hay thông báo lỗi, và lưu giữ an toàn cấu hình riêng biệt khi chuyển qua lại giữa Google Gemini và OpenAI-compatible.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI lọc chặt danh sách từ điển dựa trên văn bản nguồn thực tế của chương hoặc phân đoạn đang xử lý tại mọi bước gọi AI (Dịch thô GĐ1, Chuốt văn GĐ2, Kiểm duyệt QA GĐ3, Sửa lỗi cục bộ và Viết lại câu), đảm bảo chỉ những mục có xuất hiện trong văn bản nguồn (bao gồm cả tương đương giản thể/phồn thể và biến thể) mới được đưa vào ngữ cảnh.
- **FR-002**: Hành vi mặc định của bộ lọc từ điển theo chương PHẢI **tắt chế độ nhồi thêm các mục ghim không xuất hiện trong chương** (hoặc chỉ giữ dưới dạng tùy chọn tắt mặc định để người dùng chủ động bật khi cần) và tối ưu kích thước danh sách thuật ngữ đối chiếu trong bước quét từ điển theo đúng văn bản nguồn chương đang xét, không đẩy tràn hàng trăm mục dư thừa vào các mô hình nhẹ.
- **FR-003**: Trong nhật ký tiến trình hoặc thông tin tóm tắt phiên dịch của chương, hệ thống PHẢI ghi nhận ngắn gọn số lượng mục từ điển thực tế đã lọc theo chương trên tổng số mục từ điển dự án (ví dụ `24/577 mục`) để minh bạch mức độ giảm tải ngữ cảnh.
- **FR-004**: Hệ thống PHẢI hỗ trợ lựa chọn chế độ nhà cung cấp AI ở tầng điều phối dùng chung giữa **Google Gemini** (mặc định ban đầu) và **OpenAI-compatible (`/v1/chat/completions`)**, sao cho toàn bộ pipeline Dịch thô → Chuốt văn → QA Critique cùng các tác vụ phụ trợ đều chạy thống nhất qua một đầu mối mà không phải viết lại logic nghiệp vụ dịch thuật cho từng nhà cung cấp.
- **FR-005**: Khi chế độ **Google Gemini** được chọn, hệ thống PHẢI bảo toàn 100% cơ chế xoay vòng nhiều khóa API, theo dõi hạn mức theo mô hình và phục hồi lỗi hiện hành mà không suy giảm hành vi.
- **FR-006**: Khi chế độ **OpenAI-compatible** được chọn, hệ thống PHẢI chuyển đổi thống nhất chỉ dẫn hệ thống, nội dung người dùng, thông số nhiệt độ, tín hiệu hủy yêu cầu tức thì (abort) và cấu trúc đầu ra mong muốn sang định dạng chuẩn `/v1/chat/completions`, đồng thời trả về kết quả đúng hợp đồng dữ liệu của toàn bộ pipeline 3 giai đoạn.
- **FR-007**: Giao diện Cấu hình AI PHẢI cung cấp tùy chọn chuyển đổi chế độ nhà cung cấp và ít nhất các cấu hình mẫu nhanh (Preset) gồm: **DeepSeek**, **Qwen**, **Groq**, **NVIDIA NIM**, **Ollama (Local)**, **LM Studio (Local)** và **Tùy chỉnh (Custom Base URL)**, tự động điền địa chỉ gốc chuẩn và gợi ý mã mô hình khi người dùng chọn mẫu.
- **FR-008**: Giao diện Cấu hình AI PHẢI cho phép người dùng nhập/sửa địa chỉ gốc (Base URL), chọn hoặc tự nhập mã mô hình, để trống API key đối với các địa chỉ máy chủ cục bộ (`localhost` / `127.0.0.1`), và thực hiện **Tải danh sách mô hình** từ cổng `/v1/models` cũng như **Kiểm tra kết nối** trực tiếp trước khi chạy dịch.
- **FR-009**: Khi người dùng nhập nhiều API key cho nhà cung cấp OpenAI-compatible từ xa, bộ điều phối PHẢI tái sử dụng cơ chế xoay vòng khóa và tạm nghỉ/hồi phục khi gặp giới hạn tốc độ (`429`) hoặc quá tải (`503`) tương ứng với nhà cung cấp đó, không làm lẫn trạng thái khóa với khóa Google Gemini.
- **FR-010**: Bộ chuyển đổi `/v1/chat/completions` PHẢI xử lý tương thích linh hoạt các biến thể phản hồi JSON: tự động hạ cấp từ chế độ khuôn JSON nghiêm ngặt sang chế độ JSON tương thích hoặc chỉ dẫn JSON khi máy chủ từ chối tham số khuôn, và tự động loại bỏ thẻ suy luận (`<think>...</think>`) hay khối markdown bọc ngoài trước khi phân tích dữ liệu có cấu trúc.
- **FR-011**: Hệ thống PHẢI chuẩn hóa và hiển thị thông báo lỗi tiếng Việt rõ ràng cho các tình huống đặc thù của cổng `/v1/chat/completions`: khóa API sai (`401/403`), chạm giới hạn tốc độ (`429`), hết tín dụng/quota, mô hình không tồn tại (`404`), hết thời gian chờ, và nghi ngờ lỗi chặn CORS trình duyệt khi kết nối máy chủ cục bộ kèm hướng dẫn bật CORS.
- **FR-012**: Toàn bộ cấu hình nhà cung cấp OpenAI-compatible (địa chỉ gốc, khóa API, mã mô hình) PHẢI tuân thủ quy chuẩn bảo mật hiện tại (che khóa trên giao diện, không ghi log khóa thô, kiểm tra tính hợp lệ giao thức URL, chỉ cho phép `http://` với máy chủ cục bộ) và tuyệt đối không thay đổi cấu trúc dữ liệu truyện/chương chính.

### Key Entities

- **Hồ sơ kết nối nhà cung cấp AI (AI Provider Profile)**: Chế độ nhà cung cấp đang hoạt động (`Gemini` hoặc `OpenAI-compatible`), cấu hình mẫu đang chọn, địa chỉ máy chủ gốc (`/v1/chat/completions`), danh sách khóa API (cho phép rỗng với local) và mã mô hình đích.
- **Bộ lọc từ điển theo chương (Chapter Glossary Filter)**: Quy tắc đối chiếu giữa danh sách từ điển toàn dự án với văn bản nguồn thực tế của chương/phân đoạn hiện tại (hỗ trợ giản thể/phồn thể và biến thể), kèm số liệu trước/sau lọc.
- **Bộ chuyển đổi đầu ra tương thích (Structured Output Adapter)**: Cơ chế gửi yêu cầu định dạng cấu trúc phù hợp với từng dòng mô hình chuẩn OpenAI và bóc tách sạch dữ liệu JSON từ phản hồi có thể kèm khối suy luận hoặc markdown.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Với một dự án thử nghiệm có `577` mục từ điển trong đó chương hiện tại chỉ nhắc tới tối đa `20` mục, số mục từ điển thực tế đưa vào lời nhắc ở cả GĐ1, GĐ2, GĐ3 và sửa lỗi cục bộ là **đúng số mục xuất hiện trong chương (`<= 20` mục, giảm > 90% mục không liên quan)** ở chế độ mặc định.
- **SC-002**: Người dùng có thể chuyển từ Google Gemini sang một trong các cấu hình OpenAI-compatible (preset DeepSeek/Qwen/Groq/NVIDIA NIM hoặc Ollama/LM Studio cục bộ) và hoàn tất thành công cả 3 giai đoạn **Dịch thô → Chuốt văn → QA Critique** trên một chương mẫu mà không cần sửa cấu trúc truyện hay cài đặt thêm thành phần trung gian bên ngoài (trừ cấu hình CORS của phần mềm local nếu trình duyệt yêu cầu).
- **SC-003**: 100% thao tác kết nối tới máy chủ cục bộ (`Ollama` / `LM Studio` trên `localhost` hoặc `127.0.0.1`) hoạt động hợp lệ khi người dùng bỏ trống ô API Key, và nút **Kiểm tra kết nối** phản hồi kết quả thành công hoặc chẩn đoán lỗi rõ ràng (bao gồm gợi ý CORS) trong vòng một thao tác bấm.
- **SC-004**: 100% phản hồi JSON hợp lệ nhưng được mô hình OpenAI-compatible bọc trong khối `<think>...</think>` hoặc thẻ code markdown được bóc tách thành công ở các bước GĐ1, GĐ2, GĐ3 và trích xuất thực thể mà không văng lỗi phân tích định dạng.
- **SC-005**: 100% chức năng mặc định của Google Gemini (xoay vòng khóa, theo dõi quota theo mô hình, mở khóa thủ công từ Feature 173) vẫn hoạt động nguyên vẹn khi chuyển lại chế độ Gemini.
- **SC-006**: 0% thông tin khóa API thô xuất hiện trong log tiến trình dịch, thông báo lỗi hay báo cáo trạng thái kết nối.

## Assumptions

- Ứng dụng chạy hoàn toàn ở phía trình duyệt người dùng (Pure Client-Side SPA), do đó việc gọi trực tiếp các máy chủ cục bộ như Ollama hoặc LM Studio yêu cầu máy chủ cục bộ cho phép nguồn gốc truy cập từ trình duyệt (CORS); nếu bị chặn CORS, trình duyệt sẽ từ chối kết nối mức mạng và hệ thống hỗ trợ bằng thông báo hướng dẫn cụ thể.
- Các dịch vụ đám mây nêu trên (DeepSeek, Qwen/DashScope compatible-mode, Groq, NVIDIA NIM) đều cung cấp cổng tương thích chuẩn OpenAI `/v1/chat/completions` và `/v1/models` qua HTTPS và xác thực bằng Bearer API key.
- Kho dữ liệu hiện tại của ứng dụng đã có bước chọn từ điển liên quan cho GĐ1/GĐ2/GĐ3/sửa cục bộ nhưng vẫn cho phép chèn thêm tối đa hàng chục mục ghim không xuất hiện trong chương và chưa có cổng adapter chuẩn `/v1/chat/completions` — tính năng này tập trung siết chặt bộ lọc mặc định, đồng bộ hóa hiển thị tỷ lệ lọc và bổ sung cổng OpenAI-compatible dùng chung cho toàn pipeline.
- Không thay đổi cấu trúc lưu trữ truyện, chương và từ điển trong cơ sở dữ liệu chính; cấu hình kết nối nhà cung cấp mới được lưu tách biệt an toàn theo ranh giới cấu hình AI hiện có.
