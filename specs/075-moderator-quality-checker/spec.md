# Feature Specification: Moderator Hako Quality Checker Workspace

**Feature Branch**: `075-moderator-quality-checker`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "Thêm một khu vực làm việc mới cho moderator để kiểm định chất lượng các chương truyện đã đăng công khai trên Hako/Docln, tách biệt hoàn toàn với luồng dịch 2 giai đoạn hiện có. Lấy cảm hứng và cho phép cổng lại phần đọc/rà soát read-only từ dự án mã nguồn mở akira3175/Hako-Checker. Vấn đề: sau khi chương được dịch và đăng lên Hako, lỗi dịch/biên tập vẫn có thể lọt qua (tên riêng không nhất quán, nhân xưng/giới tính sai, thuật ngữ dịch không đồng nhất, câu sót raw, đoạn lặp hoặc đăng nhầm). Hiện phải đọc lại thủ công từng chương để phát hiện. Người dùng: moderator/biên tập viên đang dùng app dịch thuật hiện tại. Luồng chính: moderator dán URL trang giới thiệu truyện trên Hako → hệ thống lấy danh sách chương công khai → moderator chọn tối đa 12 chương để rà soát → hệ thống trả về danh sách lỗi nghi ngờ, mỗi lỗi có mức độ nghiêm trọng, phân loại, đoạn trích làm bằng chứng và giải thích → moderator xác nhận, yêu cầu xem lại, hoặc bác bỏ từng lỗi. Quyết định phải được giữ lại khi rời và quay lại phiên làm việc. Tuỳ chọn nâng cao: với một chương, moderator có thể dán thêm văn bản gốc tiếng Trung (raw) để đối chiếu trực tiếp raw với bản dịch, giúp phát hiện thêm sai nghĩa/bỏ sót/dịch thừa thay vì chỉ đoán qua bản dịch. Moderator có thể sao chép báo cáo các lỗi đã xác nhận dưới dạng văn bản. Ràng buộc bắt buộc: Chỉ đọc nội dung công khai; không dùng cookie đăng nhập Hako, không có chức năng sửa hay đăng dữ liệu ngược lên Hako; Không thay đổi hành vi hoặc logic của luồng dịch thô/biên tập hiện có; Moderator KHÔNG phải tự nhập API key hay chọn model AI riêng cho tính năng này — dùng chung cấu hình API key/model mà hệ thống dịch thuật đang quản lý; Khi Hako tạm chặn do giới hạn tốc độ hoặc thử thách chống bot, phải báo rõ nguyên nhân và gợi ý chờ rồi thử lại, không báo lỗi chung chung; Mỗi lượt rà soát giới hạn số chương hợp lý để tránh timeout. Mục tiêu: moderator rà soát xong một đợt chương nhanh hơn nhiều so với đọc thủ công, mà không phải rời khỏi ứng dụng dịch thuật hiện tại."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tải thông tin truyện Hako và chọn đợt chương kiểm định (Priority: P1)

Là một moderator hoặc biên tập viên, tôi muốn dán đường dẫn (URL) trang giới thiệu một bộ truyện công khai trên Hako/Docln để hệ thống tự động tải về danh sách các tập và chương, cho phép tôi chọn tối đa 12 chương cần kiểm định chất lượng trong đợt làm việc này.

**Why this priority**: Đây là điểm khởi đầu thiết yếu cho toàn bộ quy trình kiểm định. Không thể thực hiện phân tích nếu không tải được mục lục công khai và chọn các chương cần kiểm tra.

**Independent Test**: Moderator nhập một URL truyện Hako công khai, bấm nút lấy thông tin; danh sách tập và chương xuất hiện đầy đủ; moderator có thể đánh dấu chọn từ 1 đến 12 chương và hệ thống ngăn chặn việc chọn quá 12 chương.

**Acceptance Scenarios**:

1. **Given** moderator đang ở khu vực kiểm định chất lượng, **When** dán một URL truyện Hako/Docln hợp lệ và kích hoạt tìm nạp, **Then** hệ thống hiển thị thông tin truyện (tên truyện, tác giả, họa sĩ) cùng danh sách tập và chương công khai được phân chia rõ ràng.
2. **Given** danh sách chương đã hiển thị, **When** moderator chọn các chương cần rà soát, **Then** số lượng chương đã chọn được cập nhật trực quan và nút bắt đầu rà soát được bật nếu số lượng chọn từ 1 đến 12.
3. **Given** moderator đã chọn đủ 12 chương, **When** cố gắng chọn thêm chương thứ 13, **Then** hệ thống không cho phép chọn thêm và hiển thị cảnh báo giới hạn tối đa 12 chương mỗi lượt.

---

### User Story 2 - Rà soát tự động và xử lý danh sách lỗi nghi ngờ (Priority: P1)

Là một moderator, tôi muốn hệ thống tự động phân tích nội dung tiếng Việt của các chương đã chọn để phát hiện các lỗi dịch thuật và biên tập phổ biến (tên riêng không nhất quán, nhân xưng/giới tính sai, thuật ngữ không đồng nhất, câu sót raw, đoạn lặp, đăng nhầm), đồng thời cho phép tôi xác nhận, yêu cầu xem lại hoặc bác bỏ từng lỗi, và lưu lại quyết định này bền vững.

**Why this priority**: Đây là giá trị cốt lõi của tính năng, giúp moderator giảm thiểu thời gian đọc thủ công từng chương, tập trung xử lý các điểm nghi vấn do AI chỉ điểm kèm bằng chứng cụ thể.

**Independent Test**: Sau khi chọn các chương, moderator nhấn bắt đầu rà soát; hệ thống hiển thị danh sách các lỗi nghi ngờ kèm phân loại, mức độ nghiêm trọng, đoạn trích bằng chứng và lời giải thích; moderator có thể đổi trạng thái từng lỗi và trạng thái này vẫn được lưu khi rời trang và quay lại.

**Acceptance Scenarios**:

1. **Given** danh sách chương đã chọn (1-12 chương), **When** moderator kích hoạt lệnh rà soát, **Then** hệ thống đọc nội dung công khai từng chương và trả về danh sách các lỗi nghi vấn được phân loại rõ ràng kèm mức độ nghiêm trọng (nghiêm trọng, trung bình, nhẹ, cảnh báo).
2. **Given** danh sách lỗi hiển thị, **When** moderator xem chi tiết một lỗi, **Then** hệ thống hiển thị vị trí chương, đoạn trích làm bằng chứng từ bản dịch và giải thích lý do nghi ngờ lỗi.
3. **Given** một lỗi trong danh sách, **When** moderator chọn "Xác nhận", "Yêu cầu xem lại", hoặc "Bác bỏ", **Then** trạng thái của lỗi được cập nhật ngay lập tức.
4. **Given** phiên làm việc đã có các quyết định của moderator, **When** moderator điều hướng sang mục khác của ứng dụng hoặc tải lại trang và quay lại, **Then** toàn bộ danh sách chương, các lỗi phát hiện và trạng thái xử lý của moderator được khôi phục nguyên vẹn.

---

### User Story 3 - Đối chiếu song ngữ chuyên sâu với văn bản gốc tiếng Trung (Priority: P2)

Là một moderator, tôi muốn có tùy chọn dán thêm văn bản raw tiếng Trung tương ứng cho một hoặc nhiều chương để hệ thống đối chiếu trực tiếp raw với bản dịch tiếng Việt, giúp phát hiện chính xác các lỗi sai nghĩa, bỏ sót đoạn hoặc dịch thừa.

**Why this priority**: Giúp nâng cao độ chính xác khi moderator muốn kiểm tra kỹ lưỡng các chương nghi ngờ có vấn đề dịch thuật phức tạp mà phân tích đơn ngữ tiếng Việt không đủ dữ kiện để khẳng định.

**Independent Test**: Tại một chương cụ thể trong phiên rà soát, moderator mở rộng mục nhập raw tiếng Trung, dán nội dung và chạy phân tích; hệ thống hiển thị các phát hiện đối chiếu song ngữ (lệch nghĩa, sót câu, thêm thắt).

**Acceptance Scenarios**:

1. **Given** một chương trong đợt rà soát, **When** moderator dán văn bản raw tiếng Trung vào ô nhập raw của chương đó, **Then** hệ thống ghi nhận văn bản gốc của chương.
2. **Given** chương có văn bản raw được cung cấp, **When** hệ thống thực hiện rà soát, **Then** kết quả kiểm định bổ sung các lỗi đối chiếu song ngữ (sai lệch ngữ nghĩa so với raw, câu/đoạn bị bỏ sót, nội dung dịch thêm không có trong raw) kèm đoạn raw đối ứng làm bằng chứng.

---

### User Story 4 - Xuất báo cáo kiểm định và tổng kết sai sót (Priority: P3)

Là một moderator, tôi muốn sao chép hoặc xuất báo cáo các lỗi đã xác nhận dưới dạng văn bản có cấu trúc để gửi phản hồi cho người dịch hoặc lưu trữ hồ sơ kiểm định.

**Why this priority**: Cung cấp công cụ chia sẻ kết quả nhanh chóng, kết nối quy trình kiểm định của moderator với người dịch/nhóm biên tập mà không cần nhập liệu thủ công lại từ đầu.

**Independent Test**: Moderator sau khi hoàn tất xem xét nhấn nút "Sao chép báo cáo", nội dung báo cáo dạng văn bản chuẩn được đưa vào clipboard với đầy đủ thông tin tóm tắt và danh sách lỗi đã xác nhận.

**Acceptance Scenarios**:

1. **Given** phiên làm việc có các lỗi đã được moderator xác nhận, **When** moderator chọn chức năng sao chép báo cáo, **Then** hệ thống sao chép một bản tóm tắt có định dạng rõ ràng (tên truyện, số chương kiểm tra, danh sách lỗi phân loại theo chương kèm trích dẫn và ghi chú) vào clipboard.
2. **Given** không có lỗi nào được xác nhận hoặc toàn bộ bị bác bỏ, **When** moderator xem báo cáo, **Then** hệ thống thông báo không có lỗi cần báo cáo hoặc hiển thị báo cáo đạt chuẩn chất lượng.

---

### Edge Cases

- **Hako chặn truy cập / Rate limit / Thử thách chống bot**: Khi hệ thống gặp phản hồi chặn truy cập từ Hako (mã 429, thử thách Cloudflare/bot challenge hoặc tạm khóa IP), hệ thống phải bắt lỗi chính xác, hiển thị thông báo rõ ràng bằng tiếng Việt giải thích nguyên nhân và gợi ý thời gian chờ trước khi thử lại, tuyệt đối không hiển thị lỗi máy chủ 500 chung chung.
- **URL không hợp lệ hoặc truyện bị xóa / chuyển sang chế độ riêng tư**: Hệ thống hiển thị thông báo lỗi rõ ràng về việc không tìm thấy truyện hoặc định dạng liên kết không được hỗ trợ.
- **Moderator vượt quá giới hạn 12 chương**: Giao diện vô hiệu hóa việc chọn thêm chương và cảnh báo trực tiếp về hạn mức tối đa 12 chương mỗi lượt rà soát để ngăn ngừa quá tải và timeout.
- **Chương có dung lượng quá dài hoặc nội dung chứa nhiều ký tự đặc biệt / ảnh minh họa**: Hệ thống lọc và trích xuất phần văn bản thuần, bỏ qua các thẻ ảnh/nhúng không liên quan để tiến hành rà soát ổn định.
- **Gián đoạn kết nối mạng trong lúc rà soát**: Tiến trình rà soát lưu lại kết quả của các chương đã xử lý xong trước đó và cho phép moderator tiếp tục rà soát các chương còn dang dở mà không phải phân tích lại từ đầu.
- **Văn bản raw dán vào bị lệch định dạng hoặc không tương thích**: Hệ thống thông báo nếu độ dài raw chênh lệch quá lớn so với bản dịch nhưng vẫn cố gắng đối chiếu tốt nhất theo từng đoạn văn bản.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI cho phép người dùng dán đường dẫn (URL) trang giới thiệu truyện công khai trên nền tảng Hako/Docln để tìm nạp thông tin truyện (tiêu đề, tác giả, họa sĩ) cùng danh sách toàn bộ các tập và chương khả dụng.
- **FR-002**: Hệ thống PHẢI cho phép người dùng chọn tối thiểu 1 chương và tối đa 12 chương công khai trong một đợt rà soát chất lượng.
- **FR-003**: Hệ thống PHẢI phân tích nội dung tiếng Việt của các chương đã chọn để tự động phát hiện các lỗi chất lượng bao gồm:
  - Tên riêng (nhân vật, địa danh, tổ chức) không nhất quán giữa các đoạn hoặc các chương.
  - Xưng hô, đại từ nhân xưng và giới tính nhân vật bị mâu thuẫn hoặc thay đổi bất thường.
  - Thuật ngữ dịch thuật không đồng nhất.
  - Câu hoặc đoạn còn sót lại văn bản raw/Hán Việt chưa dịch.
  - Đoạn văn bị lặp lại nhiều lần hoặc dấu hiệu đăng nhầm chương/trùng lặp nội dung.
- **FR-004**: Với mỗi lỗi được phát hiện, hệ thống PHẢI cung cấp đầy đủ: mã định danh lỗi, phân loại lỗi, mức độ nghiêm trọng (Nghiêm trọng / Trung bình / Nhẹ / Cảnh báo), vị trí chương, đoạn trích làm bằng chứng, và giải thích chi tiết lý do nghi ngờ.
- **FR-005**: Hệ thống PHẢI cho phép moderator thực hiện các quyết định đánh giá trên từng lỗi: "Xác nhận" (Confirm), "Yêu cầu xem lại" (Needs Review), hoặc "Bác bỏ / Bỏ qua" (Dismiss), kèm theo tùy chọn nhập ghi chú bổ sung của moderator.
- **FR-006**: Hệ thống PHẢI lưu trữ bền vững trạng thái phiên làm việc và các quyết định của moderator, đảm bảo khôi phục đầy đủ khi người dùng làm mới trang hoặc chuyển qua lại giữa các khu vực làm việc khác nhau trong ứng dụng.
- **FR-007**: Hệ thống PHẢI cung cấp tùy chọn cho phép moderator dán văn bản gốc tiếng Trung (raw) cho từng chương để thực hiện phân tích đối chiếu song ngữ sâu, phát hiện thêm các lỗi sai nghĩa, bỏ sót nội dung hoặc dịch thừa/bịa đặt nội dung.
- **FR-008**: Hệ thống PHẢI cung cấp tính năng sao chép hoặc xuất báo cáo tổng hợp các lỗi đã xác nhận ra định dạng văn bản có cấu trúc rõ ràng (hỗ trợ định dạng markdown/text để gửi trao đổi).
- **FR-009**: Hệ thống PHẢI tự động tái sử dụng cấu hình mô hình AI và cơ chế quản lý API key sẵn có của ứng dụng hiện tại mà KHÔNG yêu cầu moderator phải nhập lại khóa hoặc cấu hình tham số mô hình riêng.
- **FR-010**: Khi việc truy xuất nội dung từ Hako gặp sự cố bị giới hạn tốc độ (rate limit) hoặc cơ chế chống bot/Cloudflare ngăn cản, hệ thống PHẢI hiển thị thông báo chi tiết về lý do và gợi ý hành động chờ thử lại sau một khoảng thời gian nhất định, không báo lỗi không rõ nguyên nhân.
- **FR-011**: Hệ thống CHỈ thực hiện đọc nội dung công khai (read-only), TUYỆT ĐỐI KHÔNG lưu trữ hay sử dụng cookie/thông tin đăng nhập Hako của người dùng và KHÔNG cung cấp bất kỳ chức năng sửa đổi hay đẩy dữ liệu ngược lên Hako.
- **FR-012**: Khu vực làm việc của moderator PHẢI hoạt động hoàn toàn độc lập, KHÔNG làm biến đổi hay can thiệp vào luồng dịch 2 giai đoạn (dịch thô → biên tập ngữ cảnh) và cơ sở dữ liệu dự án dịch hiện tại.

### Key Entities *(include if feature involves data)*

- **QualityReviewSession (Phiên kiểm định chất lượng)**: Đại diện cho một phiên làm việc của moderator, gồm thông tin bộ truyện Hako, danh sách chương được chọn, thời gian khởi tạo, thời gian cập nhật lần cuối, trạng thái tổng thể và danh sách kết quả rà soát.
- **HakoNovelMeta (Thông tin truyện Hako)**: Chứa URL truyện, tiêu đề, tác giả, họa sĩ, tóm tắt, ảnh bìa (nếu có) và danh mục các tập/chương công khai kèm URL tương ứng.
- **HakoChapterReviewItem (Chương kiểm định)**: Đại diện cho một chương trong phiên rà soát, gồm số thứ tự, tên chương, tên tập, URL công khai, nội dung bản dịch tiếng Việt đã tải, nội dung văn bản raw tiếng Trung tùy chọn được người dùng cung cấp, trạng thái phân tích của chương.
- **QualityIssue (Lỗi chất lượng phát hiện)**: Đại diện cho một lỗi nghi ngờ được phát hiện, gồm mã định danh lỗi, mã chương liên kết, phân loại lỗi (tên riêng, xưng hô/giới tính, thuật ngữ, sót raw, trùng lặp, sai nghĩa, bỏ sót, dịch thừa), mức độ nghiêm trọng, đoạn trích tiếng Việt làm bằng chứng, đoạn trích raw đối ứng (nếu có), giải thích của hệ thống, trạng thái quyết định của moderator (Chờ xử lý / Đã xác nhận / Cần xem lại / Đã bác bỏ) và ghi chú của moderator.
- **QualityReport (Báo cáo chất lượng)**: Bản tổng hợp kết quả sau khi moderator hoàn tất đánh giá, gồm tóm tắt số liệu (tổng số lỗi theo mức độ, theo loại) và danh sách chi tiết các lỗi đã được xác nhận kèm ghi chú để xuất hoặc sao chép.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Moderator có thể hoàn tất việc nạp thông tin mục lục truyện từ URL Hako hợp lệ trong vòng dưới 5 giây trong điều kiện mạng bình thường.
- **SC-002**: Thời gian rà soát tự động cho đợt tối đa 12 chương hoàn thành trong vòng dưới 60 giây đối với phân tích bản dịch và dưới 90 giây khi có đối chiếu song ngữ với văn bản raw.
- **SC-003**: 100% các quyết định đánh giá lỗi (xác nhận, xem lại, bác bỏ) và ghi chú của moderator được bảo toàn nguyên vẹn sau khi tải lại trang hoặc điều hướng rời khỏi phiên làm việc.
- **SC-004**: Thao tác sao chép báo cáo lỗi đã duyệt vào clipboard hoàn thành chỉ với 1 lượt bấm và đảm bảo định dạng văn bản trực quan, dễ đọc.
- **SC-005**: 100% các tình huống bị hạn chế truy cập do cơ chế chống bot hoặc rate limit từ nền tảng nguồn đều hiển thị thông báo tường minh kèm hướng dẫn thời gian thử lại, không xuất hiện thông báo lỗi kỹ thuật mã nguồn hoặc lỗi không xác định.
- **SC-006**: Moderator giảm ít nhất 70% thời gian phát hiện và tổng hợp các lỗi biên tập cơ bản so với quy trình đọc rà soát thủ công từng chương.

## Assumptions

- Người dùng là moderator hoặc biên tập viên có quyền truy cập vào ứng dụng dịch thuật hiện tại.
- Ứng dụng đã có sẵn cấu hình API key và mô hình AI đang hoạt động ổn định trên hệ thống.
- Các chương truyện trên Hako được kiểm tra là các chương đã được xuất bản ở chế độ công khai (ai cũng có thể đọc mà không cần tài khoản VIP/đăng nhập).
- Nền tảng Hako/Docln duy trì cấu trúc trang công khai tương thích để lấy được tiêu đề, tập, chương và nội dung văn bản.
- Việc lưu trữ phiên kiểm định moderator được duy trì tại môi trường lưu trữ cục bộ của người dùng để đảm bảo quyền riêng tư và tốc độ truy cập tức thì.
